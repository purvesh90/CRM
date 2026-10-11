const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'crm.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ------------------------------------------------------------
// 1. FORMAL RBAC PERMISSIONS TABLE
// ------------------------------------------------------------
const PERMISSIONS = {
  SUPER_ADMIN: [
    'ticket.view_all',
    'ticket.create',
    'ticket.assign',
    'ticket.change_status',
    'ticket.open',
    'ticket.resolve',
    'ticket.close',
    'ticket.reopen',
    'ticket.override_status',
    'ticket.reply',
    'ticket.internal_note',
    'ticket.soft_delete',
    'ticket.escalate',
    'customer.view',
    'customer.manage',
    'analytics.view_team',
    'analytics.view_own',
    'settings.manage'
  ],
  SUPPORT_AGENT: [
    'ticket.view_team',
    'ticket.create',
    'ticket.assign',
    'ticket.change_status',
    'ticket.open',
    'ticket.resolve',
    'ticket.close',
    'ticket.reopen',
    'ticket.reply',
    'ticket.internal_note',
    'ticket.escalate',
    'customer.view',
    'analytics.view_own'
  ],
  BILLING_SPECIALIST: [
    'ticket.view_team',
    'ticket.create',
    'ticket.change_status',
    'ticket.open',
    'ticket.resolve',
    'ticket.close',
    'ticket.reopen',
    'ticket.reply',
    'ticket.internal_note',
    'customer.view',
    'analytics.view_own'
  ],
  CUSTOMER: [
    'ticket.view_own',
    'ticket.create',
    'ticket.reply',
    'ticket.rate_csat'
  ]
};

// ------------------------------------------------------------
// 2. TICKET LIFECYCLE STATE MACHINE
// ------------------------------------------------------------
const STATE_TRANSITIONS = {
  NEW: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
  OPEN: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
  WAITING_CUSTOMER: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'CLOSED', 'REOPENED'],
  CLOSED: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'],
  REOPENED: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']
};

