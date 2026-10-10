// Telegram Integration & Interactive Mobile Simulator Module
const TelegramModule = {
  currentSimChatId: '89123456',
  currentSimUser: 'liam_gallagher_tech',
  currentSimName: 'Liam Gallagher',

  init() {
    this.bindEvents();
    this.loadStatus();
    this.loadLogs();
  },

  bindEvents() {
    // Save Token Form
    const tokenForm = document.getElementById('telegramTokenForm');
    if (tokenForm) {
      tokenForm.addEventListener('submit', (e) => this.handleSaveToken(e));
    }

    // Toggle Token Visibility
    const toggleBtn = document.getElementById('toggleTokenVisibility');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const input = document.getElementById('telegramBotTokenInput');
        if (input.type === 'password') {
          input.type = 'text';
        } else {
          input.type = 'password';
        }
      });
    }

    // Test Connection Button
    const testBtn = document.getElementById('testTelegramConnBtn');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testConnection());
    }

    // Refresh Logs
    const refreshLogsBtn = document.getElementById('refreshTelegramLogsBtn');
    if (refreshLogsBtn) {
      refreshLogsBtn.addEventListener('click', () => this.loadLogs());
    }

    // Simulator Chat Form
    const simForm = document.getElementById('simChatForm');
    if (simForm) {
      simForm.addEventListener('submit', (e) => this.handleSimulatorSend(e));
    }

    // Simulator Quick Command Chips
    document.querySelectorAll('.sim-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.getAttribute('data-cmd');
        const input = document.getElementById('simMessageInput');
        if (input) {
          input.value = cmd;
          input.focus();
        }
      });
    });
  },

  async loadStatus() {
    try {
      const res = await fetch('/api/telegram/status');
      const data = await res.json();
      if (data.success) {
        const status = data.status;
        const badge = document.getElementById('telegramConfigBadge');
        const headerBadge = document.getElementById('telegramHeaderBadge');
        const headerText = document.getElementById('telegramStatusText');
        const userText = document.getElementById('botUsernameText');
        const pollStatus = document.getElementById('botPollingStatus');

        if (status.connected && status.botInfo) {
          if (badge) {
            badge.textContent = `Online: @${status.botInfo.username}`;
            badge.className = 'badge-status-pill text-success';
          }
          if (headerText) headerText.textContent = `@${status.botInfo.username}`;
          if (userText) userText.innerHTML = `<span class="text-cyan">@${status.botInfo.username} (${status.botInfo.first_name})</span>`;
          if (pollStatus) pollStatus.textContent = status.isPolling ? 'Live Polling Active' : 'Standby';
        } else if (status.tokenConfigured) {
          if (badge) badge.textContent = 'Token set (Testing...)';
          if (headerText) headerText.textContent = 'Connecting...';
        } else {
          if (badge) badge.textContent = 'Simulator Ready';
          if (headerText) headerText.textContent = 'Simulator Mode';
          if (userText) userText.textContent = 'No Bot Token (Using Simulator)';
          if (pollStatus) pollStatus.textContent = 'Simulator Engine Active';
        }
      }
    } catch (err) {
      console.warn('Failed to load Telegram status:', err.message);
    }
  },

  async handleSaveToken(e) {
    e.preventDefault();
    const tokenInput = document.getElementById('telegramBotTokenInput');
    const token = tokenInput ? tokenInput.value.trim() : '';

    App.showToast('Connecting to Telegram Bot API...', 'info');

    try {
      const res = await fetch('/api/telegram/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();

      if (data.ok) {
        App.showToast(`✅ Successfully connected to @${data.bot?.username || 'Bot'}!`, 'success');
        this.loadStatus();
        this.loadLogs();
      } else {
        App.showToast(`❌ Connection failed: ${data.error || 'Invalid token'}`, 'error');
      }
    } catch (err) {
      App.showToast('Network error while saving bot token', 'error');
    }
  },

  async testConnection() {
    App.showToast('Testing Telegram API reachability...', 'info');
    try {
      const res = await fetch('/api/telegram/status');
      const data = await res.json();
      if (data.status?.connected) {
        App.showToast(`Bot @${data.status.botInfo.username} is 100% active and polling!`, 'success');
      } else {
        App.showToast('No active bot token. In-browser simulator is available!', 'warning');
      }
    } catch (e) {
      App.showToast('Error testing bot connection', 'error');
    }
  },

  async handleSimulatorSend(e) {
    e.preventDefault();
    const input = document.getElementById('simMessageInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    // Append outgoing bubble to smartphone mockup
    this.appendSimBubble({
      sender: this.currentSimName,
      text,
      isIncoming: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    input.value = '';

    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: this.currentSimChatId,
          username: this.currentSimUser,
          fullName: this.currentSimName,
          text
        })
      });

      const data = await res.json();
      if (data.success) {
        // Reload tickets in background so the CRM Kanban updates immediately
        TicketsModule.loadTickets(false);
        this.loadLogs();

        // Simulate instant bot response reply in phone
        setTimeout(() => {
          this.fetchLatestSimBotResponse(text);
        }, 600);
      }
    } catch (err) {
      App.showToast('Simulator communication failed', 'error');
    }
  },

  appendSimBubble({ sender, text, isIncoming = true, time }) {
    const container = document.getElementById('simMessagesContainer');
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = `tg-bubble ${isIncoming ? 'tg-bubble-incoming' : 'tg-bubble-outgoing'}`;
    bubble.innerHTML = `
      <div class="tg-msg-sender">${isIncoming ? 'PulseDesk Bot' : 'You'}</div>
      <div class="tg-msg-text">${this.formatTelegramText(text)}</div>
      <div class="tg-msg-time">${time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  },

  formatTelegramText(raw) {
    if (!raw) return '';
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<strong>$1</strong>')
      .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<em>$1</em>')
      .replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  },

  async fetchLatestSimBotResponse(promptText) {
    try {
      const res = await fetch('/api/telegram/logs');
      const data = await res.json();
      if (data.success && data.logs && data.logs.length > 0) {
        const outbound = data.logs.find(l => l.type.includes('OUTBOUND') && l.to === this.currentSimChatId);
        if (outbound) {
          this.appendSimBubble({
            sender: 'PulseDesk Bot',
            text: outbound.text,
            isIncoming: true,
            time: new Date(outbound.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
    } catch (e) {
      // ignore
    }
  },

  async loadLogs() {
    try {
      const res = await fetch('/api/telegram/logs');
      const data = await res.json();
      const tbody = document.getElementById('telegramLogsTableBody');
      const feed = document.getElementById('telegramLiveFeed');

      if (data.success && Array.isArray(data.logs)) {
        if (tbody) {
          tbody.innerHTML = data.logs.slice(0, 15).map(log => {
            const isOut = log.type.includes('OUTBOUND');
            const typeBadge = isOut
              ? '<span class="priority-badge priority-MEDIUM">OUTBOUND &rarr;</span>'
              : '<span class="priority-badge priority-HIGH">&larr; INBOUND</span>';

            return `
              <tr>
                <td>${typeBadge}</td>
                <td><strong>${log.from || log.to || 'Telegram User'}</strong></td>
                <td><code>${this.escapeHtml(log.text.substring(0, 100))}</code></td>
                <td><small class="text-muted">${new Date(log.timestamp).toLocaleTimeString()}</small></td>
              </tr>
            `;
          }).join('');
        }

        // Also render top items in Dashboard mini feed
        if (feed) {
          feed.innerHTML = data.logs.slice(0, 4).map(log => `
            <div class="tg-stream-item">
              <div class="tg-stream-icon">
                <i data-lucide="send"></i>
              </div>
              <div class="tg-stream-content">
                <div class="tg-stream-author">${log.from || ('Sent to ' + log.to)}</div>
                <div class="tg-stream-msg">${this.escapeHtml(log.text.substring(0, 80))}</div>
                <div class="tg-stream-time">${new Date(log.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          `).join('');
          lucide.createIcons();
        }
      }
    } catch (err) {
      console.warn('Failed to load telegram logs:', err);
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
};
