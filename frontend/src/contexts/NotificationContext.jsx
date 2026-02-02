import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token || !user) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.hostname}:3000`;
    const wsUrl = `${wsHost}/api/ws/notifications?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnected(false);
        wsRef.current = null;

        // Attempt reconnection if not intentional close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  }, [token, user]);

  // Handle incoming messages
  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'connected':
        console.log('✅ Real-time notifications enabled');
        break;

      case 'unread_count':
        setUnreadCount(data.count);
        break;

      case 'notification':
        // Add new notification to top of list
        setNotifications(prev => [data.notification, ...prev.slice(0, 49)]);
        setUnreadCount(prev => prev + 1);
        
        // Show browser notification if permitted
        showBrowserNotification(data.notification);
        break;

      case 'pong':
        // Keep-alive response
        break;

      default:
        console.log('Unknown WebSocket message:', data);
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification._id
      });
    }
  }, []);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  // Mark notification as read via WebSocket
  const markAsRead = useCallback((notificationId) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_read',
        notificationId
      }));
      
      // Optimistic update
      setNotifications(prev => 
        prev.map(n => 
          n._id === notificationId ? { ...n, read: true } : n
        )
      );
    }
  }, []);

  // Mark all as read via WebSocket
  const markAllAsRead = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mark_all_read'
      }));
      
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }, []);

  // Send ping to keep connection alive
  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // Connect when user is authenticated
  useEffect(() => {
    if (user && token) {
      connect();
    } else {
      // Disconnect if logged out
      if (wsRef.current) {
        wsRef.current.close(1000, 'User logged out');
      }
      setConnected(false);
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [user, token, connect]);

  // Keep-alive ping every 30 seconds
  useEffect(() => {
    const pingInterval = setInterval(sendPing, 30000);
    return () => clearInterval(pingInterval);
  }, [sendPing]);

  const value = {
    notifications,
    unreadCount,
    connected,
    markAsRead,
    markAllAsRead,
    requestNotificationPermission,
    reconnect: connect
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
