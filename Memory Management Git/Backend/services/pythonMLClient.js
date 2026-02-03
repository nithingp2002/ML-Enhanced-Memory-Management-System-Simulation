/**
 * Python ML Service Client
 * Communicates with the Python Flask ML microservice
 */
const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

class PythonMLClient {
  constructor(baseUrl = ML_SERVICE_URL) {
    this.baseUrl = baseUrl;
    this.timeout = 15000; // 15 second timeout for ML operations
  }

  /**
   * Check if Python ML service is available
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: this.timeout
      });
      return { available: true, data: response.data };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  /**
   * Get prediction from specific model
   */
  async predict(model = 'markov') {
    try {
      const response = await axios.post(`${this.baseUrl}/predict`, {
        model
      }, { timeout: this.timeout });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Process page access for specific model
   */
  async accessPage(model, processId, pageNumber) {
    try {
      const response = await axios.post(`${this.baseUrl}/access`, {
        model,
        processId,
        pageNumber
      }, { timeout: this.timeout });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Process page access for ALL models
   */
  async accessPageAll(processId, pageNumber) {
    try {
      const response = await axios.post(`${this.baseUrl}/access-all`, {
        processId,
        pageNumber
      }, { timeout: this.timeout });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get statistics for all models
   */
  async getStats() {
    try {
      const response = await axios.get(`${this.baseUrl}/stats`, {
        timeout: this.timeout
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get statistics for specific model
   */
  async getModelStats(model) {
    try {
      const response = await axios.get(`${this.baseUrl}/stats/${model}`, {
        timeout: this.timeout
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Train all models with sequences
   */
  async trainAll(sequences) {
    try {
      const response = await axios.post(`${this.baseUrl}/train-all`, {
        sequences
      }, { timeout: this.timeout * 4 }); // 60s timeout for training
      return { success: true, data: response.data };
    } catch (error) {
      console.error('ML TrainAll error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset all models
   */
  async resetAll(frameCount = 4) {
    try {
      const response = await axios.post(`${this.baseUrl}/reset`, {
        frameCount
      }, { timeout: this.timeout });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset specific model
   */
  async resetModel(model, frameCount = 4) {
    try {
      const response = await axios.post(`${this.baseUrl}/reset/${model}`, {
        frameCount
      }, { timeout: this.timeout });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Configure models with frame count
   */
  async configure(frameCount = 4) {
    try {
      const response = await axios.post(`${this.baseUrl}/configure`, {
        frameCount
      }, { timeout: this.timeout });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Run comparison across all ML models
   */
  async compareModels(sequence, frameCount = 4) {
    try {
      const response = await axios.post(`${this.baseUrl}/compare`, {
        sequence,
        frameCount
      }, { timeout: this.timeout * 3 }); // Triple timeout for comparison (45s)
      return { success: true, data: response.data };
    } catch (error) {
      console.error('ML Compare error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get formal ML evaluation metrics
   */
  async getMLEvaluation(sequence, frameCount = 4) {
    try {
      const response = await axios.post(`${this.baseUrl}/ml-evaluation`, {
        sequence,
        frameCount
      }, { timeout: this.timeout * 2 });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export model states
   */
  async exportStates() {
    try {
      const response = await axios.get(`${this.baseUrl}/export`, {
        timeout: this.timeout
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import model states
   */
  async importStates(states) {
    try {
      const response = await axios.post(`${this.baseUrl}/import`, states, {
        timeout: this.timeout
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const pythonMLClient = new PythonMLClient();

module.exports = {
  PythonMLClient,
  pythonMLClient
};
