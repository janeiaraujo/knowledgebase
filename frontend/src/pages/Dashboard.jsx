import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Badge, ProgressBar, Button, Dropdown, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { recordAPI, incidentAPI, billingAPI } from '../services/api';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import i18n from '../i18n';

const STATUS_LABEL_KEYS = {
  draft: 'dashboard.status.draft',
  in_review: 'dashboard.status.inReview',
  approved: 'dashboard.status.approved',
  published: 'dashboard.status.published',
  rejected: 'dashboard.status.rejected'
};

const STATUS_BADGES = {
  draft: 'warning',
  in_review: 'info',
  approved: 'success',
  published: 'primary',
  rejected: 'danger'
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [period, setPeriod] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [myActivity, setMyActivity] = useState(null);
  const [contentHealth, setContentHealth] = useState(null);
  const [trending, setTrending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingReviews, setPendingReviews] = useState([]);

  const statusLabel = (status) => (STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status);

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [analyticsRes, activityRes, healthRes, trendingRes, pendingRes] = await Promise.all([
        api.get(`/dashboard/analytics?period=${period}`),
        api.get('/dashboard/my-activity'),
        api.get('/dashboard/content-health'),
        api.get('/dashboard/trending'),
        recordAPI.list({ status: 'in_review', limit: 5 })
      ]);

      setAnalytics(analyticsRes.data);
      setMyActivity(activityRes.data);
      setContentHealth(healthRes.data);
      setTrending(trendingRes.data);
      setPendingReviews(pendingRes.data.records || []);
    } catch (error) {
      console.error('Falha ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = (p) => {
    const labels = {
      '7d': t('dashboard.period.7d'),
      '30d': t('dashboard.period.30d'),
      '90d': t('dashboard.period.90d'),
      '1y': t('dashboard.period.1y')
    };
    return labels[p] || p;
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">{t('nav.items.dashboard')}</h2>
        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm">
            <i className="bi bi-calendar3 me-1"></i>
            {getPeriodLabel(period)}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => setPeriod('7d')}>{t('dashboard.period.7d')}</Dropdown.Item>
            <Dropdown.Item onClick={() => setPeriod('30d')}>{t('dashboard.period.30d')}</Dropdown.Item>
            <Dropdown.Item onClick={() => setPeriod('90d')}>{t('dashboard.period.90d')}</Dropdown.Item>
            <Dropdown.Item onClick={() => setPeriod('1y')}>{t('dashboard.period.1y')}</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      {/* Summary Stats */}
      <Row className="g-3 mb-4">
        <Col xs={6} md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="text-muted small text-uppercase">{t('dashboard.totalKbs')}</div>
                  <h2 className="mb-0 mt-1">{analytics?.summary?.totalKBs || 0}</h2>
                  {analytics?.summary?.growth !== undefined && (
                    <small className={`text-${analytics.summary.growth >= 0 ? 'success' : 'danger'}`}>
                      <i className={`bi bi-arrow-${analytics.summary.growth >= 0 ? 'up' : 'down'} me-1`}></i>
                      {t('dashboard.growthInPeriod', { value: Math.abs(analytics.summary.growth) })}
                    </small>
                  )}
                </div>
                <div className="bg-primary bg-opacity-10 p-3 rounded">
                  <i className="bi bi-book fs-4 text-primary"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={6} md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="text-muted small text-uppercase">{t('dashboard.pending')}</div>
                  <h2 className="mb-0 mt-1 text-info">{analytics?.summary?.pendingReviews || 0}</h2>
                  <small className="text-muted">{t('dashboard.awaitingReview')}</small>
                </div>
                <div className="bg-info bg-opacity-10 p-3 rounded">
                  <i className="bi bi-hourglass-split fs-4 text-info"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={6} md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="text-muted small text-uppercase">{t('dashboard.comments')}</div>
                  <h2 className="mb-0 mt-1">{analytics?.summary?.totalComments || 0}</h2>
                  <small className="text-muted">{t('common.total')}</small>
                </div>
                <div className="bg-success bg-opacity-10 p-3 rounded">
                  <i className="bi bi-chat-dots fs-4 text-success"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={6} md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="text-muted small text-uppercase">{t('dashboard.favorites')}</div>
                  <h2 className="mb-0 mt-1">{analytics?.summary?.totalFavorites || 0}</h2>
                  <small className="text-muted">{t('common.total')}</small>
                </div>
                <div className="bg-warning bg-opacity-10 p-3 rounded">
                  <i className="bi bi-star-fill fs-4 text-warning"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Content Health Score */}
      {contentHealth && (
        <Row className="mb-4">
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">
                    <i className="bi bi-heart-pulse me-2 text-danger"></i>
                    {t('dashboard.contentHealth')}
                  </h5>
                  <div className="text-end">
                    <span className={`badge bg-${getHealthColor(contentHealth.healthScore)} fs-5`}>
                      {contentHealth.healthScore}/100
                    </span>
                  </div>
                </div>

                <ProgressBar
                  now={contentHealth.healthScore}
                  variant={getHealthColor(contentHealth.healthScore)}
                  className="mb-3"
                  style={{ height: '10px' }}
                />

                {contentHealth.recommendations?.length > 0 && (
                  <div className="mt-3">
                    {contentHealth.recommendations.map((rec, idx) => (
                      <Alert
                        key={idx}
                        variant={rec.type === 'danger' ? 'danger' : rec.type === 'warning' ? 'warning' : 'info'}
                        className="d-flex align-items-center py-2 mb-2"
                      >
                        <i className={`bi bi-${rec.icon} me-2`}></i>
                        <div className="flex-grow-1">
                          <small>{rec.message}</small>
                        </div>
                        {rec.link && (
                          <Link to={rec.link} className="btn btn-sm btn-outline-secondary ms-2">
                            {rec.action}
                          </Link>
                        )}
                      </Alert>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Pending Reviews Alert */}
      {pendingReviews.length > 0 && user && ['owner', 'admin'].includes(user.role) && (
        <Alert variant="info" className="mb-4">
          <div className="d-flex align-items-center">
            <i className="bi bi-bell-fill me-3 fs-4"></i>
            <div className="flex-grow-1">
              <strong>{t('dashboard.kbsAwaitingApproval', { count: pendingReviews.length })}</strong>
              <div className="mt-1">
                {pendingReviews.slice(0, 3).map(kb => (
                  <Link key={kb._id} to={`/kb/${kb._id}`} className="me-3 text-decoration-none">
                    • {kb.title}
                  </Link>
                ))}
                {pendingReviews.length > 3 && <span className="text-muted">{t('common.andMore')}</span>}
              </div>
            </div>
            <Link to="/kb?status=in_review" className="btn btn-info">
              {t('common.viewAll')}
            </Link>
          </div>
        </Alert>
      )}

      <Row className="g-4">
        {/* Status Distribution */}
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-0 py-3">
              <h5 className="mb-0">
                <i className="bi bi-pie-chart me-2"></i>
                {t('dashboard.statusDistribution')}
              </h5>
            </Card.Header>
            <Card.Body>
              {analytics?.statusDistribution && Object.keys(analytics.statusDistribution).length > 0 ? (
                <div>
                  {Object.entries(analytics.statusDistribution).map(([status, count]) => {
                    const total = Object.values(analytics.statusDistribution).reduce((a, b) => a + b, 0);
                    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={status} className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="text-capitalize">
                            <Badge
                              bg={STATUS_BADGES[status] || 'secondary'}
                              className="me-2"
                            >
                              {count}
                            </Badge>
                            {statusLabel(status)}
                          </span>
                          <small className="text-muted">{percent}%</small>
                        </div>
                        <ProgressBar
                          now={percent}
                          style={{
                            height: '6px',
                            backgroundColor: '#e9ecef'
                          }}
                          variant={STATUS_BADGES[status] || 'secondary'}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted text-center py-4">{t('dashboard.noDataAvailable')}</p>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Category Distribution */}
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-0 py-3">
              <h5 className="mb-0">
                <i className="bi bi-folder me-2"></i>
                {t('dashboard.topCategories')}
              </h5>
            </Card.Header>
            <Card.Body>
              {analytics?.categoryDistribution?.length > 0 ? (
                <div className="list-group list-group-flush">
                  {analytics.categoryDistribution.slice(0, 5).map((cat, idx) => (
                    <div key={cat.name} className="list-group-item border-0 px-0 d-flex justify-content-between">
                      <span>
                        <i className="bi bi-folder2 text-muted me-2"></i>
                        {cat.name}
                      </span>
                      <Badge bg="secondary" pill>{cat.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center py-4">{t('dashboard.noCategories')}</p>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Top Contributors */}
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-0 py-3">
              <h5 className="mb-0">
                <i className="bi bi-trophy me-2"></i>
                {t('dashboard.topContributors')}
              </h5>
            </Card.Header>
            <Card.Body>
              {analytics?.topContributors?.length > 0 ? (
                <div className="list-group list-group-flush">
                  {analytics.topContributors.map((contrib, idx) => (
                    <div key={contrib._id} className="list-group-item border-0 px-0 d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        <div
                          className={`rounded-circle d-flex align-items-center justify-content-center me-2 ${idx === 0 ? 'bg-warning' : idx === 1 ? 'bg-secondary' : idx === 2 ? 'bg-danger bg-opacity-75' : 'bg-light'}`}
                          style={{ width: '32px', height: '32px' }}
                        >
                          {idx < 3 ? (
                            <i className={`bi bi-trophy-fill ${idx === 0 ? 'text-dark' : 'text-white'}`}></i>
                          ) : (
                            <span className="small text-muted">{idx + 1}</span>
                          )}
                        </div>
                        <div>
                          <div>{contrib.name || contrib.email}</div>
                        </div>
                      </div>
                      <Badge bg="primary" pill>{t('dashboard.kbsCount', { count: contrib.count })}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center py-4">{t('dashboard.noContributors')}</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4 mt-2">
        {/* My Activity */}
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-0 py-3">
              <h5 className="mb-0">
                <i className="bi bi-person-circle me-2"></i>
                {t('dashboard.myActivity')}
              </h5>
            </Card.Header>
            <Card.Body>
              {myActivity ? (
                <>
                  <Row className="g-3 mb-4">
                    <Col xs={4}>
                      <div className="text-center">
                        <h3 className="mb-0">{myActivity.totalKBs}</h3>
                        <small className="text-muted">{t('dashboard.myKbs')}</small>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-center">
                        <h3 className="mb-0 text-warning">{myActivity.drafts}</h3>
                        <small className="text-muted">{t('dashboard.status.drafts')}</small>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-center">
                        <h3 className="mb-0 text-success">{myActivity.published}</h3>
                        <small className="text-muted">{t('dashboard.status.publishedPlural')}</small>
                      </div>
                    </Col>
                  </Row>

                  {myActivity.recentKBs?.length > 0 && (
                    <>
                      <h6 className="text-muted mb-2">{t('dashboard.recentKbs')}</h6>
                      <div className="list-group list-group-flush">
                        {myActivity.recentKBs.map(kb => (
                          <Link
                            key={kb._id}
                            to={`/kb/${kb._id}`}
                            className="list-group-item list-group-item-action border-0 px-0"
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <span>{kb.title}</span>
                              <Badge bg={STATUS_BADGES[kb.status]}>{statusLabel(kb.status)}</Badge>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-muted text-center py-4">{t('common.loading')}</p>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Trending */}
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-0 py-3">
              <h5 className="mb-0">
                <i className="bi bi-graph-up-arrow me-2"></i>
                {t('dashboard.trending')}
              </h5>
            </Card.Header>
            <Card.Body>
              {trending?.byComments?.length > 0 || trending?.byFavorites?.length > 0 ? (
                <Row>
                  <Col xs={12} md={6}>
                    <h6 className="text-muted mb-2">
                      <i className="bi bi-chat me-1"></i>
                      {t('dashboard.mostCommented')}
                    </h6>
                    <div className="list-group list-group-flush">
                      {trending.byComments.slice(0, 3).map(kb => (
                        <Link
                          key={kb._id}
                          to={`/kb/${kb._id}`}
                          className="list-group-item list-group-item-action border-0 px-0 py-2"
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-truncate me-2" style={{ maxWidth: '150px' }}>
                              {kb.title}
                            </span>
                            <Badge bg="info" pill>{kb.activity}</Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Col>
                  <Col xs={12} md={6}>
                    <h6 className="text-muted mb-2 mt-3 mt-md-0">
                      <i className="bi bi-star me-1"></i>
                      {t('dashboard.mostFavorited')}
                    </h6>
                    <div className="list-group list-group-flush">
                      {trending.byFavorites.slice(0, 3).map(kb => (
                        <Link
                          key={kb._id}
                          to={`/kb/${kb._id}`}
                          className="list-group-item list-group-item-action border-0 px-0 py-2"
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="text-truncate me-2" style={{ maxWidth: '150px' }}>
                              {kb.title}
                            </span>
                            <Badge bg="warning" text="dark" pill>{kb.activity}</Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Col>
                </Row>
              ) : (
                <p className="text-muted text-center py-4">
                  {t('dashboard.noRecentActivity')}
                </p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity Timeline */}
      <Row className="g-4 mt-2">
        <Col md={8}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-0 py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="bi bi-clock-history me-2"></i>
                  {t('dashboard.recentActivity')}
                </h5>
                <Link to="/kb" className="btn btn-sm btn-link">{t('common.viewAll')}</Link>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {analytics?.recentActivity?.length > 0 ? (
                <div className="list-group list-group-flush">
                  {analytics.recentActivity.map(item => (
                    <Link
                      key={item._id}
                      to={`/kb/${item._id}`}
                      className="list-group-item list-group-item-action"
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h6 className="mb-1">{item.title}</h6>
                          <small className="text-muted">
                            {item.creator_name && <span>{item.creator_name} • </span>}
                            {formatTimeAgo(item.updated_at || item.created_at)}
                          </small>
                        </div>
                        <Badge bg={STATUS_BADGES[item.status] || 'secondary'}>
                          {statusLabel(item.status)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center py-4">{t('dashboard.noRecentActivity')}</p>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col md={4}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-0 py-3">
              <h5 className="mb-0">
                <i className="bi bi-lightning me-2"></i>
                {t('dashboard.quickActions')}
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Link to="/kb/new" className="btn btn-primary">
                  <i className="bi bi-plus-circle me-2"></i>{t('navbar.newKb')}
                </Link>
                <Link to="/quick-capture" className="btn btn-success">
                  <i className="bi bi-lightning-charge me-2"></i>{t('nav.items.quickCapture')}
                </Link>
                <Link to="/gps" className="btn btn-info text-white">
                  <i className="bi bi-signpost-2 me-2"></i>{t('nav.items.gpsDiagnostic')}
                </Link>
                <Link to="/incidents" className="btn btn-outline-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>{t('nav.items.incidents')}
                </Link>
                <Link to="/reviews" className="btn btn-outline-warning">
                  <i className="bi bi-calendar-check me-2"></i>{t('nav.items.reviews')}
                </Link>
              </div>
            </Card.Body>
          </Card>

          {/* Active GPS Sessions */}
          {myActivity?.activeSessions?.length > 0 && (
            <Card className="border-0 shadow-sm mt-4">
              <Card.Header className="bg-white border-0 py-3">
                <h5 className="mb-0">
                  <i className="bi bi-compass me-2 text-primary"></i>
                  {t('dashboard.activeGpsSessions')}
                </h5>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="list-group list-group-flush">
                  {myActivity.activeSessions.slice(0, 3).map(session => (
                    <Link
                      key={session._id}
                      to={`/gps/session/${session._id}`}
                      className="list-group-item list-group-item-action"
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <span>{session.flow_name}</span>
                        <Badge bg="primary" pill>
                          {t('dashboard.stepsCount', { count: session.responses?.length || 0 })}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="p-2 text-center">
                  <Link to="/gps/sessions" className="btn btn-sm btn-link">
                    {t('dashboard.viewAllSessions')}
                  </Link>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Tag Cloud */}
          {analytics?.tagDistribution?.length > 0 && (
            <Card className="border-0 shadow-sm mt-4">
              <Card.Header className="bg-white border-0 py-3">
                <h5 className="mb-0">
                  <i className="bi bi-tags me-2"></i>
                  {t('dashboard.popularTags')}
                </h5>
              </Card.Header>
              <Card.Body>
                <div className="d-flex flex-wrap gap-2">
                  {analytics.tagDistribution.map(tag => (
                    <Link
                      key={tag.name}
                      to={`/kb?tag=${tag.name}`}
                      className="text-decoration-none"
                    >
                      <Badge
                        pill
                        style={{
                          backgroundColor: tag.color || '#6c757d',
                          fontSize: `${Math.min(0.9 + tag.count * 0.05, 1.2)}rem`
                        }}
                      >
                        {tag.name} ({tag.count})
                      </Badge>
                    </Link>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
}

function getHealthColor(score) {
  if (score >= 80) return 'success';
  if (score >= 60) return 'info';
  if (score >= 40) return 'warning';
  return 'danger';
}

// Fica fora do componente (usado em contexto sem hooks), por isso usa a
// instancia do i18n diretamente em vez do hook useTranslation.
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return i18n.t('dashboard.timeAgo.justNow');
  if (diffMins < 60) return i18n.t('dashboard.timeAgo.minutesAgo', { count: diffMins });
  if (diffHours < 24) return i18n.t('dashboard.timeAgo.hoursAgo', { count: diffHours });
  if (diffDays === 1) return i18n.t('dashboard.timeAgo.yesterday');
  if (diffDays < 7) return i18n.t('dashboard.timeAgo.daysAgo', { count: diffDays });

  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'pt-BR';
  return date.toLocaleDateString(locale);
}
