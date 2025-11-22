// Components
import { ReaderPage } from './components/ReaderPage.js';

// API - use absolute imports for MPA
import { booksAPI } from '/frontend-api/books.js';
import { chatAPI } from '/frontend-api/chat.js';

// Application utilities (re-exported for reader page)
window.app = {
  // Initialize application
  async init() {
    console.log('Initializing Reader3 Reader Application...');
    console.log('Reader application initialized');
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
  // Register global data and methods
  Alpine.data('app', () => window.app);

  // Register reader component
  Alpine.data('ReaderPage', ReaderPage);
});

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