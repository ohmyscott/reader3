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
      provider: 'openai',
      api_key: '',
      base_url: 'https://api.openai.com/v1',
      model_name: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 32000,
      language: 'en',
      dark_mode: false
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
      const newDarkMode = !this.settingsForm.dark_mode;
      this.settingsForm.dark_mode = newDarkMode;
      this.isDarkMode = newDarkMode;
      // Apply dark mode to global utility
      window.darkModeUtils.setDarkMode(newDarkMode);
    },

    // Handle dark mode change from checkbox
    handleDarkModeChange(isEnabled) {
      this.settingsForm.dark_mode = isEnabled;
      this.isDarkMode = isEnabled;
      // Apply dark mode to global utility
      window.darkModeUtils.setDarkMode(isEnabled);
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
        // Load system settings from separate endpoints
        const [languageConfig, darkModeConfig] = await Promise.allSettled([
          fetch('/api/config/language').then(res => res.json()).catch(() => ({ language: 'en' })),
          fetch('/api/config/dark_mode').then(res => res.json()).catch(() => ({ dark_mode: window.darkModeUtils.isDarkMode() }))
        ]);

        const language = languageConfig.status === 'fulfilled' ? languageConfig.value.language : 'en';
        const darkMode = darkModeConfig.status === 'fulfilled' ? darkModeConfig.value.dark_mode : window.darkModeUtils.isDarkMode();

        // Load settings into form, but keep masked API key if present
        this.settingsForm = {
          provider: config.provider || 'openai',
          api_key: config.api_key && !config.api_key.startsWith('******') ? config.api_key : '',
          base_url: config.base_url || 'https://api.openai.com/v1',
          model_name: config.model_name || 'gpt-4o-mini',
          temperature: config.temperature || 0.7,
          max_tokens: config.max_tokens || 32000,
          language: language,
          dark_mode: darkMode
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
        // Load model settings from API
        const config = await configAPI.getConfig();
        // Load system settings from separate endpoints
        const [languageConfig, darkModeConfig] = await Promise.allSettled([
          fetch('/api/config/language').then(res => res.json()).catch(() => ({ language: 'en' })),
          fetch('/api/config/dark_mode').then(res => res.json()).catch(() => ({ dark_mode: false }))
        ]);

        const language = languageConfig.status === 'fulfilled' ? languageConfig.value.language : 'en';
        const darkMode = darkModeConfig.status === 'fulfilled' ? darkModeConfig.value.dark_mode : window.darkModeUtils.isDarkMode();

        // Load settings into form, but keep masked API key if present
        this.settingsForm = {
          provider: config.provider || 'openai',
          api_key: config.api_key && !config.api_key.startsWith('******') ? config.api_key : '',
          base_url: config.base_url || 'https://api.openai.com/v1',
          model_name: config.model_name || 'gpt-4o-mini',
          temperature: config.temperature || 0.7,
          max_tokens: config.max_tokens || 32000,
          language: language,
          dark_mode: darkMode
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
        // Save model settings
        const modelSettings = {
          provider: this.settingsForm.provider,
          api_key: this.settingsForm.api_key,
          base_url: this.settingsForm.base_url,
          model_name: this.settingsForm.model_name,
          temperature: this.settingsForm.temperature,
          max_tokens: this.settingsForm.max_tokens
        };
        await configAPI.updateConfig(modelSettings);

        // Save system settings
        await Promise.all([
          fetch('/api/config/language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: this.settingsForm.language })
          }),
          fetch('/api/config/dark_mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dark_mode: this.settingsForm.dark_mode })
          })
        ]);

        window.app.showToast(window.i18n.t('library.settings.save_success'), 'success');
        this.closeSettingsModal();
      } catch (error) {
        window.app.showToast(error.message || window.i18n.t('library.settings.save_error'), 'error');
      } finally {
        this.savingSettings = false;
      }
    },

    // Handle language change
    async handleLanguageChange(language) {
      try {
        // Update i18n immediately for better UX
        await window.i18n.setLanguage(language);

        // Also update the form value
        this.settingsForm.language = language;
      } catch (error) {
        console.error('Failed to change language:', error);
        if (window.app && window.app.showToast) {
          window.app.showToast('Failed to change language', 'error');
        }
      }
    },

    // Handle provider change
    async handleProviderChange(provider) {
      try {
        // Update provider
        this.settingsForm.provider = provider;

        // Auto-fill base URL based on provider
        switch (provider) {
          case 'ollama':
            this.settingsForm.base_url = 'http://localhost:11434/v1';
            break;
          case 'lmstudio':
            this.settingsForm.base_url = 'http://127.0.0.1:1234/v1';
            break;
          case 'openai':
          default:
            this.settingsForm.base_url = 'https://api.openai.com/v1';
            break;
        }
      } catch (error) {
        console.error('Failed to change provider:', error);
        if (window.app && window.app.showToast) {
          window.app.showToast('Failed to change provider', 'error');
        }
      }
    },

    };
}