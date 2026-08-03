import axios from 'axios';

const API_URL =
    import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
    async(error) => {
        const originalRequest = error.config;

        // Não tentar refresh em rotas de autenticação
        if (originalRequest.url ?.includes('/auth/')) {
            return Promise.reject(error);
        }

        // 401 = Token expirado ou inválido
        if (error.response ?.status === 401 && !originalRequest._retry) {
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
        if (error.response ?.status === 403) {
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
    submitForReview: (id) => api.post(`/records/${id}/submit-for-review`),
    approve: (id) => api.post(`/records/${id}/approve`),
    reject: (id, reason) => api.post(`/records/${id}/reject`, { reason }),
    publish: (id) => api.post(`/records/${id}/publish`),
    delete: (id) => api.delete(`/records/${id}`),
    getVersions: (id) => api.get(`/records/${id}/versions`),
    getVersion: (id, version) => api.get(`/records/${id}/versions/${version}`),
    compareVersions: (id, from, to) => api.get(`/records/${id}/compare`, { params: { from, to } }),
    restoreVersion: (id, version) => api.post(`/records/${id}/restore/${version}`)
};

// Incidents API
export const incidentAPI = {
    list: (params) => api.get('/incidents', { params }),
    create: (data) => api.post('/incidents', data),
    get: (id) => api.get(`/incidents/${id}`),
    update: (id, data) => api.patch(`/incidents/${id}`, data),
    updateStatus: (id, status, note) => api.patch(`/incidents/${id}/status`, { status, note }),
    addNote: (id, note) => api.post(`/incidents/${id}/notes`, { note }),
    // Quick Capture
    quickCapture: (data) => api.post('/incidents/quick-capture', data),
    listQuickCaptures: (params) => api.get('/incidents/quick-captures', { params })
};

// Events API
export const eventAPI = {
    list: (params) => api.get('/events', { params }),
    convertToIncident: (id) => api.post(`/events/${id}/convert-to-incident`),
    // Fontes de eventos (tokens de ingestão - Zabbix, Grafana, Datadog, Sentry...)
    listTokens: () => api.get('/events/tokens'),
    createToken: (data) => api.post('/events/tokens', data),
    revokeToken: (id) => api.delete(`/events/tokens/${id}`)
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
    semanticSearch: (data) => api.post('/ai/semantic-search', data),
    indexAll: () => api.post('/ai/index-all'),
    getIndexStatus: () => api.get('/ai/index-status'),
    describeImage: (fileId, context) => api.post('/ai/describe-image', { fileId, context })
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
    delete: (id) => api.delete(`/users/${id}`),
    // Perfil do próprio usuário (auto-serviço, sem precisar ser admin)
    getMe: () => api.get('/users/me'),
    updateMe: (data) => api.patch('/users/me', data),
    changePassword: (currentPassword, newPassword) =>
        api.post('/users/me/password', { currentPassword, newPassword })
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

// Notifications API
export const notificationAPI = {
    list: (params) => api.get('/notifications', { params }),
    getCount: () => api.get('/notifications/count'),
    markAsRead: (id) => api.patch(`/notifications/${id}/read`),
    markAllAsRead: () => api.post('/notifications/mark-all-read'),
    delete: (id) => api.delete(`/notifications/${id}`)
};

// Export API
export const exportAPI = {
    toMarkdown: (id) => api.get(`/export/kb/${id}/markdown`, { responseType: 'blob' }),
    toHTML: (id) => api.get(`/export/kb/${id}/html`),
    batchExport: (ids) => api.post('/export/kb/export-batch', { ids })
};

// Comments API
export const commentAPI = {
    list: (recordId) => api.get(`/records/${recordId}/comments`),
    create: (recordId, data) => api.post(`/records/${recordId}/comments`, data),
    update: (commentId, data) => api.put(`/comments/${commentId}`, data),
    delete: (commentId) => api.delete(`/comments/${commentId}`)
};

// Tags API
export const tagAPI = {
    list: (params) => api.get('/tags', { params }),
    create: (data) => api.post('/tags', data),
    update: (id, data) => api.patch(`/tags/${id}`, data),
    delete: (id) => api.delete(`/tags/${id}`),
    getRecords: (id, params) => api.get(`/tags/${id}/records`, { params }),
    setRecordTags: (recordId, tagIds) => api.post(`/records/${recordId}/tags`, { tagIds })
};

// Categories API
export const categoryAPI = {
    list: (params) => api.get('/categories', { params }),
    create: (data) => api.post('/categories', data),
    update: (id, data) => api.patch(`/categories/${id}`, data),
    delete: (id) => api.delete(`/categories/${id}`),
    getRecords: (id, params) => api.get(`/categories/${id}/records`, { params }),
    setRecordCategory: (recordId, categoryId) => api.post(`/records/${recordId}/category`, { categoryId })
};

// Favorites API
export const favoriteAPI = {
    list: (params) => api.get('/favorites', { params }),
    check: (recordId) => api.get(`/favorites/check/${recordId}`),
    add: (recordId) => api.post(`/favorites/${recordId}`),
    remove: (recordId) => api.delete(`/favorites/${recordId}`),
    toggle: (recordId) => api.post(`/favorites/${recordId}/toggle`),
    getIds: () => api.get('/favorites/ids')
};

// Relations API
export const relationAPI = {
    list: (recordId) => api.get(`/records/${recordId}/relations`),
    create: (recordId, data) => api.post(`/records/${recordId}/relations`, data),
    delete: (relationId) => api.delete(`/relations/${relationId}`),
    search: (recordId, q) => api.get(`/records/${recordId}/relations/search`, { params: { q } }),
    getTypes: () => api.get('/relations/types')
};

// Templates API
export const templateAPI = {
    list: (params) => api.get('/templates', { params }),
    get: (id) => api.get(`/templates/${id}`),
    create: (data) => api.post('/templates', data),
    update: (id, data) => api.patch(`/templates/${id}`, data),
    delete: (id) => api.delete(`/templates/${id}`),
    duplicate: (id, name) => api.post(`/templates/${id}/duplicate`, { name }),
    use: (id) => api.post(`/templates/${id}/use`),
    getCategories: () => api.get('/templates/meta/categories'),
    seedDefaults: () => api.post('/templates/seed-defaults')
};

// Analytics API
export const analyticsAPI = {
    getOverview: (period) => api.get('/analytics/overview', { params: { period } }),
    getKBTrends: (period, groupBy) => api.get('/analytics/trends/kbs', { params: { period, groupBy } }),
    getStatusDistribution: () => api.get('/analytics/distribution/status'),
    getCategoryDistribution: () => api.get('/analytics/distribution/categories'),
    getTagDistribution: () => api.get('/analytics/distribution/tags'),
    getUserLeaderboard: (period) => api.get('/analytics/leaderboard/users', { params: { period } }),
    getActivity: (limit) => api.get('/analytics/activity', { params: { limit } }),
    trackView: (recordId) => api.post(`/analytics/track/view/${recordId}`),
    getAIUsage: (period) => api.get('/analytics/ai-usage', { params: { period } }),
    getSearchAnalytics: (period) => api.get('/analytics/search-analytics', { params: { period } })
};

// GPS (Guided Problem Solving) API
export const gpsAPI = {
    // Flows
    listFlows: (params) => api.get('/gps/flows', { params }),
    getFlow: (id) => api.get(`/gps/flows/${id}`),
    createFlow: (data) => api.post('/gps/flows', data),
    updateFlow: (id, data) => api.put(`/gps/flows/${id}`, data),
    deleteFlow: (id) => api.delete(`/gps/flows/${id}`),
    duplicateFlow: (id) => api.post(`/gps/flows/${id}/duplicate`),
    
    // Sessions
    listSessions: (params) => api.get('/gps/sessions', { params }),
    getSession: (id) => api.get(`/gps/sessions/${id}`),
    startSession: (flowId, data) => api.post('/gps/sessions', { flow_id: flowId, ...data }),
    submitResponse: (sessionId, data) => api.post(`/gps/sessions/${sessionId}/respond`, data),
    abandonSession: (sessionId, reason) => api.post(`/gps/sessions/${sessionId}/abandon`, { reason }),
    deleteSession: (id) => api.delete(`/gps/sessions/${id}`),
    generateRCA: (sessionId) => api.post(`/gps/sessions/${sessionId}/generate-rca`),
    
    // Categories
    getCategories: () => api.get('/gps/categories')
};