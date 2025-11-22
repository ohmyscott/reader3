import apiClient from './client.js';

export const chatAPI = {
  /**
   * Send a chat request and get streaming response
   */
  async sendChatRequest(data, onMessage, onDone, onError) {
    const params = new URLSearchParams({
      prompt_type: data.prompt_type,
      book_id: data.book_id,
      chapter_index: data.chapter_index,
      question: data.question || '',
      conversation_history: JSON.stringify(data.conversation_history || []),
    });

    const eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.content && onMessage) {
          onMessage(data);
        }
      } catch (e) {
        console.error('Error parsing SSE message:', e);
      }
    });

    eventSource.addEventListener('done', (event) => {
      try {
        if (event.data) {
          const data = JSON.parse(event.data);
          if (data.done && onDone) {
            onDone(data);
          }
        }
        eventSource.close();
      } catch (e) {
        console.error('Error parsing SSE done event:', e);
        eventSource.close();
        if (onError) onError(e);
      }
    });

    eventSource.addEventListener('error', (event) => {
      console.error('SSE error:', event);
      eventSource.close();
      if (onError) onError(new Error('Chat connection error'));
    });

    return eventSource;
  },

  /**
   * Send a regular (non-streaming) chat request
   */
  async sendChatMessage(data) {
    const response = await apiClient.post('/chat', data);
    return response;
  },
};