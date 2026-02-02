import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Row, Col, Alert, Spinner, Badge, ListGroup, Tabs, Tab, Modal, Table, ProgressBar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../services/api';

const Reviews = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data
  const [pendingReviews, setPendingReviews] = useState([]);
  const [staleKBs, setStaleKBs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [summary, setSummary] = useState({ overdue: 0, urgent: 0, upcoming: 0 });
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  
  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [scheduleData, setScheduleData] = useState({ days: 90, notes: '' });

  useEffect(() => {
    fetchSettings();
    fetchPendingReviews();
  }, [statusFilter, pagination.page]);

  useEffect(() => {
    if (activeTab === 'stale') {
      fetchStaleKBs();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/review/settings');
      setSettings(data.settings);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchPendingReviews = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/review/pending', {
        params: {
          status: statusFilter,
          page: pagination.page,
          limit: 20
        }
      });
      setPendingReviews(data.records || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
      setSummary(data.summary || { overdue: 0, urgent: 0, upcoming: 0 });
    } catch (err) {
      setError('Erro ao carregar revisões pendentes');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaleKBs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/review/stale', {
        params: { days: 90, page: 1, limit: 50 }
      });
      setStaleKBs(data.records || []);
    } catch (err) {
      setError('Erro ao carregar KBs desatualizados');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.put('/review/settings', settings);
      setShowSettingsModal(false);
    } catch (err) {
      setError('Erro ao salvar configurações');
    }
  };

  const handleScheduleReview = async () => {
    if (!selectedRecord) return;
    
    try {
      await api.post(`/review/records/${selectedRecord._id}/schedule`, {
        review_period_days: scheduleData.days,
        notes: scheduleData.notes
      });
      setShowScheduleModal(false);
      setSelectedRecord(null);
      fetchPendingReviews();
      if (activeTab === 'stale') fetchStaleKBs();
    } catch (err) {
      setError('Erro ao agendar revisão');
    }
  };

  const handleCompleteReview = async (recordId) => {
    if (!window.confirm('Marcar este KB como revisado?')) return;
    
    try {
      await api.post(`/review/records/${recordId}/complete`, {
        schedule_next: true
      });
      fetchPendingReviews();
    } catch (err) {
      setError('Erro ao completar revisão');
    }
  };

  const handleBulkSchedule = async (recordIds) => {
    if (!window.confirm(`Agendar revisão para ${recordIds.length} KB(s)?`)) return;
    
    try {
      await api.post('/review/bulk-schedule', {
        record_ids: recordIds,
        review_period_days: settings?.default_review_period_days || 90
      });
      fetchStaleKBs();
      fetchPendingReviews();
    } catch (err) {
      setError('Erro ao agendar revisões em lote');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      overdue: { bg: 'danger', label: 'Atrasado' },
      urgent: { bg: 'warning', label: 'Urgente' },
      upcoming: { bg: 'info', label: 'Próximo' },
      scheduled: { bg: 'secondary', label: 'Agendado' }
    };
    return badges[status] || badges.scheduled;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatDaysUntil = (days) => {
    if (days < 0) return `${Math.abs(days)} dias atrasado`;
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Amanhã';
    return `Em ${days} dias`;
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-calendar-check me-2"></i>
            Revisões Periódicas
          </h2>
          <p className="text-muted mb-0">
            Gerencie a revisão periódica de KBs para manter o conteúdo atualizado
          </p>
        </div>
        <Button variant="outline-primary" onClick={() => setShowSettingsModal(true)}>
          <i className="bi bi-gear me-2"></i>
          Configurações
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="border-0 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #dc3545' }}>
            <Card.Body>
              <h3 className="text-danger mb-0">{summary.overdue}</h3>
              <small className="text-muted">Atrasados</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #ffc107' }}>
            <Card.Body>
              <h3 className="text-warning mb-0">{summary.urgent}</h3>
              <small className="text-muted">Esta semana</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #0dcaf0' }}>
            <Card.Body>
              <h3 className="text-info mb-0">{summary.upcoming}</h3>
              <small className="text-muted">Este mês</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
            
            {/* Pending Reviews Tab */}
            <Tab eventKey="pending" title={<><i className="bi bi-clock me-2"></i>Pendentes</>}>
              {/* Filters */}
              <div className="d-flex gap-2 mb-3">
                <Form.Select 
                  size="sm" 
                  style={{ width: '200px' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Todos os status</option>
                  <option value="overdue">Atrasados</option>
                  <option value="this_week">Esta semana</option>
                  <option value="this_month">Este mês</option>
                  <option value="upcoming">Futuros</option>
                </Form.Select>
              </div>

              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : pendingReviews.length === 0 ? (
                <Alert variant="success">
                  <i className="bi bi-check-circle me-2"></i>
                  Nenhuma revisão pendente!
                </Alert>
              ) : (
                <Table responsive hover>
                  <thead className="bg-light">
                    <tr>
                      <th>KB</th>
                      <th>Categoria</th>
                      <th>Última Revisão</th>
                      <th>Próxima Revisão</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReviews.map(record => {
                      const statusBadge = getStatusBadge(record.review_status);
                      
                      return (
                        <tr key={record._id}>
                          <td>
                            <Link to={`/kb/view/${record._id}`} className="text-decoration-none fw-semibold">
                              {record.title}
                            </Link>
                            <br />
                            <small className="text-muted">por {record.owner?.name || 'Desconhecido'}</small>
                          </td>
                          <td>
                            <Badge bg="light" text="dark">
                              {record.category?.name || '-'}
                            </Badge>
                          </td>
                          <td>
                            {record.last_reviewed_at 
                              ? formatDate(record.last_reviewed_at)
                              : <span className="text-muted">Nunca</span>
                            }
                          </td>
                          <td>
                            {formatDate(record.next_review_date)}
                            <br />
                            <small className={`text-${record.review_status === 'overdue' ? 'danger' : 'muted'}`}>
                              {formatDaysUntil(record.days_until_review)}
                            </small>
                          </td>
                          <td>
                            <Badge bg={statusBadge.bg}>{statusBadge.label}</Badge>
                          </td>
                          <td>
                            <Button
                              variant="success"
                              size="sm"
                              className="me-1"
                              onClick={() => handleCompleteReview(record._id)}
                              title="Marcar como revisado"
                            >
                              <i className="bi bi-check"></i>
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowScheduleModal(true);
                              }}
                              title="Reagendar"
                            >
                              <i className="bi bi-calendar"></i>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Tab>

            {/* Stale KBs Tab */}
            <Tab eventKey="stale" title={<><i className="bi bi-exclamation-triangle me-2"></i>Sem Revisão</>}>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : staleKBs.length === 0 ? (
                <Alert variant="success">
                  <i className="bi bi-check-circle me-2"></i>
                  Todos os KBs têm revisão agendada!
                </Alert>
              ) : (
                <>
                  <div className="mb-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleBulkSchedule(staleKBs.map(r => r._id))}
                    >
                      <i className="bi bi-calendar-plus me-2"></i>
                      Agendar todos ({staleKBs.length})
                    </Button>
                  </div>
                  
                  <ListGroup>
                    {staleKBs.map(record => (
                      <ListGroup.Item 
                        key={record._id} 
                        className="d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <Link to={`/kb/view/${record._id}`} className="text-decoration-none fw-semibold">
                            {record.title}
                          </Link>
                          <br />
                          <small className="text-muted">
                            Atualizado há {record.days_since_update} dias • 
                            por {record.owner?.name || 'Desconhecido'}
                          </small>
                        </div>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            setSelectedRecord(record);
                            setShowScheduleModal(true);
                          }}
                        >
                          <i className="bi bi-calendar-plus me-1"></i>
                          Agendar
                        </Button>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </>
              )}
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* Settings Modal */}
      <Modal show={showSettingsModal} onHide={() => setShowSettingsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-gear me-2"></i>
            Configurações de Revisão
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {settings && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Período padrão de revisão (dias)</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={settings.default_review_period_days}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    default_review_period_days: parseInt(e.target.value)
                  }))}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Lembretes (dias antes)</Form.Label>
                <Form.Control
                  type="text"
                  value={(settings.reminder_days_before || []).join(', ')}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    reminder_days_before: e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
                  }))}
                  placeholder="30, 7, 1"
                />
                <Form.Text className="text-muted">
                  Dias antes da revisão para enviar lembretes (separados por vírgula)
                </Form.Text>
              </Form.Group>

              <Form.Check
                type="switch"
                id="notify-owner"
                label="Notificar o autor do KB"
                checked={settings.notify_owner}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  notify_owner: e.target.checked
                }))}
                className="mb-2"
              />

              <Form.Check
                type="switch"
                id="notify-admins"
                label="Notificar administradores"
                checked={settings.notify_admins}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  notify_admins: e.target.checked
                }))}
                className="mb-2"
              />

              <Form.Check
                type="switch"
                id="enabled"
                label="Sistema de revisão ativado"
                checked={settings.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  enabled: e.target.checked
                }))}
              />
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSettingsModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSaveSettings}>
            Salvar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Schedule Modal */}
      <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-calendar-plus me-2"></i>
            Agendar Revisão
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRecord && (
            <>
              <p className="text-muted mb-3">
                <strong>{selectedRecord.title}</strong>
              </p>
              
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Revisar em (dias)</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    value={scheduleData.days}
                    onChange={(e) => setScheduleData(prev => ({
                      ...prev,
                      days: parseInt(e.target.value)
                    }))}
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Label>Observações (opcional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={scheduleData.notes}
                    onChange={(e) => setScheduleData(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    placeholder="Motivo da revisão ou lembretes..."
                  />
                </Form.Group>
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleScheduleReview}>
            Agendar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Reviews;
