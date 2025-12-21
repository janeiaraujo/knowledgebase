/**
 * Utilitários de autenticação - Melhores práticas
 */

/**
 * Limpa todos os dados de autenticação do localStorage
 * Usado em logout ou quando tokens estão inválidos
 */
export const clearAuthData = () => {
  const keysToRemove = ['accessToken', 'refreshToken', 'user'];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
};

/**
 * Verifica se o usuário tem tokens válidos
 */
export const hasValidTokens = () => {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  
  return !!(accessToken && refreshToken);
};

/**
 * Verifica se o token JWT está expirado
 * @param {string} token - JWT token
 * @returns {boolean}
 */
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Converte para ms
    return Date.now() >= exp;
  } catch (error) {
    console.error('Failed to parse token:', error);
    return true;
  }
};

/**
 * Obtém tempo restante do token em segundos
 */
export const getTokenTimeRemaining = (token) => {
  if (!token) return 0;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    const remaining = exp - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  } catch (error) {
    return 0;
  }
};

/**
 * Salva dados de autenticação no localStorage
 */
export const saveAuthData = (accessToken, refreshToken, user) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
};

/**
 * Obtém usuário do localStorage
 */
export const getStoredUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Failed to parse stored user:', error);
    return null;
  }
};
