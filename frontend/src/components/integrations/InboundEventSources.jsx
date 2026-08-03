import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Badge, Button, Modal, Form, Spinner, Alert, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { eventAPI } from '../../services/api';

// Catalogo de fontes de eventos, no mesmo padrao visual das integrações de
// saída (icone, cor, descrição, lista de recursos). Cada uma pode ter
// múltiplos tokens (ex.: "Zabbix produção" + "Zabbix staging").
const SOURCES = [
  {
    type: 'zabbix',
    name: 'Zabbix',
    description: 'Triggers do Zabbix viram eventos aqui, prontos para virar incidente',
    icon: 'bi-diagram-3',
    color: '#D40000',
    features: [
      'Media Type webhook nativo',
      'Abertura de incidente por severidade',
      'Deduplicação automática (5 min)',
      'Correlação com KBs existentes'
    ]
  },
  {
    type: 'grafana',
    name: 'Grafana',
    description: 'Alert rules do Grafana enviadas via Contact Point webhook',
    icon: 'bi-bar-chart-line',
    color: '#F46800',
    features: [
      'Contact Point tipo webhook',
      'Abertura de incidente por severidade',
      'Deduplicação automática (5 min)',
      'Metadata completo do alerta'
    ]
  },
  {
    type: 'datadog',
    name: 'Datadog',
    description: 'Monitors do Datadog enviados via Webhooks integration',
    icon: 'bi-graph-up',
    color: '#632CA6',
    features: [
      'Webhooks integration nativa',
      'Abertura de incidente por severidade',
      'Correlação de incidentes',
      'Metadata completo do alerta'
    ]
  },
  {
    type: 'sentry',
    name: 'Sentry',
    description: 'Erros de aplicação capturados pelo Sentry viram eventos aqui',
    icon: 'bi-bug',
    color: '#362D59',
    features: [
      'Internal Integration webhook',
      'Abertura de incidente por severidade',
      'Stack trace nos metadados',
      'Correlação com KBs existentes'
    ]
  },
  {
    type: 'pagerduty',
    name: 'PagerDuty',
    description: 'Incidentes/alertas do PagerDuty viram eventos aqui',
    icon: 'bi-bell',
    color: '#06AC38',
    features: [
      'Webhook v3 (Event Orchestration)',
      'Abertura de incidente por severidade',
      'KB gerado vincula de volta ao alerta',
      'Deduplicação automática (5 min)'
    ]
  },
  {
    type: 'custom',
    name: 'Customizado',
    description: 'Qualquer sistema que fale HTTP/JSON - scripts internos, outra ferramenta',
    icon: 'bi-code-slash',
    color: '#6c757d',
    features: [
      'Mesma autenticação por token',
      'Schema simples e documentado',
      'Abertura de incidente por severidade',
      'Ideal para automações internas'
    ]
  }
];

function samplePayload(source) {
  return {
    source,
    event_type: 'alert',
    severity: 'high',
    title: 'Exemplo: CPU acima de 90% por 5 minutos',
    description: 'Descrição livre do alerta, vinda da ferramenta de origem.',
    timestamp: new Date().toISOString(),
    metadata: { host: 'srv-web-01', trigger_id: '12345' }
  };
}

// Exemplo pronto para copiar e colar no terminal (ou na config de webhook da
// ferramenta de origem). Usa o token/URL reais quando ja existem; senao,
// mostra placeholders para referencia antes de criar um token.
function sampleCurl(source, url, token) {
  const payload = JSON.stringify(samplePayload(source), null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : `    ${line}`))
    .join('\n');

  return `curl -X POST '${url || '<URL_DE_INGESTAO>'}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-token: ${token || '<SEU_TOKEN>'}' \\
  -d '${payload}'`;
}

