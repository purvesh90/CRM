const db = require('./db');

class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || db.getSettings().telegramBotToken || '';
    this.isPolling = false;
    this.lastUpdateId = 0;
    this.pollingTimer = null;
    this.botInfo = null;
    this.processedUpdates = new Set(); // For idempotency
    this.broadcaster = null;

    if (this.token) {
      this.init();
    }
  }

  setBroadcaster(fn) {
    this.broadcaster = fn;
  }

  async init() {
    try {
      const res = await this.testConnection(this.token);
      if (res.ok) {
        this.botInfo = res.result;
        db.updateSettings({
          telegramBotToken: this.token,
          telegramBotUsername: res.result.username
        });
        console.log(`[Telegram] Bot verified: @${res.result.username} (${res.result.first_name})`);
        this.startPolling();
      } else {
        console.warn('[Telegram] Invalid token or connection failed:', res.description);
      }
    } catch (err) {
      console.warn('[Telegram] Could not initialize bot with current token:', err.message);
    }
  }

  async setToken(newToken) {
    this.stopPolling();
    this.token = newToken ? newToken.trim() : '';
    this.botInfo = null;
    db.updateSettings({ telegramBotToken: this.token });

    if (!this.token) {
      db.updateSettings({ telegramBotUsername: '' });
      return { ok: true, message: 'Telegram token cleared.' };
    }

    const testRes = await this.testConnection(this.token);
    if (testRes.ok) {
      this.botInfo = testRes.result;
      db.updateSettings({ telegramBotUsername: testRes.result.username });
      this.startPolling();
      return { ok: true, message: 'Bot successfully connected and secured.' };
    } else {
      return { ok: false, error: testRes.description || 'Failed to authenticate token with Telegram API' };
    }
  }

  async testConnection(token = this.token) {
    if (!token) return { ok: false, description: 'No token provided' };
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      return await response.json();
    } catch (err) {
      return { ok: false, description: err.message };
    }
  }

  startPolling() {
    if (this.isPolling || !this.token) return;
    this.isPolling = true;
    console.log('[Telegram] Started long polling for updates...');
    this.pollLoop();
  }

  stopPolling() {
    this.isPolling = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    console.log('[Telegram] Stopped polling.');
  }

  async pollLoop() {
    if (!this.isPolling || !this.token) return;

    try {
      const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          this.lastUpdateId = update.update_id;
          if (this.processedUpdates.has(update.update_id)) continue; // Idempotency
          this.processedUpdates.add(update.update_id);
          if (this.processedUpdates.size > 2000) this.processedUpdates.clear();

          if (update.message) {
            await this.handleIncomingMessage(update.message);
          }
        }
      }
    } catch (err) {
      // Network pause
    }

    if (this.isPolling) {
      this.pollingTimer = setTimeout(() => this.pollLoop(), 1500);
    }
  }

  async sendMessage(chatId, text, parseMode = 'HTML') {
    if (!this.token) {
      console.log(`[Telegram Simulation] Sending message to ${chatId}: ${text}`);
      db.addTelegramLog({
        type: 'OUTBOUND (SIMULATED)',
        to: String(chatId),
        text
      });
      return { ok: true, simulated: true };
    }

    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode
        })
      });

      const resData = await response.json();
      db.addTelegramLog({
        type: resData.ok ? 'OUTBOUND' : 'OUTBOUND_ERROR',
        to: String(chatId),
        text: text.substring(0, 150),
        status: resData.ok ? 'SENT' : resData.description
      });
      return resData;
    } catch (err) {
      console.error('[Telegram] Failed to send message:', err.message);
      return { ok: false, error: err.message };
    }
  }

  async handleIncomingMessage(msg) {
    const chatId = msg.chat?.id;
    const text = msg.text ? msg.text.trim() : '';
    const username = msg.from?.username || msg.from?.first_name || 'user_' + chatId;
    const fullName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || username;

    if (!chatId || !text) return;

    db.addTelegramLog({
      type: 'INBOUND',
      from: `@${username} (${chatId})`,
      text
    });

    // 1. One-Time Secure Account Linking: /start pd_link_xxx
    if (text.startsWith('/start pd_')) {
      const token = text.replace('/start', '').trim();
      const linkResult = db.verifyTelegramLinkToken(token, msg.from);
      if (linkResult.success) {
        const welcomeVerified = `🎉 <b>Telegram Verified & Linked!</b>\n\n` +
          `Hello <b>${linkResult.customer.name}</b>, your Telegram account is now permanently connected to <b>PulseDesk CRM</b> (${linkResult.customer.email}).\n\n` +
          `All your support tickets, updates, and replies will be synchronized automatically in real time!`;
        await this.sendMessage(chatId, welcomeVerified);
        return;
      } else {
        await this.sendMessage(chatId, `⚠️ <i>${linkResult.error || 'The connection link is invalid or expired. Please generate a new one in your dashboard.'}</i>`);
        return;
      }
    }

    // Command: /start
    if (text === '/start') {
      const welcome = `👋 <b>Welcome to PulseDesk Support!</b>\n\nI am your automated CRM support concierge.\n\n` +
        `• Send any message to open a ticket or update your ongoing request.\n` +
        `• <code>/ticket &lt;details&gt;</code> or <code>/new &lt;details&gt;</code> - Create a new support ticket.\n` +
        `• <code>/status &lt;PD-1001&gt;</code> - Check live status & SLA of a ticket.\n` +
        `• <code>/rate &lt;PD-1001&gt; &lt;1-5&gt;</code> - Rate CSAT satisfaction.\n` +
        `• <code>/reopen &lt;PD-1001&gt;</code> - Reopen a resolved ticket.\n` +
        `• <code>/help</code> - Show command list.\n\n` +
        `Our support engineers are ready to assist you!`;
      await this.sendMessage(chatId, welcome);
      return;
    }

    // Command: /help
    if (text === '/help') {
      const help = `🛠 <b>PulseDesk Bot Help:</b>\n\n` +
        `• <code>/ticket [your problem]</code> : Open a new ticket\n` +
        `• <code>/status [ticket ID]</code> : Check status and SLA of your ticket\n` +
        `• <code>/rate [ticket ID] [1-5]</code> : Rate your support experience (CSAT)\n` +
        `• <code>/reopen [ticket ID]</code> : Reopen a resolved ticket\n` +
        `• Or simply type your problem message and our CRM will link it to your active ticket!`;
      await this.sendMessage(chatId, help);
      return;
    }

    // Command: /status <ticketId>
    if (text.startsWith('/status')) {
      const parts = text.split(' ');
      const queryId = parts[1] ? parts[1].trim().toUpperCase() : null;
      if (!queryId) {
        await this.sendMessage(chatId, '⚠️ Please provide a ticket ID, e.g. <code>/status PD-1001</code>');
        return;
      }
      const ticket = db.getTicketById(queryId);
      if (!ticket) {
        await this.sendMessage(chatId, `❌ Ticket <b>${queryId}</b> was not found.`);
        return;
      }

      const statusEmoji = {
        'OPEN': '🟡',
        'IN_PROGRESS': '🔵',
        'WAITING_CUSTOMER': '🟠',
        'RESOLVED': '🟢',
        'CLOSED': '⚪'
      }[ticket.status] || '⚪';

      const reply = `📋 <b>Ticket Details: #${ticket.id}</b>\n\n` +
        `<b>Subject:</b> ${ticket.title}\n` +
        `<b>Status:</b> ${statusEmoji} <b>${ticket.status.replace('_', ' ')}</b>\n` +
        `<b>Priority:</b> ${ticket.priority}\n` +
        `<b>Assigned Agent:</b> ${ticket.assignedTo}\n` +
        `<b>SLA Timer:</b> ${ticket.sla?.remainingText || 'Active'}\n` +
        `<b>Last Updated:</b> ${new Date(ticket.updatedAt).toLocaleTimeString()}\n\n` +
        `Reply here to send an update to your agent.`;
      await this.sendMessage(chatId, reply);
      return;
    }

    // Command: /rate <ticketId> <rating>
    if (text.startsWith('/rate')) {
      const parts = text.split(' ');
      const ticketId = parts[1] ? parts[1].trim().toUpperCase() : null;
      const rating = parseInt(parts[2], 10);
      if (!ticketId || isNaN(rating) || rating < 1 || rating > 5) {
        await this.sendMessage(chatId, '⚠️ Usage: <code>/rate &lt;PD-1001&gt; &lt;1 to 5&gt;</code>');
        return;
      }
      const updated = db.rateTicketCSAT(ticketId, rating, 'Rated via Telegram bot');
      if (updated) {
        const stars = '⭐'.repeat(rating);
        await this.sendMessage(chatId, `🎉 <b>Thank you!</b> Your rating of ${stars} (${rating}/5) for ticket <b>#${ticketId}</b> has been recorded.`);
      } else {
        await this.sendMessage(chatId, `❌ Ticket <b>#${ticketId}</b> not found.`);
      }
      return;
    }

    // Command: /reopen <ticketId>
    if (text.startsWith('/reopen')) {
      const parts = text.split(' ');
      const ticketId = parts[1] ? parts[1].trim().toUpperCase() : null;
      if (!ticketId) {
        await this.sendMessage(chatId, '⚠️ Usage: <code>/reopen &lt;PD-1001&gt;</code>');
        return;
      }
      try {
        const reopened = db.updateTicket(ticketId, { status: 'REOPENED' }, { name: fullName, role: 'CUSTOMER' });
        if (reopened) {
          await this.sendMessage(chatId, `🔄 Ticket <b>#${ticketId}</b> has been reopened. Our agents have been notified!`);
        } else {
          await this.sendMessage(chatId, `❌ Ticket <b>#${ticketId}</b> not found.`);
        }
      } catch (err) {
        await this.sendMessage(chatId, `⚠️ Could not reopen ticket: ${err.message}`);
      }
      return;
    }

    // Command: /ticket or /new or plain text
    let issueDescription = text;
    if (text.startsWith('/ticket')) {
      issueDescription = text.replace('/ticket', '').trim();
    } else if (text.startsWith('/new')) {
      issueDescription = text.replace('/new', '').trim();
    }

    // Check if customer already has an active open ticket from this chat
    const activeTickets = db.getTickets().filter(t =>
      t.telegramChatId === String(chatId) &&
      (t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'WAITING_CUSTOMER')
    );

    // If customer has an active ticket and didn't explicitly run /new, append message to it!
    if (activeTickets.length > 0 && !text.startsWith('/new') && !text.startsWith('/ticket')) {
      const activeTicket = activeTickets[0];
      const added = db.addMessageToTicket(activeTicket.id, {
        sender: 'CUSTOMER',
        senderName: `${fullName} (Telegram)`,
        text: issueDescription,
        isInternal: false,
        channel: 'TELEGRAM'
      });

      if (this.broadcaster) {
        this.broadcaster('ticket_message', {
          ticketId: activeTicket.id,
          message: added?.message || {
            sender: 'CUSTOMER',
            senderName: `${fullName} (Telegram)`,
            text: issueDescription,
            timestamp: new Date().toISOString(),
            channel: 'TELEGRAM'
          },
          ticketStatus: activeTicket.status,
          fromTelegram: true,
          customerName: fullName
        });
      }

      await this.sendMessage(chatId, `✅ <i>Your reply was posted to Ticket #${activeTicket.id}. Our agent will respond shortly.</i>`);
      return;
    }

    // Otherwise, create a new Ticket in the CRM with least-loaded agent assignment
    const title = issueDescription.length > 70
      ? issueDescription.substring(0, 67) + '...'
      : issueDescription;

    const newTicket = db.createTicket({
      title: title || 'Telegram Support Request',
      description: issueDescription || 'No description provided.',
      channel: 'TELEGRAM',
      customerName: fullName,
      customerEmail: `${username}@telegram.user`,
      telegramUsername: username,
      telegramChatId: String(chatId),
      priority: issueDescription.toLowerCase().includes('urgent') || issueDescription.toLowerCase().includes('emergency') ? 'URGENT' : 'MEDIUM',
      department: issueDescription.toLowerCase().includes('bill') || issueDescription.toLowerCase().includes('invoice') ? 'Billing' : 'Technical Support',
      tags: ['Telegram', 'Bot']
    }, { name: fullName, role: 'CUSTOMER' });

    if (this.broadcaster) {
      this.broadcaster('ticket_created', newTicket);
    }

    const replyMsg = `🎉 <b>Ticket Created Successfully!</b>\n\n` +
      `🎫 <b>Ticket ID:</b> <code>#${newTicket.id}</code>\n` +
      `📌 <b>Subject:</b> ${newTicket.title}\n` +
      `⚡ <b>Assigned Agent:</b> ${newTicket.assignedTo}\n` +
      `🕒 <b>Status:</b> 🟡 OPEN\n` +
      `⏱️ <b>SLA Target:</b> ${newTicket.sla?.remainingText || 'Active'}\n\n` +
      `Our team has been notified. You can send replies directly here to update this ticket!`;

    await this.sendMessage(chatId, replyMsg);
  }

  // Called when an Agent replies in the CRM UI
  async sendAgentReply(ticket, messageText, agentName = 'PulseDesk Agent') {
    if (!ticket.telegramChatId) {
      return { ok: false, reason: 'No telegramChatId attached to ticket' };
    }

    const formatted = `💬 <b>Update on Ticket #${ticket.id}</b>\n` +
      `<b>From:</b> ${agentName}\n\n` +
      `${messageText}\n\n` +
      `<i>(Reply to this message on Telegram to respond back to the agent)</i>`;

    return await this.sendMessage(ticket.telegramChatId, formatted);
  }

  // Push notifications on ticket status change
  async sendStatusChangeNotification(ticket, newStatus, actorName = 'PulseDesk Team') {
    if (!ticket.telegramChatId) return;

    if (newStatus === 'RESOLVED') {
      const msg = `🎉 <b>Your ticket #${ticket.id} has been marked RESOLVED!</b>\n\n` +
        `Resolved by <b>${actorName}</b>.\n\n` +
        `How was your support experience? Please rate us from 1 to 5 stars:\n` +
        `• <code>/rate ${ticket.id} 5</code> ⭐⭐⭐⭐⭐ (Excellent)\n` +
        `• <code>/rate ${ticket.id} 4</code> ⭐⭐⭐⭐ (Good)\n` +
        `• <code>/rate ${ticket.id} 3</code> ⭐⭐⭐ (Average)\n\n` +
        `Need more help? Type <code>/reopen ${ticket.id}</code> anytime!`;
      await this.sendMessage(ticket.telegramChatId, msg);
    } else if (newStatus === 'CLOSED') {
      const msg = `📁 <b>Ticket #${ticket.id} has been archived & closed.</b>\nThank you for choosing PulseDesk!`;
      await this.sendMessage(ticket.telegramChatId, msg);
    }
  }

  // Simulated inbound message for web testing without live token
  async simulateInboundMessage({ chatId = '12345678', username = 'alex_demo', fullName = 'Alex Demo', text }) {
    await this.handleIncomingMessage({
      chat: { id: chatId },
      from: {
        id: chatId,
        username,
        first_name: fullName
      },
      text
    });
    return { ok: true, message: 'Simulated Telegram update processed.' };
  }

  getStatus() {
    return {
      connected: !!this.botInfo,
      isPolling: this.isPolling,
      botInfo: this.botInfo ? { isProtected: true, status: 'CONNECTED' } : null,
      tokenConfigured: !!this.token
    };
  }
}

const telegramService = new TelegramService();
module.exports = telegramService;
