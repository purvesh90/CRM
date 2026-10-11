require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const telegramService = require('./telegram');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ------------------------------------------------------------
// REAL-TIME SERVER-SENT EVENTS (SSE) ENGINE
// ------------------------------------------------------------
const sseClients = new Set();
function broadcastSSE(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// ------------------------------------------------------------
// CENTRALIZED RBAC & AUTHORIZATION MIDDLEWARE
// ------------------------------------------------------------
function authenticateRequest(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId || 'user-admin';
  const user = db.getUserById(userId) || db.getUserByEmail(userId) || db.getUsers()[0];
  req.user = user;
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !db.hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: role '${req.user?.role || 'ANONYMOUS'}' lacks permission '${permission}'`
      });
    }
    next();
  };
}

function requireTicketAccess(req, res, next) {
  const ticketId = req.params.id;
  const ticket = db.getTicketById(ticketId);
  if (!ticket) {
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }

  // Security: Prevent ID enumeration / Unauthorized horizontal ticket access
  if (req.user && req.user.role === 'CUSTOMER') {
    const userEmail = (req.user.email || '').toLowerCase().trim();
    const custEmail = (ticket.customerEmail || '').toLowerCase().trim();
    if (ticket.customerId !== req.user.id && custEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are only authorized to access your own customer tickets.'
      });
    }
  }
  req.ticket = ticket;
  next();
}

// ------------------------------------------------------------
// AUTHENTICATION & ROLE MANAGEMENT API
// ------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password, userId } = req.body;
  const user = db.authenticate({ email, password, userId });
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials. Please verify your email and password.' });
  }
  const token = 'pd_token_' + Buffer.from(user.id + ':' + Date.now()).toString('base64');
  res.json({ success: true, user, token });
});

app.get('/api/auth/me', authenticateRequest, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.get('/api/auth/roles', (req, res) => {
  res.json({ success: true, users: db.getUsers() });
});

// ------------------------------------------------------------
// TICKETS API (RBAC & State-Machine Guarded)
// ------------------------------------------------------------
app.get('/api/tickets', authenticateRequest, (req, res) => {
  const { status, priority, channel, search, department, assignedTo } = req.query;
  const tickets = db.getTickets({
    status,
    priority,
    channel,
    search,
    department,
    assignedTo,
    user: req.user
  });
  res.json({ success: true, count: tickets.length, tickets });
});

app.get('/api/tickets/:id', authenticateRequest, requireTicketAccess, (req, res) => {
  res.json({ success: true, ticket: req.ticket });
});

app.post('/api/tickets', authenticateRequest, requirePermission('ticket.create'), (req, res) => {
  const { title, description, customerName, customerEmail, priority, department, channel, company, attachments, tags } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  const isCustomer = req.user.role === 'CUSTOMER';
  const newTicket = db.createTicket({
    title,
    description: description || title,
    customerName: isCustomer ? req.user.name : (customerName || req.user.name),
    customerEmail: isCustomer ? req.user.email : (customerEmail || req.user.email),
    priority: priority || 'MEDIUM',
    department: department || 'Technical Support',
    channel: isCustomer ? 'WEB_PORTAL' : (channel || 'CRM_ADMIN'),
    company: company || (isCustomer ? 'Client Organization' : 'Independent'),
    attachments: attachments || [],
    tags: tags || []
  }, req.user);

  broadcastSSE('ticket_created', newTicket);
  res.status(201).json({ success: true, ticket: newTicket });
});

app.patch('/api/tickets/:id', authenticateRequest, requireTicketAccess, (req, res) => {
  try {
    const prevStatus = req.ticket.status;
    const updated = db.updateTicket(req.params.id, req.body, req.user);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    // Push notification to Telegram on status change (e.g. RESOLVED / CLOSED)
    if (req.body.status && req.body.status !== prevStatus) {
      telegramService.sendStatusChangeNotification(updated, req.body.status, req.user.name);
    }

    broadcastSSE('ticket_updated', updated);
    res.json({ success: true, ticket: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Soft Delete endpoint (Preserves audit history)
app.delete('/api/tickets/:id', authenticateRequest, requirePermission('ticket.soft_delete'), (req, res) => {
  const deleted = db.softDeleteTicket(req.params.id, req.user);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }
  broadcastSSE('ticket_deleted', { id: req.params.id });
  res.json({ success: true, deleted, message: 'Ticket soft-deleted and archived to audit log.' });
});

// Messages and Internal Notes
app.post('/api/tickets/:id/messages', authenticateRequest, requireTicketAccess, async (req, res) => {
  const { text, isInternal, channel, attachments } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, error: 'Message text is required' });
  }

  // Enforce internal note permissions: Customers cannot create or view internal notes
  if (isInternal && !db.hasPermission(req.user.role, 'ticket.internal_note')) {
    return res.status(403).json({ success: false, error: 'Forbidden: Customers cannot author internal notes' });
  }

  const sender = req.user.role === 'CUSTOMER' ? 'CUSTOMER' : 'AGENT';
  const senderName = req.user.name;

  const result = db.addMessageToTicket(req.params.id, {
    text,
    sender,
    senderName,
    isInternal: !!isInternal,
    channel: channel || (sender === 'AGENT' ? 'CRM_ADMIN' : 'WEB_PORTAL'),
    attachments: attachments || []
  }, req.user);

  if (!result) {
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }

  const { ticket, message } = result;

  // Dispatch public Agent replies to Telegram if ticket originated from Telegram
  let telegramDispatched = false;
  if (sender === 'AGENT' && !isInternal && ticket.telegramChatId) {
    try {
      const tgRes = await telegramService.sendAgentReply(ticket, text, senderName);
      telegramDispatched = tgRes.ok;
    } catch (err) {
      console.warn('Failed to forward reply to Telegram:', err.message);
    }
  }

  broadcastSSE('ticket_message', { ticketId: ticket.id, message, ticketStatus: ticket.status });
  res.json({ success: true, message, ticket, telegramDispatched });
});

// Customer Satisfaction (CSAT) Rating
app.post('/api/tickets/:id/csat', authenticateRequest, requireTicketAccess, (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: 'Rating must be an integer between 1 and 5' });
  }

  const updated = db.rateTicketCSAT(req.params.id, rating, comment);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }
  broadcastSSE('ticket_updated', updated);
  res.json({ success: true, ticket: updated, message: 'Thank you for your rating!' });
});

// ------------------------------------------------------------
// CUSTOMERS & AGENTS DIRECTORY
// ------------------------------------------------------------
app.get('/api/customers', authenticateRequest, (req, res) => {
  res.json({ success: true, customers: db.getCustomers() });
});

app.get('/api/agents', authenticateRequest, (req, res) => {
  res.json({ success: true, agents: db.getAgents() });
});

// ------------------------------------------------------------
// ADVANCED EXECUTIVE & AGENT-TAILORED ANALYTICS
// ------------------------------------------------------------
app.get('/api/analytics', authenticateRequest, (req, res) => {
  res.json({ success: true, analytics: db.getAnalytics(req.user) });
});

// ------------------------------------------------------------
// SETTINGS API
// ------------------------------------------------------------
app.get('/api/settings', authenticateRequest, (req, res) => {
  const settings = db.getSettings();
  const safeSettings = { ...settings };
  delete safeSettings.telegramBotToken;
  delete safeSettings.telegramBotUsername;
  res.json({
    success: true,
    settings: {
      ...safeSettings,
      telegramConfigured: !!settings.telegramBotToken
    }
  });
});

app.post('/api/settings', authenticateRequest, requirePermission('settings.manage'), (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

// ------------------------------------------------------------
// TELEGRAM INTEGRATION & ONE-TIME TOKEN LINKING
// ------------------------------------------------------------
app.get('/api/telegram/status', (req, res) => {
  res.json({ success: true, status: telegramService.getStatus() });
});

app.post('/api/telegram/token', authenticateRequest, requirePermission('settings.manage'), async (req, res) => {
  const { token } = req.body;
  const result = await telegramService.setToken(token);
  res.json(result);
});

app.get('/api/telegram/logs', (req, res) => {
  res.json({ success: true, logs: db.getTelegramLogs() });
});

// One-time Telegram Token generator for secure customer account linking
app.post('/api/telegram/link-token', authenticateRequest, (req, res) => {
  const customerId = req.user.role === 'CUSTOMER' ? req.user.id : (req.body.customerId || 'cust-101');
  const token = db.generateTelegramLinkToken(customerId);
  const botUsername = db.getSettings().telegramBotUsername || 'mycrm_sales1_bot';
  const linkUrl = `https://t.me/${botUsername}?start=${token}`;
  res.json({ success: true, token, linkUrl });
});

// Web simulator for Telegram interactions
app.post('/api/telegram/simulate', async (req, res) => {
  const { chatId, username, fullName, text } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, error: 'Text is required for simulation' });
  }

  const result = await telegramService.simulateInboundMessage({
    chatId: chatId || '89123456',
    username: username || 'telegram_user',
    fullName: fullName || 'Telegram Customer',
    text
  });

  broadcastSSE('telegram_activity', { text, username });
  res.json({ success: true, result });
});

// Production Webhook receiver
app.post('/api/telegram/webhook', async (req, res) => {
  if (req.body && req.body.message) {
    await telegramService.handleIncomingMessage(req.body.message);
  }
  res.sendStatus(200);
});

// SPA Fallback for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 PulseDesk CRM Server running on http://localhost:${PORT}`);
  console.log(`📡 Realtime SSE streaming enabled on /api/events`);
  console.log(`🤖 Telegram Bot Status: ${telegramService.token ? 'Configured' : 'Awaiting Token'}`);
  console.log(`===============================================`);
});
