// Components
import { LibraryPage } from './components/LibraryPage.js';
import { ReaderPage } from './components/ReaderPage.js';

// API
import { booksAPI } from '/frontend-api/books.js';
import { chatAPI } from '/frontend-api/chat.js';
import { configAPI } from '/frontend-api/config.js';

// Application utilities
window.app = {
  // API configuration
  api: {
    books: booksAPI,
    chat: chatAPI,
    config: configAPI
  },

  // Initialize application
  async init() {
    console.log('Initializing Reader3 Application...');
    console.log('Application initialized');
  },

  // Show toast notification
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';

    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  },

  // Global error handler
  handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    this.showToast(error.message || 'An error occurred', 'error');
  }
};

// Register Alpine components
document.addEventListener('alpine:init', () => {
  console.log('Alpine.js initializing...');

  // Register global data and methods
  Alpine.data('app', () => window.app);
  console.log('App component registered');

  // Register page components
  Alpine.data('LibraryPage', LibraryPage);
  console.log('LibraryPage component registered');

  Alpine.data('ReaderPage', ReaderPage);
  console.log('ReaderPage component registered');
});

// Debug: Log when modules are loaded
console.log('App.js loaded, Alpine.js available:', typeof Alpine !== 'undefined');

// Add custom styles for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease-out;
  }
`;
document.head.appendChild(style);