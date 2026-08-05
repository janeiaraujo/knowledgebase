import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function UserActivity() {
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tenantSummary, setTenantSummary] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [period, setPeriod] = useState('30d');
    const [onlineUsers, setOnlineUsers] = useState({ count: 0, users: [] });
    const [activeTab, setActiveTab] = useState('overview');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            
            const [summaryRes, usersRes, onlineRes] = await Promise.all([
                api.get('/activity/tenant-summary'),
                api.get(`/activity/users?period=${period}`),
                api.get('/activity/online')
            ]);

            setTenantSummary(summaryRes.data);
            setUsers(usersRes.data.users);
            setOnlineUsers(onlineRes.data);
            setError('');
        } catch (err) {
            setError(t('userActivity.loadError'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [period, t]);

    useEffect(() => {
        loadData();
        // Auto refresh online users every 30 seconds
        const interval = setInterval(async () => {
            try {
                const res = await api.get('/activity/online');
                setOnlineUsers(res.data);
            } catch (err) {
                console.error('Failed to refresh online users');
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [loadData]);

    const loadUserDetails = async (userId) => {
        try {
            const res = await api.get(`/activity/users/${userId}?period=${period}`);
            setUserDetails(res.data);
            setSelectedUser(userId);
        } catch (err) {
            console.error('Failed to load user details');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return t('reviews.never');
        return new Date(dateString).toLocaleString(i18n.language === 'en' ? 'en-US' : 'pt-BR');
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '-';
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };

    const getActivityBadge = (user) => {
        if (user.is_active_today) {
            return <span className="badge bg-success"><i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>{t('userActivity.onlineToday')}</span>;
        }
        if (user.last_activity) {
            const lastActivity = new Date(user.last_activity);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            if (lastActivity > weekAgo) {
                return <span className="badge bg-warning text-dark">{t('userActivity.activeThisWeek')}</span>;
            }
        }
        return <span className="badge bg-secondary">{t('userActivity.inactive')}</span>;
    };

    if (loading && !tenantSummary) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">{t('common.loading')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">
                        <i className="bi bi-activity me-2"></i>
                        {t('userActivity.title')}
                    </h2>
                    <p className="text-muted mb-0">
                        {t('userActivity.subtitle')}
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <select 
                        className="form-select" 
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        style={{ width: 'auto' }}
                    >
                        <option value="7d">{t('reports.periods.7d')}</option>
                        <option value="30d">{t('reports.periods.30d')}</option>
                        <option value="90d">{t('reports.periods.90d')}</option>
                    </select>
                    <button className="btn btn-outline-secondary" onClick={loadData}>
                        <i className="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger">{error}</div>
            )}

            {/* Summary Cards */}
            {tenantSummary && (
                <div className="row g-3 mb-4">
                    <div className="col-md-3">
                        <div className="card bg-primary text-white h-100">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 className="card-subtitle mb-2 opacity-75">{t('userActivity.onlineUsers')}</h6>
                                        <h2 className="card-title mb-0">{onlineUsers.count}</h2>
                                    </div>
                                    <i className="bi bi-people-fill fs-1 opacity-25"></i>
                                </div>
                                <small className="opacity-75">
                                    {t('userActivity.last15min')}
                                </small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card bg-success text-white h-100">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 className="card-subtitle mb-2 opacity-75">{t('userActivity.activeToday')}</h6>
                                        <h2 className="card-title mb-0">{tenantSummary.users.active_today}</h2>
                                    </div>
                                    <i className="bi bi-person-check-fill fs-1 opacity-25"></i>
                                </div>
                                <small className="opacity-75">
                                    {t('userActivity.ofTotalUsers', { count: tenantSummary.users.total })}
                                </small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card bg-info text-white h-100">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 className="card-subtitle mb-2 opacity-75">{t('userActivity.viewsToday')}</h6>
                                        <h2 className="card-title mb-0">{tenantSummary.views.today}</h2>
                                    </div>
                                    <i className="bi bi-eye-fill fs-1 opacity-25"></i>
                                </div>
                                <small className="opacity-75">
                                    {t('userActivity.thisWeekViews', { count: tenantSummary.views.this_week })}
                                </small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card bg-warning text-dark h-100">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 className="card-subtitle mb-2 opacity-75">{t('userActivity.engagement')}</h6>
                                        <h2 className="card-title mb-0">{tenantSummary.users.engagement_rate}%</h2>
                                    </div>
                                    <i className="bi bi-graph-up-arrow fs-1 opacity-25"></i>
                                </div>
                                <small className="opacity-75">
                                    {t('userActivity.activeInWeek')}
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <ul className="nav nav-tabs mb-4">
                <li className="nav-item">
                    <button 
                        className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <i className="bi bi-graph-up me-1"></i>
                        {t('userActivity.tabOverview')}
                    </button>
                </li>
                <li className="nav-item">
                    <button 
                        className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        <i className="bi bi-people me-1"></i>
                        {t('userActivity.tabByUser')}
                    </button>
                </li>
                <li className="nav-item">
                    <button 
                        className={`nav-link ${activeTab === 'kbs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('kbs')}
                    >
                        <i className="bi bi-file-earmark-text me-1"></i>
                        {t('userActivity.tabPopularKbs')}
                    </button>
                </li>
                <li className="nav-item">
                    <button 
                        className={`nav-link ${activeTab === 'online' ? 'active' : ''}`}
                        onClick={() => setActiveTab('online')}
                    >
                        <i className="bi bi-broadcast me-1"></i>
                        {t('userActivity.tabOnline')}
                        {onlineUsers.count > 0 && (
                            <span className="badge bg-success ms-2">{onlineUsers.count}</span>
                        )}
                    </button>
                </li>
            </ul>

            {/* Tab Content */}
            {activeTab === 'overview' && tenantSummary && (
                <div className="row g-4">
                    {/* Top Viewers */}
                    <div className="col-lg-6">
                        <div className="card h-100">
                            <div className="card-header">
                                <h5 className="mb-0">
                                    <i className="bi bi-trophy me-2"></i>
                                    {t('userActivity.topViewers')}
                                </h5>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>#</th>
                                                <th>{t('userActivity.user')}</th>
                                                <th className="text-end">Views</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tenantSummary.top_viewers.length === 0 ? (
                                                <tr>
                                                    <td colSpan="3" className="text-center text-muted py-4">
                                                        {t('userActivity.noActivity')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                tenantSummary.top_viewers.map((viewer, index) => (
                                                    <tr key={viewer._id?.toString()}>
                                                        <td>
                                                            {index < 3 ? (
                                                                <span className={`badge ${index === 0 ? 'bg-warning' : index === 1 ? 'bg-secondary' : 'bg-danger'}`}>
                                                                    {index + 1}º
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted">{index + 1}</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div>
                                                                <strong>{viewer.user_name}</strong>
                                                            </div>
                                                            <small className="text-muted">{viewer.user_email}</small>
                                                        </td>
                                                        <td className="text-end">
                                                            <span className="badge bg-primary">{viewer.view_count}</span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Most Viewed KBs */}
                    <div className="col-lg-6">
                        <div className="card h-100">
                            <div className="card-header">
                                <h5 className="mb-0">
                                    <i className="bi bi-fire me-2"></i>
                                    {t('userActivity.topKbsWeek')}
                                </h5>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>KB</th>
                                                <th className="text-center">Views</th>
                                                <th className="text-center">{t('userActivity.unique')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tenantSummary.most_viewed_kbs.length === 0 ? (
                                                <tr>
                                                    <td colSpan="3" className="text-center text-muted py-4">
                                                        {t('userActivity.noActivity')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                tenantSummary.most_viewed_kbs.map((kb) => (
                                                    <tr key={kb.kb_id?.toString()}>
                                                        <td>
                                                            <Link to={`/kb/${kb.kb_id}`} className="text-decoration-none">
                                                                {kb.kb_title || t('userActivity.untitledKb')}
                                                            </Link>
                                                        </td>
                                                        <td className="text-center">
                                                            <span className="badge bg-info">{kb.view_count}</span>
                                                        </td>
                                                        <td className="text-center">
                                                            <span className="badge bg-secondary">{kb.unique_viewers}</span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Activity by Hour Chart */}
                    <div className="col-12">
                        <div className="card">
                            <div className="card-header">
                                <h5 className="mb-0">
                                    <i className="bi bi-clock me-2"></i>
                                    {t('userActivity.byHour')}
                                </h5>
                            </div>
                            <div className="card-body">
                                <div className="d-flex align-items-end" style={{ height: '150px', gap: '4px' }}>
                                    {Array.from({ length: 24 }, (_, hour) => {
                                        const hourData = tenantSummary.activity_by_hour.find(h => h._id === hour);
                                        const count = hourData?.count || 0;
                                        const maxCount = Math.max(...tenantSummary.activity_by_hour.map(h => h.count), 1);
                                        const height = (count / maxCount) * 100;
                                        
                                        return (
                                            <div 
                                                key={hour} 
                                                className="flex-fill d-flex flex-column align-items-center"
                                                title={`${hour}h: ${count} views`}
                                            >
                                                <div 
                                                    className="bg-primary rounded-top" 
                                                    style={{ 
                                                        height: `${Math.max(height, 2)}%`, 
                                                        width: '100%',
                                                        minHeight: count > 0 ? '4px' : '2px'
                                                    }}
                                                ></div>
                                                <small className="text-muted mt-1" style={{ fontSize: '0.65rem' }}>
                                                    {hour}
                                                </small>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="row g-4">
                    <div className={selectedUser ? 'col-lg-6' : 'col-12'}>
                        <div className="card">
                            <div className="card-header d-flex justify-content-between align-items-center">
                                <h5 className="mb-0">
                                    <i className="bi bi-people me-2"></i>
                                    {t('userActivity.activityByUser')}
                                </h5>
                                <span className="badge bg-secondary">{t('userActivity.usersCount', { count: users.length })}</span>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>{t('userActivity.user')}</th>
                                                <th>{t('common.status')}</th>
                                                <th className="text-center">Views</th>
                                                <th className="text-center">{t('userActivity.kbsCreated')}</th>
                                                <th className="text-center">{t('kbView.comments')}</th>
                                                <th>{t('userActivity.lastActivity')}</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center text-muted py-4">
                                                        {t('userActivity.noUsers')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                users.map((user) => (
                                                    <tr 
                                                        key={user._id?.toString()} 
                                                        className={selectedUser === user._id?.toString() ? 'table-active' : ''}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => loadUserDetails(user._id?.toString())}
                                                    >
                                                        <td>
                                                            <div>
                                                                <strong>{user.name}</strong>
                                                            </div>
                                                            <small className="text-muted">{user.email}</small>
                                                        </td>
                                                        <td>{getActivityBadge(user)}</td>
                                                        <td className="text-center">
                                                            <span className="badge bg-info">{user.stats.kb_views}</span>
                                                        </td>
                                                        <td className="text-center">
                                                            <span className="badge bg-success">{user.stats.kbs_created}</span>
                                                        </td>
                                                        <td className="text-center">
                                                            <span className="badge bg-secondary">{user.stats.comments}</span>
                                                        </td>
                                                        <td>
                                                            <small className="text-muted">
                                                                {formatDate(user.last_activity)}
                                                            </small>
                                                        </td>
                                                        <td>
                                                            <button className="btn btn-sm btn-outline-primary">
                                                                <i className="bi bi-chevron-right"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* User Details Panel */}
                    {selectedUser && userDetails && (
                        <div className="col-lg-6">
                            <div className="card sticky-top" style={{ top: '1rem' }}>
                                <div className="card-header d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">
                                        <i className="bi bi-person me-2"></i>
                                        {userDetails.user.name}
                                    </h5>
                                    <button 
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => { setSelectedUser(null); setUserDetails(null); }}
                                    >
                                        <i className="bi bi-x"></i>
                                    </button>
                                </div>
                                <div className="card-body">
                                    <div className="mb-3">
                                        <small className="text-muted">{userDetails.user.email}</small>
                                        <span className={`badge ms-2 ${
                                            userDetails.user.role === 'owner' ? 'bg-danger' :
                                            userDetails.user.role === 'admin' ? 'bg-warning text-dark' :
                                            'bg-secondary'
                                        }`}>
                                            {userDetails.user.role}
                                        </span>
                                    </div>

                                    {/* Activity Graph */}
                                    {userDetails.activity_by_day.length > 0 && (
                                        <div className="mb-4">
                                            <h6 className="text-muted mb-2">{t('userActivity.dailyActivity')}</h6>
                                            <div className="d-flex align-items-end" style={{ height: '60px', gap: '2px' }}>
                                                {userDetails.activity_by_day.slice(-30).map((day) => {
                                                    const maxCount = Math.max(...userDetails.activity_by_day.map(d => d.count), 1);
                                                    const height = (day.count / maxCount) * 100;
                                                    return (
                                                        <div 
                                                            key={day.date}
                                                            className="bg-success rounded-top"
                                                            style={{ 
                                                                height: `${Math.max(height, 5)}%`,
                                                                width: '100%',
                                                                minHeight: '2px'
                                                            }}
                                                            title={`${day.date}: ${t('userActivity.actions', { count: day.count })}`}
                                                        ></div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Top Viewed KBs */}
                                    <div className="mb-4">
                                        <h6 className="text-muted mb-2">{t('userActivity.topKbs')}</h6>
                                        {userDetails.top_viewed_kbs.length === 0 ? (
                                            <p className="text-muted small">{t('userActivity.noKbViewed')}</p>
                                        ) : (
                                            <ul className="list-group list-group-flush">
                                                {userDetails.top_viewed_kbs.slice(0, 5).map((kb) => (
                                                    <li key={kb.kb_id?.toString()} className="list-group-item d-flex justify-content-between align-items-center px-0">
                                                        <Link to={`/kb/${kb.kb_id}`} className="text-decoration-none text-truncate" style={{ maxWidth: '70%' }}>
                                                            {kb.kb_title}
                                                        </Link>
                                                        <span className="badge bg-primary">{kb.view_count}x</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Recent Views */}
                                    <div>
                                        <h6 className="text-muted mb-2">{t('userActivity.recentViews')}</h6>
                                        {userDetails.recent_views.length === 0 ? (
                                            <p className="text-muted small">{t('userActivity.noRecentViews')}</p>
                                        ) : (
                                            <div className="list-group list-group-flush" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                {userDetails.recent_views.slice(0, 10).map((view, index) => (
                                                    <div key={`${view.kb_id}-${index}`} className="list-group-item px-0 py-2">
                                                        <div className="d-flex justify-content-between">
                                                            <Link to={`/kb/${view.kb_id}`} className="text-decoration-none text-truncate" style={{ maxWidth: '60%' }}>
                                                                {view.kb_title || t('userActivity.untitledKb')}
                                                            </Link>
                                                            {view.duration_seconds && (
                                                                <small className="text-muted">
                                                                    {formatDuration(view.duration_seconds)}
                                                                </small>
                                                            )}
                                                        </div>
                                                        <small className="text-muted">
                                                            {formatDate(view.viewed_at)}
                                                        </small>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'kbs' && tenantSummary && (
                <div className="card">
                    <div className="card-header">
                        <h5 className="mb-0">
                            <i className="bi bi-file-earmark-text me-2"></i>
                            {t('userActivity.topKbs')}
                        </h5>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>#</th>
                                        <th>KB</th>
                                        <th className="text-center">{t('userActivity.totalViews')}</th>
                                        <th className="text-center">{t('userActivity.uniqueViewers')}</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tenantSummary.most_viewed_kbs.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="text-center text-muted py-4">
                                                {t('userActivity.noActivityInPeriod')}
                                            </td>
                                        </tr>
                                    ) : (
                                        tenantSummary.most_viewed_kbs.map((kb, index) => (
                                            <tr key={kb.kb_id?.toString()}>
                                                <td>
                                                    <span className="badge bg-secondary">{index + 1}</span>
                                                </td>
                                                <td>
                                                    <Link to={`/kb/${kb.kb_id}`} className="text-decoration-none">
                                                        <strong>{kb.kb_title || t('userActivity.untitledKb')}</strong>
                                                    </Link>
                                                </td>
                                                <td className="text-center">
                                                    <span className="badge bg-primary fs-6">{kb.view_count}</span>
                                                </td>
                                                <td className="text-center">
                                                    <span className="badge bg-info fs-6">{kb.unique_viewers}</span>
                                                </td>
                                                <td>
                                                    <Link to={`/kb/${kb.kb_id}`} className="btn btn-sm btn-outline-primary">
                                                        <i className="bi bi-eye me-1"></i>
                                                        {t('userActivity.viewKb')}
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'online' && (
                <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">
                            <i className="bi bi-broadcast me-2"></i>
                            {t('userActivity.onlineNow')}
                        </h5>
                        <span className="badge bg-success fs-5">{onlineUsers.count}</span>
                    </div>
                    <div className="card-body">
                        {onlineUsers.count === 0 ? (
                            <div className="text-center py-5">
                                <i className="bi bi-moon-stars fs-1 text-muted"></i>
                                <p className="text-muted mt-2">{t('userActivity.nobodyOnline')}</p>
                            </div>
                        ) : (
                            <div className="row g-3">
                                {onlineUsers.users.map((user) => (
                                    <div key={user._id?.toString()} className="col-md-4 col-lg-3">
                                        <div className="card border-success">
                                            <div className="card-body">
                                                <div className="d-flex align-items-center">
                                                    <div className="bg-success rounded-circle d-flex align-items-center justify-content-center me-3" 
                                                         style={{ width: '40px', height: '40px' }}>
                                                        <i className="bi bi-person-fill text-white"></i>
                                                    </div>
                                                    <div className="flex-grow-1 min-width-0">
                                                        <h6 className="mb-0 text-truncate">{user.name}</h6>
                                                        <small className="text-muted text-truncate d-block">{user.email}</small>
                                                    </div>
                                                </div>
                                                <div className="mt-2">
                                                    <span className={`badge ${
                                                        user.role === 'owner' ? 'bg-danger' :
                                                        user.role === 'admin' ? 'bg-warning text-dark' :
                                                        'bg-secondary'
                                                    } me-1`}>{user.role}</span>
                                                    {user.last_activity_type && (
                                                        <small className="text-muted">
                                                            {user.last_activity_type === 'kb_view' ? `👁️ ${t('userActivity.viewingKb')}` :
                                                             user.last_activity_type === 'login' ? `🔑 ${t('userActivity.login')}` :
                                                             user.last_activity_type}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
