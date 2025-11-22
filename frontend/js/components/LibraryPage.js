import { booksAPI } from '/frontend-api/books.js';
import { configAPI } from '/frontend-api/config.js';

export function LibraryPage() {
  return {
    books: [],
    loading: true,
    error: null,
    showUploadModal: false,
    selectedFile: null,
    uploading: false,
    uploadStatus: null,
    isDarkMode: false,

    // Settings related properties
    showSettingsModal: false,
    activeTab: 'model',
    settingsForm: {
      api_key: '',
      base_url: 'https://api.openai.com/v1',
      model_name: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 32000
    },
    savingSettings: false,
    showAdvancedSettings: false,

    async init() {
      // Debug: Log that init is being called
      console.log('LibraryPage init() called');

      // Set a timeout to prevent infinite loading
      const loadingTimeout = setTimeout(() => {
        console.warn('Loading timeout - showing app anyway');
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (app) app.style.display = 'block';
      }, 10000); // 10 second timeout

      // Wait for i18n to be ready before proceeding (with timeout)
      if (!window.i18n || !window.i18n.isReady()) {
        console.log('Waiting for i18n to be ready...');
        try {
          await new Promise((resolve, reject) => {
            const checkReady = () => {
              if (window.i18n && window.i18n.isReady()) {
                console.log('i18n is ready!');
                clearTimeout(loadingTimeout);
                resolve();
              } else {
                setTimeout(checkReady, 100);
              }
            };
            const timeout = setTimeout(() => {
              console.warn('i18n ready timeout - proceeding anyway');
              clearTimeout(loadingTimeout);
              resolve();
            }, 5000); // 5 second timeout for i18n
            checkReady();
          });
        } catch (error) {
          console.error('Error waiting for i18n:', error);
        }
      } else {
        console.log('i18n already ready');
        clearTimeout(loadingTimeout);
      }

      // Load dark mode preference using global utility
      this.isDarkMode = window.darkModeUtils.isDarkMode();

      // Load configuration and check if model is configured (combined to avoid duplicate API calls)
      await this.loadSettingsAndCheckStatus();

      await this.loadBooks();

      // Hide loading screen and show app
      const loadingScreen = document.getElementById('loading-screen');
      const app = document.getElementById('app');
      if (loadingScreen) loadingScreen.style.display = 'none';
      if (app) app.style.display = 'block';

      // Listen for language changes
      window.addEventListener('i18n:pageUpdated', () => {
        // Re-bind any dynamic translations when language changes
        this.updateTranslations();
      });
    },

    updateTranslations() {
      // Force update of any dynamically rendered content
      // This will be called when language changes
      console.log('Updating translations in LibraryPage');

      // Force update settings dialog title if it's currently open
      if (this.showSettingsModal) {
        setTimeout(() => {
          const titleElement = document.querySelector('h2[data-i18n="library.settings.title"]');
          if (titleElement && window.i18n && window.i18n.isReady()) {
            titleElement.textContent = window.i18n.t('library.settings.title');
          }
        }, 10);
      }
    },

    async loadBooks() {
      this.loading = true;
      this.error = null;

      try {
        this.books = await booksAPI.getAllBooks();
        console.log('Books loaded:', this.books);
      } catch (error) {
        this.error = error.message;
        console.error('Failed to load books:', error);
      } finally {
        this.loading = false;
      }
    },

    openUploadModal() {
      this.showUploadModal = true;
      this.resetUploadForm();
    },

    closeUploadModal() {
      this.showUploadModal = false;
      this.resetUploadForm();
    },

    resetUploadForm() {
      this.selectedFile = null;
      this.uploadStatus = null;
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.value = '';
    },

    handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        if (!file.name.toLowerCase().endsWith('.epub')) {
          this.uploadStatus = {
            type: 'error',
            message: window.i18n.t('library.upload.valid_epub')
          };
          return;
        }
        this.selectedFile = file;
        this.uploadStatus = null;
      }
    },

    handleDragOver(event) {
      event.preventDefault();
      event.currentTarget.classList.add('bg-gray-50', 'border-gray-400');
    },

    handleDragLeave(event) {
      event.preventDefault();
      event.currentTarget.classList.remove('bg-gray-50', 'border-gray-400');
    },

    handleDrop(event) {
      event.preventDefault();
      event.currentTarget.classList.remove('bg-gray-50', 'border-gray-400');

      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.epub')) {
          this.selectedFile = file;
          this.uploadStatus = null;
        } else {
          this.uploadStatus = {
            type: 'error',
            message: window.i18n.t('library.upload.valid_epub')
          };
        }
      }
    },

    async uploadBook() {
      if (!this.selectedFile) {
        this.uploadStatus = {
          type: 'error',
          message: 'Please select a file first'
        };
        return;
      }

      this.uploading = true;
      this.uploadStatus = {
        type: 'processing',
        message: window.i18n.t('library.upload.processing')
      };

      try {
        const result = await booksAPI.uploadBook(this.selectedFile);
        this.uploadStatus = {
          type: 'success',
          message: result.message
        };

        // Refresh books list after a short delay
        setTimeout(() => {
          this.loadBooks();
          this.closeUploadModal();
        }, 2000);

      } catch (error) {
        this.uploadStatus = {
          type: 'error',
          message: error.message
        };
      } finally {
        this.uploading = false;
      }
    },

    openReader(bookId) {
      // Navigate to the reader page
      window.location.href = `/read/${encodeURIComponent(bookId)}/0`;
    },

    toggleDarkMode() {
      this.isDarkMode = window.darkModeUtils.toggle();
    },

    getStatusColor(type) {
      if (this.isDarkMode) {
        switch (type) {
          case 'success': return 'bg-green-900 text-green-100 border-green-700';
          case 'error': return 'bg-red-900 text-red-100 border-red-700';
          case 'processing': return 'bg-gray-800 text-gray-100 border-gray-600';
          default: return 'bg-gray-800 text-gray-100 border-gray-700';
        }
      } else {
        switch (type) {
          case 'success': return 'bg-green-100 text-green-800 border-green-200';
          case 'error': return 'bg-red-100 text-red-800 border-red-200';
          case 'processing': return 'bg-gray-100 text-gray-800 border-gray-300';
          default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
      }
    },

    // Settings related methods
    async loadSettingsAndCheckStatus() {
      try {
        const config = await configAPI.getConfig();

        // Load settings into form, but keep masked API key if present
        this.settingsForm = {
          api_key: config.api_key && !config.api_key.startsWith('******') ? config.api_key : '',
          base_url: config.base_url || 'https://api.openai.com/v1',
          model_name: config.model_name || 'gpt-4o-mini',
          temperature: config.temperature || 0.7,
          max_tokens: config.max_tokens || 32000
        };

        // Check if API key is properly configured
        // If api_key is masked (starts with "******"), it means it's configured
        if (!config.api_key || config.api_key.trim() === '') {
          // API key is not configured, show settings modal
          this.showSettingsModal = true;
          if (window.i18n && window.i18n.isReady()) {
            window.app.showToast(window.i18n.t('library.toast.config_required'), 'error');
          } else {
            window.app.showToast('Please configure AI model settings first', 'error');
          }
        }
      } catch (error) {
        console.error('Failed to load settings and check status:', error);
        // If we can't get config, show settings modal
        this.showSettingsModal = true;
        if (window.i18n && window.i18n.isReady()) {
          window.app.showToast(window.i18n.t('library.toast.config_required'), 'error');
        } else {
          window.app.showToast('Please configure AI model settings first', 'error');
        }
      }
    },

    async loadSettings() {
      try {
        const config = await configAPI.getConfig();
        // Load settings into form, but keep masked API key if present
        this.settingsForm = {
          api_key: config.api_key && !config.api_key.startsWith('******') ? config.api_key : '',
          base_url: config.base_url || 'https://api.openai.com/v1',
          model_name: config.model_name || 'gpt-4o-mini',
          temperature: config.temperature || 0.7,
          max_tokens: config.max_tokens || 32000
        };
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    },

    async checkConfigStatus() {
      try {
        const config = await configAPI.getConfig();
        // Check if API key is properly configured
        // If api_key is masked (starts with "******"), it means it's configured
        if (!config.api_key || config.api_key.trim() === '') {
          // API key is not configured, show settings modal
          this.showSettingsModal = true;
          if (window.i18n && window.i18n.isReady()) {
            window.app.showToast(window.i18n.t('library.toast.config_required'), 'error');
          } else {
            window.app.showToast('Please configure AI model settings first', 'error');
          }
        }
      } catch (error) {
        console.error('Failed to check config status:', error);
        // If we can't get config, show settings modal
        this.showSettingsModal = true;
        if (window.i18n && window.i18n.isReady()) {
          window.app.showToast(window.i18n.t('library.toast.config_required'), 'error');
        } else {
          window.app.showToast('Please configure AI model settings first', 'error');
        }
      }
    },

    toggleSettings() {
      // Debug: Log that toggleSettings is being called
      console.log('toggleSettings() called');
      this.showSettingsModal = !this.showSettingsModal;
      if (this.showSettingsModal) {
        this.loadSettings();
      }
    },

    closeSettingsModal() {
      this.showSettingsModal = false;
    },

    async saveSettings() {
      this.savingSettings = true;
      try {
        await configAPI.updateConfig(this.settingsForm);
        window.app.showToast(window.i18n.t('library.settings.save_success'), 'success');
        this.closeSettingsModal();
      } catch (error) {
        window.app.showToast(error.message || window.i18n.t('library.settings.save_error'), 'error');
      } finally {
        this.savingSettings = false;
      }
    },

    };
}