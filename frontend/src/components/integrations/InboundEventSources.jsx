import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Badge, Button, Modal, Form, Spinner, Alert } from 'react-bootstrap';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { eventAPI } from '../../services/api';

const SOURCE_LABELS = {
  zabbix: 'Zabbix',
  grafana: 'Grafana',
  datadog: 'Datadog',
  sentry: 'Sentry',
  custom: 'Customizado'
};

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
      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span><i className="bi bi-hdd-network me-2"></i>Fontes de Eventos</span>
          <Button size="sm" variant="primary" onClick={() => setShowTokenModal(true)}>
            <i className="bi bi-plus-lg me-1"></i>Novo token
          </Button>
        </Card.Header>
        <Card.Body>
          <p className="text-muted small mb-3">
            Integrações de <strong>entrada</strong>: ferramentas de monitoramento (Zabbix, Grafana, Datadog, Sentry
            ou outra) enviam eventos <em>para dentro</em> desta plataforma via <code>POST /api/events/ingest</code>,
            autenticando com um token próprio no header <code>x-api-token</code>. Um token pode, opcionalmente, abrir
            incidentes automaticamente quando a severidade do alerta atingir um piso configurado.
          </p>

          <details className="mb-3">
            <summary className="text-primary small" style={{ cursor: 'pointer' }}>
              Ver exemplo de requisição (curl)
            </summary>
            <pre className="bg-body-secondary p-2 rounded small mt-2" style={{ whiteSpace: 'pre-wrap' }}>
              {sampleCurl('zabbix')}
            </pre>
          </details>

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
