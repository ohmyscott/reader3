import { booksAPI } from '/frontend-api/books.js';

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

    async init() {
      // Load dark mode preference
      this.isDarkMode = localStorage.getItem('darkMode') === 'true';
      this.applyDarkMode();

      await this.loadBooks();
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
            message: 'Please select a valid EPUB file'
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
            message: 'Please select a valid EPUB file'
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
        message: 'Processing EPUB file, please wait...'
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
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', this.isDarkMode);
      this.applyDarkMode();
    },

    applyDarkMode() {
      if (this.isDarkMode) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('bg-slate-900', 'text-gray-100');
        document.body.classList.remove('bg-slate-50', 'text-gray-900');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('bg-slate-900', 'text-gray-100');
        document.body.classList.add('bg-slate-50', 'text-gray-900');
      }
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
    }
  };
}