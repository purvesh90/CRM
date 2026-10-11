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

    // 3. Role-Based Workspace Views & Navigation Permissions
    const settingsNavItem = document.querySelector('.sidebar-nav a[data-tab="settings"]');
    const deleteTicketBtn = document.getElementById('deleteTicketBtn');
    const portalSwitcher = document.querySelector('.portal-switch-pill');

    if (user.role === 'CUSTOMER') {
      // Customer: Lock admin desk and automatically switch to self-service portal
      if (portalSwitcher) portalSwitcher.style.display = 'none';
      if (window.App && typeof App.switchPortalMode === 'function') {
        App.switchPortalMode(true);
      }
    } else {
      // Support Staff (Admin, Agent, Billing)
      if (portalSwitcher) portalSwitcher.style.display = 'flex';
      if (window.App && typeof App.switchPortalMode === 'function') {
        App.switchPortalMode(false);
      }

      if (user.role === 'SUPER_ADMIN') {
        // Super Admin: Full unrestricted access
        if (settingsNavItem) {
          settingsNavItem.style.display = 'flex';
          settingsNavItem.style.opacity = '1';
          settingsNavItem.style.pointerEvents = 'auto';
        }
        if (deleteTicketBtn) deleteTicketBtn.style.display = 'inline-flex';
      } else {
        // Agent or Billing Specialist: Restrict admin-only actions
        if (settingsNavItem) {
          settingsNavItem.style.opacity = '0.4';
          settingsNavItem.style.pointerEvents = 'none';
          settingsNavItem.title = 'Super Admin privilege required';
        }

        // Hide delete ticket button
        if (deleteTicketBtn) {
          deleteTicketBtn.style.display = 'none';
        }
      }
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
