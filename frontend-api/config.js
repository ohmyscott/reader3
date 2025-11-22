/**
 * Configuration API for managing model settings
 */

export const configAPI = {
  /**
   * Get current model configuration
   * @returns {Promise<Object>} Current configuration
   */
  async getConfig() {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`Failed to get config: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching configuration:', error);
      throw error;
    }
  },

  /**
   * Update model configuration
   * @param {Object} updates - Configuration updates
   * @returns {Promise<Object>} Update result
   */
  async updateConfig(updates) {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update config: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw error;
    }
  },

  /**
   * Reset configuration to defaults
   * @returns {Promise<Object>} Reset result
   */
  async resetConfig() {
    try {
      const response = await fetch('/api/config/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to reset config: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error resetting configuration:', error);
      throw error;
    }
  },
};