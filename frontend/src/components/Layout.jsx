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
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import QuickSearch from './QuickSearch';
import NotificationDropdown from './notifications/NotificationDropdown';
import LanguageSwitcher from './LanguageSwitcher';
import Sidebar from './Sidebar';
import './Sidebar.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
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
      '/': t('nav.items.dashboard'),
      '/kb': t('nav.items.kb'),
      '/incidents': t('nav.items.incidents'),
      '/events': t('nav.items.events'),
      '/smart-search': t('nav.items.smartSearch'),
      '/search': t('nav.items.search'),
      '/analytics': t('nav.items.analytics'),
      '/quick-capture': t('nav.items.quickCapture'),
      '/gps': t('nav.items.gpsDiagnostic'),
      '/postmortem': t('nav.items.postmortem'),
      '/favorites': t('nav.items.favorites'),
      '/templates': t('nav.items.templates'),
      '/tags': t('nav.items.tags'),
      '/properties': t('nav.items.properties'),
      '/reviews': t('nav.items.reviews'),
      '/import': t('nav.items.import'),
      '/admin': t('nav.groups.admin'),
      '/kb-requests': t('nav.items.kbRequests'),
      '/audit-logs': t('nav.items.auditLogs'),
      '/webhooks': t('nav.items.webhooks'),
      '/user-activity': t('navbar.userActivity'),
      '/settings': t('navbar.settings'),
      '/profile': t('profile.title'),
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
              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="btn btn-link nav-link p-2 border-0"
                title={isDark ? t('navbar.lightTheme') : t('navbar.darkTheme')}
              >
                <i className={`bi ${isDark ? 'bi-sun-fill text-warning' : 'bi-moon-fill'} fs-5`}></i>
              </button>

              {/* Notifications */}
              <NotificationDropdown />

              {/* Quick Capture Button */}
              <Link
                to="/quick-capture"
                className="btn btn-outline-primary d-none d-sm-inline-flex align-items-center gap-1"
                title={t('nav.items.quickCapture')}
              >
                <i className="bi bi-lightning-charge"></i>
                <span className="d-none d-md-inline">{t('nav.items.quickCapture')}</span>
              </Link>

              {/* New KB Button */}
              <Link
                to="/kb/new"
                className="btn btn-primary d-none d-sm-inline-flex align-items-center gap-1"
              >
                <i className="bi bi-plus-lg"></i>
                <span className="d-none d-md-inline">{t('navbar.newKb')}</span>
              </Link>

              {/* Quick Actions Dropdown - Mobile */}
              <Dropdown align="end" className="d-sm-none">
                <Dropdown.Toggle variant="primary" size="sm" id="quick-actions">
                  <i className="bi bi-plus-lg"></i>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item as={Link} to="/kb/new">
                    <i className="bi bi-file-earmark-plus me-2"></i>
                    {t('navbar.newKb')}
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/quick-capture">
                    <i className="bi bi-lightning-charge me-2"></i>
                    {t('nav.items.quickCapture')}
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/smart-search">
                    <i className="bi bi-robot me-2"></i>
                    {t('nav.items.smartSearch')}
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item as={Link} to="/gps">
                    <i className="bi bi-signpost-2 me-2"></i>
                    {t('nav.items.gpsDiagnostic')}
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
        title={t('navbar.menu')}
      >
        <i className={`bi bi-${sidebarOpen ? 'x-lg' : 'list'}`}></i>
      </button>
    </div>
  );
}
