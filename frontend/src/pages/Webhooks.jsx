import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Button, Badge, Form, Modal, Row, Col, Alert, Spinner, Tabs, Tab } from 'react-bootstrap';
import api from '../services/api';

const WEBHOOK_EVENTS = [
  { id: 'kb.created', name: 'KB Criado', group: 'Knowledge Base' },
  { id: 'kb.updated', name: 'KB Atualizado', group: 'Knowledge Base' },
  { id: 'kb.published', name: 'KB Publicado', group: 'Knowledge Base' },
  { id: 'kb.deleted', name: 'KB Excluído', group: 'Knowledge Base' },
  { id: 'incident.created', name: 'Incidente Criado', group: 'Incidentes' },
  { id: 'incident.updated', name: 'Incidente Atualizado', group: 'Incidentes' },
  { id: 'incident.resolved', name: 'Incidente Resolvido', group: 'Incidentes' },
  { id: 'gps.session_started', name: 'Sessão GPS Iniciada', group: 'GPS' },
  { id: 'gps.session_completed', name: 'Sessão GPS Concluída', group: 'GPS' },
  { id: 'comment.created', name: 'Comentário Adicionado', group: 'Outros' },
  { id: 'user.joined', name: 'Usuário Entrou', group: 'Outros' }
];

export default function Webhooks() {
  const { t } = useTranslation();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    name: '',
    url: '',
    events: ['kb.created', 'kb.published'],
    is_active: true
  });

  // Testing state
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/webhooks');
      setWebhooks(res.data.webhooks || []);
    } catch (err) {
      setError('Falha ao carregar webhooks');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editingWebhook) {
        await api.put(`/webhooks/${editingWebhook._id}`, form);
        setSuccess('Webhook atualizado com sucesso');
      } else {
        const res = await api.post('/webhooks', form);
        setSuccess(`Webhook criado! Secret: ${res.data.webhook.secret} (guarde-o, não será mostrado novamente)`);
      }
      setShowModal(false);
      setEditingWebhook(null);
      setForm({ name: '', url: '', events: ['kb.created', 'kb.published'], is_active: true });
      fetchWebhooks();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar webhook');
    }
  };

  const handleEdit = (webhook) => {
    setEditingWebhook(webhook);
    setForm({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      is_active: webhook.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (webhookId) => {
    if (!window.confirm(t('webhooks.temCertezaQueDesejaExcluirEste'))) return;

    try {
      await api.delete(`/webhooks/${webhookId}`);
      setSuccess('Webhook excluído');
      fetchWebhooks();
    } catch (err) {
      setError('Erro ao excluir webhook');
    }
  };

  const handleToggleActive = async (webhook) => {
    try {
      await api.put(`/webhooks/${webhook._id}`, { is_active: !webhook.is_active });
      fetchWebhooks();
    } catch (err) {
      setError('Erro ao atualizar webhook');
    }
  };

  const handleTest = async (webhookId) => {
    setTesting(webhookId);
    setTestResult(null);

    try {
      const res = await api.post(`/webhooks/${webhookId}/test`);
      setTestResult({
        webhookId,
        success: res.data.success,
        status: res.data.status_code,
        duration: res.data.duration_ms
      });
    } catch (err) {
      setTestResult({
        webhookId,
        success: false,
        error: err.response?.data?.error || 'Erro ao testar'
      });
    } finally {
      setTesting(null);
    }
  };

  const handleViewDeliveries = async (webhook) => {
    setSelectedWebhook(webhook);
    setShowDeliveries(true);
    setLoadingDeliveries(true);

    try {
      const res = await api.get(`/webhooks/${webhook._id}/deliveries`);
      setDeliveries(res.data.deliveries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('pt-BR');
  };

  const groupedEvents = WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.group]) acc[event.group] = [];
    acc[event.group].push(event);
    return acc;
  }, {});

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-link-45deg me-2"></i>
            {t('webhooks.webhooks')}
          </h2>
          <p className="text-muted mb-0">
            {t('webhooks.configureIntegracoesParaReceberNot')}
          </p>
        </div>
        <Button variant="primary" onClick={() => {
          setEditingWebhook(null);
          setForm({ name: '', url: '', events: ['kb.created', 'kb.published'], is_active: true });
          setShowModal(true);
        }}>
          <i className="bi bi-plus-lg me-2"></i>
          {t('webhooks.novoWebhook')}
        </Button>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-link-45deg display-1 text-muted"></i>
              <h5 className="mt-3">{t('webhooks.nenhumWebhookConfigurado')}</h5>
              <p className="text-muted">{t('webhooks.crieUmWebhookParaIntegrarCom')}</p>
            </div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th>{t('gpsEditor.name')}</th>
                  <th>{t('webhooks.url')}</th>
                  <th>{t('webhooks.eventos')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('webhooks.estatisticas')}</th>
                  <th className="text-end">{t('reviews.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map(webhook => (
                  <tr key={webhook._id}>
                    <td>
                      <div className="fw-semibold">{webhook.name}</div>
                      <small className="text-muted">Secret: {webhook.secret}</small>
                    </td>
                    <td>
                      <code className="small">{webhook.url}</code>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {webhook.events?.slice(0, 3).map(event => (
                          <Badge key={event} bg="secondary" className="fw-normal">
                            {event}
                          </Badge>
                        ))}
                        {webhook.events?.length > 3 && (
                          <Badge bg="light" text="dark">+{webhook.events.length - 3}</Badge>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge bg={webhook.is_active ? 'success' : 'secondary'}>
                        {webhook.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td>
                      <small>
                        <span className="text-success">{webhook.stats?.successful_deliveries || 0}</span>
                        {' / '}
                        <span className="text-danger">{webhook.stats?.failed_deliveries || 0}</span>
                        {' entregas'}
                      </small>
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Button 
                          variant="outline-primary" 
                          onClick={() => handleTest(webhook._id)}
                          disabled={testing === webhook._id}
                          title={t('webhooks.testar')}
                        >
                          {testing === webhook._id ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            <i className="bi bi-play-fill"></i>
                          )}
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          onClick={() => handleViewDeliveries(webhook)}
                          title={t('webhooks.verEntregas')}
                        >
                          <i className="bi bi-clock-history"></i>
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          onClick={() => handleEdit(webhook)}
                          title={t('common.edit')}
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                        <Button 
                          variant={webhook.is_active ? 'outline-warning' : 'outline-success'}
                          onClick={() => handleToggleActive(webhook)}
                          title={webhook.is_active ? 'Desativar' : 'Ativar'}
                        >
                          <i className={`bi bi-${webhook.is_active ? 'pause' : 'play'}`}></i>
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          onClick={() => handleDelete(webhook._id)}
                          title={t('common.delete')}
                        >
                          <i className="bi bi-trash"></i>
                        </Button>
                      </div>
                      {testResult?.webhookId === webhook._id && (
                        <div className="mt-2">
                          <Badge bg={testResult.success ? 'success' : 'danger'}>
                            {testResult.success ? `OK (${testResult.status}) - ${testResult.duration}ms` : testResult.error}
                          </Badge>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>
              {editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('webhooks.nome')}</Form.Label>
                  <Form.Control
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder={t('webhooks.exIntegracaoSlack')}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('webhooks.urlDoEndpoint')}</Form.Label>
                  <Form.Control
                    type="url"
                    value={form.url}
                    onChange={e => setForm({ ...form, url: e.target.value })}
                    placeholder="https://seu-servidor.com/webhook"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>{t('webhooks.eventosParaNotificar')}</Form.Label>
              <div className="border rounded p-3">
                {Object.entries(groupedEvents).map(([group, events]) => (
                  <div key={group} className="mb-3">
                    <strong className="small text-muted">{group}</strong>
                    <div className="mt-1">
                      {events.map(event => (
                        <Form.Check
                          key={event.id}
                          type="checkbox"
                          id={`event-${event.id}`}
                          label={event.name}
                          checked={form.events.includes(event.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setForm({ ...form, events: [...form.events, event.id] });
                            } else {
                              setForm({ ...form, events: form.events.filter(ev => ev !== event.id) });
                            }
                          }}
                          inline
                          className="me-3"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Form.Group>

            <Form.Check
              type="switch"
              id="webhook-active"
              label={t('webhooks.webhookAtivo')}
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" type="submit">
              {editingWebhook ? 'Salvar' : 'Criar Webhook'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Deliveries Modal */}
      <Modal show={showDeliveries} onHide={() => setShowDeliveries(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-clock-history me-2"></i>
            Histórico de Entregas - {selectedWebhook?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDeliveries ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : deliveries.length === 0 ? (
            <Alert variant="info">{t('webhooks.nenhumaEntregaRegistradaAinda')}</Alert>
          ) : (
            <Table responsive size="sm">
              <thead>
                <tr>
                  <th>{t('webhooks.data')}</th>
                  <th>{t('webhooks.evento')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('webhooks.codigoHttp')}</th>
                  <th>{t('webhooks.duracao')}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(delivery => (
                  <tr key={delivery._id}>
                    <td><small>{formatDate(delivery.created_at)}</small></td>
                    <td><Badge bg="secondary">{delivery.event}</Badge></td>
                    <td>
                      <Badge bg={delivery.status === 'success' ? 'success' : 'danger'}>
                        {delivery.status === 'success' ? 'Sucesso' : 'Falha'}
                      </Badge>
                    </td>
                    <td>{delivery.response_status || '-'}</td>
                    <td>{delivery.duration_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeliveries(false)}>
            {t('postmortem.close')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
