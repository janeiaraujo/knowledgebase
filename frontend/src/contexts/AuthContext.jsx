import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import i18n from '../i18n';

const AuthContext = createContext(null);

// Aplica o idioma salvo no perfil do usuario (Perfil > Preferencias). Sem
// isso, o i18next usaria so o localStorage local - a preferencia nao
// acompanharia a conta em outro navegador/maquina.
const applyUserLanguage = (user) => {
  const language = user?.preferences?.language;
  if (language && language !== i18n.language) {
    i18n.changeLanguage(language);
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        // Tenta validar o token atual
        const { data } = await authAPI.getMe();
        setUser(data.user);
        applyUserLanguage(data.user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        // Se falhar, limpa tudo (o interceptor já tentou refresh)
        logout();
      }
    } else {
      // Limpa qualquer dado residual se não tiver token completo
      if (!token || !storedUser) {
        logout();
      }
    }
    
    setLoading(false);
  };
  
  const login = async (credentials) => {
    try {
      const { data } = await authAPI.login(credentials);
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setUser(data.user);
      applyUserLanguage(data.user);
      setIsAuthenticated(true);

      return data;
    } catch (error) {
      // Garante que não há dados corrompidos em caso de erro
      logout();
      throw error;
    }
  };
  
  const register = async (userData) => {
    try {
      const { data } = await authAPI.register(userData);
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setUser(data.user);
      applyUserLanguage(data.user);
      setIsAuthenticated(true);

      return data;
    } catch (error) {
      logout();
      throw error;
    }
  };

  const loginWithMagicLink = async (token) => {
    try {
      const { data } = await authAPI.verifyMagicLink({ token });
      
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setUser(data.user);
      applyUserLanguage(data.user);
      setIsAuthenticated(true);

      return data;
    } catch (error) {
      logout();
      throw error;
    }
  };

  const logout = () => {
    // Limpa TODOS os dados de autenticação
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    setUser(null);
    setIsAuthenticated(false);
  };
  
  const value = {
    user,
    // Exposto para a tela de Perfil refletir nome/preferencias na hora,
    // sem precisar recarregar a pagina.
    setUser,
    loading,
    isAuthenticated,
    login,
    register,
    loginWithMagicLink,
    logout
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
