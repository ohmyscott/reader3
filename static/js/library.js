/**
 * Library Upload Component
 * Handles EPUB file upload functionality
 */
class LibraryUploader {
  constructor() {
    this.selectedFile = null;
    this.isUploading = false;
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Upload button
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => this.openModal());
    }

    // Modal close
    const modalOverlay = document.getElementById('uploadModal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.closeModal();
        }
      });

      const closeBtn = document.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeModal());
      }
    }

    // File input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // Upload form
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    if (uploadSubmitBtn) {
      uploadSubmitBtn.addEventListener('click', () => this.uploadFile());
    }

    // Drag and drop
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
      uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
    }
  }

  openModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
      modal.classList.add('show');
      this.resetForm();
    }
  }

  closeModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
      modal.classList.remove('show');
      this.resetForm();
    }
  }

  resetForm() {
    this.selectedFile = null;
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    const statusMessage = document.getElementById('statusMessage');

    if (fileInput) fileInput.value = '';
    if (fileInfo) fileInfo.style.display = 'none';
    if (uploadSubmitBtn) uploadSubmitBtn.disabled = true;
    if (statusMessage) {
      statusMessage.className = 'status-message';
      statusMessage.style.display = 'none';
    }
  }

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      if (!this.validateFileType(file)) {
        this.showStatus('Please select a valid EPUB file', 'error');
        return;
      }
      this.selectedFile = file;
      this.displayFileInfo(file);
    }
  }

  validateFileType(file) {
    return file.type === 'application/epub+zip' ||
           file.name.toLowerCase().endsWith('.epub');
  }

  displayFileInfo(file) {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');

    if (fileName) {
      fileName.textContent = file.name;
    }
    if (fileInfo) {
      fileInfo.style.display = 'block';
    }
    if (uploadSubmitBtn) {
      uploadSubmitBtn.disabled = false;
    }
  }

  handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      uploadArea.classList.add('dragover');
    }
  }

  handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      uploadArea.classList.remove('dragover');
    }
  }

  handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
      uploadArea.classList.remove('dragover');
    }

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const fileInput = document.getElementById('fileInput');
      if (fileInput) {
        fileInput.files = files;
      }
      this.handleFileSelect({ target: { files: [file] } });
    }
  }

  showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-message ${type}`;
      statusElement.style.display = 'block';
    }
  }

  async uploadFile() {
    if (!this.selectedFile) {
      this.showStatus('Please select a file first', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('epub_file', this.selectedFile);

    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    const originalText = uploadSubmitBtn.textContent;

    this.isUploading = true;
    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.textContent = '⏳ Processing...';
    this.showStatus('Processing EPUB file, please wait...', 'processing');

    try {
      const response = await fetch('/api/upload-book', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        this.showStatus(`✅ Success! ${result.message}`, 'success');
        uploadSubmitBtn.textContent = '✅ Upload Complete';

        // Auto-refresh after successful upload
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      this.showStatus(`❌ Error: ${error.message}`, 'error');
      uploadSubmitBtn.textContent = originalText;
      uploadSubmitBtn.disabled = false;
    } finally {
      this.isUploading = false;
    }
  }
}

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', function() {
  new LibraryUploader();

  // Add fade-in animation to book cards
  const bookCards = document.querySelectorAll('.book-card');
  bookCards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('animate-fade-in');
    }, index * 100);
  });
});

/**
 * Utility functions
 */
const Utils = {
  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
};

/**
 * Add slide animations to the page
 */
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
`;
document.head.appendChild(style);