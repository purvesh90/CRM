const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'crm.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Seed Data
const initialData = {
  settings: {
    companyName: 'PulseDesk Omnichannel CRM',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramBotUsername: '',
    telegramEnabled: true,
    autoAssign: true,
    welcomeMessage: '👋 Welcome to PulseDesk Support! Please describe your issue or type /ticket <your question> to create a support ticket.'
  },
  agents: [
    {
      id: 'agent-1',
      name: 'Sarah Connor',
      role: 'Super Admin',
      email: 'sarah.connor@pulsedesk.io',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      activeTickets: 2
    },
    {
      id: 'agent-2',
      name: 'David Vance',
      role: 'Senior DevOps Specialist',
      email: 'david.v@pulsedesk.io',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      activeTickets: 2
    },
    {
      id: 'agent-3',
      name: 'Elena Rostova',
      role: 'Billing & Account Specialist',
      email: 'elena.r@pulsedesk.io',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      activeTickets: 1
    }
  ],
  customers: [
    {
      id: 'cust-101',
      name: 'Liam Gallagher',
      email: 'liam@oasis-tech.com',
      company: 'Oasis Tech Global',
      telegramUsername: 'liam_gallagher_tech',
      telegramChatId: '89123456',
      status: 'VIP',
      totalTickets: 3,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
    },
    {
      id: 'cust-102',
      name: 'Sophia Martinez',
      email: 'sophia.m@fintechflow.io',
      company: 'FinTech Flow',
      telegramUsername: 'sophiam_fintech',
      telegramChatId: '76239102',
      status: 'ACTIVE',
      totalTickets: 2,
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
    },
    {
      id: 'cust-103',
      name: 'Marcus Brody',
      email: 'm.brody@cybervault.net',
      company: 'CyberVault Corp',
      telegramUsername: 'brody_cyber',
      telegramChatId: '65431980',
      status: 'ACTIVE',
      totalTickets: 1,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
      id: 'cust-104',
      name: 'Aisha Al-Mansoor',
      email: 'aisha@zenithcloud.org',
      company: 'Zenith Cloud Labs',
      telegramUsername: 'aisha_cloud',
      telegramChatId: '98451230',
      status: 'VIP',
      totalTickets: 2,
      createdAt: new Date(Date.now() - 45 * 86400000).toISOString()
    }
  ],
  tickets: [
    {
      id: 'PD-1001',
      title: 'Production webhook endpoint 504 gateway timeout',
      description: 'Our payment processing webhooks failed 12 times in the last 40 minutes due to 504 timeouts on the cluster proxy.',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      department: 'Technical Support',
      channel: 'TELEGRAM',
      customerId: 'cust-101',
      customerName: 'Liam Gallagher',
      customerEmail: 'liam@oasis-tech.com',
      telegramChatId: '89123456',
      telegramUsername: 'liam_gallagher_tech',
      assignedTo: 'David Vance',
      tags: ['Production', 'Webhook', 'Timeout'],
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 25 * 60000).toISOString(),
      resolvedAt: null,
      messages: [
        {
          id: 'msg-1',
          sender: 'CUSTOMER',
          senderName: 'Liam Gallagher (Telegram)',
          text: 'Emergency: our production webhook endpoint is receiving 504 Gateway Timeout intermittently!',
          isInternal: false,
          timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
          channel: 'TELEGRAM'
        },
        {
          id: 'msg-2',
          sender: 'AGENT',
          senderName: 'David Vance',
          text: 'Hi Liam, investigating the ingress proxy logs right away. Checking for bottlenecked upstream workers.',
          isInternal: false,
          timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
          channel: 'TELEGRAM'
        },
        {
          id: 'msg-3',
          sender: 'AGENT',
          senderName: 'David Vance',
          text: 'Internal Note: Worker pool capacity hit 100% due to an unindexed query on payload table. Deploying index fix.',
          isInternal: true,
          timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
          channel: 'INTERNAL'
        },
        {
          id: 'msg-4',
          sender: 'AGENT',
          senderName: 'David Vance',
          text: 'Index deployed and proxy pods scaled to 6 replicas. Latency dropped to 48ms. Could you verify on your staging/prod?',
          isInternal: false,
          timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
          channel: 'TELEGRAM'
        }
      ]
    },
    {
      id: 'PD-1002',
      title: 'Annual Enterprise Plan Renewal & Invoice VAT Update',
      description: 'We need to update our corporate VAT ID before generating the enterprise annual license renewal invoice.',
      status: 'OPEN',
      priority: 'HIGH',
      department: 'Billing',
      channel: 'TELEGRAM',
      customerId: 'cust-102',
      customerName: 'Sophia Martinez',
      customerEmail: 'sophia.m@fintechflow.io',
      telegramChatId: '76239102',
      telegramUsername: 'sophiam_fintech',
      assignedTo: 'Elena Rostova',
      tags: ['Billing', 'Enterprise', 'VAT'],
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      resolvedAt: null,
      messages: [
        {
          id: 'msg-101',
          sender: 'CUSTOMER',
          senderName: 'Sophia Martinez (Telegram)',
          text: 'Hello support, we are ready for the annual contract renewal, but our legal entity VAT number changed. Can someone apply the new certificate before billing?',
          isInternal: false,
          timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
          channel: 'TELEGRAM'
        }
      ]
    },
    {
      id: 'PD-1003',
      title: 'OAuth 2.0 PKCE Authorization flow token expiration glitch',
      description: 'Users on iOS app are getting logged out when refreshing refresh-token with custom scopes.',
      status: 'WAITING_CUSTOMER',
      priority: 'MEDIUM',
      department: 'Technical Support',
      channel: 'WEB_PORTAL',
      customerId: 'cust-103',
      customerName: 'Marcus Brody',
      customerEmail: 'm.brody@cybervault.net',
      telegramChatId: '65431980',
      telegramUsername: 'brody_cyber',
      assignedTo: 'Sarah Connor',
      tags: ['Auth', 'OAuth', 'iOS'],
      createdAt: new Date(Date.now() - 14 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      resolvedAt: null,
      messages: [
        {
          id: 'msg-201',
          sender: 'CUSTOMER',
          senderName: 'Marcus Brody',
          text: 'We are observing token rejection when iOS mobile users refresh tokens after background suspension.',
          isInternal: false,
          timestamp: new Date(Date.now() - 14 * 3600000).toISOString(),
          channel: 'WEB_PORTAL'
        },
        {
          id: 'msg-202',
          sender: 'AGENT',
          senderName: 'Sarah Connor',
          text: 'Hi Marcus! We tested the PKCE challenge verification. Can you send the exact iOS SDK build version and sample auth header?',
          isInternal: false,
          timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
          channel: 'WEB_PORTAL'
        }
      ]
    },
    {
      id: 'PD-1004',
      title: 'Request custom SLA metrics export in CSV and PDF',
      description: 'We need monthly aggregated uptime and response SLA reports for executive committee audit.',
      status: 'RESOLVED',
      priority: 'LOW',
      department: 'Product',
      channel: 'WEB_PORTAL',
      customerId: 'cust-104',
      customerName: 'Aisha Al-Mansoor',
      customerEmail: 'aisha@zenithcloud.org',
      telegramChatId: '98451230',
      telegramUsername: 'aisha_cloud',
      assignedTo: 'Sarah Connor',
      tags: ['Reporting', 'Audit', 'SLA'],
      createdAt: new Date(Date.now() - 28 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      resolvedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      messages: [
        {
          id: 'msg-301',
          sender: 'CUSTOMER',
          senderName: 'Aisha Al-Mansoor',
          text: 'Is there a way to auto-export our monthly SLA uptime report in PDF format for ISO 27001 audit?',
          isInternal: false,
          timestamp: new Date(Date.now() - 28 * 3600000).toISOString(),
          channel: 'WEB_PORTAL'
        },
        {
          id: 'msg-302',
          sender: 'AGENT',
          senderName: 'Sarah Connor',
          text: 'Hi Aisha! Yes, we have enabled the automated Executive Audit Exporter in your Analytics tab. You can now download both CSV and signed PDF reports anytime!',
          isInternal: false,
          timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
          channel: 'WEB_PORTAL'
        }
      ]
    },
    {
      id: 'PD-1005',
      title: 'Automated data pipeline schema migration failure',
      description: 'Database migration script failed during column type casting on customer telemetry table.',
      status: 'CLOSED',
      priority: 'HIGH',
      department: 'Technical Support',
      channel: 'TELEGRAM',
      customerId: 'cust-101',
      customerName: 'Liam Gallagher',
      customerEmail: 'liam@oasis-tech.com',
      telegramChatId: '89123456',
      telegramUsername: 'liam_gallagher_tech',
      assignedTo: 'David Vance',
      tags: ['Database', 'Migration', 'Telemetry'],
      createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 20 * 3600000).toISOString(),
      resolvedAt: new Date(Date.now() - 22 * 3600000).toISOString(),
      messages: [
        {
          id: 'msg-401',
          sender: 'CUSTOMER',
          senderName: 'Liam Gallagher',
          text: 'Schema migration aborted midway. Need rollback support.',
          isInternal: false,
          timestamp: new Date(Date.now() - 72 * 3600000).toISOString(),
          channel: 'TELEGRAM'
        },
        {
          id: 'msg-402',
          sender: 'AGENT',
          senderName: 'David Vance',
          text: 'Rollback snapshot restored successfully. Script revised with non-locking ALTER TABLE syntax.',
          isInternal: false,
          timestamp: new Date(Date.now() - 22 * 3600000).toISOString(),
          channel: 'TELEGRAM'
        }
      ]
    }
  ],
  telegramLogs: [
    {
      id: 'tlog-1',
      type: 'INBOUND',
      from: 'liam_gallagher_tech (89123456)',
      text: 'Emergency: our production webhook endpoint is receiving 504 Gateway Timeout intermittently!',
      ticketId: 'PD-1001',
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString()
    },
    {
      id: 'tlog-2',
      type: 'OUTBOUND',
      to: '89123456',
      text: '[Ticket PD-1001] Agent David Vance: Hi Liam, investigating the ingress proxy logs right away...',
      ticketId: 'PD-1001',
      timestamp: new Date(Date.now() - 90 * 60000).toISOString()
    }
  ]
};

