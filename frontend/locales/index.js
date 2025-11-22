// Professional simplified i18n system with single-file approach
class I18n {
  constructor() {
    // Normalize language code - handle cases where 'zh' is stored instead of 'zh-CN'
    let savedLang = localStorage.getItem('language') || 'en';
    this.currentLanguage = this.normalizeLanguageCode(savedLang);
    this.translations = {};
    this.isInitialized = false;
    this.initPromise = null;

    // Supported languages with proper locale codes
    this.supportedLanguages = [
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇺🇸',
        dir: 'ltr'
      },
      {
        code: 'zh-CN',
        name: 'Chinese (Simplified)',
        nativeName: '简体中文',
        flag: '🇨🇳',
        dir: 'ltr'
      }
    ];
  }

  // Normalize language codes to handle variations
  normalizeLanguageCode(lang) {
    // Map common variations to supported language codes
    const languageMap = {
      'zh': 'zh-CN',
      'zh-cn': 'zh-CN',
      'zho': 'zh-CN',
      'chinese': 'zh-CN'
    };

    // Convert to lowercase and check mapping
    const normalized = lang.toLowerCase();
    return languageMap[normalized] || lang;
  }

  // Initialize i18n with single file loading
  async init(modules = null) {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadTranslations();
    return this.initPromise;
  }

  // Load all translations for the current language from a single file
  async loadTranslations() {
    try {
      await this.loadTranslationFile(this.currentLanguage);
      this.isInitialized = true;
      this.updatePageLanguage();

      // Trigger initialization complete event
      window.dispatchEvent(new CustomEvent('i18n:initialized', {
        detail: { language: this.currentLanguage }
      }));

      return true;
    } catch (error) {
      console.error('Error initializing i18n:', error);
      // Fallback to English if current language fails
      if (this.currentLanguage !== 'en') {
        console.warn('Falling back to English due to initialization error');
        this.currentLanguage = 'en';
        return this.loadTranslations();
      }
      return false;
    }
  }

  // Load translation file for a language
  async loadTranslationFile(language) {
    try {
      const response = await fetch(`/locales/${language}/translations.json`);
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${language}`);
      }

      const translations = await response.json();
      this.translations[language] = translations;

    } catch (error) {
      console.error(`Error loading translations for ${language}:`, error);

      // Initialize empty object to prevent undefined errors
      this.translations[language] = {};
    }
  }

  // Get translation with namespace support
  // Supports keys like "common.header.title" or "chat.shortcuts.summarize"
  t(key, params = {}) {
    if (!this.isInitialized) {
      console.warn('I18n not yet initialized, returning key:', key);
      return this.interpolateKey(key, params);
    }

    const [namespace, ...rest] = key.split('.');
    const fullKey = rest.join('.');

    // Try current language first
    let translation = this.getNestedTranslation(
      this.translations[this.currentLanguage]?.[namespace],
      fullKey
    );

    // Fallback to English if not found
    if (!translation && this.currentLanguage !== 'en') {
      translation = this.getNestedTranslation(
        this.translations['en']?.[namespace],
        fullKey
      );
    }

    // Return translation or key as last resort
    return translation ? this.interpolate(translation, params) : this.interpolateKey(key, params);
  }

  // Get nested translation from object
  getNestedTranslation(obj, key) {
    if (!obj || !key) return null;

    return key.split('.').reduce((current, keyPart) => {
      return current && typeof current === 'object' ? current[keyPart] : null;
    }, obj);
  }

  // Interpolate parameters into translation string
  interpolate(text, params) {
    if (typeof text !== 'string' || Object.keys(params).length === 0) {
      return text;
    }

    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  // Fallback interpolation for missing keys
  interpolateKey(key, params) {
    return this.interpolate(key, params);
  }

  // Set current language and load translations
  async setLanguage(language, modules = null) {
    // Normalize language code first
    const normalizedLanguage = this.normalizeLanguageCode(language);
    const langInfo = this.supportedLanguages.find(l => l.code === normalizedLanguage);
    if (!langInfo) {
      console.warn(`Language ${normalizedLanguage} not supported`);
      return false;
    }

    // Temporarily set language for translation loading
    const originalLanguage = this.currentLanguage;
    this.currentLanguage = normalizedLanguage;

    // Load language translations if not already loaded
    if (!this.translations[normalizedLanguage]) {
      try {
        await this.loadTranslationFile(normalizedLanguage);
      } catch (error) {
        console.error(`Failed to load language ${normalizedLanguage}:`, error);
        this.currentLanguage = originalLanguage; // Restore on error
        return false;
      }
    }

    localStorage.setItem('language', normalizedLanguage);

    // Update HTML lang attribute and direction
    document.documentElement.lang = normalizedLanguage;
    document.documentElement.dir = langInfo.dir;

    this.updatePageLanguage();

    // Trigger language change event
    window.dispatchEvent(new CustomEvent('i18n:languageChanged', {
      detail: { language: normalizedLanguage, langInfo }
    }));

    // Trigger a more aggressive update event for dynamic content
    window.dispatchEvent(new CustomEvent('i18n:updateAll', {
      detail: { language: normalizedLanguage, langInfo }
    }));

    return true;
  }

  // Get current language info
  getCurrentLanguage() {
    return this.supportedLanguages.find(l => l.code === this.currentLanguage);
  }

  // Get available languages
  getAvailableLanguages() {
    return this.supportedLanguages;
  }

  // Update all elements with i18n attributes
  updatePageLanguage() {
    if (!this.isInitialized) return;

    // Update elements with data-i18n attribute (including hidden ones)
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.t(key);

      if (element.tagName === 'INPUT' &&
          (element.type === 'text' || element.type === 'password' ||
           element.type === 'url' || element.type === 'number')) {
        element.placeholder = translation;
      } else if (element.tagName === 'INPUT' && element.type === 'submit') {
        element.value = translation;
      } else {
        element.textContent = translation;
      }
    });

    // Update elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.t(key);
    });

    // Update elements with data-i18n-title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.t(key);
    });

    // Update select options with data-i18n attribute
    document.querySelectorAll('option[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.t(key);
    });

    // Update elements with data-i18n-html attribute (for HTML content)
    document.querySelectorAll('[data-i18n-html]').forEach(element => {
      const key = element.getAttribute('data-i18n-html');
      element.innerHTML = this.t(key);
    });

    // Trigger update event for components that need custom handling
    window.dispatchEvent(new CustomEvent('i18n:pageUpdated', {
      detail: { language: this.currentLanguage }
    }));

    // Force Alpine to re-evaluate by manipulating the DOM slightly
    if (window.Alpine) {
      // Trigger a DOM change that Alpine will detect
      document.documentElement.setAttribute('data-alpine-i18n-update', Date.now());
    }
  }

  // Check if i18n is ready
  isReady() {
    return this.isInitialized;
  }

  // Format date according to current locale
  formatDate(date, options = {}) {
    try {
      return new Intl.DateTimeFormat(this.currentLanguage, options).format(date);
    } catch (error) {
      console.warn('Date formatting failed:', error);
      return date.toLocaleDateString();
    }
  }

  // Format number according to current locale
  formatNumber(number, options = {}) {
    try {
      return new Intl.NumberFormat(this.currentLanguage, options).format(number);
    } catch (error) {
      console.warn('Number formatting failed:', error);
      return number.toString();
    }
  }
}

// Create and export global i18n instance
window.i18n = new I18n();

// Initialize immediately and make sure it's available for Alpine
(async () => {
  // Wait for a brief moment to ensure DOM is ready
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }

  // Initialize i18n
  await window.i18n.init();

  // Trigger ready event for Alpine
  window.dispatchEvent(new CustomEvent('i18n:ready'));
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.i18n;
}