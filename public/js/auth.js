// Authentication & Role-Based Access Control (RBAC) Module
const AuthModule = {
  currentUser: null,
  token: null,

  init() {
    this.loadSession();
    this.bindEvents();
  },

  async loadSession() {
    try {
      const stored = localStorage.getItem('pulsedesk_user');
      const token = localStorage.getItem('pulsedesk_token');
      if (stored) {
        this.currentUser = JSON.parse(stored);
        this.token = token;
      }
    } catch (e) {
      console.warn('Failed to parse stored user session');
    }

    if (!this.currentUser) {
      // Default initial session with admin credentials
      await this.login({ email: 'admin@pulsedesk.io', password: 'admin' }, false);
    } else {
      this.applyUserRole(this.currentUser);
    }
  },

  bindEvents() {
    // User Profile Button Toggle Dropdown
    const profileBtn = document.getElementById('userProfileBtn');
    const dropdown = document.getElementById('userMenuDropdown');
    if (profileBtn && dropdown) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });

      // Close when clicking outside
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !profileBtn.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }

    // Role Switcher Buttons inside Dropdown (STRICT: Password Login Required)
    document.querySelectorAll('[data-switch-user]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown) dropdown.classList.add('hidden');
        
        const email = btn.getAttribute('data-email');
        const name = btn.getAttribute('data-name');
        const role = btn.getAttribute('data-role');
        const hint = btn.getAttribute('data-hint');

        this.promptProfileSwitch({ email, name, role, hint });
      });
    });

    // Quick Role Login Cards in Login Modal (Select account to verify)
    document.querySelectorAll('[data-login-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.getAttribute('data-email');
        const name = btn.getAttribute('data-name');
        const role = btn.getAttribute('data-role');
        const hint = btn.getAttribute('data-hint');

        this.selectAccountForLogin({ email, name, role, hint });
      });
    });

    // Custom Login Form Submit
    const loginForm = document.getElementById('customLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleCustomLogin(e));
    }

    // Close Login Modal Button
    const closeBtn = document.getElementById('closeLoginModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.currentUser) {
          this.closeLoginModal();
        }
      });
    }

    // Overlay click to close if already logged in
    const modalOverlay = document.getElementById('loginModalOverlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay && this.currentUser) {
          this.closeLoginModal();
        }
      });
    }

    // Keyboard ESC to close modal if logged in
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentUser && modalOverlay && !modalOverlay.classList.contains('hidden')) {
        this.closeLoginModal();
      }
    });

    // Sign Out Button
    const btnSignOut = document.getElementById('btnSignOut');
    if (btnSignOut) {
      btnSignOut.addEventListener('click', () => this.logout());
    }
  },

  promptProfileSwitch({ email, name, role, hint }) {
    this.openLoginModal(true);
    this.selectAccountForLogin({ email, name, role, hint });
    if (window.App && typeof App.showToast === 'function') {
      App.showToast(`Password verification required to switch to ${name} (${role})`, 'info');
    }
  },

  selectAccountForLogin({ email, name, role, hint }) {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const noticeEl = document.getElementById('loginTargetNotice');
    const nameEl = document.getElementById('loginTargetUserName');
    const roleEl = document.getElementById('loginTargetUserRole');
    const hintEl = document.getElementById('loginTargetHint');
    const errEl = document.getElementById('loginErrorMessage');

    if (errEl) errEl.classList.add('hidden');

    if (emailInput && email) {
      emailInput.value = email;
    }
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.focus();
    }

    if (noticeEl && name && role) {
      if (nameEl) nameEl.textContent = name;
      if (roleEl) roleEl.textContent = role;
      if (hintEl) hintEl.textContent = hint || 'admin';
      noticeEl.classList.remove('hidden');
    }

    // Highlight active card in modal
    document.querySelectorAll('[data-login-user]').forEach(btn => {
      const btnEmail = btn.getAttribute('data-email');
      if (btnEmail && email && btnEmail.toLowerCase() === email.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (window.lucide) lucide.createIcons();
  },

  async login({ email, password }, showSuccessToast = true) {
    const errEl = document.getElementById('loginErrorMessage');
    if (errEl) errEl.classList.add('hidden');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success && data.user) {
        this.currentUser = data.user;
        this.token = data.token;
        localStorage.setItem('pulsedesk_user', JSON.stringify(data.user));
        localStorage.setItem('pulsedesk_token', data.token);

        this.closeLoginModal();
        this.applyUserRole(data.user);

        if (showSuccessToast && window.App && typeof App.showToast === 'function') {
          App.showToast(`Verified & logged in as ${data.user.name} (${data.user.roleLabel})`, 'success');
        }
        return true;
      } else {
        if (errEl) {
          errEl.textContent = data.error || 'Invalid credentials. Password verification failed.';
          errEl.classList.remove('hidden');
        }
        const passwordInput = document.getElementById('loginPassword');
        if (passwordInput) {
          passwordInput.select();
          passwordInput.focus();
        }
        if (showSuccessToast && window.App && typeof App.showToast === 'function') {
          App.showToast(data.error || 'Password verification failed', 'error');
        }
        return false;
      }
    } catch (err) {
      console.error('Auth error:', err);
      if (errEl) {
        errEl.textContent = 'Network or server error during authentication';
        errEl.classList.remove('hidden');
      }
      return false;
    }
  },

  async handleCustomLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    await this.login({ email, password }, true);
  },

  logout() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem('pulsedesk_user');
    localStorage.removeItem('pulsedesk_token');

    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) dropdown.classList.add('hidden');

    const noticeEl = document.getElementById('loginTargetNotice');
    if (noticeEl) noticeEl.classList.add('hidden');

    this.openLoginModal(false);
    if (window.App && typeof App.showToast === 'function') {
      App.showToast('You have signed out of PulseDesk CRM', 'info');
    }
  },

  openLoginModal(canClose = true) {
    const modal = document.getElementById('loginModalOverlay');
    const closeBtn = document.getElementById('closeLoginModalBtn');
    if (modal) modal.classList.remove('hidden');
    if (closeBtn) {
      closeBtn.style.display = canClose && this.currentUser ? 'flex' : 'none';
    }
    if (window.lucide) lucide.createIcons();
  },

  closeLoginModal() {
    const modal = document.getElementById('loginModalOverlay');
    if (modal) modal.classList.add('hidden');
    const noticeEl = document.getElementById('loginTargetNotice');
    if (noticeEl) noticeEl.classList.add('hidden');
    const errEl = document.getElementById('loginErrorMessage');
    if (errEl) errEl.classList.add('hidden');
  },

  applyUserRole(user) {
    if (!user) return;

    // 1. Header Profile Badge UI
    const headerAvatar = document.getElementById('headerUserAvatar');
    const headerName = document.getElementById('headerUserName');
    const headerRole = document.getElementById('headerUserRole');

    if (headerAvatar) headerAvatar.src = user.avatar;
    if (headerName) headerName.textContent = user.name;
    if (headerRole) {
      headerRole.textContent = user.roleLabel;
      headerRole.className = `profile-role role-badge-${user.role.toLowerCase()}`;
    }

    const welcomeName = document.getElementById('welcomeUserNameText');
    if (welcomeName) welcomeName.textContent = user.name.split(' ')[0];

    // 2. Dropdown Header Profile
    const dropAvatar = document.getElementById('dropdownUserAvatar');
    const dropName = document.getElementById('dropdownUserName');
    const dropEmail = document.getElementById('dropdownUserEmail');
    const dropBadge = document.getElementById('dropdownUserRoleBadge');

    if (dropAvatar) dropAvatar.src = user.avatar;
    if (dropName) dropName.textContent = user.name;
    if (dropEmail) dropEmail.textContent = user.email;
    if (dropBadge) {
      dropBadge.textContent = user.role.replace('_', ' ');
      dropBadge.className = `role-pill-badge role-badge-${user.role.toLowerCase()}`;
    }

    // 3. Strict Role-Based Workspace Views & Navigation Permissions
    const portalSwitcher = document.querySelector('.portal-switch-pill');
    const tgHeaderBadge = document.getElementById('telegramHeaderBadge');
    const navDashboard = document.querySelector('.sidebar-nav a[data-tab="dashboard"]');
    const navTickets = document.querySelector('.sidebar-nav a[data-tab="tickets"]');
    const navTelegram = document.querySelector('.sidebar-nav a[data-tab="telegram"]');
    const navCustomers = document.querySelector('.sidebar-nav a[data-tab="customers"]');
    const navAnalytics = document.querySelector('.sidebar-nav a[data-tab="analytics"]');
    const navAgents = document.querySelector('.sidebar-nav a[data-tab="agents"]');
    const navSettings = document.querySelector('.sidebar-nav a[data-tab="settings"]');
    const navSectionLabels = document.querySelectorAll('.sidebar-nav .nav-section-label');
    const sidebarFooterCard = document.querySelector('.sidebar-footer-card');

    const deleteTicketBtn = document.getElementById('deleteTicketBtn');
    const splitDeleteTicketBtn = document.getElementById('splitDeleteTicketBtn');
    const splitQuickResolveBtn = document.getElementById('splitQuickResolveBtn');
    const splitTabInternal = document.getElementById('splitTabInternal');
    const ticketsTitle = document.querySelector('#tab-tickets .panel-title');
    const ticketsSubtitle = document.querySelector('#tab-tickets .panel-subtitle');
    const filterDeptGroup = document.getElementById('filterDepartmentGroup');
    const newTicketTopBtn = document.getElementById('openNewTicketModalBtn');

    if (user.role === 'CUSTOMER') {
      // CUSTOMER ROLE: Strictly show only Customer rights (No admin or staff features)
      if (portalSwitcher) portalSwitcher.style.display = 'none';
      if (tgHeaderBadge) tgHeaderBadge.style.display = 'none';

      // Hide all administrative and staff tabs
      if (navDashboard) navDashboard.style.display = 'none';
      if (navTelegram) navTelegram.style.display = 'none';
      if (navCustomers) navCustomers.style.display = 'none';
      if (navAnalytics) navAnalytics.style.display = 'none';
      if (navAgents) navAgents.style.display = 'none';
      if (navSettings) navSettings.style.display = 'none';
      if (sidebarFooterCard) sidebarFooterCard.style.display = 'none';
      navSectionLabels.forEach(el => el.style.display = 'none');

      // Show strictly "My Support Tickets"
      if (navTickets) {
        navTickets.style.display = 'flex';
        const span = navTickets.querySelector('span:not(.nav-badge)');
        if (span) span.textContent = 'My Support Tickets';
      }

      if (newTicketTopBtn) {
        const textSpan = newTicketTopBtn.querySelector('span');
        if (textSpan) textSpan.textContent = 'Submit Request';
      }

      // Automatically place customer in their tickets desk
      if (window.App && typeof App.switchTab === 'function') {
        App.switchTab('tickets');
      }

      if (ticketsTitle) ticketsTitle.textContent = 'My Support Requests';
      if (ticketsSubtitle) ticketsSubtitle.textContent = 'Track your active inquiries, communicate directly with specialists, and rate resolved issues.';
      if (filterDeptGroup) filterDeptGroup.style.display = 'none';

      // Hide staff-only buttons
      if (deleteTicketBtn) deleteTicketBtn.style.display = 'none';
      if (splitDeleteTicketBtn) splitDeleteTicketBtn.style.display = 'none';
      if (splitQuickResolveBtn) splitQuickResolveBtn.style.display = 'none';
      if (splitTabInternal) splitTabInternal.style.display = 'none';

    } else if (user.role === 'BILLING_SPECIALIST' || user.role === 'SUPPORT_AGENT') {
      // SPECIALIST STAFF (Billing / Support)
      if (portalSwitcher) portalSwitcher.style.display = 'none';
      if (tgHeaderBadge) tgHeaderBadge.style.display = 'inline-flex';

      if (navDashboard) navDashboard.style.display = 'flex';
      if (navTickets) {
        navTickets.style.display = 'flex';
        const span = navTickets.querySelector('span:not(.nav-badge)');
        if (span) span.textContent = user.role === 'BILLING_SPECIALIST' ? 'Billing Queue' : 'Support Queue';
      }
      if (navTelegram) navTelegram.style.display = 'flex';
      if (navCustomers) navCustomers.style.display = 'flex';
      if (navAnalytics) navAnalytics.style.display = 'none';
      if (navAgents) navAgents.style.display = 'none';
      if (navSettings) navSettings.style.display = 'none';
      if (sidebarFooterCard) sidebarFooterCard.style.display = 'block';
      navSectionLabels.forEach(el => el.style.display = 'block');

      if (newTicketTopBtn) {
        const textSpan = newTicketTopBtn.querySelector('span');
        if (textSpan) textSpan.textContent = 'New Ticket';
      }

      if (ticketsTitle) ticketsTitle.textContent = user.role === 'BILLING_SPECIALIST' ? 'Billing Operations Queue' : 'Technical Support Queue';
      if (ticketsSubtitle) ticketsSubtitle.textContent = 'Triage, resolve requests in your department scope, and sync live with Telegram.';
      if (filterDeptGroup) filterDeptGroup.style.display = 'flex';

      if (deleteTicketBtn) deleteTicketBtn.style.display = 'none';
      if (splitDeleteTicketBtn) splitDeleteTicketBtn.style.display = 'none';
      if (splitQuickResolveBtn) splitQuickResolveBtn.style.display = 'inline-flex';
      if (splitTabInternal) splitTabInternal.style.display = 'flex';

    } else {
      // SUPER ADMIN: Full unrestricted access
      if (portalSwitcher) portalSwitcher.style.display = 'none';
      if (tgHeaderBadge) tgHeaderBadge.style.display = 'inline-flex';

      if (navDashboard) navDashboard.style.display = 'flex';
      if (navTickets) {
        navTickets.style.display = 'flex';
        const span = navTickets.querySelector('span:not(.nav-badge)');
        if (span) span.textContent = 'Tickets Center';
      }
      if (navTelegram) navTelegram.style.display = 'flex';
      if (navCustomers) navCustomers.style.display = 'flex';
      if (navAnalytics) navAnalytics.style.display = 'flex';
      if (navAgents) navAgents.style.display = 'flex';
      if (navSettings) navSettings.style.display = 'flex';
      if (sidebarFooterCard) sidebarFooterCard.style.display = 'block';
      navSectionLabels.forEach(el => el.style.display = 'block');

      if (newTicketTopBtn) {
        const textSpan = newTicketTopBtn.querySelector('span');
        if (textSpan) textSpan.textContent = 'New Ticket';
      }

      if (ticketsTitle) ticketsTitle.textContent = 'Tickets Command Center';
      if (ticketsSubtitle) ticketsSubtitle.textContent = 'Live multi-channel queue triage, split-screen resolution, and Telegram synchronization.';
      if (filterDeptGroup) filterDeptGroup.style.display = 'flex';

      if (deleteTicketBtn) deleteTicketBtn.style.display = 'inline-flex';
      if (splitDeleteTicketBtn) splitDeleteTicketBtn.style.display = 'inline-flex';
      if (splitQuickResolveBtn) splitQuickResolveBtn.style.display = 'inline-flex';
      if (splitTabInternal) splitTabInternal.style.display = 'flex';
    }

    // Refresh tickets and KPIs with role-scoped filters
    if (window.TicketsModule && typeof TicketsModule.loadTickets === 'function') {
      TicketsModule.loadTickets();
    }
    if (window.App && typeof App.updateDashboardKPIs === 'function') {
      App.updateDashboardKPIs();
    }

    if (window.lucide) lucide.createIcons();
  },

  getAuthHeaders() {
    return {
      'x-user-id': this.currentUser?.id || 'user-admin',
      'x-user-role': this.currentUser?.role || 'SUPER_ADMIN'
    };
  }
};

// Auto boot on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  AuthModule.init();
});
