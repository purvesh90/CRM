// Ticket Management Engine: Split-Pane Support Desk, Kanban Board, & Tabular Triage
const TicketsModule = {
  tickets: [],
  currentTicketId: null,
  currentTicket: null,
  activeReplyMode: 'CUSTOMER', // 'CUSTOMER' or 'INTERNAL'
  splitReplyMode: 'CUSTOMER',  // 'CUSTOMER' or 'INTERNAL'
  currentView: 'SPLIT',        // 'SPLIT', 'KANBAN', or 'LIST'
  inboxSubfilter: 'ALL',       // 'ALL', 'OPEN', 'URGENT', 'TELEGRAM'
  streamMode: 'MESSAGES',      // 'MESSAGES' or 'AUDIT'
  pendingAttachment: null,

  init() {
    this.bindEvents();
    this.loadTickets();
  },

  bindEvents() {
    // Global filter controls bar
    ['filterStatus', 'filterPriority', 'filterChannel', 'filterDepartment'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.loadTickets());
    });

    const searchInput = document.getElementById('ticketsSearchInput');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => this.loadTickets(), 250);
      });
    }

    const resetBtn = document.getElementById('resetFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.getElementById('filterStatus').value = 'ALL';
        document.getElementById('filterPriority').value = 'ALL';
        document.getElementById('filterChannel').value = 'ALL';
        if (document.getElementById('filterDepartment') && !document.getElementById('filterDepartment').disabled) {
          document.getElementById('filterDepartment').value = 'ALL';
        }
        document.getElementById('ticketsSearchInput').value = '';
        this.inboxSubfilter = 'ALL';
        document.querySelectorAll('[data-inbox-filter]').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-inbox-filter') === 'ALL');
        });
        this.loadTickets();
      });
    }

    // View switcher (Split Desk vs Kanban vs List)
    const btnSplit = document.getElementById('viewSplitBtn');
    const btnKanban = document.getElementById('viewKanbanBtn');
    const btnList = document.getElementById('viewListBtn');
    if (btnSplit) btnSplit.addEventListener('click', () => this.switchView('SPLIT'));
    if (btnKanban) btnKanban.addEventListener('click', () => this.switchView('KANBAN'));
    if (btnList) btnList.addEventListener('click', () => this.switchView('LIST'));

    // Split Inbox Subfilter Chips (All, Open, Urgent, Telegram)
    document.querySelectorAll('[data-inbox-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-inbox-filter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.inboxSubfilter = chip.getAttribute('data-inbox-filter');
        this.renderSplitInbox();
      });
    });

    // Split Desk: Property Selects Listeners
    ['splitStatusSelect', 'splitPrioritySelect', 'splitAgentSelect', 'splitDeptSelect'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.handleSplitPropertyUpdate(id));
      }
    });

    // Split Desk: Composer Tabs (Customer vs Internal Note)
    const splitTabCust = document.getElementById('splitTabCustomer');
    const splitTabInt = document.getElementById('splitTabInternal');
    if (splitTabCust && splitTabInt) {
      splitTabCust.addEventListener('click', () => this.setSplitReplyMode('CUSTOMER'));
      splitTabInt.addEventListener('click', () => this.setSplitReplyMode('INTERNAL'));
    }

    // Split Desk: Stream Mode Tabs (Conversation Stream vs Audit Trail)
    const btnStreamMessages = document.getElementById('btnStreamMessages');
    const btnStreamAudit = document.getElementById('btnStreamAudit');
    if (btnStreamMessages) btnStreamMessages.addEventListener('click', () => this.switchStreamMode('MESSAGES'));
    if (btnStreamAudit) btnStreamAudit.addEventListener('click', () => this.switchStreamMode('AUDIT'));

    // CSAT Star buttons
    document.querySelectorAll('#splitCsatStars .csat-star-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rating = parseInt(btn.getAttribute('data-rating'), 10);
        if (rating) this.handleRateCSAT(rating);
      });
    });

    // Attachment input & remove
    const attachInput = document.getElementById('splitAttachmentInput');
    const removeAttachBtn = document.getElementById('splitRemoveAttachmentBtn');
    if (attachInput) {
      attachInput.addEventListener('change', (e) => this.handleAttachmentSelected(e));
    }
    if (removeAttachBtn) {
      removeAttachBtn.addEventListener('click', () => this.clearAttachment());
    }

    // Telegram One-time link button
    const tgLinkBtn = document.getElementById('splitLinkTelegramBtn');
    if (tgLinkBtn) {
      tgLinkBtn.addEventListener('click', () => this.handleGenerateTelegramLink());
    }

    // Live Typing Presence emitter on composer input
    const composerInput = document.getElementById('splitComposerInput');
    if (composerInput) {
      let typingDebounce;
      composerInput.addEventListener('input', () => {
        if (!this.currentTicketId) return;
        clearTimeout(typingDebounce);
        this.emitTyping(true);
        typingDebounce = setTimeout(() => {
          this.emitTyping(false);
        }, 1800);
      });
    }

    // Split Desk: Reply Form Submit
    const splitForm = document.getElementById('splitComposerForm');
    if (splitForm) {
      splitForm.addEventListener('submit', (e) => this.handleSplitSendReply(e));
    }

    // Split Desk: Quick Resolve Button
    const splitResolveBtn = document.getElementById('splitQuickResolveBtn');
    if (splitResolveBtn) {
      splitResolveBtn.addEventListener('click', () => this.handleSplitQuickResolve());
    }

    // Split Desk: Quick Close Button
    const splitCloseBtn = document.getElementById('splitQuickCloseBtn');
    if (splitCloseBtn) {
      splitCloseBtn.addEventListener('click', () => this.handleSplitQuickClose());
    }

    // Split Desk: Quick Reopen Button
    const splitReopenBtn = document.getElementById('splitQuickReopenBtn');
    if (splitReopenBtn) {
      splitReopenBtn.addEventListener('click', () => this.handleSplitQuickReopen());
    }

    // Split Desk: Delete Ticket Button
    const splitDeleteBtn = document.getElementById('splitDeleteTicketBtn');
    if (splitDeleteBtn) {
      splitDeleteBtn.addEventListener('click', () => this.handleDeleteCurrentTicket());
    }

    // Modal Drawer Property Selects Listeners
    ['ticketStatusSelect', 'ticketPrioritySelect', 'ticketAgentSelect', 'ticketDeptSelect'].forEach(selectId => {
      const el = document.getElementById(selectId);
      if (el) {
        el.addEventListener('change', () => this.handlePropertyUpdate(selectId));
      }
    });

    // Modal Drawer: Close & Overlay
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const overlay = document.getElementById('ticketModalOverlay');
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', () => this.closeDrawer());
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeDrawer();
      });
    }

    // Modal Drawer: Delete Button
    const deleteBtn = document.getElementById('deleteTicketBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.handleDeleteCurrentTicket());
    }

    // Modal Drawer: Composer Form
    const composerForm = document.getElementById('replyComposerForm');
    if (composerForm) {
      composerForm.addEventListener('submit', (e) => this.handleSendReply(e));
    }

    // Modal Drawer: Composer Tabs
    const tabCustomer = document.getElementById('tabReplyCustomer');
    const tabInternal = document.getElementById('tabInternalNote');
    if (tabCustomer && tabInternal) {
      tabCustomer.addEventListener('click', () => this.setReplyMode('CUSTOMER'));
      tabInternal.addEventListener('click', () => this.setReplyMode('INTERNAL'));
    }

    // Canned responses (delegated for both Split View and Drawer)
    document.querySelectorAll('.canned-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-reply');
        const splitInput = document.getElementById('splitComposerInput');
        const modalInput = document.getElementById('composerInput');
        if (splitInput) {
          splitInput.value = text;
          splitInput.focus();
        }
        if (modalInput) {
          modalInput.value = text;
          modalInput.focus();
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
      const department = document.getElementById('filterDepartment')?.value || 'ALL';
      const search = document.getElementById('ticketsSearchInput')?.value || '';

      const query = new URLSearchParams({ status, priority, channel, department, search });
      const headers = window.AuthModule ? AuthModule.getAuthHeaders() : {};
      const res = await fetch(`/api/tickets?${query.toString()}`, { headers });
      const data = await res.json();

      if (data.success) {
        this.tickets = data.tickets;
        this.updateRoleQueueBanner();
        this.renderSplitInbox();
        this.renderKanban();
        this.renderTable();
        this.renderUrgentDashboardList();
        if (window.App && typeof App.updateDashboardKPIs === 'function') {
          App.updateDashboardKPIs();
        }

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

  updateRoleQueueBanner() {
    const banner = document.getElementById('roleQueueBanner');
    const pill = document.getElementById('roleQueuePill');
    const descEl = document.getElementById('roleQueueDesc');
    const countEl = document.getElementById('roleQueueCountBadge');
    const deptSelect = document.getElementById('filterDepartment');

    if (!banner || !pill) return;

    const user = window.AuthModule?.currentUser;
    const count = this.tickets.length;

    if (countEl) {
      countEl.textContent = `${count} ticket${count === 1 ? '' : 's'} in queue`;
    }

    if (!user || user.role === 'SUPER_ADMIN') {
      pill.className = 'role-queue-pill pill-admin';
      pill.innerHTML = '<i data-lucide="shield-check" class="queue-pill-icon"></i> <span>Super Admin Full Scope</span>';
      if (descEl) descEl.textContent = 'Unrestricted view across all departments (Billing, Technical Support, Product)';
      if (deptSelect) deptSelect.disabled = false;
    } else if (user.role === 'BILLING_SPECIALIST') {
      pill.className = 'role-queue-pill pill-billing';
      pill.innerHTML = '<i data-lucide="credit-card" class="queue-pill-icon"></i> <span>Billing Department Queue</span>';
      if (descEl) descEl.textContent = 'Role-restricted: Showing strictly Billing, Invoices, Refunds & Subscription tickets';
      if (deptSelect) {
        deptSelect.value = 'Billing';
        deptSelect.disabled = true;
      }
    } else if (user.role === 'SUPPORT_AGENT') {
      pill.className = 'role-queue-pill pill-support';
      pill.innerHTML = '<i data-lucide="headphones" class="queue-pill-icon"></i> <span>Technical Support Queue</span>';
      if (descEl) descEl.textContent = 'Role-restricted: Showing Technical Support, Infrastructure & Triage tickets';
      if (deptSelect) {
        deptSelect.value = 'Technical Support';
        deptSelect.disabled = true;
      }
    } else if (user.role === 'CUSTOMER') {
      pill.className = 'role-queue-pill pill-customer';
      pill.innerHTML = '<i data-lucide="user" class="queue-pill-icon"></i> <span>Customer Portal Tickets</span>';
      if (descEl) descEl.textContent = `Showing only requests submitted by ${user.name} (${user.email})`;
      if (deptSelect) deptSelect.disabled = true;
    }

    if (window.lucide) lucide.createIcons();
  },

  /* ------------------------------------------------------------
     1. MASTER-DETAIL 3-PANE SPLIT INBOX DESK
     ------------------------------------------------------------ */
  renderSplitInbox() {
    const feed = document.getElementById('splitInboxTicketsFeed');
    const countEl = document.getElementById('splitInboxCount');
    if (!feed) return;

    let filtered = [...this.tickets];

    // Apply subfilter chip
    if (this.inboxSubfilter === 'OPEN') {
      filtered = filtered.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
    } else if (this.inboxSubfilter === 'URGENT') {
      filtered = filtered.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH');
    } else if (this.inboxSubfilter === 'TELEGRAM') {
      filtered = filtered.filter(t => t.channel === 'TELEGRAM');
    }

    if (countEl) {
      countEl.textContent = `${filtered.length} ticket${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      feed.innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:var(--text-muted);">
          <i data-lucide="check-circle-2" style="width:32px;height:32px;margin-bottom:8px;color:var(--emerald);"></i>
          <p style="font-size:0.85rem;font-weight:600;">Queue clear!</p>
          <span style="font-size:0.75rem;">No tickets match current filters.</span>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    feed.innerHTML = filtered.map(t => {
      const isActive = t.id === this.currentTicketId;
      const isTelegram = t.channel === 'TELEGRAM';
      const channelBadge = isTelegram
        ? `<span class="channel-tag-pill channel-tag-telegram"><i data-lucide="send"></i> Telegram</span>`
        : `<span class="channel-tag-pill channel-tag-web"><i data-lucide="globe"></i> Web</span>`;

      const initials = (t.customerName || 'Customer')
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      const timeAgo = this.formatTimeAgo(t.updatedAt || t.createdAt);

      // Senior Feature: SLA indicator on queue cards
      let slaIndicator = '';
      if (t.sla) {
        if (t.sla.isBreached) {
          slaIndicator = `<span class="inbox-sla-badge sla-breached" title="Resolution SLA Overdue"><i data-lucide="alert-triangle"></i> OVERDUE</span>`;
        } else if (t.sla.isResolved) {
          slaIndicator = `<span class="inbox-sla-badge sla-resolved" title="SLA Criteria Met"><i data-lucide="check"></i> SLA Met</span>`;
        } else {
          slaIndicator = `<span class="inbox-sla-badge sla-active" title="SLA Countdown: ${t.sla.resolutionRemainingText || 'Active'}"><i data-lucide="clock"></i> ${t.sla.resolutionRemainingText || 'SLA Active'}</span>`;
        }
      }

      // Senior Feature: Auto-escalation flag
      const escBadge = t.escalated ? `<span class="inbox-escalated-badge" title="Auto-escalated to supervisor"><i data-lucide="flame"></i> Escalated</span>` : '';

      return `
        <div class="inbox-ticket-item ${isActive ? 'active' : ''}" data-ticket-id="${t.id}" onclick="TicketsModule.selectSplitTicket('${t.id}')">
          <div class="inbox-ticket-top">
            <span class="inbox-ticket-id">#${t.id}</span>
            <span class="inbox-ticket-time">${timeAgo}</span>
          </div>
          <div class="inbox-ticket-subject">${this.escapeHtml(t.title)}</div>
          <div class="inbox-ticket-snippet">${this.escapeHtml(t.description || 'No description provided.')}</div>
          <div class="inbox-ticket-footer">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span class="priority-badge priority-${t.priority}">${t.priority}</span>
              ${slaIndicator}
              ${escBadge}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="inbox-customer-tag">${this.escapeHtml(t.customerName)}</span>
              ${channelBadge}
            </div>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();

    // If no ticket selected yet or active ticket not in current filter, select the first one automatically
    if (!this.currentTicketId && filtered.length > 0) {
      this.selectSplitTicket(filtered[0].id);
    } else if (this.currentTicketId) {
      const exists = filtered.some(t => t.id === this.currentTicketId);
      if (!exists && filtered.length > 0) {
        this.selectSplitTicket(filtered[0].id);
      }
    }
  },

  async selectSplitTicket(ticketId) {
    this.currentTicketId = ticketId;

    // Highlight active in feed
    document.querySelectorAll('.inbox-ticket-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-ticket-id') === ticketId);
    });

    const emptyBox = document.getElementById('splitThreadEmpty');
    const contentBox = document.getElementById('splitThreadContent');
    const detailsPane = document.getElementById('splitDetailsPane');

    if (emptyBox) emptyBox.classList.add('hidden');
    if (contentBox) contentBox.classList.remove('hidden');
    if (detailsPane) detailsPane.classList.remove('hidden');

    try {
      const headers = window.AuthModule ? AuthModule.getAuthHeaders() : {};
      const res = await fetch(`/api/tickets/${ticketId}`, { headers });
      const data = await res.json();
      if (data.success && data.ticket) {
        this.populateSplitTicket(data.ticket);
      } else {
        App.showToast(data.error || 'Failed to load ticket stream', 'error');
      }
    } catch (err) {
      App.showToast('Failed to load ticket stream', 'error');
    }
  },

  populateSplitTicket(ticket) {
    this.currentTicket = ticket;

    // Header
    const badgeId = document.getElementById('splitTicketBadgeId');
    const title = document.getElementById('splitTicketTitle');
    const priorityBadge = document.getElementById('splitTicketPriorityBadge');
    if (badgeId) badgeId.textContent = `#${ticket.id}`;
    if (title) title.textContent = ticket.title;
    if (priorityBadge) {
      priorityBadge.textContent = ticket.priority;
      priorityBadge.className = `priority-badge priority-${ticket.priority}`;
    }

    // SLA & Escalation Badges in Header
    const slaBadge = document.getElementById('splitTicketSlaBadge');
    const escBadge = document.getElementById('splitTicketEscalatedBadge');
    if (slaBadge) {
      if (ticket.sla) {
        if (ticket.sla.isBreached) {
          slaBadge.className = 'sla-pill sla-breached';
          slaBadge.innerHTML = `<i data-lucide="alert-triangle"></i> <span>OVERDUE (${ticket.sla.resolutionRemainingText || 'Breached'})</span>`;
        } else if (ticket.sla.isResolved) {
          slaBadge.className = 'sla-pill sla-resolved';
          slaBadge.innerHTML = `<i data-lucide="check-circle-2"></i> <span>SLA Met</span>`;
        } else {
          slaBadge.className = 'sla-pill sla-active';
          slaBadge.innerHTML = `<i data-lucide="clock"></i> <span>SLA: ${ticket.sla.resolutionRemainingText || 'Active'}</span>`;
        }
        slaBadge.classList.remove('hidden');
      } else {
        slaBadge.classList.add('hidden');
      }
    }
    if (escBadge) {
      escBadge.classList.toggle('hidden', !ticket.escalated);
    }

    // Customer strip
    const custAvatar = document.getElementById('splitCustAvatar');
    const custName = document.getElementById('splitCustName');
    const custEmail = document.getElementById('splitCustEmail');
    const channelTag = document.getElementById('splitChannelTag');
    const channelText = document.getElementById('splitChannelText');

    const initials = (ticket.customerName || 'Customer')
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    if (custAvatar) custAvatar.textContent = initials;
    if (custName) custName.textContent = ticket.customerName;
    if (custEmail) custEmail.textContent = ticket.customerEmail || 'No email registered';

    if (channelTag && channelText) {
      if (ticket.channel === 'TELEGRAM') {
        channelTag.className = 'channel-tag-pill channel-tag-telegram';
        channelTag.innerHTML = `<i data-lucide="send"></i> <span>Telegram Bot</span>`;
      } else {
        channelTag.className = 'channel-tag-pill channel-tag-web';
        channelTag.innerHTML = `<i data-lucide="globe"></i> <span>Web Portal</span>`;
      }
    }

    // CSAT Banner: Visible upon resolution / closure
    const csatBanner = document.getElementById('splitCsatBanner');
    const csatText = document.getElementById('splitCsatText');
    const csatStars = document.querySelectorAll('#splitCsatStars .csat-star-btn');
    if (csatBanner) {
      const isResolvedOrClosed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
      if (isResolvedOrClosed) {
        csatBanner.classList.remove('hidden');
        if (ticket.csat && ticket.csat.rating) {
          if (csatText) csatText.textContent = `Customer rating: ${ticket.csat.rating}/5 ⭐ (${ticket.csat.comment || 'Verified'})`;
          csatStars.forEach(btn => {
            const r = parseInt(btn.getAttribute('data-rating'), 10);
            btn.classList.toggle('active-star', r <= ticket.csat.rating);
            btn.disabled = true;
          });
        } else {
          if (csatText) csatText.textContent = 'Ticket resolved! How satisfied are you with this resolution?';
          csatStars.forEach(btn => {
            btn.classList.remove('active-star');
            btn.disabled = false;
          });
        }
      } else {
        csatBanner.classList.add('hidden');
      }
    }

    // Action buttons: Resolve, Close, Reopen, and Delete
    const currentUser = window.AuthModule?.currentUser;
    const isCustomer = currentUser && currentUser.role === 'CUSTOMER';
    const isAdmin = !currentUser || currentUser.role === 'SUPER_ADMIN';

    const splitResolveBtn = document.getElementById('splitQuickResolveBtn');
    const splitCloseBtn = document.getElementById('splitQuickCloseBtn');
    const splitReopenBtn = document.getElementById('splitQuickReopenBtn');
    const splitDeleteBtn = document.getElementById('splitDeleteTicketBtn');

    const isResolved = ticket.status === 'RESOLVED';
    const isClosed = ticket.status === 'CLOSED';
    const isResolvedOrClosed = isResolved || isClosed;

    if (splitResolveBtn) {
      splitResolveBtn.classList.toggle('hidden', isCustomer || isResolvedOrClosed);
    }
    if (splitCloseBtn) {
      splitCloseBtn.classList.toggle('hidden', isCustomer || isClosed);
    }
    if (splitReopenBtn) {
      splitReopenBtn.classList.toggle('hidden', isCustomer || !isResolvedOrClosed);
    }
    if (splitDeleteBtn) {
      splitDeleteBtn.classList.toggle('hidden', !isAdmin);
    }

    // Role-based authorization for private Internal Notes tab
    const splitTabInternal = document.getElementById('splitTabInternal');
    if (splitTabInternal) {
      if (isCustomer) {
        splitTabInternal.classList.add('hidden');
        this.setSplitReplyMode('CUSTOMER');
      } else {
        splitTabInternal.classList.remove('hidden');
      }
    }

    // Render Conversation Stream & Audit Trail Stream
    this.renderSplitMessages(ticket.messages || []);
    this.renderSplitAuditLog(ticket.auditLog || []);

    // Update tab counters
    const tabMsgCount = document.getElementById('tabMessagesCount');
    const tabAudCount = document.getElementById('tabAuditCount');
    if (tabMsgCount) tabMsgCount.textContent = `Conversation (${(ticket.messages || []).length})`;
    if (tabAudCount) tabAudCount.textContent = `Audit Trail (${(ticket.auditLog || []).length})`;

    // Reset stream tab view to Conversation Stream
    this.switchStreamMode('MESSAGES');

    // Right Details Pane: Customer 360
    const card360Avatar = document.getElementById('split360Avatar');
    const card360Name = document.getElementById('split360Name');
    const card360Email = document.getElementById('split360Email');
    const card360Company = document.getElementById('split360Company');
    const card360Telegram = document.getElementById('split360Telegram');

    if (card360Avatar) card360Avatar.textContent = initials.charAt(0);
    if (card360Name) card360Name.textContent = ticket.customerName;
    if (card360Email) card360Email.textContent = ticket.customerEmail || 'N/A';
    if (card360Company) card360Company.textContent = ticket.customerCompany || 'Enterprise Client';
    if (card360Telegram) {
      card360Telegram.textContent = ticket.telegramChatId ? `Encrypted (***${String(ticket.telegramChatId).slice(-4)})` : 'Not connected';
    }

    // Reset Telegram link generator button/display
    const linkDisplay = document.getElementById('splitTelegramLinkDisplay');
    if (linkDisplay) linkDisplay.classList.add('hidden');

    // Clear any previous attachment
    this.clearAttachment();

    // Properties dropdowns
    const statusSelect = document.getElementById('splitStatusSelect');
    const prioritySelect = document.getElementById('splitPrioritySelect');
    const agentSelect = document.getElementById('splitAgentSelect');
    const deptSelect = document.getElementById('splitDeptSelect');

    if (statusSelect) statusSelect.value = ticket.status;
    if (prioritySelect) prioritySelect.value = ticket.priority;
    if (agentSelect) agentSelect.value = ticket.assignedTo || 'Sarah Connor';
    if (deptSelect) deptSelect.value = ticket.department || 'Technical Support';

    // If customer role, prevent direct property alterations
    [statusSelect, prioritySelect, agentSelect, deptSelect].forEach(sel => {
      if (sel) sel.disabled = isCustomer;
    });

    // Audit Timeline timestamps
    const createdEl = document.getElementById('splitTimelineCreated');
    const updatedEl = document.getElementById('splitTimelineUpdated');
    if (createdEl) createdEl.textContent = new Date(ticket.createdAt).toLocaleString();
    if (updatedEl) updatedEl.textContent = new Date(ticket.updatedAt).toLocaleString();

    // Tags
    const tagsCloud = document.getElementById('splitTagsCloud');
    if (tagsCloud) {
      tagsCloud.innerHTML = (ticket.tags || ['Customer Care', 'General']).map(t => `<span class="tag-chip">${this.escapeHtml(t)}</span>`).join('');
    }

    // Notice
    const syncNotice = document.getElementById('splitSyncNotice');
    if (syncNotice) {
      if (ticket.channel === 'TELEGRAM' && ticket.telegramChatId) {
        syncNotice.textContent = 'Reply dispatches directly to customer Telegram chat';
      } else {
        syncNotice.textContent = 'Reply will be published to customer web portal';
      }
    }

    lucide.createIcons();
  },

  renderSplitMessages(messages) {
    const stream = document.getElementById('splitMessagesStream');
    if (!stream) return;

    if (!messages || messages.length === 0) {
      stream.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.8rem;">
          No conversation history yet. Start by sending a reply below.
        </div>
      `;
      return;
    }

    stream.innerHTML = messages.map(msg => {
      let rowClass = 'incoming';
      let icon = 'user';
      let syncTag = '';

      if (msg.isInternal) {
        rowClass = 'internal';
        icon = 'lock';
      } else if (msg.sender === 'AGENT') {
        rowClass = 'outgoing';
        icon = 'shield-check';
        if (msg.channel === 'TELEGRAM' || msg.channel === 'CRM_ADMIN') {
          syncTag = `<span style="font-size:0.65rem;color:rgba(255,255,255,0.7);display:flex;align-items:center;gap:3px;"><i data-lucide="check-check"></i> Synced to Telegram</span>`;
        }
      }

      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Render attached files/screenshots
      let attachmentsHtml = '';
      if (msg.attachments && msg.attachments.length > 0) {
        attachmentsHtml = `
          <div class="msg-attachments-wrap">
            ${msg.attachments.map(att => {
              const isImg = att.type && att.type.startsWith('image/');
              if (isImg && att.dataUrl) {
                return `
                  <a href="${att.dataUrl}" target="_blank" class="msg-attachment-img-preview" title="${this.escapeHtml(att.name)}">
                    <img src="${att.dataUrl}" alt="${this.escapeHtml(att.name)}" style="max-height:120px;border-radius:6px;margin-top:6px;display:block;border:1px solid rgba(255,255,255,0.15);">
                  </a>
                `;
              }
              return `
                <a href="${att.dataUrl || '#'}" download="${this.escapeHtml(att.name)}" class="msg-attachment-download-chip">
                  <i data-lucide="paperclip"></i>
                  <span>${this.escapeHtml(att.name)}</span>
                </a>
              `;
            }).join('')}
          </div>
        `;
      }

      return `
        <div class="msg-row ${rowClass}">
          <div class="msg-bubble">
            <div style="font-weight:700;font-size:0.7rem;margin-bottom:2px;display:flex;align-items:center;gap:4px;">
              <i data-lucide="${icon}"></i>
              ${this.escapeHtml(msg.senderName)}
            </div>
            <div>${this.escapeHtml(msg.text).replace(/\n/g, '<br>')}</div>
            ${attachmentsHtml}
          </div>
          <div class="msg-meta-row">
            <span>${timeStr}</span>
            ${syncTag}
          </div>
        </div>
      `;
    }).join('');

    stream.scrollTop = stream.scrollHeight;
    lucide.createIcons();
  },

  renderSplitAuditLog(auditLog) {
    const stream = document.getElementById('splitAuditStream');
    if (!stream) return;

    if (!auditLog || auditLog.length === 0) {
      stream.innerHTML = `
        <div style="text-align:center;padding:32px 16px;color:var(--text-muted);font-size:0.8rem;">
          <i data-lucide="history" style="width:28px;height:28px;margin-bottom:8px;opacity:0.5;"></i>
          <p>No audit trail recorded yet for this ticket.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    stream.innerHTML = auditLog.map(event => {
      let icon = 'activity';
      let badgeClass = 'badge-system';

      if (event.action === 'TICKET_CREATED') {
        icon = 'sparkles';
        badgeClass = 'badge-created';
      } else if (event.action === 'STATUS_CHANGE') {
        icon = 'refresh-cw';
        badgeClass = 'badge-status';
      } else if (event.action === 'ESCALATED' || event.action === 'SLA_BREACH') {
        icon = 'alert-triangle';
        badgeClass = 'badge-breach';
      } else if (event.action === 'MESSAGE_SENT') {
        icon = event.details?.isInternal ? 'lock' : 'message-square';
        badgeClass = event.details?.isInternal ? 'badge-internal' : 'badge-message';
      } else if (event.action === 'CSAT_RATING') {
        icon = 'star';
        badgeClass = 'badge-csat';
      } else if (event.action === 'ASSIGNMENT_CHANGE') {
        icon = 'user-check';
        badgeClass = 'badge-assignment';
      }

      const timeStr = new Date(event.timestamp).toLocaleString();
      let detailsHtml = '';
      if (event.details) {
        if (event.action === 'STATUS_CHANGE') {
          detailsHtml = `<div class="audit-detail-diff">State changed from <strong>${event.details.from}</strong> &rarr; <strong class="text-primary">${event.details.to}</strong></div>`;
        } else if (event.action === 'CSAT_RATING') {
          detailsHtml = `<div class="audit-detail-diff">Received <strong>${event.details.rating}/5 ⭐</strong> rating: "${this.escapeHtml(event.details.comment || '')}"</div>`;
        } else if (event.action === 'MESSAGE_SENT') {
          const typeStr = event.details.isInternal ? 'Internal staff note' : 'Public response';
          detailsHtml = `<div class="audit-detail-diff">${typeStr} (${event.details.textLength || 0} characters)</div>`;
        } else if (event.action === 'ASSIGNMENT_CHANGE') {
          detailsHtml = `<div class="audit-detail-diff">Assigned to: <strong>${event.details.assignedTo}</strong> (${event.details.department})</div>`;
        }
      }

      return `
        <div class="audit-event-item">
          <div class="audit-event-left">
            <div class="audit-icon-wrap ${badgeClass}">
              <i data-lucide="${icon}"></i>
            </div>
            <div class="audit-timeline-line"></div>
          </div>
          <div class="audit-event-content">
            <div class="audit-event-header">
              <span class="audit-action-name">${this.escapeHtml(event.action.replace(/_/g, ' '))}</span>
              <span class="audit-actor-badge">${this.escapeHtml(event.actor || 'System')} [${this.escapeHtml(event.role || 'CORE')}]</span>
              <span class="audit-time">${timeStr}</span>
            </div>
            ${detailsHtml}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  },

  switchStreamMode(mode) {
    this.streamMode = mode;
    const btnMsg = document.getElementById('btnStreamMessages');
    const btnAud = document.getElementById('btnStreamAudit');
    const msgStream = document.getElementById('splitMessagesStream');
    const audStream = document.getElementById('splitAuditStream');

    if (mode === 'MESSAGES') {
      if (btnMsg) btnMsg.classList.add('active');
      if (btnAud) btnAud.classList.remove('active');
      if (msgStream) msgStream.classList.remove('hidden');
      if (audStream) audStream.classList.add('hidden');
    } else {
      if (btnMsg) btnMsg.classList.remove('active');
      if (btnAud) btnAud.classList.add('active');
      if (msgStream) msgStream.classList.add('hidden');
      if (audStream) audStream.classList.remove('hidden');
    }
  },

  handleAttachmentSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      App.showToast('Attachment exceeds 5MB limit', 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      this.pendingAttachment = {
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: uploadEvent.target.result
      };

      const previewTag = document.getElementById('splitAttachmentPreview');
      const nameEl = document.getElementById('splitAttachmentName');
      if (previewTag && nameEl) {
        nameEl.textContent = file.name;
        previewTag.classList.remove('hidden');
      }
    };
    reader.readAsDataURL(file);
  },

  clearAttachment() {
    this.pendingAttachment = null;
    const input = document.getElementById('splitAttachmentInput');
    const previewTag = document.getElementById('splitAttachmentPreview');
    if (input) input.value = '';
    if (previewTag) previewTag.classList.add('hidden');
  },

  async handleRateCSAT(rating) {
    if (!this.currentTicketId) return;

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(window.AuthModule ? AuthModule.getAuthHeaders() : {})
      };

      const res = await fetch(`/api/tickets/${this.currentTicketId}/csat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rating,
          comment: `Rated ${rating}/5 stars from customer dashboard`
        })
      });

      const data = await res.json();
      if (data.success) {
        App.showToast(`Thank you! Rated ${rating}/5 ⭐ successfully`, 'success');
        await this.selectSplitTicket(this.currentTicketId);
        this.loadTickets();
      } else {
        App.showToast(data.error || 'Failed to submit CSAT rating', 'error');
      }
    } catch (err) {
      App.showToast('Error submitting CSAT rating', 'error');
    }
  },

  async handleGenerateTelegramLink() {
    if (!this.currentTicket) return;

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(window.AuthModule ? AuthModule.getAuthHeaders() : {})
      };

      const res = await fetch('/api/telegram/link-token', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerId: this.currentTicket.customerId || this.currentTicket.customerEmail
        })
      });

      const data = await res.json();
      if (data.success) {
        const linkDisplay = document.getElementById('splitTelegramLinkDisplay');
        const linkAnchor = document.getElementById('splitTelegramLinkAnchor');
        if (linkDisplay && linkAnchor) {
          linkAnchor.href = data.link;
          linkAnchor.innerHTML = `<i data-lucide="send"></i> <span>Open Bot with Verification Link</span>`;
          linkDisplay.classList.remove('hidden');
          lucide.createIcons();
          App.showToast('One-time secure Telegram linking token generated!', 'success');
        }
      } else {
        App.showToast(data.error || 'Failed to generate linking token', 'error');
      }
    } catch (err) {
      App.showToast('Error requesting Telegram link', 'error');
    }
  },

  setSplitReplyMode(mode) {
    this.splitReplyMode = mode;
    const tabCustomer = document.getElementById('splitTabCustomer');
    const tabInternal = document.getElementById('splitTabInternal');
    const input = document.getElementById('splitComposerInput');

    if (mode === 'CUSTOMER') {
      tabCustomer.classList.add('active');
      tabInternal.classList.remove('active');
      if (input) input.placeholder = 'Type response to customer... (Telegram customer receives it instantly)';
    } else {
      tabCustomer.classList.remove('active');
      tabInternal.classList.add('active');
      if (input) input.placeholder = '🔒 Type internal staff note (visible only to support specialists)...';
    }
  },

  async handleSplitSendReply(e) {
    e.preventDefault();
    if (!this.currentTicketId) return;

    const input = document.getElementById('splitComposerInput');
    const text = input ? input.value.trim() : '';
    if (!text && !this.pendingAttachment) return;

    const isInternal = this.splitReplyMode === 'INTERNAL';
    const currentUser = window.AuthModule?.currentUser;
    const sender = (currentUser && currentUser.role === 'CUSTOMER') ? 'CUSTOMER' : 'AGENT';
    const senderName = currentUser ? currentUser.name : (document.getElementById('splitAgentSelect')?.value || 'Support Agent');

    const attachments = this.pendingAttachment ? [this.pendingAttachment] : [];

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(window.AuthModule ? AuthModule.getAuthHeaders() : {})
      };

      const res = await fetch(`/api/tickets/${this.currentTicketId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: text || (attachments.length ? `[Attached file: ${attachments[0].name}]` : ''),
          sender,
          senderName,
          isInternal,
          attachments
        })
      });

      const data = await res.json();
      if (data.success) {
        if (input) input.value = '';
        this.clearAttachment();
        App.showToast(isInternal ? 'Internal staff note added' : 'Message dispatched to customer & Telegram!', 'success');
        await this.selectSplitTicket(this.currentTicketId);
        this.loadTickets();
        if (window.TelegramModule && typeof TelegramModule.loadLogs === 'function') {
          TelegramModule.loadLogs();
        }
      } else {
        App.showToast(data.error || 'Failed to dispatch reply', 'error');
      }
    } catch (err) {
      App.showToast('Failed to send message', 'error');
    }
  },

  async handleSplitQuickResolve() {
    if (!this.currentTicketId) return;
    const statusSelect = document.getElementById('splitStatusSelect');
    if (statusSelect) statusSelect.value = 'RESOLVED';
    await this.handleSplitPropertyUpdate('splitStatusSelect');
  },

  async handleSplitPropertyUpdate(selectId) {
    if (!this.currentTicketId) return;

    const status = document.getElementById('splitStatusSelect')?.value;
    const priority = document.getElementById('splitPrioritySelect')?.value;
    const assignedTo = document.getElementById('splitAgentSelect')?.value;
    const department = document.getElementById('splitDeptSelect')?.value;

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(window.AuthModule ? AuthModule.getAuthHeaders() : {})
      };

      const res = await fetch(`/api/tickets/${this.currentTicketId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, priority, assignedTo, department })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast('Ticket properties updated', 'success');
        await this.selectSplitTicket(this.currentTicketId);
        this.loadTickets();
      } else {
        App.showToast(data.error || 'Invalid property transition', 'error');
        // Revert status dropdown if invalid state transition was rejected by server state machine
        if (this.currentTicket && document.getElementById('splitStatusSelect')) {
          document.getElementById('splitStatusSelect').value = this.currentTicket.status;
        }
      }
    } catch (err) {
      App.showToast('Error updating ticket properties', 'error');
    }
  },

  async handleSplitQuickResolve() {
    if (!this.currentTicketId) return;
    const statusSelect = document.getElementById('splitStatusSelect');
    if (statusSelect) statusSelect.value = 'RESOLVED';
    await this.handleSplitPropertyUpdate('splitStatusSelect');
  },

  async handleSplitQuickClose() {
    if (!this.currentTicketId) return;
    const statusSelect = document.getElementById('splitStatusSelect');
    if (statusSelect) statusSelect.value = 'CLOSED';
    await this.handleSplitPropertyUpdate('splitStatusSelect');
  },

  async handleSplitQuickReopen() {
    if (!this.currentTicketId) return;
    const statusSelect = document.getElementById('splitStatusSelect');
    if (statusSelect) statusSelect.value = 'OPEN';
    await this.handleSplitPropertyUpdate('splitStatusSelect');
  },

  emitTyping(isTyping) {
    if (!this.currentTicketId) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(window.AuthModule ? AuthModule.getAuthHeaders() : {})
      };
      fetch(`/api/tickets/${this.currentTicketId}/typing`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ isTyping })
      }).catch(() => {});
    } catch (e) {}
  },

  appendLiveMessage(msg) {
    const stream = document.getElementById('splitMessagesStream');
    if (!stream || !msg) return;

    // Remove empty state message if present
    if (stream.innerHTML.includes('No conversation history yet')) {
      stream.innerHTML = '';
    }

    const rowClass = msg.isInternal ? 'internal' : (msg.sender === 'AGENT' ? 'outgoing' : 'incoming');
    const icon = msg.isInternal ? 'lock' : (msg.sender === 'AGENT' ? 'shield-check' : 'user');
    const timeStr = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let syncTag = '';
    if (msg.channel === 'TELEGRAM' || msg.channel === 'CRM_ADMIN') {
      syncTag = `<span style="font-size:0.65rem;color:rgba(255,255,255,0.7);display:flex;align-items:center;gap:3px;"><i data-lucide="check-check"></i> Synced to Telegram</span>`;
    }

    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.length > 0) {
      attachmentsHtml = `
        <div class="msg-attachments-wrap">
          ${msg.attachments.map(att => {
            const isImg = att.type && att.type.startsWith('image/');
            if (isImg && att.dataUrl) {
              return `
                <a href="${att.dataUrl}" target="_blank" class="msg-attachment-img-preview" title="${this.escapeHtml(att.name)}">
                  <img src="${att.dataUrl}" alt="${this.escapeHtml(att.name)}" style="max-height:120px;border-radius:6px;margin-top:6px;display:block;border:1px solid rgba(255,255,255,0.15);">
                </a>
              `;
            }
            return `
              <a href="${att.dataUrl || '#'}" download="${this.escapeHtml(att.name)}" class="msg-attachment-download-chip">
                <i data-lucide="paperclip"></i>
                <span>${this.escapeHtml(att.name)}</span>
              </a>
            `;
          }).join('')}
        </div>
      `;
    }

    const div = document.createElement('div');
    div.className = `msg-row ${rowClass} msg-live-in`;
    div.innerHTML = `
      <div class="msg-bubble">
        <div style="font-weight:700;font-size:0.7rem;margin-bottom:2px;display:flex;align-items:center;gap:4px;">
          <i data-lucide="${icon}"></i>
          ${this.escapeHtml(msg.senderName)}
        </div>
        <div>${this.escapeHtml(msg.text).replace(/\n/g, '<br>')}</div>
        ${attachmentsHtml}
      </div>
      <div class="msg-meta-row">
        <span>${timeStr}</span>
        ${syncTag}
      </div>
    `;

    stream.appendChild(div);
    stream.scrollTop = stream.scrollHeight;
    lucide.createIcons();
  },

  markTicketUnread(ticketId) {
    const card = document.querySelector(`.inbox-ticket-item[data-ticket-id="${ticketId}"]`);
    if (!card) return;
    card.classList.add('ticket-unread-live');
    let dot = card.querySelector('.live-unread-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'live-unread-dot';
      const topRow = card.querySelector('.inbox-ticket-top');
      if (topRow) topRow.appendChild(dot);
    }
  },

  /* ------------------------------------------------------------
     2. KANBAN BOARD TRIAGE
     ------------------------------------------------------------ */
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
      : `<span class="ticket-channel-icon" style="color:var(--primary);background:var(--primary-light);"><i data-lucide="globe"></i> Web</span>`;

    const initials = (ticket.assignedTo || 'Unassigned')
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

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

    card.addEventListener('click', () => {
      this.switchView('SPLIT');
      this.selectSplitTicket(ticket.id);
    });

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
        App.showToast(`Ticket #${ticketId} moved to ${newStatus.replace('_', ' ')}`, 'info');
        this.loadTickets();
      }
    } catch (err) {
      App.showToast('Failed to update status', 'error');
    }
  },

  /* ------------------------------------------------------------
     3. TABULAR LIST VIEW
     ------------------------------------------------------------ */
  renderTable() {
    const tbody = document.getElementById('ticketsTableBody');
    if (!tbody) return;

    if (this.tickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted);">No tickets found matching filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.tickets.map(t => {
      const isTg = t.channel === 'TELEGRAM';
      const chBadge = isTg
        ? `<span class="channel-tag-pill channel-tag-telegram"><i data-lucide="send"></i> Telegram</span>`
        : `<span class="channel-tag-pill channel-tag-web"><i data-lucide="globe"></i> Web</span>`;

      return `
        <tr data-id="${t.id}">
          <td><strong style="color:var(--primary);font-family:var(--font-mono);">#${t.id}</strong></td>
          <td><strong>${this.escapeHtml(t.title)}</strong></td>
          <td>${this.escapeHtml(t.customerName)}</td>
          <td>${chBadge}</td>
          <td><span class="priority-badge priority-${t.priority}">${t.priority}</span></td>
          <td><span style="font-weight:600;font-size:0.75rem;">${t.status.replace('_', ' ')}</span></td>
          <td>${this.escapeHtml(t.assignedTo)}</td>
          <td><small class="text-muted">${this.formatTimeAgo(t.updatedAt || t.createdAt)}</small></td>
          <td>
            <button class="btn-secondary btn-icon-only" title="Open Desk" onclick="TicketsModule.switchView('SPLIT'); TicketsModule.selectSplitTicket('${t.id}')">
              <i data-lucide="arrow-right"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.switchView('SPLIT');
          this.selectSplitTicket(row.getAttribute('data-id'));
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
        <div style="text-align:center;padding:24px;color:var(--text-muted);">
          <i data-lucide="shield-check" style="width:32px;height:32px;margin-bottom:8px;color:var(--emerald);"></i>
          <p>No critical unresolved tickets in the SLA queue!</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = urgentTickets.map(t => `
      <div class="urgent-ticket-item" onclick="App.switchTab('tickets'); TicketsModule.switchView('SPLIT'); TicketsModule.selectSplitTicket('${t.id}')">
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
    const btnSplit = document.getElementById('viewSplitBtn');
    const btnKanban = document.getElementById('viewKanbanBtn');
    const btnList = document.getElementById('viewListBtn');

    const splitView = document.getElementById('splitInboxView');
    const kanbanView = document.getElementById('kanbanBoardView');
    const listView = document.getElementById('ticketListView');

    if (btnSplit) btnSplit.classList.toggle('active', view === 'SPLIT');
    if (btnKanban) btnKanban.classList.toggle('active', view === 'KANBAN');
    if (btnList) btnList.classList.toggle('active', view === 'LIST');

    if (splitView) splitView.classList.toggle('hidden', view !== 'SPLIT');
    if (kanbanView) kanbanView.classList.toggle('hidden', view !== 'KANBAN');
    if (listView) listView.classList.toggle('hidden', view !== 'LIST');
  },

  /* ------------------------------------------------------------
     4. MODAL DRAWER FALLBACK (DEEP-DIVE & QUICK ACTIONS)
     ------------------------------------------------------------ */
  async openDrawer(ticketId) {
    this.currentTicketId = ticketId;
    const overlay = document.getElementById('ticketModalOverlay');
    if (overlay) overlay.classList.remove('hidden');

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
    if (overlay) overlay.classList.add('hidden');
  },

  renderDrawerTicket(ticket) {
    document.getElementById('drawerTicketId').textContent = `#${ticket.id}`;
    document.getElementById('drawerTicketTitle').textContent = ticket.title;
    document.getElementById('drawerCustomerName').textContent = ticket.customerName;
    document.getElementById('drawerCustomerEmail').textContent = ticket.customerEmail || 'No email attached';

    const chBadge = document.getElementById('drawerChannelBadge');
    if (ticket.channel === 'TELEGRAM') {
      chBadge.innerHTML = `<i data-lucide="send"></i> <span>Telegram Bot Channel</span>`;
      chBadge.style.color = 'var(--cyan)';
    } else {
      chBadge.innerHTML = `<i data-lucide="globe"></i> <span>Web Portal Channel</span>`;
      chBadge.style.color = 'var(--primary)';
    }

    document.getElementById('ticketStatusSelect').value = ticket.status;
    document.getElementById('ticketPrioritySelect').value = ticket.priority;
    document.getElementById('ticketAgentSelect').value = ticket.assignedTo || 'Sarah Connor';
    document.getElementById('ticketDeptSelect').value = ticket.department || 'Technical Support';

    document.getElementById('drawerMetaTelegramId').textContent = ticket.telegramChatId ? `Encrypted (***${String(ticket.telegramChatId).slice(-4)})` : 'Not linked';
    document.getElementById('drawerMetaTelegramUser').textContent = ticket.telegramUsername ? 'Protected Account' : 'None';

    document.getElementById('drawerMetaCreated').textContent = new Date(ticket.createdAt).toLocaleString();
    document.getElementById('drawerMetaUpdated').textContent = new Date(ticket.updatedAt).toLocaleString();
    document.getElementById('drawerMetaResolved').textContent = ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString() : 'In Progress';

    const tagsCloud = document.getElementById('drawerTagsCloud');
    if (tagsCloud) {
      tagsCloud.innerHTML = (ticket.tags || ['Support']).map(tag => `<span class="tag-chip">${this.escapeHtml(tag)}</span>`).join('');
    }

    this.renderDrawerMessages(ticket.messages || []);

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
          syncNotice = `<div style="font-size:0.65rem;color:rgba(255,255,255,0.7);display:flex;align-items:center;gap:3px;margin-top:3px;"><i data-lucide="check-check"></i> Delivered via Telegram</div>`;
        }
      }

      return `
        <div class="msg-row ${msg.sender === 'AGENT' ? 'outgoing' : msg.isInternal ? 'internal' : 'incoming'}">
          <div class="msg-bubble">
            <div style="font-weight:700;font-size:0.7rem;margin-bottom:2px;display:flex;align-items:center;gap:4px;">
              <i data-lucide="${icon}"></i>
              ${this.escapeHtml(msg.senderName)}
            </div>
            <div>${this.escapeHtml(msg.text).replace(/\n/g, '<br>')}</div>
            ${syncNotice}
          </div>
          <div class="msg-meta-row">
            <span>${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
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
        App.showToast(isInternal ? 'Internal note added' : 'Reply sent & synced with customer!', 'success');
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
      const headers = {
        'Content-Type': 'application/json',
        ...(window.AuthModule ? AuthModule.getAuthHeaders() : {})
      };

      const res = await fetch(`/api/tickets/${this.currentTicketId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, priority, assignedTo, department })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast('Ticket properties updated', 'success');
        this.loadTickets();
      } else {
        App.showToast(data.error || 'Failed to update ticket', 'error');
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
        this.currentTicketId = null;
        await this.loadTickets();
      } else {
        App.showToast(data.error || 'Failed to delete ticket', 'error');
      }
    } catch (err) {
      App.showToast('Error deleting ticket', 'error');
    }
  },

  openNewTicketModal() {
    const modal = document.getElementById('newTicketModalOverlay');
    if (!modal) return;
    modal.classList.remove('hidden');

    const currentUser = window.AuthModule?.currentUser;
    const isCustomer = currentUser && currentUser.role === 'CUSTOMER';
    const nameInput = document.getElementById('newTicketCustomerName');
    const emailInput = document.getElementById('newTicketCustomerEmail');
    const assigneeGroup = document.getElementById('newTicketAssignee')?.closest('.form-group');
    const channelGroup = document.getElementById('newTicketChannel')?.closest('.form-group');
    const modalTitle = modal.querySelector('.modal-dialog-header h3');

    if (isCustomer) {
      if (nameInput) {
        nameInput.value = currentUser.name;
        nameInput.readOnly = true;
      }
      if (emailInput) {
        emailInput.value = currentUser.email;
        emailInput.readOnly = true;
      }
      if (assigneeGroup) assigneeGroup.style.display = 'none';
      if (channelGroup) channelGroup.style.display = 'none';
      if (modalTitle) modalTitle.textContent = 'Submit Support Request';
    } else {
      if (nameInput) nameInput.readOnly = false;
      if (emailInput) emailInput.readOnly = false;
      if (assigneeGroup) assigneeGroup.style.display = 'block';
      if (channelGroup) channelGroup.style.display = 'block';
      if (modalTitle) modalTitle.textContent = 'Create New Support Ticket';
    }
  },

  closeNewTicketModal() {
    const modal = document.getElementById('newTicketModalOverlay');
    if (modal) modal.classList.add('hidden');
  },

  async handleCreateTicket(e) {
    e.preventDefault();
    const currentUser = window.AuthModule?.currentUser;
    const isCustomer = currentUser && currentUser.role === 'CUSTOMER';

    const title = document.getElementById('newTicketTitle').value.trim();
    const customerName = isCustomer ? currentUser.name : document.getElementById('newTicketCustomerName').value.trim();
    const customerEmail = isCustomer ? currentUser.email : document.getElementById('newTicketCustomerEmail').value.trim();
    const priority = document.getElementById('newTicketPriority').value;
    const department = document.getElementById('newTicketDept').value;
    const channel = isCustomer ? 'WEB_PORTAL' : (document.getElementById('newTicketChannel')?.value || 'WEB_PORTAL');
    const assignedTo = isCustomer ? '' : (document.getElementById('newTicketAssignee')?.value || '');
    const description = document.getElementById('newTicketDescription').value.trim();

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(window.AuthModule ? AuthModule.getAuthHeaders() : {})
      };

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers,
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
        await this.loadTickets();
        this.switchView('SPLIT');
        this.selectSplitTicket(data.ticket.id);
      }
    } catch (err) {
      App.showToast('Failed to create ticket', 'error');
    }
  },

  formatTimeAgo(dateStr) {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
};
