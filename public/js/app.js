// PulseDesk CRM Main Coordinator & State Manager
const App = {
  currentTab: 'dashboard',
  isCustomerView: false,

  init() {
    this.bindEvents();
    this.initSSE();
    this.loadCustomers();
    this.loadAgents();
    this.loadAnalytics();
    this.loadSettings();
    this.updateDashboardKPIs();

    // Initialize modules
    TicketsModule.init();
    TelegramModule.init();

    // Chart init
    setTimeout(() => {
      AnalyticsModule.initDashboardOverviewChart();
      lucide.createIcons();
    }, 150);

    // Deep link tab support from hash
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`tab-${hash}`)) {
      this.switchTab(hash);
    }
  },

  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // View Switcher (Admin vs Customer Portal)
    const btnAdmin = document.getElementById('btnAdminView');
    const btnCust = document.getElementById('btnCustomerView');
    if (btnAdmin && btnCust) {
      btnAdmin.addEventListener('click', () => this.switchPortalMode(false));
      btnCust.addEventListener('click', () => this.switchPortalMode(true));
    }

    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('appSidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }

    // Refresh Dashboard button
    const refreshDashBtn = document.getElementById('refreshDashboardBtn');
    if (refreshDashBtn) {
      refreshDashBtn.addEventListener('click', () => {
        this.updateDashboardKPIs();
        TicketsModule.loadTickets();
        TelegramModule.loadLogs();
        this.showToast('Command center refreshed with live data', 'info');
      });
    }

    // View All Tickets from Dashboard link
    const viewAllBtn = document.getElementById('viewAllTicketsFromDash');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => this.switchTab('tickets'));
    }

    // Quick open simulator link from Dashboard
    const quickSimBtn = document.getElementById('openTelegramSimulatorQuick');
    if (quickSimBtn) {
      quickSimBtn.addEventListener('click', () => this.switchTab('telegram'));
    }

    // Customer Portal: Submit Ticket Form
    const custForm = document.getElementById('customerSubmitTicketForm');
    if (custForm) {
      custForm.addEventListener('submit', (e) => this.handleCustomerPortalSubmit(e));
    }

    // Customer Portal: Track Ticket Button
    const trackBtn = document.getElementById('portalTrackTicketBtn');
    if (trackBtn) {
      trackBtn.addEventListener('click', () => this.handleTrackTicketLookup());
    }



    // Settings Form
    const settingsForm = document.getElementById('systemSettingsForm');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => this.handleSaveSettings(e));
    }

    // Customer Directory Search
    const custSearch = document.getElementById('customerSearchInput');
    if (custSearch) {
      custSearch.addEventListener('input', (e) => this.filterCustomersTable(e.target.value));
    }

    // Global Search Keyboard Shortcut (Ctrl+K or /)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) searchInput.focus();
      }
    });

    const globalSearch = document.getElementById('globalSearchInput');
    if (globalSearch) {
      globalSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = globalSearch.value.trim();
          if (val) {
            this.switchTab('tickets');
            const ticketSearch = document.getElementById('ticketsSearchInput');
            if (ticketSearch) {
              ticketSearch.value = val;
              TicketsModule.loadTickets();
            }
          }
        }
      });
    }

    // Export CSV report
    const exportBtn = document.getElementById('exportReportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCsvReport());
    }
  },

  switchTab(tabName) {
    if (this.isCustomerView) {
      this.switchPortalMode(false);
    }

    this.currentTab = tabName;
    window.location.hash = tabName;

    // Update sidebar active link
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      if (item.getAttribute('data-tab') === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Hide all tabs and show targeted
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`tab-${tabName}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // Re-render charts or data if analytics tab
    if (tabName === 'analytics') {
      this.loadAnalytics();
    } else if (tabName === 'dashboard') {
      AnalyticsModule.initDashboardOverviewChart();
      this.updateDashboardKPIs();
    } else if (tabName === 'telegram') {
      TelegramModule.loadLogs();
      TelegramModule.loadStatus();
    }

    lucide.createIcons();
  },

  switchPortalMode(isCustomer) {
    this.isCustomerView = isCustomer;
    const btnAdmin = document.getElementById('btnAdminView');
    const btnCust = document.getElementById('btnCustomerView');
    const sidebar = document.getElementById('appSidebar');
    const panels = document.querySelectorAll('.tab-panel');
    const portalContainer = document.getElementById('customerPortalContainer');

    if (isCustomer) {
      btnCust.classList.add('active');
      btnAdmin.classList.remove('active');
      sidebar.classList.add('hidden');
      panels.forEach(p => p.classList.add('hidden'));
      portalContainer.classList.remove('hidden');
    } else {
      btnAdmin.classList.add('active');
      btnCust.classList.remove('active');
      sidebar.classList.remove('hidden');
      portalContainer.classList.add('hidden');
      panels.forEach(p => p.classList.remove('hidden'));
      this.switchTab(this.currentTab || 'dashboard');
    }
    lucide.createIcons();
  },

  async updateDashboardKPIs() {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (data.success && data.analytics) {
        const a = data.analytics;
        document.getElementById('kpiActiveTickets').textContent = (a.open + a.inProgress + a.waiting);
        document.getElementById('kpiUrgentSubtext').textContent = `${a.urgent} Urgent SLA Pending`;
        document.getElementById('kpiTelegramTickets').textContent = a.telegramCount;
        document.getElementById('kpiResolvedTickets').textContent = a.resolved;
        document.getElementById('kpiAvgHours').textContent = `Avg. ${a.avgResolutionHours} hrs resolution`;
        document.getElementById('kpiCsatScore').textContent = a.csatScore;
      }
    } catch (e) {
      // ignore
    }
  },

  async loadCustomers() {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      const tbody = document.getElementById('customersTableBody');
      if (data.success && tbody) {
        this.renderCustomersTable(data.customers);
      }
    } catch (err) {
      console.warn('Failed to load customers:', err);
    }
  },

  renderCustomersTable(customers) {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;

    tbody.innerHTML = customers.map(c => {
      const tgDisplay = c.telegramUsername
        ? '<span class="ticket-channel-icon"><i data-lucide="shield-check"></i> Secured Gateway</span>'
        : '<span class="text-muted">Direct Web</span>';

      const statusBadge = c.status === 'VIP'
        ? '<span class="priority-badge priority-URGENT">VIP Tier</span>'
        : '<span class="priority-badge priority-MEDIUM">Active</span>';

      return `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td>${c.company || 'Individual'}</td>
          <td><code>${c.email}</code></td>
          <td>${tgDisplay}</td>
          <td>${statusBadge}</td>
          <td><strong>${c.totalTickets || 1}</strong> tickets</td>
          <td><small class="text-muted">${new Date(c.createdAt).toLocaleDateString()}</small></td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  },

  filterCustomersTable(query) {
    const q = query.toLowerCase();
    const rows = document.querySelectorAll('#customersTableBody tr');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(q) ? '' : 'none';
    });
  },

  async loadAgents() {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      const grid = document.getElementById('agentsCardsGrid');
      if (data.success && grid) {
        grid.innerHTML = data.agents.map(ag => `
          <div class="agent-profile-card">
            <img src="${ag.avatar}" alt="${ag.name}" class="agent-card-avatar">
            <div class="agent-card-name">${ag.name}</div>
            <div class="agent-card-role">${ag.role}</div>
            <div class="agent-card-email">${ag.email}</div>
            <div class="agent-card-stats-row">
              <div class="agent-stat-item">
                <span class="agent-stat-val text-indigo">${ag.activeTickets}</span>
                <span class="agent-stat-lbl">Active Queue</span>
              </div>
              <div class="agent-stat-item">
                <span class="agent-stat-val text-emerald">99.1%</span>
                <span class="agent-stat-lbl">SLA Rate</span>
              </div>
              <div class="agent-stat-item">
                <span class="agent-stat-val text-amber">4.9/5</span>
                <span class="agent-stat-lbl">Rating</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.warn('Failed to load agents:', e);
    }
  },

  async loadAnalytics() {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (data.success && data.analytics) {
        AnalyticsModule.renderAnalyticsCharts(data.analytics);
      }
    } catch (e) {
      console.warn('Failed to load analytics:', e);
    }
  },

  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        const nameInput = document.getElementById('settingCompanyName');
        const welcomeInput = document.getElementById('settingWelcomeMessage');
        const autoAssignInput = document.getElementById('settingAutoAssign');
        const tgEnabledInput = document.getElementById('settingTelegramEnabled');

        if (nameInput) nameInput.value = s.companyName || '';
        if (welcomeInput) welcomeInput.value = s.welcomeMessage || '';
        if (autoAssignInput) autoAssignInput.checked = s.autoAssign !== false;
        if (tgEnabledInput) tgEnabledInput.checked = s.telegramEnabled !== false;
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  },

  async handleSaveSettings(e) {
    e.preventDefault();
    const companyName = document.getElementById('settingCompanyName').value.trim();
    const welcomeMessage = document.getElementById('settingWelcomeMessage').value.trim();
    const autoAssign = document.getElementById('settingAutoAssign').checked;
    const telegramEnabled = document.getElementById('settingTelegramEnabled').checked;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, welcomeMessage, autoAssign, telegramEnabled })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('System configuration saved successfully!', 'success');
      }
    } catch (err) {
      this.showToast('Failed to save settings', 'error');
    }
  },

  // Customer Portal: Submit Support Ticket
  async handleCustomerPortalSubmit(e) {
    e.preventDefault();
    const customerName = document.getElementById('custName').value.trim();
    const customerEmail = document.getElementById('custEmail').value.trim();
    const company = document.getElementById('custCompany').value.trim();
    const department = document.getElementById('custDept').value;
    const priority = document.getElementById('custPriority').value;
    const title = document.getElementById('custSubject').value.trim();
    const description = document.getElementById('custDescription').value.trim();

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          customerName,
          customerEmail,
          company,
          department,
          priority,
          channel: 'WEB_PORTAL'
        })
      });

      const data = await res.json();
      if (data.success) {
        document.getElementById('customerSubmitTicketForm').reset();
        this.showToast(`🎉 Ticket #${data.ticket.id} submitted! Our agent is assigned.`, 'success');

        // Show ticket confirmation in the track box
        const trackBox = document.getElementById('portalTrackResult');
        trackBox.classList.remove('hidden');
        trackBox.innerHTML = `
          <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);padding:14px;border-radius:10px;">
            <h4 style="color:#34d399;margin-bottom:6px;">Support Ticket #${data.ticket.id} Created</h4>
            <p style="font-size:0.8rem;color:#cbd5e1;">Your request has been routed to <strong>${data.ticket.assignedTo}</strong>. You can check back anytime with ID <code>${data.ticket.id}</code>.</p>
          </div>
        `;
      }
    } catch (err) {
      this.showToast('Submission failed. Please check network.', 'error');
    }
  },

  async handleTrackTicketLookup() {
    const input = document.getElementById('portalTrackTicketId');
    const ticketId = input ? input.value.trim().toUpperCase() : '';
    if (!ticketId) return;

    const trackBox = document.getElementById('portalTrackResult');
    trackBox.classList.remove('hidden');
    trackBox.innerHTML = `<p class="text-muted">Searching for ticket ${ticketId}...</p>`;

    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      const data = await res.json();
      if (data.success && data.ticket) {
        const t = data.ticket;
        trackBox.innerHTML = `
          <div style="background:rgba(15,23,42,0.9);border:1px solid rgba(255,255,255,0.1);padding:16px;border-radius:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong style="color:#6366f1;">#${t.id} - ${t.title}</strong>
              <span class="priority-badge priority-${t.priority}">${t.status.replace('_', ' ')}</span>
            </div>
            <p style="font-size:0.8rem;color:#94a3b8;margin-bottom:8px;">Assigned Specialist: <strong>${t.assignedTo}</strong></p>
            <div style="font-size:0.75rem;color:#64748b;">Last Updated: ${new Date(t.updatedAt).toLocaleString()}</div>
          </div>
        `;
      } else {
        trackBox.innerHTML = `<div style="color:#fb7185;padding:10px;">Ticket <strong>${ticketId}</strong> was not found. Please verify the ID.</div>`;
      }
    } catch (err) {
      trackBox.innerHTML = `<div style="color:#fb7185;">Lookup error.</div>`;
    }
  },

  // Export CSV Report
  async exportCsvReport() {
    try {
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (!data.success || !data.tickets) return;

      const headers = ['ID', 'Title', 'Customer', 'Email', 'Channel', 'Priority', 'Status', 'Assigned', 'Department', 'Created'];
      const rows = data.tickets.map(t => [
        t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(t.customerName || '').replace(/"/g, '""')}"`,
        t.customerEmail || '',
        t.channel,
        t.priority,
        t.status,
        t.assignedTo,
        t.department,
        t.createdAt
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `pulsedesk_tickets_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showToast('CSV export downloaded successfully', 'success');
    } catch (e) {
      this.showToast('Export failed', 'error');
    }
  },

  // Real-time Server-Sent Events (SSE)
  initSSE() {
    try {
      const evtSource = new EventSource('/api/events');

      evtSource.addEventListener('ticket_created', (e) => {
        const ticket = JSON.parse(e.data);
        App.showToast(`🔔 New Ticket: #${ticket.id} (${ticket.customerName})`, 'info');
        TicketsModule.loadTickets();
        TelegramModule.loadLogs();
      });

      evtSource.addEventListener('ticket_updated', (e) => {
        TicketsModule.loadTickets();
      });

      evtSource.addEventListener('ticket_message', (e) => {
        const payload = JSON.parse(e.data);
        if (TicketsModule.currentTicketId === payload.ticketId) {
          TicketsModule.openDrawer(payload.ticketId);
        }
        TicketsModule.loadTickets();
      });

      evtSource.addEventListener('telegram_activity', (e) => {
        TelegramModule.loadLogs();
      });

      evtSource.onerror = () => {
        // SSE reconnection handled automatically by browser
      };
    } catch (err) {
      console.warn('SSE not supported or disabled');
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'error') iconName = 'alert-octagon';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

// Auto boot on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
