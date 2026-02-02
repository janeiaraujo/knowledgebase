import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { notificationAPI } from '../services/api';

const NOTIFICATION_TYPES = {
  kb_submitted: { icon: 'bi-send-check', color: 'info', label: 'Enviado para Revisão' },
  kb_approved: { icon: 'bi-check-circle', color: 'success', label: 'Aprovado' },
  kb_rejected: { icon: 'bi-x-circle', color: 'danger', label: 'Rejeitado' },
  kb_published: { icon: 'bi-globe', color: 'primary', label: 'Publicado' },
  mention: { icon: 'bi-at', color: 'warning', label: 'Menção' },
  comment: { icon: 'bi-chat', color: 'secondary', label: 'Comentário' }
};

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  
  useEffect(() => {
    fetchNotifications();
  }, [filter]);
  
  const fetchNotifications = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await notificationAPI.list({ 
        page, 
        limit: 20,
        unread_only: filter === 'unread'
      });
      setNotifications(data.notifications || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Falha ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };
  
  const handleMarkAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };
  
  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };
  
  const handleDelete = async (id) => {
    try {
      await notificationAPI.delete(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };
  
  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification._id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };
  
  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getTypeConfig = (type) => {
    return NOTIFICATION_TYPES[type] || { icon: 'bi-bell', color: 'secondary', label: 'Notificação' };
  };
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Notificações</h2>
          <p className="text-muted mb-0">
            {pagination.total} notificação{pagination.total !== 1 ? 'ões' : ''}
            {unreadCount > 0 && ` • ${unreadCount} não lida${unreadCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        
        <div className="d-flex gap-2">
          <div className="btn-group">
            <button
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setFilter('all')}
            >
              Todas
            </button>
            <button
              className={`btn btn-sm ${filter === 'unread' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setFilter('unread')}
            >
              Não Lidas
            </button>
          </div>
          
          {unreadCount > 0 && (
            <Button variant="outline-secondary" size="sm" onClick={handleMarkAllAsRead}>
              <i className="bi bi-check2-all me-1"></i>
              Marcar Todas como Lidas
            </Button>
          )}
        </div>
      </div>
      
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : notifications.length > 0 ? (
            <ListGroup variant="flush">
              {notifications.map(notification => {
                const config = getTypeConfig(notification.type);
                return (
                  <ListGroup.Item
                    key={notification._id}
                    className={`d-flex gap-3 py-3 ${!notification.read ? 'bg-light' : ''}`}
                    style={{ cursor: notification.link ? 'pointer' : 'default' }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={`text-${config.color}`}>
                      <i className={`bi ${config.icon} fs-3`}></i>
                    </div>
                    
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div>
                          <strong className={!notification.read ? 'text-dark' : 'text-muted'}>
                            {notification.title}
                          </strong>
                          <Badge bg={config.color} className="ms-2" style={{ fontSize: '0.7rem' }}>
                            {config.label}
                          </Badge>
                          {!notification.read && (
                            <Badge bg="danger" className="ms-1" style={{ fontSize: '0.6rem' }}>
                              Nova
                            </Badge>
                          )}
                        </div>
                        <small className="text-muted">
                          {formatDate(notification.created_at)}
                        </small>
                      </div>
                      
                      <p className="mb-2 text-muted">{notification.message}</p>
                      
                      <div className="d-flex gap-2">
                        {!notification.read && (
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification._id);
                            }}
                          >
                            <i className="bi bi-check2 me-1"></i>
                            Marcar como lida
                          </Button>
                        )}
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 text-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification._id);
                          }}
                        >
                          <i className="bi bi-trash me-1"></i>
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          ) : (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-bell-slash fs-1 d-block mb-3"></i>
              <p className="mb-0">
                {filter === 'unread' 
                  ? 'Você não tem notificações não lidas' 
                  : 'Você ainda não tem notificações'
                }
              </p>
            </div>
          )}
        </Card.Body>
        
        {/* Pagination */}
        {pagination.pages > 1 && (
          <Card.Footer className="bg-white">
            <nav>
              <ul className="pagination pagination-sm mb-0 justify-content-center">
                <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                  <button 
                    className="page-link" 
                    onClick={() => fetchNotifications(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Anterior
                  </button>
                </li>
                
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
                  <li key={page} className={`page-item ${pagination.page === page ? 'active' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => fetchNotifications(page)}
                    >
                      {page}
                    </button>
                  </li>
                ))}
                
                <li className={`page-item ${pagination.page === pagination.pages ? 'disabled' : ''}`}>
                  <button 
                    className="page-link" 
                    onClick={() => fetchNotifications(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                  >
                    Próxima
                  </button>
                </li>
              </ul>
            </nav>
          </Card.Footer>
        )}
      </Card>
    </>
  );
}
