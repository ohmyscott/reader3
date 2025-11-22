import { booksAPI } from '../../frontend-api/books.js';
import { chatAPI } from '../../frontend-api/chat.js';

export function ReaderPage(initialData = {}) {
  return {
    // Properties
    bookId: initialData.bookId || '',
    chapterIndex: parseInt(initialData.chapterIndex) || 0,

    // State
    book: null,
    chapter: null,
    toc: [],
    loading: true,
    error: null,
    readingProgress: 0,

    // Chat state
    chatOpen: false,
    messages: [],
    currentMessage: '',
    chatHistory: [],
    isLoading: false,
    promptType: 'qa',

    async init() {
      if (this.bookId) {
        await this.loadBook();
        await this.loadChapter();

        // Set up scroll listener for reading progress
        window.addEventListener('scroll', () => this.updateReadingProgress());
      } else {
        this.error = 'No book specified';
        this.loading = false;
      }
    },

    async loadBook() {
      try {
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

        // Initialize chat
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

    navigateToChapter(chapterIndex) {
      if (chapterIndex >= 0 && chapterIndex < (this.book?.chapters || 0)) {
        this.chapterIndex = chapterIndex;
        this.loadChapter();

        // Update router state
        const appEl = document.getElementById('app');
        if (appEl && appEl._x_dataStack && appEl._x_dataStack[0]) {
          appEl._x_dataStack[0].navigateToReader(this.bookId, chapterIndex);
        }
      }
    },

    navigatePrevious() {
      if (this.chapterIndex > 0) {
        this.navigateToChapter(this.chapterIndex - 1);
      }
    },

    navigateNext() {
      const totalChapters = this.book?.chapters || 0;
      if (this.chapterIndex < totalChapters - 1) {
        this.navigateToChapter(this.chapterIndex + 1);
      }
    },

    // Chat functions
    toggleChat() {
      this.chatOpen = !this.chatOpen;

      if (this.chatOpen) {
        // Focus input when chat opens
        setTimeout(() => {
          const input = document.getElementById('chatInput');
          if (input) input.focus();
        }, 300);
      }
    },

    addMessage(role, content) {
      this.messages.push({
        id: Date.now() + Math.random(),
        role,
        content,
        timestamp: new Date().toISOString()
      });

      // Auto scroll to bottom
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    },

    addWelcomeMessage() {
      const welcomeMessage = `你好！我是你的智能AI阅读助手。我可以帮助你：

- 📝 **智能总结**：快速生成章节核心内容
- 📋 **学习笔记**：创建结构化学习材料
- ❓ **智能问答**：解答任何阅读疑问
- 🔍 **深度分析**：挖掘文本深层含义
- 🧠 **批判思考**：激发思辨能力
- 🔗 **知识关联**：构建知识网络

请选择上方的快捷指令开始，或直接向我提问！`;

      this.addMessage('assistant', welcomeMessage);
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
        // Auto-send predefined prompts
        this.sendMessage(prompts[type]);
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

      // Send to chat API
      this.sendStreamRequest(content);
    },

    sendStreamRequest(message) {
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
              // Start new message
              messageId = Date.now() + Math.random();
              this.addMessage('assistant', '', true); // streaming=true flag

              // Find the message and mark as streaming
              const lastMessage = this.messages[this.messages.length - 1];
              lastMessage.content = currentContent;
              lastMessage.streaming = true;
            } else {
              // Update existing message
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
          // Mark message as complete
          const streamingMessage = this.messages.find(m => m.streaming);
          if (streamingMessage) {
            streamingMessage.streaming = false;
          }

          // Update chat history
          if (this.promptType === 'qa' && message) {
            this.chatHistory.push({ role: 'user', content: message });
          }
          if (currentContent) {
            this.chatHistory.push({ role: 'assistant', content: currentContent });
          }

          this.isLoading = false;
        },
        // onError
        (error) => {
          console.error('Chat error:', error);
          this.addMessage('assistant', '抱歉，发生了一个错误。请稍后重试。');
          this.isLoading = false;
        }
      );
    },

    clearChat() {
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

    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    getTocItemClass(href) {
      // Check if this TOC item matches the current chapter
      if (this.chapter && this.chapter.href === href) {
        return 'bg-gray-100 text-gray-800 border-gray-300';
      }
      return '';
    },

    // Copy message content to clipboard
    async copyMessage(content) {
      try {
        await navigator.clipboard.writeText(content);
        window.app.showToast('Message copied to clipboard', 'success');
      } catch (error) {
        console.error('Failed to copy message:', error);
        window.app.showToast('Failed to copy message', 'error');
      }
    },

    // Generate image from message content
    async generateImage(content) {
      try {
        // Create a temporary container for the content
        const container = document.createElement('div');
        container.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 600px;
          padding: 40px;
          background: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #374151;
          z-index: 10000;
        `;

        // Convert markdown to HTML and set as content
        container.innerHTML = content;
        document.body.appendChild(container);

        // Use html-to-image library to generate image
        const { toPng } = await import('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/esm/index.js');

        const dataUrl = await toPng(container, {
          quality: 0.95,
          backgroundColor: '#ffffff'
        });

        // Clean up
        document.body.removeChild(container);

        // Create download link
        const link = document.createElement('a');
        link.download = `chat-message-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();

        window.app.showToast('Image generated successfully', 'success');
      } catch (error) {
        console.error('Failed to generate image:', error);
        window.app.showToast('Failed to generate image', 'error');
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