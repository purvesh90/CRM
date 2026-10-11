// Authentication & Role-Based Access Control (RBAC) Module
const AuthModule = {
  currentUser: null,
  token: null,

  init() {
    this.loadSession();
    this.bindEvents();
  },

  loadSession() {
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
      // Default to Super Admin for seamless first load, or open login modal
      this.login({ userId: 'user-admin' });
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

    // Role Switcher Buttons inside Dropdown
    document.querySelectorAll('[data-switch-user]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = btn.getAttribute('data-switch-user');
        this.login({ userId });
        if (dropdown) dropdown.classList.add('hidden');
      });
    });

    // Quick Role Login Cards in Login Modal
    document.querySelectorAll('[data-login-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-login-user');
        this.login({ userId });
      });
    });

    // Custom Login Form Submit
    const loginForm = document.getElementById('customLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleCustomLogin(e));
    }

    // Sign Out Button
    const btnSignOut = document.getElementById('btnSignOut');
    if (btnSignOut) {
      btnSignOut.addEventListener('click', () => this.logout());
    }
  },

  async login({ email, password, userId }) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, userId })
      });
      const data = await res.json();

      if (data.success && data.user) {
        this.currentUser = data.user;
        this.token = data.token;
        localStorage.setItem('pulsedesk_user', JSON.stringify(data.user));
        localStorage.setItem('pulsedesk_token', data.token);

        this.closeLoginModal();
        this.applyUserRole(data.user);

        App.showToast(`Logged in as ${data.user.name} (${data.user.roleLabel})`, 'success');
        return true;
      } else {
        const errEl = document.getElementById('loginErrorMessage');
        if (errEl) {
          errEl.textContent = data.error || 'Login failed';
          errEl.classList.remove('hidden');
        }
        return false;
      }
    } catch (err) {
      App.showToast('Network error during authentication', 'error');
      return false;
    }
  },

  async handleCustomLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    await this.login({ email, password });
  },

  logout() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem('pulsedesk_user');
    localStorage.removeItem('pulsedesk_token');

    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) dropdown.classList.add('hidden');

    this.openLoginModal();
    App.showToast('You have signed out of PulseDesk CRM', 'info');
  },

  openLoginModal() {
    const modal = document.getElementById('loginModalOverlay');
    if (modal) modal.classList.remove('hidden');
  },

  closeLoginModal() {
    const modal = document.getElementById('loginModalOverlay');
    if (modal) modal.classList.add('hidden');
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
    const telegramForm = document.getElementById('telegramTokenForm');
    const portalSwitcher = document.querySelector('.portal-switch-pill');

    if (user.role === 'CUSTOMER') {
      // Customer: Lock admin desk and automatically switch to self-service portal
      if (portalSwitcher) portalSwitcher.style.display = 'none';
      App.switchPortalMode(true);
    } else {
      // Support Staff (Admin, Agent, Billing)
      if (portalSwitcher) portalSwitcher.style.display = 'flex';
      App.switchPortalMode(false);

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
          // Hide or disable settings tab
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

    lucide.createIcons();
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
