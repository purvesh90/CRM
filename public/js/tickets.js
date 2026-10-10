// Ticket Management & Kanban Engine
const TicketsModule = {
  tickets: [],
  currentTicketId: null,
  activeReplyMode: 'CUSTOMER', // 'CUSTOMER' or 'INTERNAL'
  currentView: 'KANBAN', // 'KANBAN' or 'LIST'

  init() {
    this.bindEvents();
    this.loadTickets();
  },

  bindEvents() {
    // Filter controls
    ['filterStatus', 'filterPriority', 'filterChannel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.loadTickets());
    });

    const searchInput = document.getElementById('ticketsSearchInput');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => this.loadTickets(), 300);
      });
    }

    const resetBtn = document.getElementById('resetFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.getElementById('filterStatus').value = 'ALL';
        document.getElementById('filterPriority').value = 'ALL';
        document.getElementById('filterChannel').value = 'ALL';
        document.getElementById('ticketsSearchInput').value = '';
        this.loadTickets();
      });
    }

    // View switcher (Kanban vs List)
    const btnKanban = document.getElementById('viewKanbanBtn');
    const btnList = document.getElementById('viewListBtn');
    if (btnKanban && btnList) {
      btnKanban.addEventListener('click', () => this.switchView('KANBAN'));
      btnList.addEventListener('click', () => this.switchView('LIST'));
    }

    // Ticket Drawer Closing
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const overlay = document.getElementById('ticketModalOverlay');
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', () => this.closeDrawer());
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeDrawer();
      });
    }

    // Drawer Property Selects Change Listeners
    ['ticketStatusSelect', 'ticketPrioritySelect', 'ticketAgentSelect', 'ticketDeptSelect'].forEach(selectId => {
      const el = document.getElementById(selectId);
      if (el) {
        el.addEventListener('change', () => this.handlePropertyUpdate(selectId));
      }
    });

    // Delete Ticket Button
    const deleteBtn = document.getElementById('deleteTicketBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.handleDeleteCurrentTicket());
    }

    // Composer Tabs (Reply Customer vs Internal Note)
    const tabCustomer = document.getElementById('tabReplyCustomer');
    const tabInternal = document.getElementById('tabInternalNote');
    if (tabCustomer && tabInternal) {
      tabCustomer.addEventListener('click', () => this.setReplyMode('CUSTOMER'));
      tabInternal.addEventListener('click', () => this.setReplyMode('INTERNAL'));
    }

    // Reply Composer Form Submit
    const composerForm = document.getElementById('replyComposerForm');
    if (composerForm) {
      composerForm.addEventListener('submit', (e) => this.handleSendReply(e));
    }

    // Canned response quick insert
    document.querySelectorAll('.canned-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-reply');
        const input = document.getElementById('composerInput');
        if (input) {
          input.value = text;
          input.focus();
        }
      });
    });

    // Setup Drag and Drop listeners on Kanban columns
    this.setupKanbanDragDrop();

    // Admin Create New Ticket Form
    const adminTicketForm = document.getElementById('adminNewTicketForm');
    if (adminTicketForm) {
      adminTicketForm.addEventListener('submit', (e) => this.handleCreateTicket(e));
    }

    // Open/Close New Ticket Modal
    const openModalBtns = [
      document.getElementById('openNewTicketModalBtn'),
      document.getElementById('dashboardNewTicketBtn'),
      document.getElementById('ticketCenterNewTicketBtn')
    ];
    openModalBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', () => this.openNewTicketModal());
    });

    const closeModalBtn = document.getElementById('closeNewTicketModalBtn');
    const cancelModalBtn = document.getElementById('cancelNewTicketBtn');
    const modalOverlay = document.getElementById('newTicketModalOverlay');
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.closeNewTicketModal());
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => this.closeNewTicketModal());
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.closeNewTicketModal();
      });
    }
  },

  async loadTickets(showLoading = false) {
    try {
      const status = document.getElementById('filterStatus')?.value || 'ALL';
      const priority = document.getElementById('filterPriority')?.value || 'ALL';
      const channel = document.getElementById('filterChannel')?.value || 'ALL';
      const search = document.getElementById('ticketsSearchInput')?.value || '';

      const query = new URLSearchParams({ status, priority, channel, search });
      const res = await fetch(`/api/tickets?${query.toString()}`);
      const data = await res.json();

      if (data.success) {
        this.tickets = data.tickets;
        this.renderKanban();
        this.renderTable();
        this.renderUrgentDashboardList();
        App.updateDashboardKPIs();

        const badge = document.getElementById('sidebarOpenTicketBadge');
        if (badge) {
          const openCount = this.tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
          badge.textContent = openCount;
        }
      }
    } catch (err) {
      console.warn('Failed to load tickets:', err);
    }
  },

  renderKanban() {
    const statuses = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
    const counts = { OPEN: 0, IN_PROGRESS: 0, WAITING_CUSTOMER: 0, RESOLVED: 0, CLOSED: 0 };

    statuses.forEach(status => {
      const col = document.getElementById(`kanban-col-${status}`);
      if (col) col.innerHTML = '';
    });

    this.tickets.forEach(ticket => {
      if (counts[ticket.status] !== undefined) {
        counts[ticket.status]++;
      }

      const col = document.getElementById(`kanban-col-${ticket.status}`);
      if (col) {
        col.appendChild(this.createKanbanCard(ticket));
      }
    });

    // Update counts
    statuses.forEach(status => {
      const countEl = document.getElementById(`count-${status}`);
      if (countEl) countEl.textContent = counts[status] || 0;
    });

    lucide.createIcons();
  },

  createKanbanCard(ticket) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', ticket.id);

    const isTelegram = ticket.channel === 'TELEGRAM';
    const channelHtml = isTelegram
      ? `<span class="ticket-channel-icon"><i data-lucide="send"></i> Telegram</span>`
      : `<span class="ticket-channel-icon" style="color:#818cf8;background:rgba(99,102,241,0.1);"><i data-lucide="globe"></i> Web</span>`;

    const initials = (ticket.assignedTo || 'Unassigned')
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2);

    card.innerHTML = `
      <div class="kanban-card-top">
        <span class="ticket-tag-id">#${ticket.id}</span>
        ${channelHtml}
      </div>
      <div class="kanban-card-title">${this.escapeHtml(ticket.title)}</div>
      <div class="kanban-card-desc">${this.escapeHtml(ticket.description || 'No description.')}</div>
      <div class="kanban-card-footer">
        <span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span>
        <div class="card-assignee-avatar" title="Assigned to ${ticket.assignedTo}">${initials}</div>
      </div>
    `;

    card.addEventListener('click', () => this.openDrawer(ticket.id));

    // Drag start / end
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', ticket.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    return card;
  },

  setupKanbanDragDrop() {
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const ticketId = e.dataTransfer.getData('text/plain');
        const targetStatus = col.getAttribute('data-status');

        if (ticketId && targetStatus) {
          await this.updateTicketStatus(ticketId, targetStatus);
        }
      });
    });
  },

  async updateTicketStatus(ticketId, newStatus) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast(`Ticket #${ticketId} moved to ${newStatus.replace('_', ' ')}`, 'success');
        this.loadTickets();
      }
    } catch (err) {
      App.showToast('Failed to update ticket status', 'error');
    }
  },

  renderTable() {
    const tbody = document.getElementById('ticketsTableBody');
    if (!tbody) return;

    if (this.tickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:#64748b;">No tickets match the current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.tickets.map(t => {
      const isTg = t.channel === 'TELEGRAM';
      const channelBadge = isTg
        ? `<span class="ticket-channel-icon"><i data-lucide="send"></i> Telegram</span>`
        : `<span class="ticket-channel-icon" style="color:#818cf8;background:rgba(99,102,241,0.1);"><i data-lucide="globe"></i> Web</span>`;

      return `
        <tr data-id="${t.id}" style="cursor:pointer;">
          <td><strong class="ticket-tag-id">#${t.id}</strong></td>
          <td><strong>${this.escapeHtml(t.title)}</strong></td>
          <td>${this.escapeHtml(t.customerName)}</td>
          <td>${channelBadge}</td>
          <td><span class="priority-badge priority-${t.priority}">${t.priority}</span></td>
          <td><span class="column-title-pill pill-yellow"><span class="status-indicator yellow"></span>${t.status.replace('_', ' ')}</span></td>
          <td>${t.assignedTo}</td>
          <td><small class="text-muted">${new Date(t.updatedAt || t.createdAt).toLocaleTimeString()}</small></td>
          <td>
            <button class="btn-secondary btn-icon-only" onclick="TicketsModule.openDrawer('${t.id}')">
              <i data-lucide="external-link"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row click
    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.openDrawer(row.getAttribute('data-id'));
        }
      });
    });

    lucide.createIcons();
  },

  renderUrgentDashboardList() {
    const container = document.getElementById('urgentTicketsList');
    if (!container) return;

    const urgentTickets = this.tickets.filter(t =>
      (t.priority === 'URGENT' || t.priority === 'HIGH') &&
      t.status !== 'RESOLVED' && t.status !== 'CLOSED'
    ).slice(0, 4);

    if (urgentTickets.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:24px;color:#64748b;">
          <i data-lucide="shield-check" style="width:32px;height:32px;margin-bottom:8px;color:#10b981;"></i>
          <p>No critical unresolved tickets in the SLA queue!</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = urgentTickets.map(t => `
      <div class="urgent-ticket-item" onclick="TicketsModule.openDrawer('${t.id}')">
        <div class="urgent-ticket-info">
          <div class="urgent-title-row">
            <span class="priority-badge priority-${t.priority}">${t.priority}</span>
            <span class="urgent-ticket-title">#${t.id} - ${this.escapeHtml(t.title)}</span>
          </div>
          <div class="urgent-ticket-meta">
            From: <strong>${t.customerName}</strong> (${t.channel}) &bull; Assigned: ${t.assignedTo}
          </div>
        </div>
        <button class="btn-text">Resolve &rarr;</button>
      </div>
    `).join('');

    lucide.createIcons();
  },

  switchView(view) {
    this.currentView = view;
    const btnKanban = document.getElementById('viewKanbanBtn');
    const btnList = document.getElementById('viewListBtn');
    const kanbanView = document.getElementById('kanbanBoardView');
    const listView = document.getElementById('ticketListView');

    if (view === 'KANBAN') {
      btnKanban.classList.add('active');
      btnList.classList.remove('active');
      kanbanView.classList.remove('hidden');
      listView.classList.add('hidden');
    } else {
      btnKanban.classList.remove('active');
      btnList.classList.add('active');
      kanbanView.classList.add('hidden');
      listView.classList.remove('hidden');
    }
  },

  // OPEN TICKET DRAWER & CONVERSATION THREAD
  async openDrawer(ticketId) {
    this.currentTicketId = ticketId;
    const overlay = document.getElementById('ticketModalOverlay');
    overlay.classList.remove('hidden');

    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      const data = await res.json();
      if (data.success && data.ticket) {
        this.renderDrawerTicket(data.ticket);
      }
    } catch (err) {
      App.showToast('Could not load ticket details', 'error');
    }
  },

  closeDrawer() {
    this.currentTicketId = null;
    const overlay = document.getElementById('ticketModalOverlay');
    overlay.classList.add('hidden');
  },

  renderDrawerTicket(ticket) {
    document.getElementById('drawerTicketId').textContent = `#${ticket.id}`;
    document.getElementById('drawerTicketTitle').textContent = ticket.title;
    document.getElementById('drawerCustomerName').textContent = ticket.customerName;
    document.getElementById('drawerCustomerEmail').textContent = ticket.customerEmail || 'No email attached';

    // Channel badge
    const chBadge = document.getElementById('drawerChannelBadge');
    if (ticket.channel === 'TELEGRAM') {
      chBadge.innerHTML = `<i data-lucide="send"></i> <span>Telegram Bot Channel</span>`;
      chBadge.style.color = '#22d3ee';
    } else {
      chBadge.innerHTML = `<i data-lucide="globe"></i> <span>Web Portal Channel</span>`;
      chBadge.style.color = '#818cf8';
    }

    // Properties dropdowns
    document.getElementById('ticketStatusSelect').value = ticket.status;
    document.getElementById('ticketPrioritySelect').value = ticket.priority;
    document.getElementById('ticketAgentSelect').value = ticket.assignedTo || 'Sarah Connor';
    document.getElementById('ticketDeptSelect').value = ticket.department || 'Technical Support';

    // Telegram connection metadata (masked for security)
    document.getElementById('drawerMetaTelegramId').textContent = ticket.telegramChatId ? `Encrypted (***${String(ticket.telegramChatId).slice(-4)})` : 'Not linked';
    document.getElementById('drawerMetaTelegramUser').textContent = ticket.telegramUsername ? 'Protected Account' : 'None';

    document.getElementById('drawerMetaCreated').textContent = new Date(ticket.createdAt).toLocaleString();
    document.getElementById('drawerMetaUpdated').textContent = new Date(ticket.updatedAt).toLocaleString();
    document.getElementById('drawerMetaResolved').textContent = ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString() : 'In Progress';

    // Tags
    const tagsCloud = document.getElementById('drawerTagsCloud');
    if (tagsCloud) {
      tagsCloud.innerHTML = (ticket.tags || ['Support']).map(tag => `<span class="tag-chip">${this.escapeHtml(tag)}</span>`).join('');
    }

    // Render Conversation Messages
    this.renderDrawerMessages(ticket.messages || []);

    // Sync notification notice
    const composerNotice = document.getElementById('composerSyncStatus');
    if (ticket.channel === 'TELEGRAM' && ticket.telegramChatId) {
      composerNotice.textContent = 'Reply will be sent instantly to customer Telegram chat';
    } else {
      composerNotice.textContent = 'Reply will be posted to Customer Web Portal';
    }

    lucide.createIcons();
  },

  renderDrawerMessages(messages) {
    const stream = document.getElementById('drawerMessagesStream');
    if (!stream) return;

    stream.innerHTML = messages.map(msg => {
      let bubbleClass = 'stream-msg-customer';
      let icon = 'user';
      let syncNotice = '';

      if (msg.isInternal) {
        bubbleClass = 'stream-msg-internal';
        icon = 'lock';
      } else if (msg.sender === 'AGENT') {
        bubbleClass = 'stream-msg-agent';
        icon = 'shield-check';
        if (msg.channel === 'TELEGRAM' || msg.channel === 'CRM_ADMIN') {
          syncNotice = `<div class="msg-footer-telegram-sync"><i data-lucide="check-check"></i> Delivered via Telegram</div>`;
        }
      }

      return `
        <div class="stream-message-bubble ${bubbleClass}">
          <div class="msg-header-row">
            <span class="msg-sender-name">
              <i data-lucide="${icon}"></i>
              ${this.escapeHtml(msg.senderName)}
            </span>
            <span class="msg-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="msg-content-text">${this.escapeHtml(msg.text).replace(/\n/g, '<br>')}</div>
          ${syncNotice}
        </div>
      `;
    }).join('');

    stream.scrollTop = stream.scrollHeight;
    lucide.createIcons();
  },

  setReplyMode(mode) {
    this.activeReplyMode = mode;
    const tabCustomer = document.getElementById('tabReplyCustomer');
    const tabInternal = document.getElementById('tabInternalNote');
    const input = document.getElementById('composerInput');

    if (mode === 'CUSTOMER') {
      tabCustomer.classList.add('active');
      tabInternal.classList.remove('active');
      input.placeholder = 'Type reply to customer (delivered directly to Telegram / portal)...';
    } else {
      tabCustomer.classList.remove('active');
      tabInternal.classList.add('active');
      input.placeholder = '🔒 Type internal staff note (only visible to support agents)...';
    }
  },

  async handleSendReply(e) {
    e.preventDefault();
    if (!this.currentTicketId) return;

    const input = document.getElementById('composerInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    const isInternal = this.activeReplyMode === 'INTERNAL';
    const senderName = document.getElementById('ticketAgentSelect').value || 'Sarah Connor';

    try {
      const res = await fetch(`/api/tickets/${this.currentTicketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sender: 'AGENT',
          senderName,
          isInternal
        })
      });

      const data = await res.json();
      if (data.success) {
        input.value = '';
        App.showToast(
          isInternal ? 'Internal note added' : 'Reply sent & synced with customer!',
          'success'
        );
        this.openDrawer(this.currentTicketId);
        this.loadTickets();
        TelegramModule.loadLogs();
      }
    } catch (err) {
      App.showToast('Failed to send reply', 'error');
    }
  },

  async handlePropertyUpdate(selectId) {
    if (!this.currentTicketId) return;

    const status = document.getElementById('ticketStatusSelect').value;
    const priority = document.getElementById('ticketPrioritySelect').value;
    const assignedTo = document.getElementById('ticketAgentSelect').value;
    const department = document.getElementById('ticketDeptSelect').value;

    try {
      const res = await fetch(`/api/tickets/${this.currentTicketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, priority, assignedTo, department })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast('Ticket properties updated', 'success');
        this.loadTickets();
      }
    } catch (err) {
      App.showToast('Error updating ticket properties', 'error');
    }
  },

  async handleDeleteCurrentTicket() {
    if (!this.currentTicketId) return;
    if (window.AuthModule && AuthModule.currentUser?.role !== 'SUPER_ADMIN') {
      App.showToast('Access denied: Only Super Admin can delete tickets', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to delete Ticket #${this.currentTicketId}?`)) return;

    try {
      const headers = window.AuthModule ? AuthModule.getAuthHeaders() : {};
      const res = await fetch(`/api/tickets/${this.currentTicketId}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) {
        App.showToast(`Ticket #${this.currentTicketId} removed`, 'info');
        this.closeDrawer();
        this.loadTickets();
      } else {
        App.showToast(data.error || 'Failed to delete ticket', 'error');
      }
    } catch (err) {
      App.showToast('Error deleting ticket', 'error');
    }
  },

  openNewTicketModal() {
    const modal = document.getElementById('newTicketModalOverlay');
    if (modal) modal.classList.remove('hidden');
  },

  closeNewTicketModal() {
    const modal = document.getElementById('newTicketModalOverlay');
    if (modal) modal.classList.add('hidden');
  },

  async handleCreateTicket(e) {
    e.preventDefault();
    const title = document.getElementById('newTicketTitle').value.trim();
    const customerName = document.getElementById('newTicketCustomerName').value.trim();
    const customerEmail = document.getElementById('newTicketCustomerEmail').value.trim();
    const priority = document.getElementById('newTicketPriority').value;
    const department = document.getElementById('newTicketDept').value;
    const channel = document.getElementById('newTicketChannel').value;
    const assignedTo = document.getElementById('newTicketAssignee').value;
    const description = document.getElementById('newTicketDescription').value.trim();

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          customerName,
          customerEmail,
          priority,
          department,
          channel,
          assignedTo,
          description
        })
      });

      const data = await res.json();
      if (data.success) {
        App.showToast(`🎉 Ticket #${data.ticket.id} created successfully!`, 'success');
        this.closeNewTicketModal();
        document.getElementById('adminNewTicketForm').reset();
        this.loadTickets();
        this.openDrawer(data.ticket.id);
      }
    } catch (err) {
      App.showToast('Failed to create ticket', 'error');
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
};
