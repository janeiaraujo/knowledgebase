import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Dropdown, ListGroup, Button, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { notificationAPI } from '../services/api';

const NOTIFICATION_TYPES = {
  kb_submitted: { icon: 'bi-send-check', color: 'info' },
  kb_approved: { icon: 'bi-check-circle', color: 'success' },
  kb_rejected: { icon: 'bi-x-circle', color: 'danger' },
  kb_published: { icon: 'bi-globe', color: 'primary' },
  mention: { icon: 'bi-at', color: 'warning' },
  comment: { icon: 'bi-chat', color: 'secondary' }
};

export default function NotificationBell() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const intervalRef = useRef(null);
  
  useEffect(() => {
    fetchUnreadCount();
    
    // Poll for new notifications every 30 seconds
    intervalRef.current = setInterval(fetchUnreadCount, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  const fetchUnreadCount = async () => {
    try {
      const { data } = await notificationAPI.getCount();
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error('Failed to fetch notification count:', error);
    }
  };
  
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await notificationAPI.list({ limit: 10 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggle = (isOpen) => {
    setShow(isOpen);
    if (isOpen) {
      fetchNotifications();
    }
  };
  
  const handleMarkAsRead = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };
  
  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };
  
  const formatTime = (date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now - notifDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return notifDate.toLocaleDateString('pt-BR');
  };
  
  const getTypeConfig = (type) => {
    return NOTIFICATION_TYPES[type] || { icon: 'bi-bell', color: 'secondary' };
  };
  
  return (
    <Dropdown show={show} onToggle={handleToggle} align="end">
      <Dropdown.Toggle
        as="button"
        className="btn btn-link text-white position-relative p-2"
        id="notification-dropdown"
        style={{ background: 'none', border: 'none' }}
      >
        <i className="bi bi-bell fs-5"></i>
        {unreadCount > 0 && (
          <Badge 
            bg="danger" 
            pill 
            className="position-absolute top-0 start-100 translate-middle"
            style={{ fontSize: '0.65rem' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Dropdown.Toggle>
      
      <Dropdown.Menu 
        className="shadow-lg border-0" 
        style={{ width: '360px', maxHeight: '480px', overflowY: 'auto' }}
      >
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
          <h6 className="mb-0">{t('notificationBell.notificacoes')}</h6>
          {unreadCount > 0 && (
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 text-primary"
              onClick={handleMarkAllAsRead}
            >
              {t('notificationBell.marcarTodasComoLidas')}
            </Button>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" />
          </div>
        ) : notifications.length > 0 ? (
          <ListGroup variant="flush">
            {notifications.map(notification => {
              const config = getTypeConfig(notification.type);
              return (
                <ListGroup.Item 
                  key={notification._id}
                  as={Link}
                  to={notification.link || '#'}
                  onClick={() => !notification.read && handleMarkAsRead(notification._id, { preventDefault: () => {}, stopPropagation: () => {} })}
                  className={`border-0 ${!notification.read ? 'bg-light' : ''}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="d-flex gap-3">
                    <div className={`text-${config.color}`}>
                      <i className={`bi ${config.icon} fs-4`}></i>
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <strong className={`small ${!notification.read ? 'text-dark' : 'text-muted'}`}>
                          {notification.title}
                        </strong>
                        {!notification.read && (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 text-muted"
                            onClick={(e) => handleMarkAsRead(notification._id, e)}
                            title={t('notificationBell.marcarComoLida')}
                          >
                            <i className="bi bi-check2"></i>
                          </Button>
                        )}
                      </div>
                      <p className="mb-1 small text-muted" style={{ lineHeight: '1.3' }}>
                        {notification.message}
                      </p>
                      <small className="text-muted">
                        {formatTime(notification.created_at)}
                      </small>
                    </div>
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        ) : (
          <div className="text-center py-4 text-muted">
            <i className="bi bi-bell-slash fs-1 d-block mb-2"></i>
            <small>{t('notificationBell.nenhumaNotificacao')}</small>
          </div>
        )}
        
        {notifications.length > 0 && (
          <div className="border-top p-2 text-center">
            <Link to="/notifications" className="small text-primary">
              {t('notificationBell.verTodasAsNotificacoes')}
            </Link>
          </div>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}
