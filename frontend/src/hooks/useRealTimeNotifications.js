/**
 * Real-Time Notifications Hook
 * 
 * Provides WebSocket-based real-time notifications
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

// Sem VITE_WS_URL, deriva do host atual: mantem o protocolo correto (wss em HTTPS)
// e funciona atras de tuneis, passando pelo proxy do Vite.
const WS_URL = import.meta.env.VITE_WS_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

export function useRealTimeNotifications() {
  const { t } = useTranslation();
    const { token, isAuthenticated } = useAuth();
    const [connected, setConnected] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    const connect = useCallback(() => {
        if (!isAuthenticated || !token || wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            const ws = new WebSocket(`${WS_URL}/api/ws/notifications?token=${token}`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                setConnected(true);
                reconnectAttempts.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                setConnected(false);
                wsRef.current = null;

                // Attempt to reconnect
                if (reconnectAttempts.current < maxReconnectAttempts && isAuthenticated) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
        }
    }, [token, isAuthenticated]);

    const handleMessage = useCallback((data) => {
        switch (data.type) {
            case 'connected':
                console.log('Real-time notifications enabled');
                break;

            case 'unread_count':
                setUnreadCount(data.count || 0);
                break;

            case 'notification':
                // Add to notifications list
                setNotifications(prev => [data.notification, ...prev].slice(0, 50));
                setUnreadCount(prev => prev + 1);

                // Show toast notification
                showToastNotification(data.notification);
                break;

            case 'kb_created':
                toast.info(
                    <div>
                        <strong>{t('useRealTimeNotifications.novoKbCriado')}</strong>
                        <br />
                        <small>{data.kb?.title}</small>
                    </div>,
                    { icon: '📄' }
                );
                break;

            case 'kb_updated':
                toast.info(
                    <div>
                        <strong>{t('useRealTimeNotifications.kbAtualizado')}</strong>
                        <br />
                        <small>{data.kb?.title}</small>
                    </div>,
                    { icon: '✏️' }
                );
                break;

            case 'comment_added':
                toast.info(
                    <div>
                        <strong>{t('useRealTimeNotifications.novoComentario')}</strong>
                        <br />
                        <small>{data.comment?.content?.slice(0, 50)}...</small>
                    </div>,
                    { icon: '💬' }
                );
                break;

            case 'badge_earned':
                toast.success(
                    <div>
                        <strong>🎉 Nova conquista!</strong>
                        <br />
                        <span style={{ fontSize: '1.5rem' }}>{data.badge?.icon}</span> {data.badge?.name}
                    </div>,
                    { autoClose: 5000 }
                );
                break;

            case 'incident_created':
                toast.warning(
                    <div>
                        <strong>⚠️ Novo incidente</strong>
                        <br />
                        <small>{data.incident?.title}</small>
                    </div>,
                    { autoClose: false }
                );
                break;

            case 'review_needed':
                toast.info(
                    <div>
                        <strong>{t('useRealTimeNotifications.revisaoNecessaria')}</strong>
                        <br />
                        <small>{data.kb?.title}</small>
                    </div>,
                    { icon: '👁️' }
                );
                break;

            case 'mention':
                toast.info(
                    <div>
                        <strong>{t('useRealTimeNotifications.voceFoiMencionado')}</strong>
                        <br />
                        <small>Por {data.by} em {data.context}</small>
                    </div>,
                    { icon: '@' }
                );
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    }, []);

    const showToastNotification = (notification) => {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            badge: '🏆',
            mention: '@'
        };

        const icon = icons[notification.type] || 'ℹ️';

        toast.info(
            <div>
                <strong>{notification.title}</strong>
                <br />
                <small>{notification.message}</small>
            </div>,
            { icon }
        );
    };

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnected(false);
    }, []);

    const markAsRead = useCallback((notificationId) => {
        setNotifications(prev =>
            prev.map(n =>
                n._id === notificationId ? { ...n, read: true } : n
            )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    }, []);

    // Connect on mount
    useEffect(() => {
        if (isAuthenticated && token) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [isAuthenticated, token, connect, disconnect]);

    return {
        connected,
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        reconnect: connect
    };
}

export default useRealTimeNotifications;
