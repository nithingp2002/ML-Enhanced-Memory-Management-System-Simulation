import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with interceptors for debugging
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Request interceptor - log all requests
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - log all responses
api.interceptors.response.use(
  (response) => {
    console.log(`[API] Response ${response.status} from ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`[API] Error from ${error.config?.url}:`, error.message);
    return Promise.reject(error);
  }
);

// Memory API
export const memoryAPI = {
  initialize: (config) => api.post('/memory/initialize', config),
  getState: () => api.get('/memory/state'),
  accessPage: (processId, pageNumber) => 
    api.post('/memory/access', { processId, pageNumber }),
  accessSequence: (sequence) => 
    api.post('/memory/access-sequence', { sequence }),
  setAlgorithm: (algorithm) => 
    api.post('/memory/algorithm', { algorithm }),
  reset: () => api.post('/memory/reset'),
  getStats: () => api.get('/memory/stats'),
  deallocate: (processId) => 
    api.delete(`/memory/deallocate/${processId}`)
};

// Process API
export const processAPI = {
  create: (data) => api.post('/process', data),
  getAll: () => api.get('/process'),
  getOne: (processId) => api.get(`/process/${processId}`),
  delete: (processId) => api.delete(`/process/${processId}`),
  updateStatus: (processId, status) => 
    api.patch(`/process/${processId}/status`, { status }),
  getPageTable: (processId) => 
    api.get(`/process/${processId}/page-table`),
  clearAll: () => api.delete('/process/all')
};

// Algorithm API (Updated with ML)
export const algorithmAPI = {
  compare: (sequence, frameCount) => 
    api.post('/algorithms/compare', { sequence, frameCount }),
  compareWithML: (sequence, frameCount) =>
    api.post('/algorithms/compare-with-ml', { sequence, frameCount }),
  runFIFO: (sequence, frameCount) => 
    api.post('/algorithms/fifo', { sequence, frameCount }),
  runLRU: (sequence, frameCount) => 
    api.post('/algorithms/lru', { sequence, frameCount }),
  runLFU: (sequence, frameCount) => 
    api.post('/algorithms/lfu', { sequence, frameCount }),
  runML: (sequence, frameCount, sequenceLength = 3) =>
    api.post('/algorithms/ml', { sequence, frameCount, sequenceLength }),
  trainML: (trainingSequence, testSequence, frameCount) =>
    api.post('/algorithms/ml/train', { trainingSequence, testSequence, frameCount }),
  generateWorkload: (type, length, uniquePages, localityFactor) =>
    api.post('/algorithms/generate-workload', { type, length, uniquePages, localityFactor }),
  // New ML persistence APIs
  getMLStats: () => api.get('/algorithms/ml/stats'),
  trainFromHistory: (limit = 100) => api.post('/algorithms/ml/train-from-history', { limit }),
  resetMLModels: () => api.post('/algorithms/ml/reset'),
  // Cold-start comparison for research evaluation
  coldStartComparison: (frameCount, referenceString) =>
    api.post('/algorithms/ml/cold-start-comparison', { frameCount, referenceString })
};

// Python ML Service API (sklearn-style models: Random Forest, XGBoost, Naive Bayes)
export const pythonMLAPI = {
  // Health check
  health: () => api.get('/python-ml/health'),
  
  // Train models with sequences
  train: (model, sequences) => 
    api.post('/python-ml/train', { model, sequences }),
  trainAll: (sequences) =>
    api.post('/python-ml/train-all', { sequences }),
  
  // Get predictions
  predict: (model) => api.post('/python-ml/predict', { model }),
  
  // Access page with specific model
  access: (model, processId, pageNumber) =>
    api.post('/python-ml/access', { model, processId, pageNumber }),
  accessAll: (processId, pageNumber) =>
    api.post('/python-ml/access-all', { processId, pageNumber }),
  
  // Get stats
  getStats: () => api.get('/python-ml/stats'),
  getModelStats: (model) => api.get(`/python-ml/stats/${model}`),
  
  // Compare models
  compare: (sequence, frameCount) =>
    api.post('/python-ml/compare', { sequence, frameCount }),
  
  // Evaluation
  evaluate: (sequence, frameCount) =>
    api.post('/python-ml/evaluation', { sequence, frameCount }),
  
  // Reset models
  reset: (frameCount) => api.post('/python-ml/reset', { frameCount }),
  resetModel: (model, frameCount) => 
    api.post(`/python-ml/reset/${model}`, { frameCount }),
  
  // Configure
  configure: (frameCount) => api.post('/python-ml/configure', { frameCount })
};

export default api;