// ------------------------------------------------------------
// 3. SLA CONFIGURATION (Hours)
// ------------------------------------------------------------
const SLA_CONFIG = {
  URGENT: { firstResponseHours: 0.5, resolutionHours: 4 },
  HIGH: { firstResponseHours: 2, resolutionHours: 8 },
  MEDIUM: { firstResponseHours: 4, resolutionHours: 24 },
  LOW: { firstResponseHours: 8, resolutionHours: 48 }
};

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
  telegramLinkTokens: {}, // token -> { customerId, createdAt, expiresAt }
  users: [
    {
      id: 'user-admin',
      name: 'Sarah Connor',
      email: 'admin@pulsedesk.io',
      password: 'admin',
      role: 'SUPER_ADMIN',
      roleLabel: 'Super Admin',
      department: 'Executive Operations',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      permissions: PERMISSIONS.SUPER_ADMIN
    },
    {
      id: 'user-agent',
      name: 'David Vance',
      email: 'agent@pulsedesk.io',
      password: 'agent',
      role: 'SUPPORT_AGENT',
      roleLabel: 'Support Specialist',
      department: 'Technical Support',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      permissions: PERMISSIONS.SUPPORT_AGENT
    },
    {
      id: 'user-billing',
      name: 'Elena Rostova',
      email: 'billing@pulsedesk.io',
      password: 'billing',
      role: 'BILLING_SPECIALIST',
      roleLabel: 'Billing Specialist',
      department: 'Billing & Accounting',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      permissions: PERMISSIONS.BILLING_SPECIALIST
    },
    {
      id: 'user-customer',
      name: 'Liam Gallagher',
      email: 'liam@oasis-tech.com',
      password: 'customer',
      role: 'CUSTOMER',
      roleLabel: 'Enterprise Client',
      department: 'Client Portal',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      permissions: PERMISSIONS.CUSTOMER
    }
  ],
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
      activeTickets: 2
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
      firstResponseAt: new Date(Date.now() - 90 * 60000).toISOString(),
      resolvedAt: null,
      deletedAt: null,
      csatRating: null,
      csatComment: null,
      isEscalated: false,
      attachments: [],
      auditLog: [
        {
          id: 'aud-1',
          timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
          actorName: 'Liam Gallagher',
          actorRole: 'CUSTOMER',
          action: 'TICKET_CREATED',
          details: 'Ticket created via Telegram Bot'
        },
        {
          id: 'aud-2',
          timestamp: new Date(Date.now() - 110 * 60000).toISOString(),
          actorName: 'System (Auto-Assign)',
          actorRole: 'SYSTEM',
          action: 'AUTO_ASSIGNED',
          details: 'Assigned to David Vance (least-loaded DevOps specialist)'
        },
        {
          id: 'aud-3',
          timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
          actorName: 'David Vance',
          actorRole: 'SUPPORT_AGENT',
          action: 'STATUS_CHANGED',
          from: 'OPEN',
          to: 'IN_PROGRESS',
          details: 'First response sent. Investigating ingress proxy.'
        }
      ],
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
      firstResponseAt: null,
      resolvedAt: null,
      deletedAt: null,
      csatRating: null,
      csatComment: null,
      isEscalated: false,
      attachments: [],
      auditLog: [
        {
          id: 'aud-10',
          timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
          actorName: 'Sophia Martinez',
          actorRole: 'CUSTOMER',
          action: 'TICKET_CREATED',
          details: 'Created via Telegram'
        },
        {
          id: 'aud-11',
          timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
          actorName: 'System (Auto-Assign)',
          actorRole: 'SYSTEM',
          action: 'AUTO_ASSIGNED',
          details: 'Auto-assigned to Elena Rostova (Billing Specialist)'
        }
      ],
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
      firstResponseAt: new Date(Date.now() - 13 * 3600000).toISOString(),
      resolvedAt: null,
      deletedAt: null,
      csatRating: null,
      csatComment: null,
      isEscalated: false,
      attachments: [],
      auditLog: [
        {
          id: 'aud-20',
          timestamp: new Date(Date.now() - 14 * 3600000).toISOString(),
          actorName: 'Marcus Brody',
          actorRole: 'CUSTOMER',
          action: 'TICKET_CREATED',
          details: 'Created in Web Portal'
        },
        {
          id: 'aud-21',
          timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
          actorName: 'Sarah Connor',
          actorRole: 'SUPER_ADMIN',
          action: 'STATUS_CHANGED',
          from: 'IN_PROGRESS',
          to: 'WAITING_CUSTOMER',
          details: 'Requested iOS SDK build info'
        }
      ],
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
      firstResponseAt: new Date(Date.now() - 26 * 3600000).toISOString(),
      resolvedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      deletedAt: null,
      csatRating: 5,
      csatComment: 'Super fast response! Enabled the exporter within hours.',
      isEscalated: false,
      attachments: [],
      auditLog: [
        {
          id: 'aud-30',
          timestamp: new Date(Date.now() - 28 * 3600000).toISOString(),
          actorName: 'Aisha Al-Mansoor',
          actorRole: 'CUSTOMER',
          action: 'TICKET_CREATED',
          details: 'Created in Web Portal'
        },
        {
          id: 'aud-31',
          timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
          actorName: 'Sarah Connor',
          actorRole: 'SUPER_ADMIN',
          action: 'STATUS_CHANGED',
          from: 'IN_PROGRESS',
          to: 'RESOLVED',
          details: 'Enabled exporter feature in portal'
        },
        {
          id: 'aud-32',
          timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
          actorName: 'Aisha Al-Mansoor',
          actorRole: 'CUSTOMER',
          action: 'CSAT_RATED',
          details: 'Rated 5 stars: Super fast response!'
        }
      ],
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
      firstResponseAt: new Date(Date.now() - 70 * 3600000).toISOString(),
      resolvedAt: new Date(Date.now() - 22 * 3600000).toISOString(),
      deletedAt: null,
      csatRating: 5,
      csatComment: 'Saved our release timeline!',
      isEscalated: false,
      attachments: [],
      auditLog: [
        {
          id: 'aud-40',
          timestamp: new Date(Date.now() - 72 * 3600000).toISOString(),
          actorName: 'Liam Gallagher',
          actorRole: 'CUSTOMER',
          action: 'TICKET_CREATED',
          details: 'Created in Telegram'
        },
        {
          id: 'aud-41',
          timestamp: new Date(Date.now() - 22 * 3600000).toISOString(),
          actorName: 'David Vance',
          actorRole: 'SUPPORT_AGENT',
          action: 'STATUS_CHANGED',
          from: 'IN_PROGRESS',
          to: 'RESOLVED',
          details: 'Restored snapshot and patched script'
        },
        {
          id: 'aud-42',
          timestamp: new Date(Date.now() - 20 * 3600000).toISOString(),
          actorName: 'System',
          actorRole: 'SYSTEM',
          action: 'STATUS_CHANGED',
          from: 'RESOLVED',
          to: 'CLOSED',
          details: 'Ticket closed after resolution confirmation'
        }
      ],
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
    },
    {
      id: 'PD-1006',
      title: 'Stripe invoice recurring payment retry failure for EU tier',
      description: 'Customer corporate card was declined during month-end renewal. Needs manual SEPA direct debit invoice generation.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      department: 'Billing',
      channel: 'TELEGRAM',
      customerId: 'cust-104',
      customerName: 'Aisha Al-Mansoor',
      customerEmail: 'aisha@zenithcloud.org',
      telegramChatId: '98451230',
      telegramUsername: 'aisha_cloud',
      assignedTo: 'Elena Rostova',
      tags: ['Billing', 'Stripe', 'SEPA', 'Invoice'],
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 40 * 60000).toISOString(),
      firstResponseAt: new Date(Date.now() - 40 * 60000).toISOString(),
      resolvedAt: null,
      deletedAt: null,
      csatRating: null,
      csatComment: null,
      isEscalated: false,
      attachments: [],
      auditLog: [
        {
          id: 'aud-50',
          timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
          actorName: 'Aisha Al-Mansoor',
          actorRole: 'CUSTOMER',
          action: 'TICKET_CREATED',
          details: 'Created via Telegram'
        },
        {
          id: 'aud-51',
          timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
          actorName: 'Elena Rostova',
          actorRole: 'BILLING_SPECIALIST',
          action: 'STATUS_CHANGED',
          from: 'OPEN',
          to: 'IN_PROGRESS',
          details: 'Generated SEPA invoice reference #EU-88219'
        }
      ],
      messages: [
        {
          id: 'msg-501',
          sender: 'CUSTOMER',
          senderName: 'Aisha Al-Mansoor',
          text: 'Our accounting department notified us that the automated Stripe charge failed. Can you issue a SEPA direct invoice?',
          isInternal: false,
          timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
          channel: 'TELEGRAM'
        },
        {
          id: 'msg-502',
          sender: 'AGENT',
          senderName: 'Elena Rostova',
          text: 'Hello Aisha, generated SEPA billing invoice with reference #EU-88219. Sent to your corporate accounts payable.',
          isInternal: false,
          timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
          channel: 'TELEGRAM'
        }
      ]
    },
    {
      id: 'PD-1007',
      title: 'Request credit note & refund for duplicate seat license upgrade',
      description: 'Purchased 5 additional seats twice during annual checkout. Customer requesting credit note adjustment.',
      status: 'OPEN',
      priority: 'URGENT',
      department: 'Billing',
      channel: 'WEB_PORTAL',
      customerId: 'cust-102',
      customerName: 'Sophia Martinez',
      customerEmail: 'sophia.m@fintechflow.io',
      telegramChatId: '76239102',
      telegramUsername: 'sophiam_fintech',
      assignedTo: 'Elena Rostova',
      tags: ['Billing', 'Refund', 'Credit Note', 'License'],
      createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
      firstResponseAt: null,
      resolvedAt: null,
      deletedAt: null,
      csatRating: null,
      csatComment: null,
      isEscalated: false,
      attachments: [],
      auditLog: [
        {
          id: 'aud-60',
          timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
          actorName: 'Sophia Martinez',
          actorRole: 'CUSTOMER',
          action: 'TICKET_CREATED',
          details: 'Created in Web Portal'
        }
      ],
      messages: [
        {
          id: 'msg-601',
          sender: 'CUSTOMER',
          senderName: 'Sophia Martinez',
          text: 'Hi Elena, our card was billed twice for the 5 extra agent seats. Could you please void the duplicate transaction and issue a credit note?',
          isInternal: false,
          timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
          channel: 'WEB_PORTAL'
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
        const parsed = JSON.parse(raw);
        // Ensure initial required structures
        if (!parsed.telegramLinkTokens) parsed.telegramLinkTokens = {};
        return parsed;
      }
    } catch (err) {
      console.error('Error loading crm.json, using seed data:', err.message);
    }
    this.save(initialData);
    return JSON.parse(JSON.stringify(initialData));
  }

  save(dataToSave = this.data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving crm.json:', err.message);
    }
  }

  getPermissions(role) {
    return PERMISSIONS[role] || [];
  }

  hasPermission(role, permission) {
    if (!role) return false;
    const perms = this.getPermissions(role);
    return perms.includes('*') || perms.includes(permission);
  }

  getUsers() {
    return (this.data.users || []).map(u => {
      const { password, ...safeUser } = u;
      return safeUser;
    });
  }

  getUserById(id) {
    const user = (this.data.users || []).find(u => u.id === id);
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  }

  getUserByEmail(email) {
    const user = (this.data.users || []).find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  }

  authenticate({ email, password, userId }) {
    let user = null;
    if (email) {
      user = (this.data.users || []).find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    } else if (userId) {
      user = (this.data.users || []).find(u => u.id === userId);
    }
    if (!user) return null;
    if (!password || (user.password && user.password !== password)) {
      return null;
    }
    const { password: _, ...safeUser } = user;
    return safeUser;
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

  // ------------------------------------------------------------
  // SLA ENGINE: Calculate deadlines and check breach
  // ------------------------------------------------------------
  calculateSLA(ticket) {
    if (!ticket) return null;
    const priority = ticket.priority || 'MEDIUM';
    const config = SLA_CONFIG[priority] || SLA_CONFIG.MEDIUM;
    const createdAtMs = new Date(ticket.createdAt).getTime();

    const firstResponseDeadlineMs = createdAtMs + config.firstResponseHours * 3600000;
    const resolutionDeadlineMs = createdAtMs + config.resolutionHours * 3600000;
    const nowMs = Date.now();

    const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    const hasFirstResponse = !!ticket.firstResponseAt;

    let isBreached = false;
    let breachReason = '';

    if (!hasFirstResponse && nowMs > firstResponseDeadlineMs && !isResolved) {
      isBreached = true;
      breachReason = 'First response SLA breached';
    } else if (!isResolved && nowMs > resolutionDeadlineMs) {
      isBreached = true;
      breachReason = 'Resolution SLA breached';
    } else if (ticket.resolvedAt && new Date(ticket.resolvedAt).getTime() > resolutionDeadlineMs) {
      isBreached = true;
      breachReason = 'Resolved past SLA deadline';
    }

    const remainingResMs = resolutionDeadlineMs - nowMs;
    let remainingText = '';
    if (isResolved) {
      remainingText = 'Resolved';
    } else if (remainingResMs < 0) {
      const overMin = Math.abs(Math.round(remainingResMs / 60000));
      const overH = Math.floor(overMin / 60);
      const overM = overMin % 60;
      remainingText = `OVERDUE -${overH}h ${overM}m`;
    } else {
      const remMin = Math.round(remainingResMs / 60000);
      const remH = Math.floor(remMin / 60);
      const remM = remMin % 60;
      remainingText = `${remH}h ${remM}m left`;
    }

    return {
      firstResponseDeadline: new Date(firstResponseDeadlineMs).toISOString(),
      resolutionDeadline: new Date(resolutionDeadlineMs).toISOString(),
      isBreached,
      breachReason,
      remainingText
    };
  }

  // ------------------------------------------------------------
  // AUTO-ASSIGNMENT: Round-robin / Least-loaded agent
  // ------------------------------------------------------------
  assignLeastLoadedAgent(department = 'Technical Support') {
    if (!this.data.agents || this.data.agents.length === 0) return 'David Vance';

    // Filter agents by department if possible
    let candidates = [...this.data.agents];
    if (department.toLowerCase().includes('billing')) {
      candidates = candidates.filter(a => a.name === 'Elena Rostova' || a.role.toLowerCase().includes('billing'));
    } else {
      candidates = candidates.filter(a => a.name !== 'Elena Rostova');
    }
    if (candidates.length === 0) candidates = [...this.data.agents];

    candidates.sort((a, b) => (a.activeTickets || 0) - (b.activeTickets || 0));
    const chosen = candidates[0];
    chosen.activeTickets = (chosen.activeTickets || 0) + 1;
    return chosen.name;
  }

  // ------------------------------------------------------------
  // STATE MACHINE VALIDATOR
  // ------------------------------------------------------------
  isValidStateTransition(currentStatus, newStatus) {
    if (currentStatus === newStatus) return true;
    const allowed = STATE_TRANSITIONS[currentStatus] || [];
    return allowed.includes(newStatus);
  }

  // ------------------------------------------------------------
  // TICKETS: GET, FILTER, RBAC
  // ------------------------------------------------------------
  getTickets(filters = {}) {
    let list = (this.data.tickets || []).filter(t => !t.deletedAt); // Exclude soft-deleted

    // Role-based Access Control (RBAC) Ticket Scoping
    if (filters.user) {
      const { role, email, name, id } = filters.user;
      if (role === 'BILLING_SPECIALIST') {
        // Billing Specialist strictly sees ONLY Billing & Invoice tickets
        list = list.filter(t => {
          const isBillingDept = t.department && t.department.toLowerCase().includes('billing');
          const isBillingTag = t.tags && t.tags.some(tag => tag.toLowerCase().includes('billing'));
          return isBillingDept || isBillingTag;
        });
      } else if (role === 'SUPPORT_AGENT') {
        // Support Specialist strictly sees Technical & Customer Support tickets (excluding billing)
        list = list.filter(t => {
          const isBillingDept = t.department && t.department.toLowerCase().includes('billing');
          const isBillingTag = t.tags && t.tags.some(tag => tag.toLowerCase().includes('billing'));
          return !isBillingDept && !isBillingTag;
        });
      } else if (role === 'CUSTOMER') {
        // Customer strictly sees only their own tickets
        const userEmail = (email || '').toLowerCase().trim();
        const userName = (name || '').toLowerCase().trim();
        list = list.filter(t =>
          (t.customerEmail && t.customerEmail.toLowerCase().trim() === userEmail) ||
          (t.customerName && t.customerName.toLowerCase().trim() === userName) ||
          (t.customerId && t.customerId === id)
        );
      }
      // SUPER_ADMIN has unrestricted visibility across all departments
    }

    // Explicit department filter (e.g. from UI dropdown)
    if (filters.department && filters.department !== 'ALL') {
      list = list.filter(t => (t.department || '').toLowerCase() === filters.department.toLowerCase());
    }

    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(t => t.status === filters.status);
    }
    if (filters.priority && filters.priority !== 'ALL') {
      list = list.filter(t => t.priority === filters.priority);
    }
    if (filters.channel && filters.channel !== 'ALL') {
      list = list.filter(t => t.channel === filters.channel);
    }
    if (filters.assignedTo && filters.assignedTo !== 'ALL') {
      list = list.filter(t => t.assignedTo === filters.assignedTo);
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

    // Enrich with live SLA calculations
    list = list.map(t => {
      const sla = this.calculateSLA(t);
      return { ...t, sla };
    });

    // Auto-escalate tickets that breached SLA
    let hasEscalations = false;
    list.forEach(t => {
      if (t.sla.isBreached && !t.isEscalated && t.status !== 'RESOLVED' && t.status !== 'CLOSED') {
        t.isEscalated = true;
        hasEscalations = true;
        if (!t.auditLog) t.auditLog = [];
        t.auditLog.push({
          id: 'aud-' + Date.now(),
          timestamp: new Date().toISOString(),
          actorName: 'System SLA Monitor',
          actorRole: 'SYSTEM',
          action: 'AUTO_ESCALATED',
          details: `Ticket breached SLA: ${t.sla.breachReason}. Escalated to Lead.`
        });
      }
    });
    if (hasEscalations) this.save();

    // Sort descending by updated / created
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return list;
  }

  getTicketById(id) {
    const ticket = (this.data.tickets || []).find(t => t.id === id);
    if (!ticket) return null;
    const sla = this.calculateSLA(ticket);
    return { ...ticket, sla };
  }

  generateTicketId() {
    const numbers = (this.data.tickets || [])
      .map(t => parseInt(t.id.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const nextNum = (numbers.length > 0 ? Math.max(...numbers) : 1000) + 1;
    return `PD-${nextNum}`;
  }

  createTicket(ticketData, actor = null) {
    const id = this.generateTicketId();
    const customer = this.findOrCreateCustomer({
      name: ticketData.customerName,
      email: ticketData.customerEmail,
      telegramUsername: ticketData.telegramUsername,
      telegramChatId: ticketData.telegramChatId,
      company: ticketData.company
    });

    // Auto-assign agent if none specified
    let assignedTo = ticketData.assignedTo;
    if (!assignedTo) {
      assignedTo = this.assignLeastLoadedAgent(ticketData.department || 'Technical Support');
    }

    const now = new Date().toISOString();
    const actorName = actor ? actor.name : (ticketData.customerName || 'Customer');
    const actorRole = actor ? actor.role : 'CUSTOMER';

    const newTicket = {
      id,
      title: ticketData.title,
      description: ticketData.description || ticketData.title,
      status: 'OPEN',
      priority: ticketData.priority || 'MEDIUM',
      department: ticketData.department || 'Technical Support',
      channel: ticketData.channel || 'WEB_PORTAL',
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      telegramChatId: customer.telegramChatId || '',
      telegramUsername: customer.telegramUsername || '',
      assignedTo,
      tags: ticketData.tags || (ticketData.department === 'Billing' ? ['Billing'] : ['General']),
      createdAt: now,
      updatedAt: now,
      firstResponseAt: null,
      resolvedAt: null,
      deletedAt: null,
      csatRating: null,
      csatComment: null,
      isEscalated: false,
      attachments: ticketData.attachments || [],
      auditLog: [
        {
          id: 'aud-' + Date.now() + '-1',
          timestamp: now,
          actorName,
          actorRole,
          action: 'TICKET_CREATED',
          details: `Ticket created via ${ticketData.channel || 'WEB_PORTAL'}`
        },
        {
          id: 'aud-' + Date.now() + '-2',
          timestamp: now,
          actorName: 'System (Auto-Assign)',
          actorRole: 'SYSTEM',
          action: 'AUTO_ASSIGNED',
          details: `Dispatched to ${assignedTo} (${ticketData.department || 'Technical Support'})`
        }
      ],
      messages: [
        {
          id: 'msg-' + Date.now(),
          sender: 'CUSTOMER',
          senderName: customer.name,
          text: ticketData.description || ticketData.title,
          isInternal: false,
          timestamp: now,
          channel: ticketData.channel || 'WEB_PORTAL',
          attachments: ticketData.attachments || []
        }
      ]
    };

    this.data.tickets.unshift(newTicket);
    this.save();
    return { ...newTicket, sla: this.calculateSLA(newTicket) };
  }

  updateTicket(id, updates, actor = null) {
    const ticket = (this.data.tickets || []).find(t => t.id === id);
    if (!ticket) return null;

    if (!ticket.auditLog) ticket.auditLog = [];
    const actorName = actor ? actor.name : 'System';
    const actorRole = actor ? actor.role : 'SYSTEM';

    // State Machine Validation with Admin Full Rights Override
    if (updates.status && updates.status !== ticket.status) {
      const isAdmin = !actor || actor.role === 'SUPER_ADMIN' || this.hasPermission(actor.role, 'ticket.override_status');
      if (!isAdmin && !this.isValidStateTransition(ticket.status, updates.status)) {
        throw new Error(`Invalid status transition from ${ticket.status} to ${updates.status}`);
      }

      ticket.auditLog.push({
        id: 'aud-' + Date.now(),
        timestamp: new Date().toISOString(),
        actorName,
        actorRole,
        action: 'STATUS_CHANGED',
        from: ticket.status,
        to: updates.status,
        details: `Status updated from ${ticket.status} to ${updates.status}${isAdmin ? ' (Admin Authorized)' : ''}`
      });

      if (updates.status === 'RESOLVED') {
        updates.resolvedAt = new Date().toISOString();
        updates.closedAt = null;
      } else if (updates.status === 'CLOSED') {
        if (!ticket.resolvedAt) updates.resolvedAt = new Date().toISOString();
        updates.closedAt = new Date().toISOString();
      } else if (updates.status === 'REOPENED') {
        updates.resolvedAt = null;
        updates.closedAt = null;
        updates.status = 'IN_PROGRESS';
      } else if (updates.status === 'OPEN' || updates.status === 'IN_PROGRESS' || updates.status === 'WAITING_CUSTOMER') {
        updates.resolvedAt = null;
        updates.closedAt = null;
      }
    }

    // Priority Change Audit
    if (updates.priority && updates.priority !== ticket.priority) {
      ticket.auditLog.push({
        id: 'aud-' + Date.now() + '-pri',
        timestamp: new Date().toISOString(),
        actorName,
        actorRole,
        action: 'PRIORITY_CHANGED',
        from: ticket.priority,
        to: updates.priority,
        details: `Priority adjusted to ${updates.priority}`
      });
    }

    // Assignee Change Audit
    if (updates.assignedTo && updates.assignedTo !== ticket.assignedTo) {
      ticket.auditLog.push({
        id: 'aud-' + Date.now() + '-asg',
        timestamp: new Date().toISOString(),
        actorName,
        actorRole,
        action: 'REASSIGNED',
        from: ticket.assignedTo,
        to: updates.assignedTo,
        details: `Reassigned from ${ticket.assignedTo} to ${updates.assignedTo}`
      });
    }

    // Escalation flag
    if (updates.isEscalated && !ticket.isEscalated) {
      ticket.auditLog.push({
        id: 'aud-' + Date.now() + '-esc',
        timestamp: new Date().toISOString(),
        actorName,
        actorRole,
        action: 'ESCALATED',
        details: 'Manually escalated by supervisor'
      });
    }

    Object.assign(ticket, updates);
    ticket.updatedAt = new Date().toISOString();
    this.save();
    return { ...ticket, sla: this.calculateSLA(ticket) };
  }

  addMessageToTicket(id, messageData, actor = null) {
    const ticket = (this.data.tickets || []).find(t => t.id === id);
    if (!ticket) return null;

    const message = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      sender: messageData.sender || 'AGENT',
      senderName: messageData.senderName || 'PulseDesk Admin',
      text: messageData.text,
      isInternal: !!messageData.isInternal,
      timestamp: new Date().toISOString(),
      channel: messageData.channel || (messageData.sender === 'AGENT' ? 'CRM_ADMIN' : ticket.channel),
      attachments: messageData.attachments || []
    };

    if (!ticket.messages) ticket.messages = [];
    ticket.messages.push(message);

    if (!ticket.auditLog) ticket.auditLog = [];
    const actorName = actor ? actor.name : (messageData.senderName || 'Agent');
    const actorRole = actor ? actor.role : (messageData.sender === 'CUSTOMER' ? 'CUSTOMER' : 'SUPPORT_AGENT');

    // First Response SLA Timestamp
    if (message.sender === 'AGENT' && !message.isInternal && !ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date().toISOString();
      ticket.auditLog.push({
        id: 'aud-' + Date.now() + '-sla',
        timestamp: new Date().toISOString(),
        actorName,
        actorRole,
        action: 'FIRST_RESPONSE_RECORDED',
        details: 'First public agent response delivered'
      });
    }

    // Status auto-transitions based on conversation flow
    if (message.sender === 'AGENT' && !message.isInternal) {
      if (ticket.status === 'OPEN') {
        ticket.status = 'IN_PROGRESS';
      }
      ticket.auditLog.push({
        id: 'aud-' + Date.now() + '-reply',
        timestamp: new Date().toISOString(),
        actorName,
        actorRole,
        action: 'PUBLIC_REPLY_SENT',
        details: `Sent public reply to customer`
      });
    } else if (message.sender === 'AGENT' && message.isInternal) {
      ticket.auditLog.push({
        id: 'aud-' + Date.now() + '-note',
        timestamp: new Date().toISOString(),
        actorName,
        actorRole,
        action: 'INTERNAL_NOTE_ADDED',
        details: 'Added private internal collaboration note'
      });
    } else if (message.sender === 'CUSTOMER') {
      if (ticket.status === 'WAITING_CUSTOMER' || ticket.status === 'RESOLVED') {
        ticket.status = 'IN_PROGRESS';
      }
      ticket.auditLog.push({
        id: 'aud-' + Date.now() + '-cust',
        timestamp: new Date().toISOString(),
        actorName,
        actorRole,
        action: 'CUSTOMER_REPLY_RECEIVED',
        details: 'Customer sent follow-up message'
      });
    }

    ticket.updatedAt = new Date().toISOString();
    this.save();
    return { ticket: { ...ticket, sla: this.calculateSLA(ticket) }, message };
  }

  // Soft Delete (Preserves audit history and compliance)
  softDeleteTicket(id, actor = null) {
    const ticket = (this.data.tickets || []).find(t => t.id === id);
    if (!ticket) return null;

    ticket.deletedAt = new Date().toISOString();
    ticket.deletedBy = actor ? `${actor.name} (${actor.role})` : 'Administrator';

    if (!ticket.auditLog) ticket.auditLog = [];
    ticket.auditLog.push({
      id: 'aud-' + Date.now() + '-del',
      timestamp: new Date().toISOString(),
      actorName: actor ? actor.name : 'Administrator',
      actorRole: actor ? actor.role : 'SUPER_ADMIN',
      action: 'SOFT_DELETED',
      details: 'Ticket archived and marked deleted by administrator'
    });

    this.save();
    return ticket;
  }

  // CSAT Rating Collection
  rateTicketCSAT(id, rating, comment = '') {
    const ticket = (this.data.tickets || []).find(t => t.id === id);
    if (!ticket) return null;

    const r = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
    ticket.csatRating = r;
    ticket.csatComment = comment;

    if (!ticket.auditLog) ticket.auditLog = [];
    ticket.auditLog.push({
      id: 'aud-' + Date.now() + '-csat',
      timestamp: new Date().toISOString(),
      actorName: ticket.customerName,
      actorRole: 'CUSTOMER',
      action: 'CSAT_RATED',
      details: `Customer submitted CSAT score: ${r} / 5 stars${comment ? ` ("${comment}")` : ''}`
    });

    this.save();
    return ticket;
  }

  // ------------------------------------------------------------
  // TELEGRAM ONE-TIME LINK TOKEN ENGINE
  // ------------------------------------------------------------
  generateTelegramLinkToken(customerId) {
    const token = 'pd_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    if (!this.data.telegramLinkTokens) this.data.telegramLinkTokens = {};
    this.data.telegramLinkTokens[token] = {
      customerId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() // 24 hour expiry
    };
    this.save();
    return token;
  }

  verifyTelegramLinkToken(token, telegramUser) {
    if (!this.data.telegramLinkTokens || !this.data.telegramLinkTokens[token]) {
      return { success: false, error: 'Invalid or expired link token' };
    }

    const { customerId } = this.data.telegramLinkTokens[token];
    const customer = (this.data.customers || []).find(c => c.id === customerId);
    if (!customer) {
      return { success: false, error: 'Customer account not found' };
    }

    // Permanently link chat_id and username
    customer.telegramChatId = String(telegramUser.id);
    customer.telegramUsername = telegramUser.username || telegramUser.first_name || '';
    customer.isTelegramVerified = true;

    // Delete token (one-time use)
    delete this.data.telegramLinkTokens[token];
    this.save();
    return { success: true, customer };
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

  // ------------------------------------------------------------
  // SENIOR DEVELOPER ANALYTICS & EXECUTIVE KPI ENGINE
  // ------------------------------------------------------------
  getAnalytics(user = null) {
    const tickets = this.getTickets({ user });
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

    // Time buckets (Today, This Week, This Month)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const createdToday = tickets.filter(t => new Date(t.createdAt).getTime() >= startOfToday).length;
    const resolvedToday = tickets.filter(t => t.resolvedAt && new Date(t.resolvedAt).getTime() >= startOfToday).length;

    const createdWeek = tickets.filter(t => new Date(t.createdAt).getTime() >= startOfWeek).length;
    const resolvedWeek = tickets.filter(t => t.resolvedAt && new Date(t.resolvedAt).getTime() >= startOfWeek).length;

    const createdMonth = tickets.filter(t => new Date(t.createdAt).getTime() >= startOfMonth).length;
    const resolvedMonth = tickets.filter(t => t.resolvedAt && new Date(t.resolvedAt).getTime() >= startOfMonth).length;

    // Average First Response Time (hours)
    const firstResponded = tickets.filter(t => t.firstResponseAt);
    let avgFirstResponseHours = 0.4;
    if (firstResponded.length > 0) {
      const sumFirstMs = firstResponded.reduce((acc, t) => {
        return acc + Math.max(0, new Date(t.firstResponseAt) - new Date(t.createdAt));
      }, 0);
      avgFirstResponseHours = (sumFirstMs / (firstResponded.length * 3600000)).toFixed(1);
    }

    // Average Resolution Time (hours)
    const resolvedTickets = tickets.filter(t => t.resolvedAt);
    let avgResolutionHours = 2.4;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((acc, t) => {
        const diffMs = new Date(t.resolvedAt) - new Date(t.createdAt);
        return acc + Math.max(0.2, diffMs / (1000 * 60 * 60));
      }, 0);
      avgResolutionHours = (totalHours / resolvedTickets.length).toFixed(1);
    }

    // SLA Compliance Percentage
    const completedOrEvaluated = tickets.filter(t => t.sla);
    const breachedCount = completedOrEvaluated.filter(t => t.sla.isBreached).length;
    const slaComplianceRate = completedOrEvaluated.length > 0
      ? (((completedOrEvaluated.length - breachedCount) / completedOrEvaluated.length) * 100).toFixed(1)
      : '98.4';

    // Workload & Performance per Agent
    const agentWorkload = {};
    tickets.forEach(t => {
      const name = t.assignedTo || 'Unassigned';
      if (!agentWorkload[name]) {
        agentWorkload[name] = { active: 0, resolved: 0, total: 0 };
      }
      agentWorkload[name].total++;
      if (t.status === 'RESOLVED' || t.status === 'CLOSED') {
        agentWorkload[name].resolved++;
      } else {
        agentWorkload[name].active++;
      }
    });

    // CSAT Score & Distribution
    const ratedTickets = tickets.filter(t => t.csatRating);
    let avgCsat = 4.8;
    const csatDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (ratedTickets.length > 0) {
      const totalRating = ratedTickets.reduce((acc, t) => {
        csatDistribution[t.csatRating] = (csatDistribution[t.csatRating] || 0) + 1;
        return acc + t.csatRating;
      }, 0);
      avgCsat = (totalRating / ratedTickets.length).toFixed(1);
    }

    // Category / Department breakdown
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
      periods: {
        today: { open: createdToday, resolved: resolvedToday },
        thisWeek: { open: createdWeek, resolved: resolvedWeek },
        thisMonth: { open: createdMonth, resolved: resolvedMonth }
      },
      avgFirstResponseHours,
      avgResolutionHours,
      slaComplianceRate: `${slaComplianceRate}%`,
      slaBreaches: breachedCount,
      agentWorkload,
      csatScore: `${avgCsat} / 5.0`,
      csatDistribution,
      departments: deptCounts,
      customersCount: this.data.customers.length
    };
  }
}

const db = new Database();
module.exports = db;
