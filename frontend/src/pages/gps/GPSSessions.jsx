import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Badge, Form, Row, Col, Spinner, Modal, Alert, Pagination } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const STATUS_CONFIG = {
  active: { label: 'Em Andamento', variant: 'primary', icon: 'play-circle' },
  completed: { label: 'Concluído', variant: 'success', icon: 'check-circle' },
  abandoned: { label: 'Abandonado', variant: 'secondary', icon: 'x-circle' }
};

export default function GPSSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0 });
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [flowFilter, setFlowFilter] = useState('');
  const [flows, setFlows] = useState([]);
  
  // Modal states
  const [selectedSession, setSelectedSession] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchFlows = useCallback(async () => {
    try {
      const res = await api.get('/gps/flows?active_only=false');
      setFlows(res.data.flows || []);
    } catch (err) {
      console.error('Erro ao carregar flows:', err);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      if (statusFilter) params.append('status', statusFilter);
      if (flowFilter) params.append('flow_id', flowFilter);

      const res = await api.get(`/gps/sessions?${params.toString()}`);
      setSessions(res.data.sessions || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination?.total || 0 }));
    } catch (err) {
      console.error('Erro ao carregar sessões:', err);
      setError('Falha ao carregar histórico de sessões');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, flowFilter]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleViewDetails = async (session) => {
    setSelectedSession(session);
    setShowDetails(true);
    setLoadingDetails(true);

    try {
      const res = await api.get(`/gps/sessions/${session._id}`);
      setSessionDetails(res.data);
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleContinueSession = (sessionId) => {
    navigate(`/gps/player/${sessionId}`);
  };

  const handleAbandonSession = async (sessionId) => {
    if (!window.confirm('Tem certeza que deseja abandonar esta sessão?')) return;

    try {
      await api.post(`/gps/sessions/${sessionId}/abandon`);
      fetchSessions();
    } catch (err) {
      console.error('Erro ao abandonar sessão:', err);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (start, end) => {
    if (!start) return '-';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate - startDate;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-clock-history me-2"></i>
            Histórico de Sessões GPS
          </h2>
          <p className="text-muted mb-0">
            Visualize e gerencie suas sessões de diagnóstico guiado
          </p>
        </div>
        <Link to="/gps/flows" className="btn btn-primary">
          <i className="bi bi-play-circle me-2"></i>
          Nova Sessão
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={4}>
              <Form.Label className="small text-muted">Status</Form.Label>
              <Form.Select 
                value={statusFilter} 
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">Todos os status</option>
                <option value="active">Em Andamento</option>
                <option value="completed">Concluídos</option>
                <option value="abandoned">Abandonados</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label className="small text-muted">Fluxo</Form.Label>
              <Form.Select 
                value={flowFilter} 
                onChange={(e) => {
                  setFlowFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">Todos os fluxos</option>
                {flows.map(flow => (
                  <option key={flow._id} value={flow._id}>{flow.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={4} className="text-end">
              <Button 
                variant="outline-secondary" 
                onClick={() => {
                  setStatusFilter('');
                  setFlowFilter('');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <i className="bi bi-x-lg me-1"></i>
                Limpar Filtros
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {/* Sessions Table */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Carregando sessões...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-compass display-1 text-muted"></i>
              <h5 className="mt-3">Nenhuma sessão encontrada</h5>
              <p className="text-muted">
                {statusFilter || flowFilter 
                  ? 'Tente ajustar os filtros' 
                  : 'Inicie uma nova sessão de diagnóstico guiado'}
              </p>
              <Link to="/gps/flows" className="btn btn-primary mt-2">
                <i className="bi bi-play-circle me-2"></i>
                Iniciar Nova Sessão
              </Link>
            </div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th>Fluxo</th>
                  <th>Iniciado em</th>
                  <th>Duração</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => {
                  const statusConfig = STATUS_CONFIG[session.status] || STATUS_CONFIG.active;
                  const progress = session.responses?.length || 0;
                  
                  return (
                    <tr key={session._id}>
                      <td>
                        <div className="fw-semibold">{session.flow_name || 'Fluxo'}</div>
                        {session.context?.incident_title && (
                          <small className="text-muted">
                            <i className="bi bi-link-45deg me-1"></i>
                            {session.context.incident_title}
                          </small>
                        )}
                      </td>
                      <td>
                        <div>{formatDate(session.started_at)}</div>
                        {session.completed_at && (
                          <small className="text-muted">
                            Finalizado: {formatDate(session.completed_at)}
                          </small>
                        )}
                      </td>
                      <td>{formatDuration(session.started_at, session.completed_at)}</td>
                      <td>
                        <Badge bg={statusConfig.variant}>
                          <i className={`bi bi-${statusConfig.icon} me-1`}></i>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: '8px', minWidth: '60px' }}>
                            <div 
                              className={`progress-bar bg-${statusConfig.variant}`}
                              style={{ width: `${Math.min(progress * 10, 100)}%` }}
                            />
                          </div>
                          <small className="text-muted">{progress} respostas</small>
                        </div>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <Button 
                            variant="outline-primary" 
                            onClick={() => handleViewDetails(session)}
                            title="Ver Detalhes"
                          >
                            <i className="bi bi-eye"></i>
                          </Button>
                          {session.status === 'active' && (
                            <>
                              <Button 
                                variant="primary" 
                                onClick={() => handleContinueSession(session._id)}
                                title="Continuar Sessão"
                              >
                                <i className="bi bi-play-fill"></i>
                              </Button>
                              <Button 
                                variant="outline-danger" 
                                onClick={() => handleAbandonSession(session._id)}
                                title="Abandonar"
                              >
                                <i className="bi bi-x-lg"></i>
                              </Button>
                            </>
                          )}
                          {session.status === 'completed' && session.rca_generated && (
                            <Link 
                              to={`/kb/${session.rca_generated}`} 
                              className="btn btn-sm btn-outline-success"
                              title="Ver RCA Gerado"
                            >
                              <i className="bi bi-file-text"></i>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <Card.Footer className="bg-white border-top">
            <div className="d-flex justify-content-between align-items-center">
              <small className="text-muted">
                Mostrando {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
              </small>
              <Pagination className="mb-0" size="sm">
                <Pagination.First 
                  onClick={() => handlePageChange(1)} 
                  disabled={pagination.page === 1}
                />
                <Pagination.Prev 
                  onClick={() => handlePageChange(pagination.page - 1)} 
                  disabled={pagination.page === 1}
                />
                {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                  const pageNum = Math.max(1, pagination.page - 2) + idx;
                  if (pageNum > totalPages) return null;
                  return (
                    <Pagination.Item 
                      key={pageNum}
                      active={pageNum === pagination.page}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Pagination.Item>
                  );
                })}
                <Pagination.Next 
                  onClick={() => handlePageChange(pagination.page + 1)} 
                  disabled={pagination.page === totalPages}
                />
                <Pagination.Last 
                  onClick={() => handlePageChange(totalPages)} 
                  disabled={pagination.page === totalPages}
                />
              </Pagination>
            </div>
          </Card.Footer>
        )}
      </Card>

      {/* Session Details Modal */}
      <Modal show={showDetails} onHide={() => setShowDetails(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-compass me-2"></i>
            Detalhes da Sessão
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDetails ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : sessionDetails ? (
            <div>
              {/* Session Info */}
              <div className="mb-4">
                <Row>
                  <Col md={6}>
                    <p className="mb-1"><strong>Fluxo:</strong> {sessionDetails.session?.flow_name}</p>
                    <p className="mb-1"><strong>Status:</strong> {' '}
                      <Badge bg={STATUS_CONFIG[sessionDetails.session?.status]?.variant}>
                        {STATUS_CONFIG[sessionDetails.session?.status]?.label}
                      </Badge>
                    </p>
                  </Col>
                  <Col md={6}>
                    <p className="mb-1"><strong>Iniciado:</strong> {formatDate(sessionDetails.session?.started_at)}</p>
                    {sessionDetails.session?.completed_at && (
                      <p className="mb-1"><strong>Finalizado:</strong> {formatDate(sessionDetails.session?.completed_at)}</p>
                    )}
                  </Col>
                </Row>
              </div>

              {/* Summary */}
              {sessionDetails.session?.summary && (
                <div className="mb-4">
                  <h6><i className="bi bi-card-text me-2"></i>Resumo</h6>
                  <Card className="bg-light border-0">
                    <Card.Body>
                      <pre className="mb-0 white-space-pre-wrap" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                        {sessionDetails.session.summary}
                      </pre>
                    </Card.Body>
                  </Card>
                </div>
              )}

              {/* Responses Timeline */}
              {sessionDetails.session?.responses?.length > 0 && (
                <div>
                  <h6><i className="bi bi-list-check me-2"></i>Respostas ({sessionDetails.session.responses.length})</h6>
                  <div className="timeline">
                    {sessionDetails.session.responses.map((resp, idx) => (
                      <div key={idx} className="timeline-item mb-3">
                        <Card className="border-start border-primary border-3">
                          <Card.Body className="py-2">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <small className="text-muted">Passo {idx + 1}</small>
                                <div className="fw-semibold">{resp.step_id}</div>
                              </div>
                              <small className="text-muted">
                                {formatDate(resp.timestamp)}
                              </small>
                            </div>
                            <div className="mt-2">
                              {typeof resp.response === 'object' ? (
                                <pre className="mb-0 small bg-light p-2 rounded">
                                  {JSON.stringify(resp.response, null, 2)}
                                </pre>
                              ) : (
                                <p className="mb-0">{resp.response}</p>
                              )}
                            </div>
                            {resp.evidence && (
                              <div className="mt-2">
                                <Badge bg="info" className="me-1">
                                  <i className="bi bi-paperclip me-1"></i>
                                  Evidência anexada
                                </Badge>
                              </div>
                            )}
                          </Card.Body>
                        </Card>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RCA Link */}
              {sessionDetails.session?.rca_generated && (
                <Alert variant="success" className="mt-3">
                  <i className="bi bi-file-earmark-text me-2"></i>
                  <strong>RCA Gerado:</strong>{' '}
                  <Link to={`/kb/${sessionDetails.session.rca_generated}`}>
                    Ver documento de análise de causa raiz
                  </Link>
                </Alert>
              )}
            </div>
          ) : (
            <Alert variant="warning">Não foi possível carregar os detalhes</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          {selectedSession?.status === 'active' && (
            <Button variant="primary" onClick={() => handleContinueSession(selectedSession._id)}>
              <i className="bi bi-play-fill me-2"></i>
              Continuar Sessão
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowDetails(false)}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
