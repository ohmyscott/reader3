import apiClient from './client.js';

export const booksAPI = {
  /**
   * Get all books from the library
   */
  async getAllBooks() {
    const response = await apiClient.get('/books');
    return response;
  },

  /**
   * Get book details by ID
   */
  async getBookById(bookId) {
    const response = await apiClient.get(`/books/${bookId}`);
    return response;
  },

  /**
   * Upload an EPUB file
   */
  async uploadBook(file) {
    const formData = new FormData();
    formData.append('epub_file', file);

    const response = await apiClient.post('/upload-book', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response;
  },

  /**
   * Get chapter content
   */
  async getChapter(bookId, chapterIndex) {
    const response = await apiClient.get(`/books/${bookId}/chapters/${chapterIndex}`);
    return response;
  },

  /**
   * Get book table of contents
   */
  async getTOC(bookId) {
    const response = await apiClient.get(`/books/${bookId}/toc`);
    return response;
  },
};