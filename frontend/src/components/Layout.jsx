/**
 * Layout Component - Professional Version
 * 
 * Main application layout with:
 * - Professional sidebar with collapsible groups
 * - Top navbar with quick actions
 * - Theme toggle
 * - Notifications
 */

import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Container, Nav, Navbar, Button, Dropdown } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import QuickSearch from './QuickSearch';
import NotificationDropdown from './notifications/NotificationDropdown';
import Sidebar from './Sidebar';
import './Sidebar.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);
  
  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  // Get page title based on current route
  const getPageTitle = () => {
    const routes = {
      '/': 'Dashboard',
      '/kb': 'Knowledge Base',
      '/incidents': 'Incidentes',
      '/events': 'Eventos',
      '/smart-search': 'Busca Inteligente',
      '/search': 'Busca Avançada',
      '/analytics': 'Analytics',
      '/quick-capture': 'Captura Rápida',
      '/gps': 'Diagnóstico GPS',
      '/postmortem': 'Post-Mortem',
      '/favorites': 'Favoritos',
      '/templates': 'Templates',
      '/tags': 'Tags & Categorias',
      '/properties': 'Propriedades',
      '/reviews': 'Revisões',
      '/import': 'Importar',
      '/admin': 'Administração',
      '/kb-requests': 'Solicitações KB',
      '/audit-logs': 'Audit Logs',
      '/webhooks': 'Webhooks',
      '/user-activity': 'Atividade de Usuários',
      '/settings': 'Configurações',
    };
    
    // Check exact match first
    if (routes[location.pathname]) return routes[location.pathname];
    
    // Check partial matches
    for (const [path, title] of Object.entries(routes)) {
      if (location.pathname.startsWith(path) && path !== '/') {
        return title;
      }
    }
    
    return 'Incident KB';
  };
  
  return (
    <div className="d-flex">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      {/* Main Content */}
      <div className="main-content-pro flex-grow-1">
        <NotificationProvider>
          {/* Top Navbar */}
          <Navbar 
            bg={isDark ? 'dark' : 'white'} 
            variant={isDark ? 'dark' : 'light'}
            className="border-bottom px-3 py-2 sticky-top"
            style={{ 
              backdropFilter: 'blur(10px)',
              backgroundColor: isDark ? 'rgba(13, 17, 23, 0.9)' : 'rgba(255, 255, 255, 0.95)'
            }}
          >
            {/* Mobile menu button */}
            <Button 
              variant={isDark ? 'outline-light' : 'outline-secondary'}
              className="d-lg-none me-2 border-0"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="bi bi-list fs-5"></i>
            </Button>
            
            {/* Page Title - Hidden on mobile */}
            <div className="d-none d-md-flex align-items-center">
              <h5 className="mb-0 fw-semibold">{getPageTitle()}</h5>
            </div>
            
            {/* Quick Search */}
            <div className="ms-auto me-3 d-none d-sm-block" style={{ maxWidth: '400px', flex: 1 }}>
              <QuickSearch />
            </div>
            
            <Nav className="align-items-center gap-2">
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme} 
                className="btn btn-link nav-link p-2 border-0"
                title={isDark ? 'Tema claro' : 'Tema escuro'}
              >
                <i className={`bi ${isDark ? 'bi-sun-fill text-warning' : 'bi-moon-fill'} fs-5`}></i>
              </button>
              
              {/* Notifications */}
              <NotificationDropdown />
              
              {/* New KB Button */}
              <Link 
                to="/kb/new" 
                className="btn btn-primary d-none d-sm-inline-flex align-items-center gap-1"
              >
                <i className="bi bi-plus-lg"></i>
                <span className="d-none d-md-inline">Novo KB</span>
              </Link>
              
              {/* Quick Actions Dropdown - Mobile */}
              <Dropdown align="end" className="d-sm-none">
                <Dropdown.Toggle variant="primary" size="sm" id="quick-actions">
                  <i className="bi bi-plus-lg"></i>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item as={Link} to="/kb/new">
                    <i className="bi bi-file-earmark-plus me-2"></i>
                    Novo KB
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/quick-capture">
                    <i className="bi bi-lightning-charge me-2"></i>
                    Captura Rápida
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/smart-search">
                    <i className="bi bi-robot me-2"></i>
                    Busca Inteligente
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item as={Link} to="/gps">
                    <i className="bi bi-signpost-2 me-2"></i>
                    Diagnóstico GPS
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav>
          </Navbar>
          
          {/* Page Content */}
          <main className="p-3 p-md-4">
            <Container fluid className="px-0">
              <Outlet />
            </Container>
          </main>
        </NotificationProvider>
      </div>
      
      {/* Mobile floating menu button */}
      <button 
        className="sidebar-mobile-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Menu"
      >
        <i className={`bi bi-${sidebarOpen ? 'x-lg' : 'list'}`}></i>
      </button>
    </div>
  );
}
