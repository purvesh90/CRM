const db = require('./db');

class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || db.getSettings().telegramBotToken || '';
    this.isPolling = false;
    this.lastUpdateId = 0;
    this.pollingTimer = null;
    this.botInfo = null;

    if (this.token) {
      this.init();
    }
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
          if (update.message) {
            await this.handleIncomingMessage(update.message);
          }
        }
      }
    } catch (err) {
      // Network hiccup or pause
      // Wait a moment before retry to avoid spinning
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

    // Command: /start
    if (text === '/start') {
      const welcome = `👋 <b>Welcome to PulseDesk Support!</b>\n\nI am your automated CRM support concierge.\n\n` +
        `• Send any message to automatically open a ticket or update your ongoing request.\n` +
        `• <code>/ticket &lt;issue details&gt;</code> - Create a new support ticket.\n` +
        `• <code>/status &lt;PD-1001&gt;</code> - Check status of an existing ticket.\n` +
        `• <code>/help</code> - Show this menu.\n\n` +
        `Our support engineers are ready to assist you!`;
      await this.sendMessage(chatId, welcome);
      return;
    }

    // Command: /help
    if (text === '/help') {
      const help = `🛠 <b>PulseDesk Bot Help:</b>\n\n` +
        `• <code>/ticket [your problem]</code> : Open a new ticket\n` +
        `• <code>/status [ticket ID]</code> : Check status of your ticket\n` +
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
        `<b>Last Updated:</b> ${new Date(ticket.updatedAt).toLocaleTimeString()}\n\n` +
        `Reply here to send an update to your agent.`;
      await this.sendMessage(chatId, reply);
      return;
    }

    // Command /ticket <title> OR plain text
    let issueDescription = text;
    if (text.startsWith('/ticket')) {
      issueDescription = text.replace('/ticket', '').trim();
    }

    // Check if customer already has an active open ticket from this chat
    const activeTickets = db.getTickets().filter(t =>
      t.telegramChatId === String(chatId) &&
      (t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'WAITING_CUSTOMER')
    );

    // If customer has an active ticket and didn't explicitly run /ticket, append message to it!
    if (activeTickets.length > 0 && !text.startsWith('/ticket')) {
      const activeTicket = activeTickets[0];
      db.addMessageToTicket(activeTicket.id, {
        sender: 'CUSTOMER',
        senderName: `${fullName} (Telegram)`,
        text: issueDescription,
        isInternal: false,
        channel: 'TELEGRAM'
      });

      await this.sendMessage(chatId, `✅ <i>Your reply was posted to Ticket #${activeTicket.id}. Our agent will respond shortly.</i>`);
      return;
    }

    // Otherwise, create a new Ticket in the CRM!
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
    });

    const replyMsg = `🎉 <b>Ticket Created Successfully!</b>\n\n` +
      `🎫 <b>Ticket ID:</b> <code>#${newTicket.id}</code>\n` +
      `📌 <b>Subject:</b> ${newTicket.title}\n` +
      `⚡ <b>Assigned Agent:</b> ${newTicket.assignedTo}\n` +
      `🕒 <b>Status:</b> 🟡 OPEN\n\n` +
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
