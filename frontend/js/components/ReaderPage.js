import { booksAPI } from '/frontend-api/books.js';
import { chatAPI } from '/frontend-api/chat.js';
import { configAPI } from '/frontend-api/config.js';

export function ReaderPage() {
  return {
    // Properties - will be set from the page
    bookId: '',
    chapterIndex: 0,

    // State
    book: null,
    chapter: null,
    toc: [],
    loading: true,
    error: null,
    readingProgress: 0,
    showToc: false,

    // Chat state
    chatOpen: false,
    messages: [],
    currentMessage: '',
    chatHistory: [],
    isLoading: false,
    promptType: 'qa',
    loadingDots: 0,
    loadingInterval: null,

    // Settings state
    settingsOpen: false,
    activeSettingsTab: 'model',
    settings: {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 32000
    },

    async init() {
      // Get bookId and chapterIndex from the current page URL
      const pathParts = window.location.pathname.split('/');
      if (pathParts.length >= 4 && pathParts[1] === 'read') {
        this.bookId = decodeURIComponent(pathParts[2]);
        this.chapterIndex = parseInt(pathParts[3]) || 0;

        console.log('ReaderPage init:', this.bookId, this.chapterIndex);

        if (this.bookId) {
          await this.loadBook();
          await this.loadChapter();

          // Set up scroll listener for reading progress
          window.addEventListener('scroll', () => this.updateReadingProgress());
        } else {
          this.error = 'No book specified';
          this.loading = false;
        }
      } else {
        this.error = 'Invalid URL format';
        this.loading = false;
      }

      // Load settings configuration
      await this.loadSettings();
    },

    async loadBook() {
      try {
        // Reset state for new book
        this.book = null;
        this.chapter = null;
        this.toc = [];
        this.error = null;
        this.loading = true;

        console.log('Loading book:', this.bookId);
        this.book = await booksAPI.getBookById(this.bookId);
        this.toc = this.book.toc || [];
        console.log('Book loaded:', this.book);
      } catch (error) {
        this.error = error.message;
        console.error('Failed to load book:', error);
        this.loading = false;
      }
    },

    async loadChapter() {
      if (!this.bookId) return;

      this.loading = true;
      this.error = null;

      try {
        this.chapter = await booksAPI.getChapter(this.bookId, this.chapterIndex);
        console.log('Chapter loaded:', this.chapter);

        // Reset chat state for new chapter
        this.messages = [];
        this.chatHistory = [];
        this.currentMessage = '';
        this.chatOpen = false;

        // Initialize chat (only add welcome message)
        setTimeout(() => {
          this.addWelcomeMessage();
        }, 500);
      } catch (error) {
        this.error = error.message;
        console.error('Failed to load chapter:', error);
      } finally {
        this.loading = false;
      }
    },

    // Chat functions
    toggleChat() {
      console.log('Toggle chat called, current state:', this.chatOpen);
      this.chatOpen = !this.chatOpen;

      if (this.chatOpen) {
        // Focus input when chat opens
        setTimeout(() => {
          const input = document.getElementById('chatInput');
          if (input) input.focus();
        }, 300);
      }
    },

    toggleToc() {
      console.log('toggleToc called, current showToc:', this.showToc);
      this.showToc = !this.showToc;
    },

    closeChat() {
      console.log('Close chat called');
      this.chatOpen = false;
    },

  
    addMessage(role, content, streaming = false) {
      this.messages.push({
        id: Date.now() + Math.random(),
        role,
        content,
        streaming,
        showActions: false, // Initialize hover state
        timestamp: new Date().toISOString()
      });

      // Auto scroll to bottom
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    },

    addWelcomeMessage() {
      // Only add welcome message if there are no messages yet
      if (this.messages.length === 0) {
        const welcomeMessage = `你好！我是你的智能AI阅读助手。我可以帮助你：

- 📝 **智能总结**：快速生成章节核心内容
- 📋 **学习笔记**：创建结构化学习材料
- ❓ **智能问答**：解答任何阅读疑问
- 🔍 **深度分析**：挖掘文本深层含义
- 🧠 **批判思考**：激发思辨能力
- 🔗 **知识关联**：构建知识网络

请选择上方的快捷指令开始，或直接向我提问！`;

        this.addMessage('assistant', welcomeMessage);
      }
    },

    scrollToBottom() {
      const container = document.getElementById('chatMessages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    handleShortcut(type) {
      this.promptType = type;

      const prompts = {
        'summarize': '正在生成本章总结...',
        'notes': '正在生成阅读笔记...',
        'qa': '',
        'analysis': '正在进行深度分析...',
        'critical': '正在生成批判思考问题...',
        'connection': '正在建立知识关联...'
      };

      const userMessages = {
        'summarize': '📝 请帮我总结本章的核心内容',
        'notes': '📋 请为我生成本章的学习笔记',
        'analysis': '🔍 请对本章进行深度分析',
        'critical': '🧠 请提出一些批判性思考问题',
        'connection': '🔗 请帮我建立本章与相关知识的关联'
      };

      if (type === 'qa') {
        // Let user type their question
        setTimeout(() => {
          const input = document.getElementById('chatInput');
          if (input) {
            input.placeholder = '输入你的问题...';
            input.focus();
          }
        }, 100);
      } else {
        // Add user message for display only (not added to chat history)
        this.addMessage('user', userMessages[type]);

        // Auto-send predefined prompts
        setTimeout(() => {
          this.sendMessage(prompts[type]);
        }, 300); // Small delay for better UX
      }
    },

    sendMessage(event = null) {
      // Handle keyboard event
      let message = '';
      if (event && event.type === 'keydown') {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          message = this.currentMessage;
        } else {
          return; // Don't send on other keys or Shift+Enter
        }
      } else {
        // Handle button click
        message = this.currentMessage;
      }

      if (!message.trim() && this.promptType === 'qa') {
        return;
      }

      if (this.isLoading) return;

      const content = message.trim();

      // Add user message for QA prompts
      if (this.promptType === 'qa' && content) {
        this.addMessage('user', content);
      }

      // Clear input for QA prompts
      if (this.promptType === 'qa') {
        this.currentMessage = '';
      }

      this.isLoading = true;

      // Add loading message for non-QA prompts or when content is provided
      const loadingTexts = {
        'summarize': '📝 正在为您总结本章内容',
        'notes': '📋 正在为您生成学习笔记',
        'analysis': '🔍 正在进行深度分析',
        'critical': '🧠 正在生成批判思考问题',
        'connection': '🔗 正在建立知识关联',
        'qa': content ? '🤔 正在思考您的问题' : ''
      };

      const loadingText = loadingTexts[this.promptType];
      let loadingMessageId = null;
      if (loadingText) {
        loadingMessageId = Date.now() + Math.random();
        this.addMessage('assistant', loadingText, false);
        // Start animation for the loading message
        this.$nextTick(() => {
          this.startLoadingAnimation(loadingMessageId);
        });
      }

      // Send to chat API
      this.sendStreamRequest(content, loadingMessageId);
    },

    sendStreamRequest(message, loadingMessageId = null) {
      const request = {
        prompt_type: this.promptType,
        book_id: this.bookId,
        chapter_index: this.chapterIndex,
        question: message,
        conversation_history: this.chatHistory.slice(-10)
      };

      let currentContent = '';
      let messageId = null;

      chatAPI.sendChatRequest(
        request,
        // onMessage
        (data) => {
          if (data.content) {
            currentContent += data.content;

            if (!messageId) {
              // This is the first AI content - stop loading animation and replace message
              this.stopLoadingAnimation();

              const lastMessage = this.messages[this.messages.length - 1];

              // Check if last message is a loading message
              if (lastMessage && (
                lastMessage.content.startsWith('📝 正在为您总结本章内容') ||
                lastMessage.content.startsWith('📋 正在为您生成学习笔记') ||
                lastMessage.content.startsWith('🔍 正在进行深度分析') ||
                lastMessage.content.startsWith('🧠 正在生成批判思考问题') ||
                lastMessage.content.startsWith('🔗 正在建立知识关联') ||
                lastMessage.content.startsWith('🤔 正在思考您的问题')
              )) {
                // Replace loading message with actual content
                messageId = Date.now() + Math.random();
                lastMessage.content = currentContent;
                lastMessage.streaming = true;
              } else {
                // Add new message if no loading message found
                messageId = Date.now() + Math.random();
                this.addMessage('assistant', currentContent, true); // streaming=true flag
              }
            } else {
              // Update existing streaming message
              const streamingMessage = this.messages.find(m => m.streaming);
              if (streamingMessage) {
                streamingMessage.content = currentContent;
              }
            }

            this.scrollToBottom();
          }
        },
        // onDone
        () => {
          // Stop any remaining animation
          this.stopLoadingAnimation();

          // Mark message as complete
          const streamingMessage = this.messages.find(m => m.streaming);
          if (streamingMessage) {
            streamingMessage.streaming = false;
          }

          // Update chat history - only record QA interactions to maintain clean context
          if (this.promptType === 'qa' && message) {
            this.chatHistory.push({ role: 'user', content: message });
          }
          if (this.promptType === 'qa' && currentContent) {
            this.chatHistory.push({ role: 'assistant', content: currentContent });
          }

          this.isLoading = false;
        },
        // onError
        (error) => {
          console.error('Chat error:', error);
          // Stop animation and show error
          this.stopLoadingAnimation();

          const lastMessage = this.messages[this.messages.length - 1];
          if (lastMessage && (
            lastMessage.content.startsWith('📝 正在为您总结本章内容') ||
            lastMessage.content.startsWith('📋 正在为您生成学习笔记') ||
            lastMessage.content.startsWith('🔍 正在进行深度分析') ||
            lastMessage.content.startsWith('🧠 正在生成批判思考问题') ||
            lastMessage.content.startsWith('🔗 正在建立知识关联') ||
            lastMessage.content.startsWith('🤔 正在思考您的问题')
          )) {
            // Replace loading message with error message
            lastMessage.content = '抱歉，发生了一个错误。请稍后重试。';
            lastMessage.streaming = false;
          } else {
            // Add new error message
            this.addMessage('assistant', '抱歉，发生了一个错误。请稍后重试。');
          }
          this.isLoading = false;
        }
      );
    },

    clearChat() {
      // Stop any running loading animation
      this.stopLoadingAnimation();

      this.messages = [];
      this.chatHistory = [];
      this.currentMessage = '';
      setTimeout(() => {
        this.addWelcomeMessage();
      }, 300);
    },

    clearMessages() {
      this.messages = [];
    },

    // Utility functions
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    getChapterIndex(tocHref) {
      // Extract the HTML file name from TOC href (remove #anchor)
      const htmlFile = tocHref.split('#')[0];

      // Find the matching spine entry
      if (this.book && this.book.spine) {
        const spineEntry = this.book.spine.find(item => item.href === htmlFile);
        return spineEntry ? spineEntry.order : 0;
      }

      return 0; // Fallback to first chapter
    },

    getTocItemClass(href) {
      // Check if this TOC item matches the current chapter
      return this.chapter && this.chapter.href === href;
    },

    // Copy message content to clipboard
    async copyMessage(content) {
      try {
        await navigator.clipboard.writeText(content);
        // Show toast notification if available, otherwise just log
        if (window.app && window.app.showToast) {
          window.app.showToast('Message copied to clipboard', 'success');
        } else {
          console.log('Message copied to clipboard');
        }
      } catch (error) {
        console.error('Failed to copy message:', error);
        if (window.app && window.app.showToast) {
          window.app.showToast('Failed to copy message', 'error');
        }
      }
    },

    // Generate image from message content using new approach
    async generateImage(content) {
      try {
        const htmlContent = marked.parse(content);
        this.showImageDialog(htmlContent);
      } catch (error) {
        console.error('Failed to generate image:', error);
        if (window.app && window.app.showToast) {
          window.app.showToast('Failed to generate image', 'error');
        }
      }
    },

    // Show image generation dialog (based on operation manual)
    showImageDialog(htmlContent) {
      // Create modal overlay
      const modalOverlay = document.createElement('div');
      modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        backdrop-filter: blur(5px);
      `;

      // Create modal content
      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        border-radius: 16px;
        width: 800px;
        max-width: 90vw;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        overflow: hidden;
      `;

      modalContent.innerHTML = `
        <div style="padding: 16px 24px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fff;">
            <h3 style="margin: 0; font-size: 18px; color: #333; font-weight: 600;">📸 图片预览</h3>
            <div style="display: flex; gap: 10px;">
                <button id="copyImgBtn" style="display: flex; align-items: center; gap: 6px; background: #fff; color: #333; border: 1px solid #ddd; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
                    <span>📋</span> 复制图片
                </button>
                <button id="downloadBtn" style="display: flex; align-items: center; gap: 6px; background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
                    <span>📥</span> 下载图片
                </button>
                <button id="closeModalBtn" style="background: transparent; color: #999; border: none; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 20px; line-height: 1;">
                    ✕
                </button>
            </div>
        </div>
        <div style="flex: 1; padding: 30px; overflow-y: auto; background: #f8f9fa; display: flex; justify-content: center;">
            <div id="imagePreview" class="message-bubble" style="
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                width: 100%;
                max-width: 100%;
                color: #333;
                list-style-position: inside;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.6;
            ">
                ${htmlContent}
            </div>
        </div>
      `;

      modalOverlay.appendChild(modalContent);
      document.body.appendChild(modalOverlay);

      // Event handlers
      const close = () => {
        if (document.body.contains(modalOverlay)) {
          document.body.removeChild(modalOverlay);
        }
      };

      document.getElementById('closeModalBtn').onclick = close;

      // 复制功能
      document.getElementById('copyImgBtn').onclick = async () => {
        const btn = document.getElementById('copyImgBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ 处理中...';

        try {
          await this.copyImageToClipboard('imagePreview');
          btn.innerHTML = '✅ 已复制';
          if (window.app && window.app.showToast) {
            window.app.showToast('图片已复制到剪贴板', 'success');
          }
        } catch (err) {
          console.error(err);
          btn.innerHTML = '❌ 失败';
          if (window.app && window.app.showToast) {
            window.app.showToast('复制失败，请重试', 'error');
          }
        }

        setTimeout(() => {
          if (document.body.contains(btn)) btn.innerHTML = originalText;
        }, 2000);
      };

      // 下载功能
      document.getElementById('downloadBtn').onclick = async () => {
        const btn = document.getElementById('downloadBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ 生成中...';

        try {
          await this.downloadImageNew('imagePreview');
          btn.innerHTML = '✅ 已下载';
        } catch (err) {
          console.error(err);
          btn.innerHTML = '❌ 失败';
        }

        setTimeout(() => {
          if (document.body.contains(btn)) btn.innerHTML = originalText;
        }, 2000);
      };

      modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) close();
      };
    },

    // Image generation options (based on operation manual)
    get imageOptions() {
      return {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          fontFamily: '"Georgia", "Microsoft YaHei", sans-serif'
        }
      };
    },

    // Copy image to clipboard using html-to-image
    async copyImageToClipboard(elementId) {
      const node = document.getElementById(elementId);
      if (!node) return;

      try {
        // Generate blob using htmlToImage
        const blob = await window.htmlToImage.toBlob(node, this.imageOptions);

        // Write to clipboard
        if (navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]);
        } else {
          throw new Error('Clipboard API not supported');
        }
      } catch (error) {
        console.error('Copy image failed:', error);
        throw error;
      }
    },

    // Download image using html-to-image
    async downloadImageNew(elementId) {
      const node = document.getElementById(elementId);
      if (!node) return;

      try {
        // Generate Data URL
        const dataUrl = await window.htmlToImage.toPng(node, this.imageOptions);

        const link = document.createElement('a');
        link.download = `ai-note-${new Date().getTime()}.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error('Download image failed:', error);
        throw error;
      }
    },

    // Fallback method for image generation
    showImageGenerationFallback(content) {
      try {
        // Create a simple text download as fallback
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `chat-message-${Date.now()}.txt`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        if (window.app && window.app.showToast) {
          window.app.showToast('Image generation failed, downloaded as text file', 'warning');
        }
      } catch (err) {
        console.error('Fallback also failed:', err);
        if (window.app && window.app.showToast) {
          window.app.showToast('Failed to generate image', 'error');
        }
      }
    },

    // Start loading animation
    startLoadingAnimation(messageId) {
      this.stopLoadingAnimation(); // Clear any existing animation

      this.loadingInterval = setInterval(() => {
        this.loadingDots = (this.loadingDots + 1) % 4;

        // Update the loading message with animated dots
        const loadingMessage = this.messages.find(m => m.id === messageId);
        if (loadingMessage && loadingMessage.content) {
          // Find the base message without dots
          const baseMessages = {
            'summarize': '📝 正在为您总结本章内容',
            'notes': '📋 正在为您生成学习笔记',
            'analysis': '🔍 正在进行深度分析',
            'critical': '🧠 正在生成批判思考问题',
            'connection': '🔗 正在建立知识关联'
          };

          const baseMessage = baseMessages[this.promptType] || '🤔 正在思考您的问题';
          loadingMessage.content = baseMessage + '.'.repeat(this.loadingDots);
        }
      }, 500); // Change dots every 500ms
    },

    // Stop loading animation
    stopLoadingAnimation() {
      if (this.loadingInterval) {
        clearInterval(this.loadingInterval);
        this.loadingInterval = null;
      }
      this.loadingDots = 0;
    },

    // Settings methods
    async loadSettings() {
      try {
        const config = await configAPI.getConfig();
        if (config) {
          // Update settings state (API key will be masked for security)
          this.settings = {
            apiKey: config.api_key?.startsWith('******') ? '' : config.api_key || '',
            baseUrl: config.base_url || 'https://api.openai.com/v1',
            modelName: config.model_name || 'gpt-4o-mini',
            temperature: config.temperature || 0.7,
            maxTokens: config.max_tokens || 32000
          };
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        if (window.app && window.app.showToast) {
          window.app.showToast('Failed to load configuration', 'error');
        }
      }
    },

    toggleSettings() {
      this.settingsOpen = !this.settingsOpen;
    },

    async saveSettings() {
      try {
        // Validate required fields
        if (!this.settings.apiKey.trim()) {
          throw new Error('API Key is required');
        }
        if (!this.settings.baseUrl.trim()) {
          throw new Error('Base URL is required');
        }
        if (!this.settings.modelName.trim()) {
          throw new Error('Model Name is required');
        }

        // Prepare updates
        const updates = {
          api_key: this.settings.apiKey.trim(),
          base_url: this.settings.baseUrl.trim(),
          model_name: this.settings.modelName.trim()
        };

        // Only include optional fields if they're not empty
        if (this.settings.temperature !== null && this.settings.temperature !== '') {
          updates.temperature = parseFloat(this.settings.temperature);
        }
        if (this.settings.maxTokens !== null && this.settings.maxTokens !== '') {
          updates.max_tokens = parseInt(this.settings.maxTokens);
        }

        await configAPI.updateConfig(updates);

        this.settingsOpen = false;
        if (window.app && window.app.showToast) {
          window.app.showToast('Settings saved successfully', 'success');
        }
      } catch (error) {
        console.error('Failed to save settings:', error);
        if (window.app && window.app.showToast) {
          window.app.showToast(error.message || 'Failed to save settings', 'error');
        }
      }
    },

    async resetSettings() {
      try {
        await configAPI.resetConfig();

        // Reset local settings state
        this.settings = {
          apiKey: '',
          baseUrl: 'https://api.openai.com/v1',
          modelName: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 32000
        };

        if (window.app && window.app.showToast) {
          window.app.showToast('Settings reset to defaults', 'success');
        }
      } catch (error) {
        console.error('Failed to reset settings:', error);
        if (window.app && window.app.showToast) {
          window.app.showToast('Failed to reset settings', 'error');
        }
      }
    },

    // Update reading progress based on scroll position
    updateReadingProgress() {
      if (!this.chapter) return;

      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollPercent = (scrollTop / (documentHeight - windowHeight)) * 100;

      this.readingProgress = Math.max(0, Math.min(100, scrollPercent));
    }
  };
}