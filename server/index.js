require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const telegramService = require('./telegram');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple in-memory SSE clients list for real-time pushes
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

// SSE stream endpoint
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

// --- TICKETS API ---
app.get('/api/tickets', (req, res) => {
  const { status, priority, channel, search } = req.query;
  const tickets = db.getTickets({ status, priority, channel, search });
  res.json({ success: true, count: tickets.length, tickets });
});

app.get('/api/tickets/:id', (req, res) => {
  const ticket = db.getTicketById(req.params.id);
  if (!ticket) {
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }
  res.json({ success: true, ticket });
});

app.post('/api/tickets', (req, res) => {
  const { title, description, customerName, customerEmail, priority, department, channel, company } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  const newTicket = db.createTicket({
    title,
    description: description || title,
    customerName: customerName || 'Web Customer',
    customerEmail: customerEmail || 'guest@example.com',
    priority: priority || 'MEDIUM',
    department: department || 'Technical Support',
    channel: channel || 'WEB_PORTAL',
    company
  });

  broadcastSSE('ticket_created', newTicket);
  res.status(201).json({ success: true, ticket: newTicket });
});

app.patch('/api/tickets/:id', (req, res) => {
  const updated = db.updateTicket(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }
  broadcastSSE('ticket_updated', updated);
  res.json({ success: true, ticket: updated });
});

app.delete('/api/tickets/:id', (req, res) => {
  const deleted = db.deleteTicket(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }
  broadcastSSE('ticket_deleted', { id: req.params.id });
  res.json({ success: true, deleted });
});

app.post('/api/tickets/:id/messages', async (req, res) => {
  const { text, sender, senderName, isInternal, channel } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, error: 'Message text is required' });
  }

  const result = db.addMessageToTicket(req.params.id, {
    text,
    sender: sender || 'AGENT',
    senderName: senderName || 'Admin Agent',
    isInternal: !!isInternal,
    channel: channel || 'CRM_ADMIN'
  });

  if (!result) {
    return res.status(404).json({ success: false, error: 'Ticket not found' });
  }

  const { ticket, message } = result;

  // If this was an Agent replying (and not an internal note), dispatch to Telegram if ticket originated/has Telegram ID
  let telegramDispatched = false;
  if (sender === 'AGENT' && !isInternal && ticket.telegramChatId) {
    try {
      const tgRes = await telegramService.sendAgentReply(ticket, text, senderName || 'PulseDesk Agent');
      telegramDispatched = tgRes.ok;
    } catch (err) {
      console.warn('Failed to forward reply to Telegram:', err.message);
    }
  }

  broadcastSSE('ticket_message', { ticketId: ticket.id, message, ticketStatus: ticket.status });
  res.json({ success: true, message, ticket, telegramDispatched });
});

// --- CUSTOMERS & AGENTS ---
app.get('/api/customers', (req, res) => {
  res.json({ success: true, customers: db.getCustomers() });
});

app.get('/api/agents', (req, res) => {
  res.json({ success: true, agents: db.getAgents() });
});

// --- ANALYTICS ---
app.get('/api/analytics', (req, res) => {
  res.json({ success: true, analytics: db.getAnalytics() });
});

// --- SETTINGS (Secured) ---
app.get('/api/settings', (req, res) => {
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

app.post('/api/settings', (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

// --- TELEGRAM INTEGRATION APIS ---
app.get('/api/telegram/status', (req, res) => {
  res.json({ success: true, status: telegramService.getStatus() });
});

app.post('/api/telegram/token', async (req, res) => {
  const { token } = req.body;
  const result = await telegramService.setToken(token);
  res.json(result);
});

app.get('/api/telegram/logs', (req, res) => {
  res.json({ success: true, logs: db.getTelegramLogs() });
});

// Telegram Simulator Endpoint (Test live Telegram flows directly from the web app)
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

// Webhook receiver (if user hosts with public HTTPS domain)
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
