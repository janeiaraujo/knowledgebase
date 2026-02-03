import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Container, Nav, Navbar, NavDropdown, Button } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import QuickSearch from './QuickSearch';
import NotificationDropdown from './notifications/NotificationDropdown';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme, setThemeMode } = useTheme();
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
  
  const isActive = (path) => location.pathname.startsWith(path);
  
  return (
    <div className="d-flex">
      {/* Mobile overlay */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'show' : ''}`}>
        <div className="px-3 py-2 mb-3 border-bottom border-secondary">
          <h5 className="text-white mb-0">
            <i className="bi bi-database-fill me-2"></i>
            Incident KB
          </h5>
        </div>
        
        <Nav className="flex-column">
          <Link 
            to="/" 
            className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}
          >
            <i className="bi bi-speedometer2 me-2"></i>
            Dashboard
          </Link>
          
          <Link 
            to="/kb" 
            className={`nav-link ${isActive('/kb') ? 'active' : ''}`}
          >
            <i className="bi bi-book me-2"></i>
            Knowledge Base
          </Link>
          
          <Link 
            to="/incidents" 
            className={`nav-link ${isActive('/incidents') ? 'active' : ''}`}
          >
            <i className="bi bi-exclamation-triangle me-2"></i>
            Incidents
          </Link>
          
          <Link 
            to="/events" 
            className={`nav-link ${isActive('/events') ? 'active' : ''}`}
          >
            <i className="bi bi-calendar-event me-2"></i>
            Events
          </Link>
          
          <Link 
            to="/favorites" 
            className={`nav-link ${isActive('/favorites') ? 'active' : ''}`}
          >
            <i className="bi bi-star me-2"></i>
            Favoritos
          </Link>
          
          <Link 
            to="/search" 
            className={`nav-link ${isActive('/search') ? 'active' : ''}`}
          >
            <i className="bi bi-search me-2"></i>
            Busca Avançada
          </Link>
          
          <Link 
            to="/smart-search" 
            className={`nav-link ${isActive('/smart-search') ? 'active' : ''}`}
          >
            <i className="bi bi-robot me-2"></i>
            Busca Inteligente
          </Link>
          
          <Link 
            to="/quick-capture" 
            className={`nav-link ${isActive('/quick-capture') ? 'active' : ''}`}
          >
            <i className="bi bi-lightning-charge me-2"></i>
            Captura Rápida
          </Link>
          
          <Link 
            to="/gps" 
            className={`nav-link ${isActive('/gps') && location.pathname === '/gps' ? 'active' : ''}`}
          >
            <i className="bi bi-signpost-2 me-2"></i>
            Diagnóstico GPS
          </Link>
          
          <Link 
            to="/gps/sessions" 
            className={`nav-link ${isActive('/gps/sessions') ? 'active' : ''}`}
          >
            <i className="bi bi-clock-history me-2"></i>
            Sessões GPS
          </Link>
          
          <Link 
            to="/analytics" 
            className={`nav-link ${isActive('/analytics') ? 'active' : ''}`}
          >
            <i className="bi bi-graph-up me-2"></i>
            Analytics
          </Link>
          
          <hr className="text-white-50 my-3" />
          
          {(user?.role === 'admin' || user?.role === 'owner') && (
            <Link 
              to="/admin" 
              className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
            >
              <i className="bi bi-gear-fill me-2"></i>
              Administração
            </Link>
          )}
          
          <Link 
            to="/properties" 
            className={`nav-link ${isActive('/properties') ? 'active' : ''}`}
          >
            <i className="bi bi-sliders me-2"></i>
            Propriedades
          </Link>
          
          <Link 
            to="/tags" 
            className={`nav-link ${isActive('/tags') ? 'active' : ''}`}
          >
            <i className="bi bi-tags me-2"></i>
            Tags & Categorias
          </Link>
          
          <Link 
            to="/templates" 
            className={`nav-link ${isActive('/templates') ? 'active' : ''}`}
          >
            <i className="bi bi-file-earmark-text me-2"></i>
            Templates
          </Link>
          
          <Link 
            to="/import" 
            className={`nav-link ${isActive('/import') ? 'active' : ''}`}
          >
            <i className="bi bi-cloud-upload me-2"></i>
            Importar
          </Link>
          
          <Link 
            to="/reviews" 
            className={`nav-link ${isActive('/reviews') ? 'active' : ''}`}
          >
            <i className="bi bi-calendar-check me-2"></i>
            Revisões
          </Link>
          
          <Link 
            to="/postmortem" 
            className={`nav-link ${isActive('/postmortem') ? 'active' : ''}`}
          >
            <i className="bi bi-file-earmark-medical me-2"></i>
            Post-Mortem
          </Link>
          
          {(user?.role === 'admin' || user?.role === 'owner') && (
            <Link 
              to="/kb-requests" 
              className={`nav-link ${isActive('/kb-requests') ? 'active' : ''}`}
            >
              <i className="bi bi-inbox me-2"></i>
              Solicitações KB
            </Link>
          )}
          
          {(user?.role === 'admin' || user?.role === 'owner') && (
            <Link 
              to="/audit-logs" 
              className={`nav-link ${isActive('/audit-logs') ? 'active' : ''}`}
            >
              <i className="bi bi-journal-text me-2"></i>
              Audit Logs
            </Link>
          )}
          
          {(user?.role === 'admin' || user?.role === 'owner') && (
            <Link 
              to="/webhooks" 
              className={`nav-link ${isActive('/webhooks') ? 'active' : ''}`}
            >
              <i className="bi bi-link-45deg me-2"></i>
              Webhooks
            </Link>
          )}
          
          {(user?.role === 'admin' || user?.role === 'owner') && (
            <Link 
              to="/user-activity" 
              className={`nav-link ${isActive('/user-activity') ? 'active' : ''}`}
            >
              <i className="bi bi-activity me-2"></i>
              Atividade Usuários
            </Link>
          )}
          
          <Link 
            to="/settings" 
            className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
          >
            <i className="bi bi-gear me-2"></i>
            Settings
          </Link>
        </Nav>
        
        <div className="position-absolute bottom-0 w-100 p-3 border-top border-secondary">
          <div className="text-white-50 small">
            <div className="mb-1">{user?.name}</div>
            <div className="mb-2 text-capitalize">
              <i className="bi bi-shield-check me-1"></i>
              {user?.role}
            </div>
            <button 
              onClick={handleLogout}
              className="btn btn-sm btn-outline-light w-100"
            >
              <i className="bi bi-box-arrow-right me-1"></i>
              Logout
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content flex-grow-1">
        <NotificationProvider>
          <Navbar bg="white" className="border-bottom mb-4">
            <Container fluid>
              {/* Mobile menu button - hidden on desktop */}
              <Button 
                variant="outline-secondary"
                className="d-md-none me-2"
                onClick={() => setSidebarOpen(true)}
              >
                <i className="bi bi-list"></i>
              </Button>
              
              <QuickSearch />
              
              <Nav className="ms-auto align-items-center gap-2">
                {/* Theme Toggle */}
                <button 
                  onClick={toggleTheme} 
                  className="theme-toggle nav-link border-0 bg-transparent"
                  title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                >
                  <i className={`bi ${isDark ? 'bi-sun-fill text-warning' : 'bi-moon-fill text-secondary'} fs-5`}></i>
                </button>
                
                <NotificationDropdown />
                <Link to="/kb/new" className="btn btn-primary btn-sm d-none d-sm-inline-flex">
                  <i className="bi bi-plus-circle me-1"></i>
                  <span className="d-none d-md-inline">Novo KB</span>
                </Link>
                <Link to="/kb/new" className="btn btn-primary btn-sm d-sm-none">
                  <i className="bi bi-plus-circle"></i>
                </Link>
              </Nav>
            </Container>
          </Navbar>
          
          <Container fluid>
            <Outlet />
          </Container>
        </NotificationProvider>
      </div>
      
      {/* Mobile floating menu button */}
      <Button 
        variant="primary"
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <i className={`bi bi-${sidebarOpen ? 'x-lg' : 'list'}`}></i>
      </Button>
    </div>
  );
}
