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
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

// Menu configuration with groups. `t` vem do i18next - a config em si
// (paths, icones, roles) e fixa, so os labels mudam por idioma.
const getMenuConfig = (user, t) => [
  {
    id: 'main',
    label: t('nav.groups.main'),
    icon: 'bi-house',
    items: [
      { path: '/', label: t('nav.items.dashboard'), icon: 'bi-speedometer2', exact: true },
      { path: '/kb', label: t('nav.items.kb'), icon: 'bi-book' },
      { path: '/incidents', label: t('nav.items.incidents'), icon: 'bi-exclamation-triangle' },
      { path: '/events', label: t('nav.items.events'), icon: 'bi-calendar-event' },
    ]
  },
  {
    id: 'search',
    label: t('nav.groups.search'),
    icon: 'bi-search',
    items: [
      { path: '/smart-search', label: t('nav.items.smartSearch'), icon: 'bi-robot', badge: 'AI' },
      { path: '/search', label: t('nav.items.search'), icon: 'bi-search' },
      { path: '/analytics', label: t('nav.items.analytics'), icon: 'bi-graph-up' },
      { path: '/gamification', label: t('nav.items.gamification'), icon: 'bi-trophy', badge: 'NEW' },
    ]
  },
  {
    id: 'tools',
    label: t('nav.groups.tools'),
    icon: 'bi-tools',
    items: [
      { path: '/quick-capture', label: t('nav.items.quickCapture'), icon: 'bi-lightning-charge' },
      { path: '/gps', label: t('nav.items.gpsDiagnostic'), icon: 'bi-signpost-2', exact: true },
      { path: '/gps/sessions', label: t('nav.items.gpsSessions'), icon: 'bi-clock-history' },
      { path: '/postmortem', label: t('nav.items.postmortem'), icon: 'bi-file-earmark-medical' },
      { path: '/reports', label: t('nav.items.reports'), icon: 'bi-file-earmark-bar-graph', badge: 'NEW' },
      { path: '/integrations', label: t('nav.items.integrations'), icon: 'bi-plug' },
    ]
  },
  {
    id: 'content',
    label: t('nav.groups.content'),
    icon: 'bi-folder',
    items: [
      { path: '/favorites', label: t('nav.items.favorites'), icon: 'bi-star' },
      { path: '/templates', label: t('nav.items.templates'), icon: 'bi-file-earmark-text' },
      { path: '/tags', label: t('nav.items.tags'), icon: 'bi-tags' },
      { path: '/properties', label: t('nav.items.properties'), icon: 'bi-sliders' },
      { path: '/reviews', label: t('nav.items.reviews'), icon: 'bi-calendar-check' },
      { path: '/import', label: t('nav.items.import'), icon: 'bi-cloud-upload' },
      { path: '/help', label: t('nav.items.help'), icon: 'bi-question-circle' },
    ]
  },
  {
    id: 'admin',
    label: t('nav.groups.admin'),
    icon: 'bi-shield-lock',
    roles: ['admin', 'owner'],
    items: [
      { path: '/admin', label: t('nav.items.adminPanel'), icon: 'bi-gear-fill' },
      { path: '/kb-requests', label: t('nav.items.kbRequests'), icon: 'bi-inbox' },
      { path: '/audit-logs', label: t('nav.items.auditLogs'), icon: 'bi-journal-text' },
      { path: '/webhooks', label: t('nav.items.webhooks'), icon: 'bi-link-45deg' },
      { path: '/user-activity', label: t('nav.items.userActivity'), icon: 'bi-activity' },
    ]
  },
];

// Sidebar component
export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState(['main', 'search']);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter menu based on user role
  const menuConfig = useMemo(() => {
    return getMenuConfig(user, t).filter(group => {
      if (!group.roles) return true;
      return group.roles.includes(user?.role);
    });
  }, [user, t]);

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
              <span className="sidebar-brand-version">v{__APP_VERSION__}</span>
            </div>
          )}
          <button 
            className="sidebar-collapse-btn d-none d-md-flex"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? t('nav.expandMenu') : t('nav.collapseMenu')}
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
          <Link to="/profile" className="sidebar-user" onClick={onClose}>
            <div className="sidebar-user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.name || t('nav.user')}</span>
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
            title={t('nav.logout')}
          >
            <i className="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </aside>
    </>
  );
}
