/**
 * Professional Sidebar Component
 * 
 * Features:
 * - Collapsible menu groups
 * - Active state indicators
 * - Smooth animations
 * - Notification badges
 * - User profile section
 * - Dark/Light theme aware
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';

// Menu configuration with groups
const getMenuConfig = (user) => [
  {
    id: 'main',
    label: 'Principal',
    icon: 'bi-house',
    items: [
      { path: '/', label: 'Dashboard', icon: 'bi-speedometer2', exact: true },
      { path: '/kb', label: 'Knowledge Base', icon: 'bi-book' },
      { path: '/incidents', label: 'Incidentes', icon: 'bi-exclamation-triangle' },
      { path: '/events', label: 'Eventos', icon: 'bi-calendar-event' },
    ]
  },
  {
    id: 'search',
    label: 'Busca & Análise',
    icon: 'bi-search',
    items: [
      { path: '/smart-search', label: 'Busca Inteligente', icon: 'bi-robot', badge: 'AI' },
      { path: '/search', label: 'Busca Avançada', icon: 'bi-search' },
      { path: '/analytics', label: 'Analytics', icon: 'bi-graph-up' },
      { path: '/gamification', label: 'Gamificação', icon: 'bi-trophy', badge: 'NEW' },
    ]
  },
  {
    id: 'tools',
    label: 'Ferramentas',
    icon: 'bi-tools',
    items: [
      { path: '/quick-capture', label: 'Captura Rápida', icon: 'bi-lightning-charge' },
      { path: '/gps', label: 'Diagnóstico GPS', icon: 'bi-signpost-2', exact: true },
      { path: '/gps/sessions', label: 'Sessões GPS', icon: 'bi-clock-history' },
      { path: '/postmortem', label: 'Post-Mortem', icon: 'bi-file-earmark-medical' },
      { path: '/reports', label: 'Relatórios', icon: 'bi-file-earmark-bar-graph', badge: 'NEW' },
      { path: '/integrations', label: 'Integrações', icon: 'bi-plug' },
    ]
  },
  {
    id: 'content',
    label: 'Conteúdo',
    icon: 'bi-folder',
    items: [
      { path: '/favorites', label: 'Favoritos', icon: 'bi-star' },
      { path: '/templates', label: 'Templates', icon: 'bi-file-earmark-text' },
      { path: '/tags', label: 'Tags & Categorias', icon: 'bi-tags' },
      { path: '/properties', label: 'Propriedades', icon: 'bi-sliders' },
      { path: '/reviews', label: 'Revisões', icon: 'bi-calendar-check' },
      { path: '/import', label: 'Importar', icon: 'bi-cloud-upload' },
      { path: '/help', label: 'Central de Ajuda', icon: 'bi-question-circle' },
    ]
  },
  {
    id: 'admin',
    label: 'Administração',
    icon: 'bi-shield-lock',
    roles: ['admin', 'owner'],
    items: [
      { path: '/admin', label: 'Painel Admin', icon: 'bi-gear-fill' },
      { path: '/kb-requests', label: 'Solicitações KB', icon: 'bi-inbox' },
      { path: '/audit-logs', label: 'Audit Logs', icon: 'bi-journal-text' },
      { path: '/webhooks', label: 'Webhooks', icon: 'bi-link-45deg' },
      { path: '/user-activity', label: 'Atividade', icon: 'bi-activity' },
    ]
  },
];

// Sidebar component
export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState(['main', 'search']);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter menu based on user role
  const menuConfig = useMemo(() => {
    return getMenuConfig(user).filter(group => {
      if (!group.roles) return true;
      return group.roles.includes(user?.role);
    });
  }, [user]);

  // Auto-expand group containing active route
  useEffect(() => {
    const activeGroup = menuConfig.find(group => 
      group.items.some(item => 
        item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)
      )
    );
    if (activeGroup && !expandedGroups.includes(activeGroup.id)) {
      setExpandedGroups(prev => [...prev, activeGroup.id]);
    }
  }, [location.pathname, menuConfig]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const isActive = (item) => {
    return item.exact 
      ? location.pathname === item.path 
      : location.pathname.startsWith(item.path);
  };

  const renderMenuItem = (item) => {
    const active = isActive(item);
    
    const content = (
      <Link
        to={item.path}
        className={`sidebar-menu-item ${active ? 'active' : ''}`}
        onClick={() => onClose?.()}
      >
        <i className={`bi ${item.icon} sidebar-menu-icon`}></i>
        {!isCollapsed && (
          <>
            <span className="sidebar-menu-label">{item.label}</span>
            {item.badge && (
              <Badge bg="info" pill className="sidebar-badge ms-auto">
                {item.badge}
              </Badge>
            )}
          </>
        )}
        {active && <span className="sidebar-active-indicator"></span>}
      </Link>
    );

    if (isCollapsed) {
      return (
        <OverlayTrigger
          key={item.path}
          placement="right"
          overlay={<Tooltip>{item.label}</Tooltip>}
        >
          {content}
        </OverlayTrigger>
      );
    }

    return <div key={item.path}>{content}</div>;
  };

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className={`sidebar-overlay ${isOpen ? 'show' : ''}`}
        onClick={onClose}
      />
      
      <aside className={`sidebar-pro ${isOpen ? 'show' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Logo/Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <i className="bi bi-database-fill-gear"></i>
          </div>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">Incident KB</span>
              <span className="sidebar-brand-version">v2.0</span>
            </div>
          )}
          <button 
            className="sidebar-collapse-btn d-none d-md-flex"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <i className={`bi bi-chevron-${isCollapsed ? 'right' : 'left'}`}></i>
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {menuConfig.map(group => (
            <div key={group.id} className="sidebar-group">
              {!isCollapsed ? (
                <button
                  className={`sidebar-group-header ${expandedGroups.includes(group.id) ? 'expanded' : ''}`}
                  onClick={() => toggleGroup(group.id)}
                >
                  <i className={`bi ${group.icon} sidebar-group-icon`}></i>
                  <span className="sidebar-group-label">{group.label}</span>
                  <i className={`bi bi-chevron-down sidebar-group-arrow`}></i>
                </button>
              ) : (
                <OverlayTrigger
                  placement="right"
                  overlay={<Tooltip>{group.label}</Tooltip>}
                >
                  <div className="sidebar-group-divider">
                    <i className={`bi ${group.icon}`}></i>
                  </div>
                </OverlayTrigger>
              )}
              
              <div className={`sidebar-group-items ${expandedGroups.includes(group.id) || isCollapsed ? 'expanded' : ''}`}>
                {group.items.map(renderMenuItem)}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className="sidebar-footer">
          <Link to="/settings" className="sidebar-user" onClick={onClose}>
            <div className="sidebar-user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.name || 'Usuário'}</span>
                <span className="sidebar-user-role">
                  <i className="bi bi-shield-check me-1"></i>
                  {user?.role || 'user'}
                </span>
              </div>
            )}
          </Link>
          
          <button 
            className="sidebar-logout-btn"
            onClick={logout}
            title="Sair"
          >
            <i className="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </aside>
    </>
  );
}
