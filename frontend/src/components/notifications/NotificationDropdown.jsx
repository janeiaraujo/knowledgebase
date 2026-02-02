import React, { useState, useEffect } from 'react';
import { Dropdown, Badge, ListGroup, Spinner, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import api from '../../services/api';

const NotificationDropdown = () => {
  const { 
    notifications: realtimeNotifications, 
    unreadCount, 
    connected, 
    markAsRead, 
    markAllAsRead,
    requestNotificationPermission 
  } = useNotifications();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch initial notifications
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Merge realtime notifications with fetched ones
  useEffect(() => {
    if (realtimeNotifications.length > 0) {
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n._id));
        const newNotifications = realtimeNotifications.filter(n => !existingIds.has(n._id));
        return [...newNotifications, ...prev].slice(0, 50);
      });
    }
  }, [realtimeNotifications]);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications', {
        params: { limit: 20 }
      });
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId, e) => {
    e.preventDefault();
    e.stopPropagation();
    markAsRead(notificationId);
    setNotifications(prev =>
      prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = async () => {
    markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getNotificationIcon = (type) => {
    const icons = {
      kb_submitted: 'bi-send text-info',
      kb_approved: 'bi-check-circle text-success',
      kb_rejected: 'bi-x-circle text-danger',
      kb_published: 'bi-globe text-primary',
      kb_comment: 'bi-chat-dots text-secondary',
      kb_mentioned: 'bi-at text-warning',
      kb_updated: 'bi-pencil text-info',
      system: 'bi-bell text-muted'
    };
    return icons[type] || 'bi-bell';
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <Dropdown 
      show={showDropdown} 
      onToggle={(isOpen) => setShowDropdown(isOpen)}
      align="end"
    >
      <Dropdown.Toggle 
        variant="link" 
        className="nav-link position-relative p-2"
        id="notifications-dropdown"
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
        {connected && (
          <span 
            className="position-absolute bottom-0 end-0 bg-success rounded-circle"
            style={{ width: '8px', height: '8px' }}
            title="Conectado em tempo real"
          ></span>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu 
        className="shadow-lg border-0 p-0" 
        style={{ width: '360px', maxHeight: '500px' }}
      >
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center p-3 border-bottom bg-light">
          <div>
            <strong>Notificações</strong>
            {connected && (
              <Badge bg="success" className="ms-2" style={{ fontSize: '0.6rem' }}>
                <i className="bi bi-lightning-charge me-1"></i>Live
              </Badge>
            )}
          </div>
          <div className="d-flex gap-2">
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 text-muted"
              onClick={handleMarkAllAsRead}
              title="Marcar todas como lidas"
            >
              <i className="bi bi-check-all"></i>
            </Button>
            <Button 
              variant="link" 
              size="sm" 
              className="p-0 text-muted"
              onClick={requestNotificationPermission}
              title="Ativar notificações do navegador"
            >
              <i className="bi bi-bell-fill"></i>
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>
              <span>Nenhuma notificação</span>
            </div>
          ) : (
            <ListGroup variant="flush">
              {notifications.map((notification) => (
                <ListGroup.Item 
                  key={notification._id}
                  as={notification.link ? Link : 'div'}
                  to={notification.link || '#'}
                  action={!!notification.link}
                  className={`border-0 py-3 ${!notification.read ? 'bg-light' : ''}`}
                  onClick={() => {
                    if (!notification.read) {
                      handleMarkAsRead(notification._id, { preventDefault: () => {}, stopPropagation: () => {} });
                    }
                    if (notification.link) {
                      setShowDropdown(false);
                    }
                  }}
                >
                  <div className="d-flex">
                    <div className="me-3">
                      <div 
                        className={`rounded-circle d-flex align-items-center justify-content-center ${!notification.read ? 'bg-primary bg-opacity-10' : 'bg-light'}`}
                        style={{ width: '40px', height: '40px' }}
                      >
                        <i className={`bi ${getNotificationIcon(notification.type)}`}></i>
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <strong className={`d-block ${!notification.read ? 'text-dark' : 'text-muted'}`} style={{ fontSize: '0.9rem' }}>
                          {notification.title}
                        </strong>
                        <small className="text-muted ms-2" style={{ whiteSpace: 'nowrap' }}>
                          {formatTime(notification.created_at)}
                        </small>
                      </div>
                      <p className="mb-0 text-muted small" style={{ 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="ms-2">
                        <span 
                          className="bg-primary rounded-circle d-inline-block"
                          style={{ width: '8px', height: '8px' }}
                        ></span>
                      </div>
                    )}
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </div>

        {/* Footer */}
        <div className="border-top p-2 text-center bg-light">
          <Link 
            to="/notifications" 
            className="text-decoration-none small"
            onClick={() => setShowDropdown(false)}
          >
            Ver todas as notificações
          </Link>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default NotificationDropdown;
