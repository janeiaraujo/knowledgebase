import { useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook to track KB views and engagement
 * Automatically records view start, duration, and scroll depth
 */
export function useKBTracking(kbId, enabled = true) {
    const viewStartTime = useRef(null);
    const maxScrollDepth = useRef(0);
    const isTracking = useRef(false);

    // Track scroll depth
    const handleScroll = useCallback(() => {
        if (!enabled || !kbId) return;
        
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
        
        if (scrollPercent > maxScrollDepth.current) {
            maxScrollDepth.current = scrollPercent;
        }
    }, [enabled, kbId]);

    // Record view start
    const startTracking = useCallback(async () => {
        if (!enabled || !kbId || isTracking.current) return;

        try {
            isTracking.current = true;
            viewStartTime.current = Date.now();
            maxScrollDepth.current = 0;

            await api.post('/activity/kb-views', {
                kb_id: kbId
            });

            // Also log general activity
            await api.post('/activity/log', {
                action: 'kb_view',
                entity_type: 'kb',
                entity_id: kbId
            });
        } catch (err) {
            console.error('Failed to record KB view:', err);
        }
    }, [enabled, kbId]);

    // Record engagement metrics on leave
    const stopTracking = useCallback(async () => {
        if (!enabled || !kbId || !isTracking.current) return;

        const duration = viewStartTime.current 
            ? Math.round((Date.now() - viewStartTime.current) / 1000)
            : 0;

        // Don't bother sending if user was on page less than 2 seconds
        if (duration < 2) {
            isTracking.current = false;
            return;
        }

        try {
            // We could update the view record with duration here
            // For now, just log the engagement
            await api.post('/activity/log', {
                action: 'kb_view_end',
                entity_type: 'kb',
                entity_id: kbId,
                metadata: {
                    duration_seconds: duration,
                    scroll_depth: maxScrollDepth.current
                }
            });
        } catch (err) {
            console.error('Failed to record KB view end:', err);
        } finally {
            isTracking.current = false;
        }
    }, [enabled, kbId]);

    useEffect(() => {
        if (!enabled || !kbId) return;

        // Start tracking when component mounts
        startTracking();

        // Add scroll listener
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Stop tracking when component unmounts or visibility changes
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopTracking();
            } else if (!isTracking.current) {
                startTracking();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stopTracking();
        };
    }, [enabled, kbId, startTracking, stopTracking, handleScroll]);

    return {
        getDuration: () => viewStartTime.current 
            ? Math.round((Date.now() - viewStartTime.current) / 1000)
            : 0,
        getScrollDepth: () => maxScrollDepth.current
    };
}

/**
 * Hook to log user activity
 */
export function useActivityLog() {
    const logActivity = useCallback(async (action, entityType = null, entityId = null, metadata = {}) => {
        try {
            await api.post('/activity/log', {
                action,
                entity_type: entityType,
                entity_id: entityId,
                metadata
            });
        } catch (err) {
            console.error('Failed to log activity:', err);
        }
    }, []);

    return { logActivity };
}

export default useKBTracking;
