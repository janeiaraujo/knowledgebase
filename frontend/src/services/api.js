import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const clearAuthData = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  isRefreshing = false;
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Não tentar refresh em rotas de autenticação
    if (originalRequest.url?.includes('/auth/')) {
      return Promise.reject(error);
    }
    
    // 401 = Token expirado ou inválido
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Se já está refreshing, adiciona à fila
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      
      // Se não tem refresh token, limpa tudo e redireciona
      if (!refreshToken) {
        clearAuthData();
        window.location.href = '/login';
        return Promise.reject(error);
      }
      
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken
        });
        
        const newAccessToken = data.accessToken;
        localStorage.setItem('accessToken', newAccessToken);
        
        // Se retornar novo refresh token, atualiza
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        
        // Atualiza header da requisição original
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        
        // Processa fila de requisições pendentes
        processQueue(null, newAccessToken);
        isRefreshing = false;
        
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh falhou - token inválido ou expirado
        processQueue(refreshError, null);
        clearAuthData();
        
        // Redireciona apenas se não estiver já na página de login
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?session=expired';
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    // 403 = Sem permissão
    if (error.response?.status === 403) {
      console.error('Acesso negado. Você não tem permissão para esta ação.');
    }
    
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  requestMagicLink: (data) => api.post('/auth/magic-link', data),
  verifyMagicLink: (data) => api.post('/auth/magic-verify', data),
  getMe: () => api.get('/auth/me')
};

// KB/Records API
export const kbAPI = {
  search: (params) => api.get('/kb/search', { params }),
  capture: (data) => api.post('/kb/capture', data),
  getRelated: (recordId) => api.get(`/kb/${recordId}/related`)
};

export const recordAPI = {
  list: (params) => api.get('/records', { params }),
  create: (data) => api.post('/records', data),
  get: (id) => api.get(`/records/${id}`),
  update: (id, data) => api.patch(`/records/${id}`, data),
  approve: (id) => api.post(`/records/${id}/approve`),
  publish: (id) => api.post(`/records/${id}/publish`),
  delete: (id) => api.delete(`/records/${id}`),
  getVersions: (id) => api.get(`/records/${id}/versions`)
};

// Incidents API
export const incidentAPI = {
  list: (params) => api.get('/incidents', { params }),
  create: (data) => api.post('/incidents', data),
  get: (id) => api.get(`/incidents/${id}`),
  update: (id, data) => api.patch(`/incidents/${id}`, data),
  addNote: (id, note) => api.post(`/incidents/${id}/notes`, { note })
};

// Events API
export const eventAPI = {
  list: (params) => api.get('/events', { params }),
  convertToIncident: (id) => api.post(`/events/${id}/convert-to-incident`)
};

// Files API
export const fileAPI = {
  upload: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        if (onProgress) onProgress(percentCompleted);
      }
    });
  },
  list: (params) => api.get('/files', { params }),
  get: (id) => api.get(`/files/${id}`),
  getSignedUrl: (id) => api.get(`/files/${id}/signed-url`),
  delete: (id) => api.delete(`/files/${id}`)
};

// AI API
export const aiAPI = {
  generateDraft: (data) => api.post('/ai/generate-draft', data),
  summarize: (data) => api.post('/ai/summarize', data),
  suggestProperties: (data) => api.post('/ai/suggest-properties', data),
  semanticSearch: (data) => api.post('/ai/semantic-search', data)
};

// Databases API
export const databaseAPI = {
  list: () => api.get('/databases'),
  create: (data) => api.post('/databases', data),
  get: (id) => api.get(`/databases/${id}`),
  update: (id, data) => api.patch(`/databases/${id}`, data)
};

// Organizations API
export const organizationAPI = {
  get: () => api.get('/organizations'),
  update: (data) => api.patch('/organizations', data)
};

// Users API
export const userAPI = {
  list: () => api.get('/users'),
  invite: (data) => api.post('/users/invite', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`)
};

// Billing API
export const billingAPI = {
  getSubscription: () => api.get('/billing/subscription'),
  getUsage: () => api.get('/billing/usage'),
  getPlans: () => api.get('/billing/plans'),
  changePlan: (planId) => api.post('/billing/change-plan', { plan_id: planId }),
  getHistory: () => api.get('/billing/history'),
  getMetrics: (params) => api.get('/billing/metrics', { params })
};
