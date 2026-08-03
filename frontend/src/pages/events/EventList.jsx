import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Badge, Button, Modal, Form, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { eventAPI } from '../../services/api';

const SEVERITY_COLORS = { info: 'secondary', low: 'success', medium: 'warning', high: 'danger', critical: 'dark' };

const SOURCE_LABELS = {
  zabbix: 'Zabbix',
  grafana: 'Grafana',
  datadog: 'Datadog',
  sentry: 'Sentry',
  custom: 'Customizado'
};

function samplePayload(source) {
  const base = {
    source,
    event_type: 'alert',
    severity: 'high',
    title: 'Exemplo: CPU acima de 90% por 5 minutos',
    description: 'Descrição livre do alerta, vinda da ferramenta de origem.',
    timestamp: new Date().toISOString(),
    metadata: { host: 'srv-web-01', trigger_id: '12345' }
  };
  return JSON.stringify(base, null, 2);
}

export default function EventList() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [converting, setConverting] = useState(null);

  const [tokens, setTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [tokensForbidden, setTokensForbidden] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [newTokenValue, setNewTokenValue] = useState(null);
  const [newTokenIngestUrl, setNewTokenIngestUrl] = useState(null);
  const [tokenForm, setTokenForm] = useState({
    label: '',
    source: 'zabbix',
    auto_create_incident: false,
    auto_create_severity_threshold: 'high'
  });

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const { data } = await eventAPI.list({ limit: 50 });
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const loadTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const { data } = await eventAPI.listTokens();
      setTokens(data.tokens || []);
    } catch (err) {
      if (err.response?.status === 403) {
        // Quem nao e owner/admin nao gerencia fontes de eventos - esconde a secao
        setTokensForbidden(true);
      } else {
        console.error('Failed to load tokens:', err);
      }
    } finally {
      setLoadingTokens(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadTokens();
  }, [loadEvents, loadTokens]);

  const handleConvert = async (eventId) => {
    setConverting(eventId);
    try {
      const { data } = await eventAPI.convertToIncident(eventId);
      toast.success('Incidente criado a partir do evento');
      navigate(`/incidents/${data.incidentId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao converter evento em incidente');
    } finally {
      setConverting(null);
    }
  };

  const handleCreateToken = async (e) => {
    e.preventDefault();
    if (!tokenForm.label.trim()) return;
    setCreatingToken(true);
    try {
      const { data } = await eventAPI.createToken(tokenForm);
      setNewTokenValue(data.token);
      setNewTokenIngestUrl(data.ingest_url);
      await loadTokens();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar token');
    } finally {
      setCreatingToken(false);
    }
  };

  const handleRevoke = async (tokenId) => {
    if (!window.confirm('Revogar este token? Integrações que o usam param de funcionar imediatamente.')) return;
    try {
      await eventAPI.revokeToken(tokenId);
      toast.success('Token revogado');
      loadTokens();
    } catch (err) {
      toast.error('Erro ao revogar token');
    }
  };

  const closeTokenModal = () => {
    setShowTokenModal(false);
    setNewTokenValue(null);
    setNewTokenIngestUrl(null);
    setTokenForm({ label: '', source: 'zabbix', auto_create_incident: false, auto_create_severity_threshold: 'high' });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success('Copiado');
  };

  return (
    <>
      <h2 className="mb-4">Eventos</h2>

      {/* Fontes de eventos (tokens de ingestão) - só visível para owner/admin */}
      {tokensForbidden ? null : (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <span><i className="bi bi-hdd-network me-2"></i>Fontes de Eventos</span>
            <Button size="sm" variant="primary" onClick={() => setShowTokenModal(true)}>
              <i className="bi bi-plus-lg me-1"></i>Novo token
            </Button>
          </Card.Header>
          <Card.Body>
            <p className="text-muted small mb-3">
              Cada fonte (Zabbix, Grafana, Datadog, Sentry ou outra) usa um token próprio para enviar eventos para{' '}
              <code>POST /api/events/ingest</code> via o header <code>x-api-token</code>. Um token pode, opcionalmente,
              abrir incidentes automaticamente quando a severidade do alerta atingir um piso configurado.
            </p>
            {loadingTokens ? (
              <div className="text-center py-3"><Spinner size="sm" animation="border" /></div>
            ) : tokens.length === 0 ? (
              <p className="text-muted small mb-0">Nenhuma fonte configurada ainda.</p>
            ) : (
              <Table size="sm" responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Fonte</th>
                    <th>Token</th>
                    <th>Auto-incidente</th>
                    <th>Último uso</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map(t => (
                    <tr key={t._id}>
                      <td>{t.label}</td>
                      <td>{SOURCE_LABELS[t.source] || t.source}</td>
                      <td><code>{t.token_preview}</code></td>
                      <td>
                        {t.auto_create_incident ? (
                          <Badge bg="success">≥ {t.auto_create_severity_threshold}</Badge>
                        ) : (
                          <span className="text-muted small">manual</span>
                        )}
                      </td>
                      <td className="text-muted small">
                        {t.last_used_at
                          ? formatDistanceToNow(new Date(t.last_used_at), { addSuffix: true, locale: ptBR })
                          : 'nunca usado'}
                      </td>
                      <td>
                        <Button size="sm" variant="outline-danger" onClick={() => handleRevoke(t._id)}>
                          <i className="bi bi-trash"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Eventos ingeridos */}
      <Card className="border-0 shadow-sm">
        <Card.Header><i className="bi bi-activity me-2"></i>Eventos recentes</Card.Header>
        {loadingEvents ? (
          <Card.Body className="text-center py-5"><Spinner animation="border" variant="primary" /></Card.Body>
        ) : events.length === 0 ? (
          <Card.Body className="text-center py-5">
            <i className="bi bi-inbox fs-1 text-muted"></i>
            <p className="text-muted mt-3 mb-0">Nenhum evento recebido ainda</p>
            <p className="text-muted small">
              Configure uma fonte acima para começar a receber eventos de monitoramento.
            </p>
          </Card.Body>
        ) : (
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Título</th>
                <th>Fonte</th>
                <th>Severidade</th>
                <th>Ocorrências</th>
                <th>Recebido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev._id}>
                  <td>{ev.title}</td>
                  <td className="text-muted small">{ev.source}</td>
                  <td><Badge bg={SEVERITY_COLORS[ev.severity] || 'secondary'}>{ev.severity}</Badge></td>
                  <td>{ev.occurrence_count > 1 ? `×${ev.occurrence_count}` : '-'}</td>
                  <td className="text-muted small">
                    {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: ptBR })}
                  </td>
                  <td>
                    {ev.related_incidents?.length > 0 ? (
                      <Button size="sm" variant="outline-secondary" onClick={() => navigate(`/incidents/${ev.related_incidents[0]}`)}>
                        Ver incidente
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={converting === ev._id}
                        onClick={() => handleConvert(ev._id)}
                      >
                        {converting === ev._id ? <Spinner size="sm" animation="border" /> : 'Converter em incidente'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Modal: novo token */}
      <Modal show={showTokenModal} onHide={closeTokenModal}>
        <Modal.Header closeButton>
          <Modal.Title>Nova fonte de eventos</Modal.Title>
        </Modal.Header>
        {newTokenValue ? (
          <Modal.Body>
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-1"></i>
              Copie o token agora — por segurança, ele não será exibido novamente.
            </Alert>
            <Form.Label className="small text-muted">Token</Form.Label>
            <div className="input-group mb-3">
              <Form.Control readOnly value={newTokenValue} />
              <Button variant="outline-secondary" onClick={() => copyToClipboard(newTokenValue)}>
                <i className="bi bi-clipboard"></i>
              </Button>
            </div>

            <Form.Label className="small text-muted">Endpoint de ingestão</Form.Label>
            <div className="input-group mb-3">
              <Form.Control readOnly value={newTokenIngestUrl || ''} />
              <Button variant="outline-secondary" onClick={() => copyToClipboard(newTokenIngestUrl)}>
                <i className="bi bi-clipboard"></i>
              </Button>
            </div>

            <Form.Label className="small text-muted">
              Exemplo de payload (envie como <code>POST</code>, header <code>x-api-token: {'<token>'}</code>)
            </Form.Label>
            <pre className="bg-body-secondary p-2 rounded small" style={{ whiteSpace: 'pre-wrap' }}>
              {samplePayload(tokenForm.source)}
            </pre>
          </Modal.Body>
        ) : (
          <Form onSubmit={handleCreateToken}>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Label</Form.Label>
                <Form.Control
                  autoFocus
                  required
                  placeholder="Ex: Zabbix produção"
                  value={tokenForm.label}
                  onChange={(e) => setTokenForm(prev => ({ ...prev, label: e.target.value }))}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Fonte</Form.Label>
                <Form.Select
                  value={tokenForm.source}
                  onChange={(e) => setTokenForm(prev => ({ ...prev, source: e.target.value }))}
                >
                  {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Check
                  type="switch"
                  id="auto-create-switch"
                  label="Abrir incidente automaticamente"
                  checked={tokenForm.auto_create_incident}
                  onChange={(e) => setTokenForm(prev => ({ ...prev, auto_create_incident: e.target.checked }))}
                />
                <Form.Text className="text-muted">
                  Recomendado apenas para fontes confiáveis, para evitar abrir incidentes por alertas ruidosos.
                </Form.Text>
              </Form.Group>
              {tokenForm.auto_create_incident && (
                <Form.Group>
                  <Form.Label className="small">Severidade mínima para auto-abrir</Form.Label>
                  <Form.Select
                    value={tokenForm.auto_create_severity_threshold}
                    onChange={(e) => setTokenForm(prev => ({ ...prev, auto_create_severity_threshold: e.target.value }))}
                  >
                    <option value="medium">Média ou acima</option>
                    <option value="high">Alta ou acima</option>
                    <option value="critical">Somente crítica</option>
                  </Form.Select>
                </Form.Group>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" onClick={closeTokenModal}>Cancelar</Button>
              <Button variant="primary" type="submit" disabled={creatingToken || !tokenForm.label.trim()}>
                {creatingToken ? <Spinner size="sm" animation="border" /> : 'Criar token'}
              </Button>
            </Modal.Footer>
          </Form>
        )}
        {newTokenValue && (
          <Modal.Footer>
            <Button variant="primary" onClick={closeTokenModal}>Concluído</Button>
          </Modal.Footer>
        )}
      </Modal>
    </>
  );
}
