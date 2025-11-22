// Global Dark Mode Utility
// Shared across all pages to ensure consistent dark mode behavior

window.darkModeUtils = {
  // Initialize dark mode from localStorage
  init() {
    // Wait for DOM to be ready
    if (typeof document === 'undefined') {
      return;
    }

    // Apply dark mode immediately if DOM is ready, otherwise wait for DOMContentLoaded
    const applyMode = () => {
      const isDark = this.isDarkMode();
      this.applyDarkMode(isDark);
      return isDark;
    };

    // Apply immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyMode);
    } else {
      applyMode();
    }

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

    return this.isDarkMode();
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
    // Wait for DOM to be ready
    if (typeof document === 'undefined') {
      return;
    }

    const apply = () => {
      try {
        if (!document.documentElement || !document.body) {
          return;
        }

        if (isDark) {
          document.documentElement.classList.add('dark');
          document.body.classList.add('bg-slate-900', 'text-gray-100');
          document.body.classList.remove('bg-slate-50', 'text-gray-900');
        } else {
          document.documentElement.classList.remove('dark');
          document.body.classList.remove('bg-slate-900', 'text-gray-100');
          document.body.classList.add('bg-slate-50', 'text-gray-900');
        }
      } catch (error) {
        console.error('Error applying dark mode:', error);
      }
    };

    // Apply immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      // Use setTimeout to ensure DOM is fully processed
      setTimeout(apply, 0);
    }
  },

  // Get current dark mode state as boolean
  getCurrentState() {
    return this.isDarkMode();
  }
};

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  // Always wait for DOM to be ready before initializing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        window.darkModeUtils.init();
      }, 10); // Small delay to ensure all scripts are loaded
    });
  } else {
    // DOM is already loaded, but wait a bit to ensure initialization order
    setTimeout(() => {
      window.darkModeUtils.init();
    }, 10);
  }
}