export default function InboundEventSources() {
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
    loadTokens();
  }, [loadTokens]);

  const openModalForSource = (sourceType) => {
    setTokenForm(prev => ({ ...prev, source: sourceType }));
    setShowTokenModal(true);
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

  if (tokensForbidden) {
    return (
      <Alert variant="secondary" className="mb-0">
        Apenas owners/admins podem gerenciar fontes de eventos.
      </Alert>
    );
  }

  return (
    <>
      <p className="text-muted small mb-3">
        Integrações de <strong>entrada</strong>: ferramentas de monitoramento enviam eventos <em>para dentro</em>
        desta plataforma via <code>POST /api/events/ingest</code>, autenticando com um token próprio no header{' '}
        <code>x-api-token</code>. Um token pode, opcionalmente, abrir incidentes automaticamente quando a
        severidade do alerta atingir um piso configurado.
      </p>

      <details className="mb-4">
        <summary className="text-primary small" style={{ cursor: 'pointer' }}>
          Ver exemplo de requisição (curl)
        </summary>
        <pre className="bg-body-secondary p-2 rounded small mt-2" style={{ whiteSpace: 'pre-wrap' }}>
          {sampleCurl('zabbix')}
        </pre>
      </details>

      {loadingTokens ? (
        <div className="text-center py-4"><Spinner animation="border" variant="primary" /></div>
      ) : (
        <Row xs={1} md={2} lg={3} className="g-4">
          {SOURCES.map(source => {
            const sourceTokens = tokens.filter(t => t.source === source.type);
            const configured = sourceTokens.length > 0;

            return (
              <Col key={source.type}>
                <Card className={`h-100 shadow-sm border-0 ${configured ? 'border-start border-success border-4' : ''}`}>
                  <Card.Body>
                    <div className="d-flex align-items-start mb-3">
                      <div className="p-3 rounded me-3" style={{ backgroundColor: `${source.color}15` }}>
                        <i className={`bi ${source.icon}`} style={{ color: source.color, fontSize: '1.5rem' }}></i>
                      </div>
                      <div className="flex-grow-1">
                        <h5 className="mb-1">{source.name}</h5>
                        {configured ? (
                          <Badge bg="success" className="d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                            <i className="bi bi-check"></i>
                            {sourceTokens.length === 1 ? '1 token ativo' : `${sourceTokens.length} tokens ativos`}
                          </Badge>
                        ) : (
                          <Badge bg="secondary">Não configurado</Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-muted small mb-3">{source.description}</p>

                    <div className="mb-3">
                      <small className="text-muted fw-semibold">Recursos:</small>
                      <ul className="small mb-0 ps-3">
                        {source.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
                    </div>

                    {sourceTokens.length > 0 && (
                      <div className="border-top pt-2 mt-2">
                        {sourceTokens.map(t => (
                          <div key={t._id} className="d-flex align-items-center justify-content-between small mb-1">
                            <div className="text-truncate me-2">
                              <span className="fw-medium">{t.label}</span>{' '}
                              <code className="text-muted">{t.token_preview}</code>
                              {t.auto_create_incident && (
                                <Badge bg="success" className="ms-1">auto ≥ {t.auto_create_severity_threshold}</Badge>
                              )}
                            </div>
                            <OverlayTrigger overlay={<Tooltip>Revogar</Tooltip>}>
                              <Button size="sm" variant="outline-danger" onClick={() => handleRevoke(t._id)}>
                                <i className="bi bi-trash"></i>
                              </Button>
                            </OverlayTrigger>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                  <Card.Footer className="bg-white border-0 pt-0">
                    <Button
                      variant={configured ? 'outline-primary' : 'primary'}
                      size="sm"
                      className="w-100"
                      onClick={() => openModalForSource(source.type)}
                    >
                      <i className="bi bi-plus-lg me-1"></i>
                      {configured ? 'Adicionar outro token' : 'Configurar'}
                    </Button>
                  </Card.Footer>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

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

            <Form.Label className="small text-muted">
              Exemplo pronto pra usar (envie este comando no terminal, ou copie a URL/token para a configuração de
              webhook da ferramenta de origem)
            </Form.Label>
            <div className="input-group mb-3">
              <pre className="bg-body-secondary p-2 rounded small mb-0 flex-grow-1" style={{ whiteSpace: 'pre-wrap' }}>
                {sampleCurl(tokenForm.source, newTokenIngestUrl, newTokenValue)}
              </pre>
            </div>
            <Button
              size="sm"
              variant="outline-secondary"
              className="mb-3"
              onClick={() => copyToClipboard(sampleCurl(tokenForm.source, newTokenIngestUrl, newTokenValue))}
            >
              <i className="bi bi-clipboard me-1"></i>Copiar curl
            </Button>

            <Form.Label className="small text-muted">Token (isolado, se preferir)</Form.Label>
            <div className="input-group mb-2">
              <Form.Control readOnly value={newTokenValue} />
              <Button variant="outline-secondary" onClick={() => copyToClipboard(newTokenValue)}>
                <i className="bi bi-clipboard"></i>
              </Button>
            </div>

            <Form.Label className="small text-muted">Endpoint de ingestão</Form.Label>
            <div className="input-group">
              <Form.Control readOnly value={newTokenIngestUrl || ''} />
              <Button variant="outline-secondary" onClick={() => copyToClipboard(newTokenIngestUrl)}>
                <i className="bi bi-clipboard"></i>
              </Button>
            </div>
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
                  {SOURCES.map(source => (
                    <option key={source.type} value={source.type}>{source.name}</option>
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
