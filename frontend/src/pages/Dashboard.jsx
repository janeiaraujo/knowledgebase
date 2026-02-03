import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Badge, ProgressBar, Button, Dropdown, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { recordAPI, incidentAPI, billingAPI } from '../services/api';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_LABELS = {
  draft: 'Rascunho',
  in_review: 'Em Revisão',
  approved: 'Aprovado',
  published: 'Publicado',
  rejected: 'Rejeitado'
};

const STATUS_BADGES = {
  draft: 'warning',
  in_review: 'info',
  approved: 'success',
  published: 'primary',
  rejected: 'danger'
};

const STATUS_COLORS = {
  draft: '#ffc107',
  in_review: '#17a2b8',
  approved: '#28a745',
  published: '#007bff',
  rejected: '#dc3545'
};

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('30d');
  const [analytics, setAnalytics] = useState(null);
  const [myActivity, setMyActivity] = useState(null);
  const [contentHealth, setContentHealth] = useState(null);
  const [trending, setTrending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingReviews, setPendingReviews] = useState([]);
  
  useEffect(() => {
    fetchDashboardData();
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
      '7d': 'Últimos 7 dias',
      '30d': 'Últimos 30 dias',
      '90d': 'Últimos 90 dias',
      '1y': 'Último ano'
    };
    return labels[p] || p;
  };
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Dashboard</h2>
        <Dropdown>
          <Dropdown.Toggle variant="outline-secondary" size="sm">
            <i className="bi bi-calendar3 me-1"></i>
            {getPeriodLabel(period)}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => setPeriod('7d')}>Últimos 7 dias</Dropdown.Item>
            <Dropdown.Item onClick={() => setPeriod('30d')}>Últimos 30 dias</Dropdown.Item>
            <Dropdown.Item onClick={() => setPeriod('90d')}>Últimos 90 dias</Dropdown.Item>
            <Dropdown.Item onClick={() => setPeriod('1y')}>Último ano</Dropdown.Item>
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
                  <div className="text-muted small text-uppercase">Total de KBs</div>
                  <h2 className="mb-0 mt-1">{analytics?.summary?.totalKBs || 0}</h2>
                  {analytics?.summary?.growth !== undefined && (
                    <small className={`text-${analytics.summary.growth >= 0 ? 'success' : 'danger'}`}>
                      <i className={`bi bi-arrow-${analytics.summary.growth >= 0 ? 'up' : 'down'} me-1`}></i>
                      {Math.abs(analytics.summary.growth)}% no período
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
                  <div className="text-muted small text-uppercase">Pendentes</div>
                  <h2 className="mb-0 mt-1 text-info">{analytics?.summary?.pendingReviews || 0}</h2>
                  <small className="text-muted">Aguardando revisão</small>
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
                  <div className="text-muted small text-uppercase">Comentários</div>
                  <h2 className="mb-0 mt-1">{analytics?.summary?.totalComments || 0}</h2>
                  <small className="text-muted">Total</small>
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
                  <div className="text-muted small text-uppercase">Favoritos</div>
                  <h2 className="mb-0 mt-1">{analytics?.summary?.totalFavorites || 0}</h2>
                  <small className="text-muted">Total</small>
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
                    Saúde do Conteúdo
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
              <strong>{pendingReviews.length} KBs aguardando sua aprovação</strong>
              <div className="mt-1">
                {pendingReviews.slice(0, 3).map(kb => (
                  <Link key={kb._id} to={`/kb/${kb._id}`} className="me-3 text-decoration-none">
                    • {kb.title}
                  </Link>
                ))}
                {pendingReviews.length > 3 && <span className="text-muted">e mais...</span>}
              </div>
            </div>
            <Link to="/kb?status=in_review" className="btn btn-info">
              Ver Todos
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
                Distribuição por Status
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
                            {STATUS_LABELS[status] || status}
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
                <p className="text-muted text-center py-4">Nenhum dado disponível</p>
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
                Top Categorias
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
                <p className="text-muted text-center py-4">Nenhuma categoria</p>
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
                Top Contribuidores
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
                      <Badge bg="primary" pill>{contrib.count} KBs</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center py-4">Nenhum contribuidor</p>
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
                Minha Atividade
              </h5>
            </Card.Header>
            <Card.Body>
              {myActivity ? (
                <>
                  <Row className="g-3 mb-4">
                    <Col xs={4}>
                      <div className="text-center">
                        <h3 className="mb-0">{myActivity.totalKBs}</h3>
                        <small className="text-muted">Meus KBs</small>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-center">
                        <h3 className="mb-0 text-warning">{myActivity.drafts}</h3>
                        <small className="text-muted">Rascunhos</small>
                      </div>
                    </Col>
                    <Col xs={4}>
                      <div className="text-center">
                        <h3 className="mb-0 text-success">{myActivity.published}</h3>
                        <small className="text-muted">Publicados</small>
                      </div>
                    </Col>
                  </Row>
                  
                  {myActivity.recentKBs?.length > 0 && (
                    <>
                      <h6 className="text-muted mb-2">KBs Recentes</h6>
                      <div className="list-group list-group-flush">
                        {myActivity.recentKBs.map(kb => (
                          <Link 
                            key={kb._id} 
                            to={`/kb/${kb._id}`}
                            className="list-group-item list-group-item-action border-0 px-0"
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <span>{kb.title}</span>
                              <Badge bg={STATUS_BADGES[kb.status]}>{STATUS_LABELS[kb.status]}</Badge>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-muted text-center py-4">Carregando...</p>
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
                Em Alta
              </h5>
            </Card.Header>
            <Card.Body>
              {trending?.byComments?.length > 0 || trending?.byFavorites?.length > 0 ? (
                <Row>
                  <Col xs={12} md={6}>
                    <h6 className="text-muted mb-2">
                      <i className="bi bi-chat me-1"></i>
                      Mais Comentados
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
                      Mais Favoritados
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
                  Nenhuma atividade recente
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
                  Atividade Recente
                </h5>
                <Link to="/kb" className="btn btn-sm btn-link">Ver todos</Link>
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
                          {STATUS_LABELS[item.status] || item.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center py-4">Nenhuma atividade recente</p>
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
                Ações Rápidas
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Link to="/kb/new" className="btn btn-primary">
                  <i className="bi bi-plus-circle me-2"></i>Novo KB
                </Link>
                <Link to="/quick-capture" className="btn btn-success">
                  <i className="bi bi-lightning-charge me-2"></i>Captura Rápida
                </Link>
                <Link to="/gps" className="btn btn-info text-white">
                  <i className="bi bi-signpost-2 me-2"></i>Diagnóstico GPS
                </Link>
                <Link to="/incidents" className="btn btn-outline-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>Incidentes
                </Link>
                <Link to="/reviews" className="btn btn-outline-warning">
                  <i className="bi bi-calendar-check me-2"></i>Revisões
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
                  Sessões GPS Ativas
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
                          {session.responses?.length || 0} passos
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="p-2 text-center">
                  <Link to="/gps/sessions" className="btn btn-sm btn-link">
                    Ver todas sessões
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
                  Tags Populares
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

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return date.toLocaleDateString('pt-BR');
}
