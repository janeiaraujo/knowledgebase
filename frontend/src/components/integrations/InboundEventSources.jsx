import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Badge, Button, Modal, Form, Spinner, Alert, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import { eventAPI } from '../../services/api';

// Catalogo de fontes de eventos, no mesmo padrao visual das integrações de
// saída (icone, cor, descrição, lista de recursos). Cada uma pode ter
// múltiplos tokens (ex.: "Zabbix produção" + "Zabbix staging").
const SOURCES = [
  {
    type: 'zabbix',
    name: 'Zabbix',
    icon: 'bi-diagram-3',
    color: '#D40000',
  },
  {
    type: 'grafana',
    name: 'Grafana',
    icon: 'bi-bar-chart-line',
    color: '#F46800',
  },
  {
    type: 'datadog',
    name: 'Datadog',
    icon: 'bi-graph-up',
    color: '#632CA6',
  },
  {
    type: 'sentry',
    name: 'Sentry',
    icon: 'bi-bug',
    color: '#362D59',
  },
  {
    type: 'pagerduty',
    name: 'PagerDuty',
    icon: 'bi-bell',
    color: '#06AC38',
  },
  {
    type: 'custom',
    nameKey: 'inbound.sources.custom.name',
    icon: 'bi-code-slash',
    color: '#6c757d',
  }
];

function samplePayload(source) {
  return {
    source,
    event_type: 'alert',
    severity: 'high',
    title: 'Example: CPU above 90% for 5 minutes',
    description: 'Free-form alert description, coming from the source tool.',
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
  const { t } = useTranslation();

  const featuresOf = (type) => {
    const list = t(`inbound.sources.${type}.features`, { returnObjects: true });
    return Array.isArray(list) ? list : [];
  };
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
      toast.error(err.response?.data?.error || t('inbound.createTokenError'));
    } finally {
      setCreatingToken(false);
    }
  };

  const handleRevoke = async (tokenId) => {
    if (!window.confirm(t('inbound.confirmRevoke'))) return;
    try {
      await eventAPI.revokeToken(tokenId);
      toast.success(t('inbound.tokenRevoked'));
      loadTokens();
    } catch (err) {
      toast.error(t('inbound.revokeError'));
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
    toast.success(t('inbound.copied'));
  };

  if (tokensForbidden) {
    return (
      <Alert variant="secondary" className="mb-0">
        {t('inbound.adminOnly')}
      </Alert>
    );
  }

  return (
    <>
      <p className="text-muted small mb-3">
        <Trans
          i18nKey="inbound.intro"
          components={{ b: <strong />, i: <em />, path: <code />, header: <code /> }}
        />
      </p>

      <details className="mb-4">
        <summary className="text-primary small" style={{ cursor: 'pointer' }}>
          {t('inbound.seeCurlExample')}
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
            const sourceTokens = tokens.filter(token => token.source === source.type);
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
                        <h5 className="mb-1">{source.nameKey ? t(source.nameKey) : source.name}</h5>
                        {configured ? (
                          <Badge bg="success" className="d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                            <i className="bi bi-check"></i>
                            {t('inbound.activeTokens', { count: sourceTokens.length })}
                          </Badge>
                        ) : (
                          <Badge bg="secondary">{t('integrations.notConfigured')}</Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-muted small mb-3">{t(`inbound.sources.${source.type}.description`)}</p>

                    <div className="mb-3">
                      <small className="text-muted fw-semibold">{t('integrations.features')}</small>
                      <ul className="small mb-0 ps-3">
                        {featuresOf(source.type).slice(0, 3).map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
                    </div>

                    {sourceTokens.length > 0 && (
                      <div className="border-top pt-2 mt-2">
                        {sourceTokens.map(token => (
                          <div key={token._id} className="d-flex align-items-center justify-content-between small mb-1">
                            <div className="text-truncate me-2">
                              <span className="fw-medium">{token.label}</span>{' '}
                              <code className="text-muted">{token.token_preview}</code>
                              {token.auto_create_incident && (
                                <Badge bg="success" className="ms-1">auto ≥ {token.auto_create_severity_threshold}</Badge>
                              )}
                            </div>
                            <OverlayTrigger overlay={<Tooltip>{t('inbound.revoke')}</Tooltip>}>
                              <Button size="sm" variant="outline-danger" onClick={() => handleRevoke(token._id)}>
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
                      {configured ? t('inbound.addAnotherToken') : t('integrations.configure')}
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
          <Modal.Title>{t('inbound.newSourceTitle')}</Modal.Title>
        </Modal.Header>
        {newTokenValue ? (
          <Modal.Body>
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-1"></i>
              {t('inbound.copyTokenNow')}
            </Alert>

            <Form.Label className="small text-muted">
              {t('inbound.readyExample')}
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
              <i className="bi bi-clipboard me-1"></i>{t('inbound.copyCurl')}
            </Button>

            <Form.Label className="small text-muted">{t('inbound.tokenAlone')}</Form.Label>
            <div className="input-group mb-2">
              <Form.Control readOnly value={newTokenValue} />
              <Button variant="outline-secondary" onClick={() => copyToClipboard(newTokenValue)}>
                <i className="bi bi-clipboard"></i>
              </Button>
            </div>

            <Form.Label className="small text-muted">{t('inbound.ingestEndpoint')}</Form.Label>
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
                <Form.Label>{t('inbound.label')}</Form.Label>
                <Form.Control
                  autoFocus
                  required
                  placeholder={t('inbound.labelPlaceholder')}
                  value={tokenForm.label}
                  onChange={(e) => setTokenForm(prev => ({ ...prev, label: e.target.value }))}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>{t('inbound.source')}</Form.Label>
                <Form.Select
                  value={tokenForm.source}
                  onChange={(e) => setTokenForm(prev => ({ ...prev, source: e.target.value }))}
                >
                  {SOURCES.map(source => (
                    <option key={source.type} value={source.type}>{source.nameKey ? t(source.nameKey) : source.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Check
                  type="switch"
                  id="auto-create-switch"
                  label={t('inbound.autoCreate')}
                  checked={tokenForm.auto_create_incident}
                  onChange={(e) => setTokenForm(prev => ({ ...prev, auto_create_incident: e.target.checked }))}
                />
                <Form.Text className="text-muted">
                  {t('inbound.autoCreateHelp')}
                </Form.Text>
              </Form.Group>
              {tokenForm.auto_create_incident && (
                <Form.Group>
                  <Form.Label className="small">{t('inbound.minSeverity')}</Form.Label>
                  <Form.Select
                    value={tokenForm.auto_create_severity_threshold}
                    onChange={(e) => setTokenForm(prev => ({ ...prev, auto_create_severity_threshold: e.target.value }))}
                  >
                    <option value="medium">{t('inbound.sevMedium')}</option>
                    <option value="high">{t('inbound.sevHigh')}</option>
                    <option value="critical">{t('inbound.sevCritical')}</option>
                  </Form.Select>
                </Form.Group>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" onClick={closeTokenModal}>{t('common.cancel')}</Button>
              <Button variant="primary" type="submit" disabled={creatingToken || !tokenForm.label.trim()}>
                {creatingToken ? <Spinner size="sm" animation="border" /> : t('inbound.createToken')}
              </Button>
            </Modal.Footer>
          </Form>
        )}
        {newTokenValue && (
          <Modal.Footer>
            <Button variant="primary" onClick={closeTokenModal}>{t('inbound.done')}</Button>
          </Modal.Footer>
        )}
      </Modal>
    </>
  );
}
