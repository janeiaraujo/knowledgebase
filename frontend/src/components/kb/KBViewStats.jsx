import { useState, useEffect } from 'react';
import api from '../../services/api';

/**
 * Component to show view statistics for a KB
 * Shows total views, unique viewers, and recent viewers
 */
export default function KBViewStats({ kbId }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [views, setViews] = useState([]);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        if (!kbId) return;
        loadStats();
    }, [kbId]);

    const loadStats = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/activity/kb-views/${kbId}?unique=true&limit=10`);
            setStats(res.data.stats);
            setViews(res.data.views);
        } catch (err) {
            console.error('Failed to load KB view stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('pt-BR');
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '-';
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };

    if (loading) {
        return (
            <div className="card">
                <div className="card-body text-center py-3">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                        <span className="visually-hidden">Carregando...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!stats) {
        return null;
    }

    return (
        <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center py-2">
                <h6 className="mb-0">
                    <i className="bi bi-eye me-2"></i>
                    Estatísticas de Visualização
                </h6>
                <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setShowDetails(!showDetails)}
                >
                    <i className={`bi bi-chevron-${showDetails ? 'up' : 'down'}`}></i>
                </button>
            </div>
            
            <div className="card-body py-2">
                <div className="row text-center g-2">
                    <div className="col-4">
                        <div className="fs-5 fw-bold text-primary">{stats.total_views}</div>
                        <small className="text-muted">Total Views</small>
                    </div>
                    <div className="col-4">
                        <div className="fs-5 fw-bold text-info">{stats.unique_viewers}</div>
                        <small className="text-muted">Únicos</small>
                    </div>
                    <div className="col-4">
                        <div className="fs-5 fw-bold text-success">
                            {stats.avg_duration > 0 ? formatDuration(stats.avg_duration) : '-'}
                        </div>
                        <small className="text-muted">Tempo Médio</small>
                    </div>
                </div>

                {showDetails && views.length > 0 && (
                    <div className="mt-3 pt-3 border-top">
                        <h6 className="text-muted mb-2">Visualizadores Recentes</h6>
                        <div className="list-group list-group-flush" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {views.map((view) => (
                                <div 
                                    key={view._id?.toString()} 
                                    className="list-group-item px-0 py-2 d-flex justify-content-between align-items-center"
                                >
                                    <div>
                                        <div className="fw-medium">{view.user_name}</div>
                                        <small className="text-muted">{view.user_email}</small>
                                    </div>
                                    <div className="text-end">
                                        <span className="badge bg-primary">{view.view_count}x</span>
                                        <div className="small text-muted mt-1">
                                            Último: {formatDate(view.last_view)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {showDetails && views.length === 0 && (
                    <div className="mt-3 pt-3 border-top text-center text-muted">
                        <i className="bi bi-eye-slash me-2"></i>
                        Nenhuma visualização registrada ainda
                    </div>
                )}
            </div>
        </div>
    );
}