class Database {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading CRM database file, resetting to defaults:', err.message);
    }
    this.save(initialData);
    return JSON.parse(JSON.stringify(initialData));
  }

  save(data = this.data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving CRM database:', err.message);
    }
  }

  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }

  getAgents() {
    return this.data.agents;
  }

  getCustomers() {
    return this.data.customers;
  }

  findOrCreateCustomer({ name, email, telegramUsername, telegramChatId, company }) {
    let customer = null;
    if (telegramChatId) {
      customer = this.data.customers.find(c => c.telegramChatId === String(telegramChatId));
    }
    if (!customer && email) {
      customer = this.data.customers.find(c => c.email.toLowerCase() === email.toLowerCase());
    }

    if (!customer) {
      customer = {
        id: 'cust-' + (Date.now().toString(36) + Math.random().toString(36).substr(2, 4)),
        name: name || (telegramUsername ? `@${telegramUsername}` : 'Anonymous Customer'),
        email: email || `${telegramUsername || 'telegram_' + telegramChatId}@telegram.user`,
        company: company || 'Self-Employed / Independent',
        telegramUsername: telegramUsername || '',
        telegramChatId: telegramChatId ? String(telegramChatId) : '',
        status: 'ACTIVE',
        totalTickets: 1,
        createdAt: new Date().toISOString()
      };
      this.data.customers.push(customer);
    } else {
      customer.totalTickets = (customer.totalTickets || 0) + 1;
      if (telegramChatId && !customer.telegramChatId) customer.telegramChatId = String(telegramChatId);
      if (telegramUsername && !customer.telegramUsername) customer.telegramUsername = telegramUsername;
    }
    this.save();
    return customer;
  }

  getTickets(filters = {}) {
    let list = [...this.data.tickets];
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(t => t.status === filters.status);
    }
    if (filters.priority && filters.priority !== 'ALL') {
      list = list.filter(t => t.priority === filters.priority);
    }
    if (filters.channel && filters.channel !== 'ALL') {
      list = list.filter(t => t.channel === filters.channel);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(t =>
        t.id.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        t.customerEmail.toLowerCase().includes(q) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }
    // Sort descending by updated / created
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return list;
  }

  getTicketById(id) {
    return this.data.tickets.find(t => t.id === id);
  }

  generateTicketId() {
    const numbers = this.data.tickets
      .map(t => parseInt(t.id.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const nextNum = (numbers.length > 0 ? Math.max(...numbers) : 1000) + 1;
    return `PD-${nextNum}`;
  }

  createTicket(ticketData) {
    const id = this.generateTicketId();
    const customer = this.findOrCreateCustomer({
      name: ticketData.customerName,
      email: ticketData.customerEmail,
      telegramUsername: ticketData.telegramUsername,
      telegramChatId: ticketData.telegramChatId,
      company: ticketData.company
    });

    // Auto-assign to an agent if not specified
    let assignedTo = ticketData.assignedTo;
    if (!assignedTo && this.data.agents.length > 0) {
      // Pick agent with least active tickets
      const sortedAgents = [...this.data.agents].sort((a, b) => a.activeTickets - b.activeTickets);
      assignedTo = sortedAgents[0].name;
      sortedAgents[0].activeTickets++;
    }

    const newTicket = {
      id,
      title: ticketData.title || 'Support Request via ' + (ticketData.channel || 'Web Portal'),
      description: ticketData.description || '',
      status: ticketData.status || 'OPEN',
      priority: ticketData.priority || 'MEDIUM',
      department: ticketData.department || 'Technical Support',
      channel: ticketData.channel || 'WEB_PORTAL',
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      telegramChatId: customer.telegramChatId || '',
      telegramUsername: customer.telegramUsername || '',
      assignedTo: assignedTo || 'Unassigned',
      tags: ticketData.tags || ['General'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
      messages: [
        {
          id: 'msg-' + Date.now(),
          sender: 'CUSTOMER',
          senderName: customer.name + (ticketData.channel === 'TELEGRAM' ? ' (Telegram)' : ''),
          text: ticketData.description || ticketData.title,
          isInternal: false,
          timestamp: new Date().toISOString(),
          channel: ticketData.channel || 'WEB_PORTAL'
        }
      ]
    };

    this.data.tickets.unshift(newTicket);
    this.save();
    return newTicket;
  }

  updateTicket(id, updates) {
    const ticket = this.getTicketById(id);
    if (!ticket) return null;

    // Handle status change metrics
    if (updates.status && updates.status !== ticket.status) {
      if (updates.status === 'RESOLVED' && !ticket.resolvedAt) {
        updates.resolvedAt = new Date().toISOString();
      } else if (updates.status !== 'RESOLVED' && updates.status !== 'CLOSED') {
        updates.resolvedAt = null;
      }
    }

    Object.assign(ticket, updates);
    ticket.updatedAt = new Date().toISOString();
    this.save();
    return ticket;
  }

  addMessageToTicket(id, messageData) {
    const ticket = this.getTicketById(id);
    if (!ticket) return null;

    const message = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      sender: messageData.sender || 'AGENT',
      senderName: messageData.senderName || 'PulseDesk Admin',
      text: messageData.text,
      isInternal: !!messageData.isInternal,
      timestamp: new Date().toISOString(),
      channel: messageData.channel || (messageData.sender === 'AGENT' ? 'CRM_ADMIN' : ticket.channel)
    };

    if (!ticket.messages) ticket.messages = [];
    ticket.messages.push(message);

    // If agent replied to customer, move from OPEN to IN_PROGRESS or WAITING_CUSTOMER
    if (message.sender === 'AGENT' && !message.isInternal) {
      if (ticket.status === 'OPEN') {
        ticket.status = 'IN_PROGRESS';
      }
    } else if (message.sender === 'CUSTOMER') {
      if (ticket.status === 'WAITING_CUSTOMER') {
        ticket.status = 'IN_PROGRESS';
      }
    }

    ticket.updatedAt = new Date().toISOString();
    this.save();
    return { ticket, message };
  }

  deleteTicket(id) {
    const idx = this.data.tickets.findIndex(t => t.id === id);
    if (idx !== -1) {
      const removed = this.data.tickets.splice(idx, 1)[0];
      this.save();
      return removed;
    }
    return null;
  }

  addTelegramLog(log) {
    const item = {
      id: 'tlog-' + Date.now(),
      timestamp: new Date().toISOString(),
      ...log
    };
    if (!this.data.telegramLogs) this.data.telegramLogs = [];
    this.data.telegramLogs.unshift(item);
    if (this.data.telegramLogs.length > 100) {
      this.data.telegramLogs = this.data.telegramLogs.slice(0, 100);
    }
    this.save();
    return item;
  }

  getTelegramLogs() {
    return this.data.telegramLogs || [];
  }

  getAnalytics() {
    const tickets = this.data.tickets;
    const total = tickets.length;
    const open = tickets.filter(t => t.status === 'OPEN').length;
    const inProgress = tickets.filter(t => t.status === 'IN_PROGRESS').length;
    const waiting = tickets.filter(t => t.status === 'WAITING_CUSTOMER').length;
    const resolved = tickets.filter(t => t.status === 'RESOLVED').length;
    const closed = tickets.filter(t => t.status === 'CLOSED').length;

    const urgent = tickets.filter(t => t.priority === 'URGENT').length;
    const high = tickets.filter(t => t.priority === 'HIGH').length;
    const medium = tickets.filter(t => t.priority === 'MEDIUM').length;
    const low = tickets.filter(t => t.priority === 'LOW').length;

    const telegramCount = tickets.filter(t => t.channel === 'TELEGRAM').length;
    const webCount = tickets.filter(t => t.channel === 'WEB_PORTAL').length;

    // Calculate avg resolution time in hours
    const resolvedTickets = tickets.filter(t => t.resolvedAt);
    let avgResolutionHours = 2.4; // default baseline
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((acc, t) => {
        const diffMs = new Date(t.resolvedAt) - new Date(t.createdAt);
        return acc + Math.max(0.2, diffMs / (1000 * 60 * 60));
      }, 0);
      avgResolutionHours = (totalHours / resolvedTickets.length).toFixed(1);
    }

    // Departments breakdown
    const deptCounts = {};
    tickets.forEach(t => {
      deptCounts[t.department] = (deptCounts[t.department] || 0) + 1;
    });

    return {
      total,
      open,
      inProgress,
      waiting,
      resolved,
      closed,
      urgent,
      high,
      medium,
      low,
      telegramCount,
      webCount,
      avgResolutionHours,
      csatScore: '98.4%',
      slaBreachRate: '1.2%',
      departments: deptCounts,
      customersCount: this.data.customers.length
    };
  }
}

const db = new Database();
module.exports = db;
