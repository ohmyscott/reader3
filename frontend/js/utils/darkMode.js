// Global Dark Mode Utility
// Shared across all pages to ensure consistent dark mode behavior

window.darkModeUtils = {
  // Initialize dark mode from localStorage
  init() {
    const isDark = this.isDarkMode();
    this.applyDarkMode(isDark);

    // Listen for storage changes from other tabs/windows
    window.addEventListener('storage', (e) => {
      if (e.key === 'darkMode') {
        const isDark = e.newValue === 'true';
        this.applyDarkMode(isDark);
        // Trigger custom event for Alpine.js components
        window.dispatchEvent(new CustomEvent('darkModeChanged', {
          detail: { isDarkMode: isDark }
        }));
      }
    });

    return isDark;
  },

  // Check current dark mode state
  isDarkMode() {
    return localStorage.getItem('darkMode') === 'true';
  },

  // Toggle dark mode and update localStorage
  toggle() {
    const isDark = !this.isDarkMode();
    this.setDarkMode(isDark);
    return isDark;
  },

  // Set dark mode state
  setDarkMode(isDark) {
    localStorage.setItem('darkMode', isDark.toString());
    this.applyDarkMode(isDark);

    // Trigger custom event for Alpine.js components
    window.dispatchEvent(new CustomEvent('darkModeChanged', {
      detail: { isDarkMode: isDark }
    }));
  },

  // Apply dark mode classes to DOM
  applyDarkMode(isDark) {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-slate-900', 'text-gray-100');
      document.body.classList.remove('bg-slate-50', 'text-gray-900');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-slate-900', 'text-gray-100');
      document.body.classList.add('bg-slate-50', 'text-gray-900');
    }
  },

  // Get current dark mode state as boolean
  getCurrentState() {
    return this.isDarkMode();
  }
};

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.darkModeUtils.init();
}