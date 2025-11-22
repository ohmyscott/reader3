import apiClient from './client.js';

export const chatAPI = {
  /**
   * Send a chat request and get streaming response
   */
  async sendChatRequest(data, onMessage, onDone, onError) {
    console.log('Starting chat request with data:', data);

    const params = new URLSearchParams({
      prompt_type: data.prompt_type,
      book_id: data.book_id,
      chapter_index: data.chapter_index,
      question: data.question || '',
      conversation_history: JSON.stringify(data.conversation_history || []),
    });

    const url = `/api/chat/stream?${params.toString()}`;
    console.log('Connecting to SSE endpoint:', url);

    const eventSource = new EventSource(url);

    // Add connection established timeout
    const connectionTimeout = setTimeout(() => {
      console.warn('SSE connection timeout - no response within 10 seconds');
      if (onError) onError(new Error('Connection timeout - please check your internet connection'));
      eventSource.close();
    }, 10000);

    eventSource.addEventListener('open', () => {
      console.log('SSE connection opened successfully');
      clearTimeout(connectionTimeout);
    });

    eventSource.addEventListener('message', (event) => {
      try {
        console.log('SSE message received:', event.data);
        const data = JSON.parse(event.data);
        if (data.content && onMessage) {
          onMessage(data);
        }
        if (data.error) {
          console.error('Server sent error:', data.error);
          if (onError) onError(new Error(data.error));
          eventSource.close();
        }
      } catch (e) {
        console.error('Error parsing SSE message:', e, 'Raw data:', event.data);
      }
    });

    eventSource.addEventListener('done', (event) => {
      console.log('SSE done event received:', event.data);
      clearTimeout(connectionTimeout);
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
      console.error('SSE error event:', event);
      clearTimeout(connectionTimeout);

      // Check browser-specific error information
      if (event.target && event.target.readyState) {
        console.log('EventSource readyState:', event.target.readyState);
        switch (event.target.readyState) {
          case EventSource.CONNECTING:
            console.log('SSE connection status: CONNECTING');
            break;
          case EventSource.OPEN:
            console.log('SSE connection status: OPEN');
            break;
          case EventSource.CLOSED:
            console.log('SSE connection status: CLOSED');
            break;
        }
      }

      eventSource.close();
      if (onError) onError(new Error('Chat connection error - please check if the server is running'));
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