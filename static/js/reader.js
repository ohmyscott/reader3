/**
 * Reader Interface Components
 * Handles reading experience, chat functionality, and user interactions
 */

// Include marked.js for markdown rendering
const markedScript = document.createElement('script');
markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
document.head.appendChild(markedScript);

// Include html-to-image for image generation
const htmlToImageScript = document.createElement('script');
htmlToImageScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js';
document.head.appendChild(htmlToImageScript);

/**
 * Chat Service Component
 */
class ChatService {
  constructor() {
    this.chatHistory = [];
    this.currentPromptType = 'qa';
    this.isChatOpen = false;
    this.isLoading = false;
    this.currentStreamingMessage = null;
    this.accumulatedContent = '';
  }

  initializeEventListeners() {
    // Chat button
    const chatBtn = document.getElementById('chatBtn');
    if (chatBtn) {
      chatBtn.addEventListener('click', () => this.toggleChat());
    }

    // Chat close button
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    if (chatCloseBtn) {
      chatCloseBtn.addEventListener('click', () => this.toggleChat());
    }

    // Chat input
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => this.handleChatKeydown(e));
      chatInput.addEventListener('input', () => this.autoResize(chatInput));
    }

    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Shortcut buttons
    document.querySelectorAll('.shortcut-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleShortcut(btn));
    });

    // Click outside to close chat
    const chatDialog = document.getElementById('chatDialog');
    if (chatDialog) {
      document.addEventListener('click', (e) => {
        if (!chatDialog.contains(e.target) && !chatBtn.contains(e.target)) {
          this.closeChat();
        }
      });
    }
  }

  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
    const dialog = document.getElementById('chatDialog');
    const chatBtn = document.getElementById('chatBtn');

    if (this.isChatOpen) {
      dialog.classList.add('open');
      chatBtn.classList.add('active');
      setTimeout(() => {
        const input = document.getElementById('chatInput');
        if (input) input.focus();
      }, 300);
    } else {
      this.closeChat();
    }
  }

  closeChat() {
    const dialog = document.getElementById('chatDialog');
    const chatBtn = document.getElementById('chatBtn');
    dialog.classList.remove('open');
    chatBtn.classList.remove('active');
    this.isChatOpen = false;
  }

  handleShortcut(button) {
    const promptType = button.dataset.promptType || button.textContent.match(/[\u4e00-\u9fff]+/)?.[0] || 'qa';
    this.currentPromptType = promptType;

    // Update button states
    document.querySelectorAll('.shortcut-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    button.classList.add('active');

    const input = document.getElementById('chatInput');

    const actions = {
      '总结': { placeholder: '正在生成本章总结...', message: '', prompt: 'summarize' },
      '笔记': { placeholder: '正在生成阅读笔记...', message: '', prompt: 'notes' },
      '提问': { placeholder: '输入你的问题...', message: '', prompt: 'qa' },
      '分析': { placeholder: '正在进行深度分析...', message: '', prompt: 'analysis' },
      '批判': { placeholder: '正在生成批判思考问题...', message: '', prompt: 'critical' },
      '关联': { placeholder: '正在建立知识关联...', message: '', prompt: 'connection' }
    };

    const action = actions[promptType] || actions['提问'];
    input.placeholder = action.placeholder;
    input.value = action.message;

    if (promptType !== 'qa' || !action.message) {
      this.sendPrompt(action.prompt, action.message);
    }
  }

  sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message || this.isLoading) return;

    this.sendPrompt(this.currentPromptType, message);
    input.value = '';
    this.autoResize(input);
  }

  sendPrompt(promptType, message) {
    if (this.isLoading) return;

    this.isLoading = true;
    this.updateSendButtonState();

    // Add user message if it's a QA prompt with actual message
    if (promptType === 'qa' && message) {
      this.addMessage('user', message);
    }

    // Reset accumulated content
    this.accumulatedContent = '';

    // Add typing indicator
    const typingId = this.addTypingIndicator();

    // Build SSE URL
    const params = new URLSearchParams({
      prompt_type: promptType,
      book_id: this.getBookId(),
      chapter_index: this.getChapterIndex(),
      question: message,
      conversation_history: JSON.stringify(this.chatHistory.slice(-10))
    });

    const sseUrl = '/api/chat/stream?' + params.toString();
    console.log('Starting SSE connection to:', sseUrl);

    // Create EventSource connection
    const eventSource = new EventSource(sseUrl);

    // Handle message events
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.content) {
          this.accumulatedContent += data.content;

          // Remove typing indicator and create/update streaming message
          if (this.currentStreamingMessage === null) {
            this.removeTypingIndicator(typingId);
            this.currentStreamingMessage = this.addStreamingMessage();
          }

          this.updateStreamingMessage(this.accumulatedContent);
        }
      } catch (e) {
        console.error('Error parsing SSE message:', e);
      }
    });

    // Handle done event
    eventSource.addEventListener('done', (event) => {
      try {
        if (event.data && event.data.trim()) {
          const data = JSON.parse(event.data);
          if (data.done) {
            if (this.currentStreamingMessage !== null) {
              this.finalizeStreamingMessage(this.accumulatedContent);
              this.currentStreamingMessage = null;
            } else {
              this.removeTypingIndicator(typingId);
            }

            // Update chat history
            if (promptType === 'qa' && message) {
              this.chatHistory.push({ role: 'user', content: message });
            }
            if (this.accumulatedContent) {
              this.chatHistory.push({ role: 'assistant', content: this.accumulatedContent });
            }

            eventSource.close();
            this.isLoading = false;
            this.updateSendButtonState();
          }
        }
      } catch (e) {
        console.error('Error parsing SSE done event:', e);
      }
    });

    // Handle error events
    eventSource.addEventListener('error', (event) => {
      console.error('SSE error:', event);
      this.removeTypingIndicator(typingId);
      this.addMessage('assistant', '抱歉，发生了一个错误。请稍后重试。');
      eventSource.close();
      this.isLoading = false;
      this.updateSendButtonState();
    });
  }

  addMessage(role, content) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    let renderedContent = content;
    if (role === 'assistant') {
      renderedContent = marked.parse(content);
    }

    const messageId = `assistant-${Date.now()}`;
    messageDiv.id = messageId;

    messageDiv.innerHTML = `
      <div class="message-bubble">${renderedContent}</div>
      <div class="message-time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
    `;

    // Add actions for assistant messages
    if (role === 'assistant') {
      const timeElement = messageDiv.querySelector('.message-time');
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'message-actions';
      actionsDiv.innerHTML = `
        <button class="message-action-btn" onclick="window.copyMessage('${messageId}')" title="复制消息">
          📋 复制
        </button>
        <button class="message-action-btn" onclick="window.generateImage('${messageId}')" title="生成图片">
          🖼️ 图片
        </button>
      `;
      timeElement.parentNode.insertBefore(actionsDiv, timeElement.nextSibling);
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  addTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant';
    typingDiv.id = typingId;
    typingDiv.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return typingId;
  }

  removeTypingIndicator(typingId) {
    const typingElement = document.getElementById(typingId);
    if (typingElement) {
      typingElement.remove();
    }
  }

  addStreamingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming';
    const messageId = 'streaming-' + Date.now();
    messageDiv.id = messageId;
    messageDiv.innerHTML = `
      <div class="message-bubble streaming-content"></div>
      <div class="message-time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return messageId;
  }

  updateStreamingMessage(content) {
    if (this.currentStreamingMessage) {
      const messageElement = document.getElementById(this.currentStreamingMessage);
      if (messageElement) {
        const bubbleElement = messageElement.querySelector('.streaming-content');
        if (bubbleElement) {
          bubbleElement.innerHTML = marked.parse(content);
          const messagesContainer = document.getElementById('chatMessages');
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }
    }
  }

  finalizeStreamingMessage(content) {
    if (this.currentStreamingMessage) {
      const messageElement = document.getElementById(this.currentStreamingMessage);
      if (messageElement) {
        messageElement.classList.remove('streaming');
        const bubbleElement = messageElement.querySelector('.streaming-content');
        if (bubbleElement) {
          bubbleElement.innerHTML = marked.parse(content);
          bubbleElement.classList.remove('streaming-content');
        }

        // Add message actions
        const timeElement = messageElement.querySelector('.message-time');
        if (timeElement) {
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'message-actions';
          actionsDiv.innerHTML = `
            <button class="message-action-btn" onclick="window.copyMessage('${this.currentStreamingMessage}')" title="复制消息">
              📋 复制
            </button>
            <button class="message-action-btn" onclick="window.generateImage('${this.currentStreamingMessage}')" title="生成图片">
              🖼️ 图片
            </button>
          `;
          timeElement.parentNode.insertBefore(actionsDiv, timeElement.nextSibling);
        }
      }
    }
  }

  updateSendButtonState() {
    const sendBtn = document.getElementById('sendBtn');
    if (this.isLoading) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '⏳';
    } else {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '➤';
    }
  }

  handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 5 * 20) + 'px'; // 5rem max
  }

  getBookId() {
    return document.body.dataset.bookId || '';
  }

  getChapterIndex() {
    return document.body.dataset.chapterIndex || '0';
  }
}

/**
 * Copy Service Component
 */
class CopyService {
  async copyChapterContent() {
    const copyBtn = document.querySelector('.copy-btn');
    const contentElement = document.querySelector('.book-content');

    try {
      const textContent = contentElement.innerText || contentElement.textContent;
      await navigator.clipboard.writeText(textContent);

      this.updateCopyButton(copyBtn, 'Copied!', '✓');
      setTimeout(() => {
        this.resetCopyButton(copyBtn);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      this.fallbackCopy(contentElement);
    }
  }

  async copyMessage(messageId) {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
      const bubbleElement = messageElement.querySelector('.message-bubble');
      if (bubbleElement) {
        const textContent = bubbleElement.innerText || bubbleElement.textContent;
        try {
          await navigator.clipboard.writeText(textContent);
          this.showToast('消息已复制到剪贴板', 'success');
        } catch (err) {
          console.error('Failed to copy message: ', err);
          this.showToast('复制失败，请手动复制', 'error');
        }
      }
    }
  }

  updateCopyButton(button, text, icon) {
    button.classList.add('copied');
    button.querySelector('.btn-text').textContent = text;
    button.querySelector('.btn-icon').textContent = icon;
  }

  resetCopyButton(button) {
    button.classList.remove('copied');
    button.querySelector('.btn-text').textContent = 'Copy';
    button.querySelector('.btn-icon').textContent = '📋';
  }

  fallbackCopy(contentElement) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = contentElement.innerText || contentElement.textContent;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      const copyBtn = document.querySelector('.copy-btn');
      this.updateCopyButton(copyBtn, 'Copied!', '✓');
      setTimeout(() => {
        this.resetCopyButton(copyBtn);
      }, 2000);
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr);
      const copyBtn = document.querySelector('.copy-btn');
      copyBtn.querySelector('.btn-text').textContent = 'Failed';
      setTimeout(() => {
        this.resetCopyButton(copyBtn);
      }, 2000);
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';

    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: ${bgColor};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

/**
 * Image Generation Service
 */
class ImageService {
  getImageOptions(node) {
    return {
      quality: 1.0,
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      width: node.scrollWidth,
      height: node.scrollHeight,
      style: {
        transform: 'none',
        overflow: 'visible',
        maxHeight: 'none',
        height: 'auto',
        display: 'block',
        fontFamily: '"Georgia", "Microsoft YaHei", sans-serif',
        background: 'white',
        padding: '40px'
      }
    };
  }

  async copyImageToClipboard(elementId) {
    const node = document.getElementById(elementId);
    if (!node) return;

    try {
      const options = this.getImageOptions(node);
      const blob = await htmlToImage.toBlob(node, options);

      if (navigator.clipboard && navigator.clipboard.write) {
        const clipboardItem = {};
        clipboardItem[blob.type] = blob;
        await navigator.clipboard.write([
          new ClipboardItem(clipboardItem)
        ]);
      } else {
        throw new Error('Clipboard API not supported');
      }
    } catch (error) {
      console.error('Copy image failed:', error);
      throw error;
    }
  }

  async downloadImage(elementId) {
    const node = document.getElementById(elementId);
    if (!node) return;

    try {
      const options = this.getImageOptions(node);
      const dataUrl = await htmlToImage.toPng(node, options);

      const link = document.createElement('a');
      link.download = `ai-note-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Download image failed:', error);
      throw error;
    }
  }

  generateImage(messageId) {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
      const bubbleElement = messageElement.querySelector('.message-bubble');
      if (bubbleElement) {
        this.showImageDialog(bubbleElement.innerHTML);
      }
    }
  }

  showImageDialog(htmlContent) {
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

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 16px;
      width: 800px;
      max-width: 90vw;
      min-height: 400px;
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
          <button id="downloadBtn" style="display: flex; align-items: center; gap: 6px; background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;">
            <span>📥</span> 下载图片
          </button>
          <button id="closeModalBtn" style="background: transparent; color: #999; border: none; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 20px; line-height: 1;">
            ✕
          </button>
        </div>
      </div>
      <div style="flex: 1; padding: 30px; overflow-y: auto; background: #f9fafb; display: flex; justify-content: center;">
        <div id="imagePreview" class="message-bubble" style="
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: 100%;
          color: #333;
          display: block;
          box-sizing: border-box;
          height: auto;
          overflow: visible;
        ">
          ${htmlContent}
        </div>
      </div>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    const close = () => document.body.removeChild(modalOverlay);
    document.getElementById('closeModalBtn').onclick = close;

    // Copy functionality
    document.getElementById('copyImgBtn').onclick = async () => {
      const btn = document.getElementById('copyImgBtn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳ 处理中...';

      try {
        await this.copyImageToClipboard('imagePreview');
        btn.innerHTML = '✅ 已复制';
        window.copyService.showToast('图片已复制到剪贴板', 'success');
      } catch (err) {
        console.error(err);
        btn.innerHTML = '❌ 失败';
        window.copyService.showToast('复制失败，请重试', 'error');
      }

      setTimeout(() => {
        if (document.body.contains(btn)) btn.innerHTML = originalText;
      }, 2000);
    };

    // Download functionality
    document.getElementById('downloadBtn').onclick = async () => {
      const btn = document.getElementById('downloadBtn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳ 生成中...';

      try {
        await this.downloadImage('imagePreview');
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
  }
}

/**
 * Navigation Service
 */
class NavigationService {
  findAndGoToChapter(filename) {
    const spineMap = window.spineMap || {};
    const cleanFile = filename.split('#')[0];
    const idx = spineMap[cleanFile];

    if (idx !== undefined) {
      const bookId = document.body.dataset.bookId;
      window.location.href = `/read/${bookId}/${idx}`;
    } else {
      console.log("Could not find index for", filename);
    }
  }
}

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', function() {
  // Initialize services
  window.chatService = new ChatService();
  window.copyService = new CopyService();
  window.imageService = new ImageService();
  window.navigationService = new NavigationService();

  // Initialize event listeners
  window.chatService.initializeEventListeners();

  // Add global functions for buttons
  window.copyMessage = (messageId) => window.copyService.copyMessage(messageId);
  window.generateImage = (messageId) => window.imageService.generateImage(messageId);
  window.findAndGoToChapter = (filename) => window.navigationService.findAndGoToChapter(filename);
  window.copyChapterContent = () => window.copyService.copyChapterContent();

  // Set up spine map from template
  window.spineMap = window.spineMap || {};

  // Add welcome message to chat
  const welcomeMessage = `你好！我是你的智能AI阅读助手。我可以帮助你：

- 📝 **智能总结**：快速生成章节核心内容
- 📋 **学习笔记**：创建结构化学习材料
- ❓ **智能问答**：解答任何阅读疑问
- 🔍 **深度分析**：挖掘文本深层含义
- 🧠 **批判思考**：激发思辨能力
- 🔗 **知识关联**：构建知识网络

请选择上方的快捷指令开始，或直接向我提问！`;

  setTimeout(() => {
    window.chatService.addMessage('assistant', welcomeMessage);
  }, 500);

  // Add smooth scroll behavior
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Add reading progress indicator
  addReadingProgress();
});

/**
 * Add reading progress indicator
 */
function addReadingProgress() {
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: 3px;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    z-index: 1000;
    transition: width 0.3s ease;
  `;
  progressBar.id = 'reading-progress';
  document.body.appendChild(progressBar);

  const updateProgress = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollTop / scrollHeight) * 100;
    progressBar.style.width = progress + '%';
  };

  window.addEventListener('scroll', updateProgress);
  window.addEventListener('resize', updateProgress);
}