/**
 * Integrations Page
 * 
 * Configure integrations with:
 * - Slack
 * - Microsoft Teams
 * - Jira
 * - PagerDuty
 * - And more
 */

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Modal, Badge, Alert, Spinner, Tab, Tabs, ListGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaSlack, FaMicrosoft, FaJira, FaEnvelope, FaBell, FaPlug, FaCheck, FaTimes, FaCog, FaExternalLinkAlt, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../services/api';

// Integration icons mapping
const integrationIcons = {
    slack: { icon: FaSlack, color: '#4A154B' },
    teams: { icon: FaMicrosoft, color: '#6264A7' },
    email: { icon: FaEnvelope, color: '#0d6efd' },
    jira: { icon: FaJira, color: '#0052CC' },
    pagerduty: { icon: FaBell, color: '#06AC38' },
    datadog: { icon: FaPlug, color: '#632CA6' }
};

export default function Integrations() {
    const [integrations, setIntegrations] = useState([]);
    const [notificationSettings, setNotificationSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [selectedIntegration, setSelectedIntegration] = useState(null);
    const [configForm, setConfigForm] = useState({});
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [integrationsRes, settingsRes] = await Promise.all([
                api.get('/integrations'),
                api.get('/integrations/notifications/settings')
            ]);
            
            setIntegrations(integrationsRes.data.integrations || []);
            setNotificationSettings(settingsRes.data.settings);
        } catch (error) {
            console.error('Error loading integrations:', error);
            toast.error('Erro ao carregar integrações');
        } finally {
            setLoading(false);
        }
    };

    const openConfigModal = (integration) => {
        setSelectedIntegration(integration);
        setConfigForm(integration.config?.raw_config || getDefaultConfig(integration.type));
        setShowConfigModal(true);
    };

    const getDefaultConfig = (type) => {
        switch (type) {
            case 'slack':
                return { webhook_url: '', channel: '#general' };
            case 'teams':
                return { webhook_url: '' };
            case 'email':
                return { smtp_host: '', smtp_port: 587, smtp_user: '', smtp_pass: '', from_email: '' };
            case 'jira':
                return { base_url: '', email: '', api_token: '', project_key: '' };
            case 'pagerduty':
                return { api_key: '', service_id: '' };
            case 'datadog':
                return { api_key: '', app_key: '', site: 'datadoghq.com' };
            default:
                return {};
        }
    };

    const testConnection = async () => {
        if (!selectedIntegration) return;
        
        setTesting(true);
        try {
            await api.post(`/integrations/${selectedIntegration.type}/test`, configForm);
            toast.success('Conexão estabelecida com sucesso!');
        } catch (error) {
            toast.error(error.response?.data?.details || 'Falha na conexão');
        } finally {
            setTesting(false);
        }
    };

    const saveConfiguration = async () => {
        if (!selectedIntegration) return;
        
        setSaving(true);
        try {
            await api.post(`/integrations/${selectedIntegration.type}`, configForm);
            toast.success('Integração configurada com sucesso!');
            setShowConfigModal(false);
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Erro ao salvar configuração');
        } finally {
            setSaving(false);
        }
    };

    const deleteIntegration = async (type) => {
        if (!window.confirm('Remover esta integração?')) return;
        
        try {
            await api.delete(`/integrations/${type}`);
            toast.success('Integração removida');
            loadData();
        } catch (error) {
            toast.error('Erro ao remover integração');
        }
    };

    const toggleIntegration = async (integration) => {
        try {
            await api.put(`/integrations/${integration.type}`, {
                enabled: !integration.config?.enabled
            });
            toast.success(integration.config?.enabled ? 'Integração desativada' : 'Integração ativada');
            loadData();
        } catch (error) {
            toast.error('Erro ao atualizar integração');
        }
    };

    const sendTestNotification = async (type) => {
        try {
            await api.post('/integrations/notifications/test', { type });
            toast.success('Notificação de teste enviada!');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Erro ao enviar notificação');
        }
    };

    const updateNotificationSetting = async (event, channel, value) => {
        try {
            const newSettings = {
                ...notificationSettings,
                [event]: {
                    ...notificationSettings[event],
                    [channel]: value
                }
            };
            
            await api.put('/integrations/notifications/settings', newSettings);
            setNotificationSettings(newSettings);
        } catch (error) {
            toast.error('Erro ao atualizar configuração');
        }
    };

    const renderConfigForm = () => {
        if (!selectedIntegration) return null;

        switch (selectedIntegration.type) {
            case 'slack':
                return (
                    <>
                        <Form.Group className="mb-3">
                            <Form.Label>Webhook URL *</Form.Label>
                            <Form.Control
                                type="url"
                                value={configForm.webhook_url || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, webhook_url: e.target.value }))}
                                placeholder="https://hooks.slack.com/services/..."
                            />
                            <Form.Text className="text-muted">
                                <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer">
                                    Como criar um webhook <FaExternalLinkAlt size={10} />
                                </a>
                            </Form.Text>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Canal Padrão</Form.Label>
                            <Form.Control
                                type="text"
                                value={configForm.channel || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, channel: e.target.value }))}
                                placeholder="#general"
                            />
                        </Form.Group>
                    </>
                );

            case 'teams':
                return (
                    <Form.Group className="mb-3">
                        <Form.Label>Webhook URL *</Form.Label>
                        <Form.Control
                            type="url"
                            value={configForm.webhook_url || ''}
                            onChange={(e) => setConfigForm(prev => ({ ...prev, webhook_url: e.target.value }))}
                            placeholder="https://outlook.office.com/webhook/..."
                        />
                        <Form.Text className="text-muted">
                            <a href="https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook" target="_blank" rel="noopener noreferrer">
                                Como criar um webhook <FaExternalLinkAlt size={10} />
                            </a>
                        </Form.Text>
                    </Form.Group>
                );

            case 'email':
                return (
                    <>
                        <Row>
                            <Col md={8}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Servidor SMTP *</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={configForm.smtp_host || ''}
                                        onChange={(e) => setConfigForm(prev => ({ ...prev, smtp_host: e.target.value }))}
                                        placeholder="smtp.gmail.com"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Porta *</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={configForm.smtp_port || 587}
                                        onChange={(e) => setConfigForm(prev => ({ ...prev, smtp_port: parseInt(e.target.value) }))}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label>Usuário</Form.Label>
                            <Form.Control
                                type="text"
                                value={configForm.smtp_user || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, smtp_user: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Senha</Form.Label>
                            <Form.Control
                                type="password"
                                value={configForm.smtp_pass || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, smtp_pass: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Email Remetente *</Form.Label>
                            <Form.Control
                                type="email"
                                value={configForm.from_email || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, from_email: e.target.value }))}
                                placeholder="noreply@empresa.com"
                            />
                        </Form.Group>
                    </>
                );

            case 'jira':
                return (
                    <>
                        <Form.Group className="mb-3">
                            <Form.Label>URL do Jira *</Form.Label>
                            <Form.Control
                                type="url"
                                value={configForm.base_url || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, base_url: e.target.value }))}
                                placeholder="https://empresa.atlassian.net"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Email *</Form.Label>
                            <Form.Control
                                type="email"
                                value={configForm.email || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, email: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>API Token *</Form.Label>
                            <Form.Control
                                type="password"
                                value={configForm.api_token || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, api_token: e.target.value }))}
                            />
                            <Form.Text className="text-muted">
                                <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">
                                    Criar API Token <FaExternalLinkAlt size={10} />
                                </a>
                            </Form.Text>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Projeto Padrão</Form.Label>
                            <Form.Control
                                type="text"
                                value={configForm.project_key || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, project_key: e.target.value }))}
                                placeholder="KB"
                            />
                        </Form.Group>
                    </>
                );

            case 'pagerduty':
                return (
                    <>
                        <Form.Group className="mb-3">
                            <Form.Label>API Key *</Form.Label>
                            <Form.Control
                                type="password"
                                value={configForm.api_key || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, api_key: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Service ID</Form.Label>
                            <Form.Control
                                type="text"
                                value={configForm.service_id || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, service_id: e.target.value }))}
                            />
                        </Form.Group>
                    </>
                );

            case 'datadog':
                return (
                    <>
                        <Form.Group className="mb-3">
                            <Form.Label>API Key *</Form.Label>
                            <Form.Control
                                type="password"
                                value={configForm.api_key || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, api_key: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Application Key *</Form.Label>
                            <Form.Control
                                type="password"
                                value={configForm.app_key || ''}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, app_key: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Site</Form.Label>
                            <Form.Select
                                value={configForm.site || 'datadoghq.com'}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, site: e.target.value }))}
                            >
                                <option value="datadoghq.com">US (datadoghq.com)</option>
                                <option value="datadoghq.eu">EU (datadoghq.eu)</option>
                                <option value="us3.datadoghq.com">US3 (us3.datadoghq.com)</option>
                                <option value="us5.datadoghq.com">US5 (us5.datadoghq.com)</option>
                            </Form.Select>
                        </Form.Group>
                    </>
                );

            default:
                return <p>Configuração não disponível</p>;
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2">Carregando integrações...</p>
            </div>
        );
    }

    return (
        <Container fluid>
            <Row className="mb-4">
                <Col>
                    <h2 className="mb-1">
                        <i className="bi bi-plug me-2"></i>
                        Integrações
                    </h2>
                    <p className="text-muted">Conecte com suas ferramentas favoritas</p>
                </Col>
            </Row>

            <Tabs defaultActiveKey="integrations" className="mb-4">
                <Tab eventKey="integrations" title={<span><FaPlug className="me-2" />Integrações</span>}>
                    <Row xs={1} md={2} lg={3} className="g-4">
                        {integrations.map(integration => {
                            const IconComponent = integrationIcons[integration.type]?.icon || FaPlug;
                            const iconColor = integrationIcons[integration.type]?.color || '#6c757d';
                            
                            return (
                                <Col key={integration.type}>
                                    <Card className={`h-100 shadow-sm border-0 ${integration.configured ? 'border-start border-success border-4' : ''}`}>
                                        <Card.Body>
                                            <div className="d-flex align-items-start mb-3">
                                                <div 
                                                    className="p-3 rounded me-3"
                                                    style={{ backgroundColor: `${iconColor}15` }}
                                                >
                                                    <IconComponent size={24} style={{ color: iconColor }} />
                                                </div>
                                                <div className="flex-grow-1">
                                                    <h5 className="mb-1">{integration.name}</h5>
                                                    {integration.configured ? (
                                                        <Badge bg="success" className="d-flex align-items-center gap-1" style={{ width: 'fit-content' }}>
                                                            <FaCheck size={10} /> Configurado
                                                        </Badge>
                                                    ) : (
                                                        <Badge bg="secondary">Não configurado</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <p className="text-muted small mb-3">{integration.description}</p>
                                            
                                            <div className="mb-3">
                                                <small className="text-muted fw-semibold">Recursos:</small>
                                                <ul className="small mb-0 ps-3">
                                                    {integration.features?.slice(0, 3).map((feature, idx) => (
                                                        <li key={idx}>{feature}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </Card.Body>
                                        <Card.Footer className="bg-white border-0 pt-0">
                                            <div className="d-flex gap-2">
                                                <Button 
                                                    variant={integration.configured ? 'outline-primary' : 'primary'}
                                                    size="sm"
                                                    className="flex-grow-1"
                                                    onClick={() => openConfigModal(integration)}
                                                >
                                                    <FaCog className="me-1" />
                                                    {integration.configured ? 'Editar' : 'Configurar'}
                                                </Button>
                                                
                                                {integration.configured && (
                                                    <>
                                                        <OverlayTrigger
                                                            overlay={<Tooltip>Enviar teste</Tooltip>}
                                                        >
                                                            <Button
                                                                variant="outline-success"
                                                                size="sm"
                                                                onClick={() => sendTestNotification(integration.type)}
                                                            >
                                                                <FaBell />
                                                            </Button>
                                                        </OverlayTrigger>
                                                        <OverlayTrigger
                                                            overlay={<Tooltip>Remover</Tooltip>}
                                                        >
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                onClick={() => deleteIntegration(integration.type)}
                                                            >
                                                                <FaTrash />
                                                            </Button>
                                                        </OverlayTrigger>
                                                    </>
                                                )}
                                            </div>
                                        </Card.Footer>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>
                </Tab>

                <Tab eventKey="notifications" title={<span><FaBell className="me-2" />Notificações</span>}>
                    {notificationSettings && (
                        <Card className="shadow-sm border-0">
                            <Card.Header className="bg-white">
                                <h5 className="mb-0">Configurações de Notificação</h5>
                                <small className="text-muted">
                                    Escolha quais eventos disparam notificações em cada canal
                                </small>
                            </Card.Header>
                            <Card.Body>
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle">
                                        <thead>
                                            <tr>
                                                <th>Evento</th>
                                                <th className="text-center" style={{ width: 100 }}>
                                                    <FaSlack className="me-1" /> Slack
                                                </th>
                                                <th className="text-center" style={{ width: 100 }}>
                                                    <FaMicrosoft className="me-1" /> Teams
                                                </th>
                                                <th className="text-center" style={{ width: 100 }}>
                                                    <FaEnvelope className="me-1" /> Email
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { key: 'kb_created', label: 'Novo KB criado' },
                                                { key: 'kb_published', label: 'KB publicado' },
                                                { key: 'kb_updated', label: 'KB atualizado' },
                                                { key: 'incident_created', label: 'Novo incidente' },
                                                { key: 'incident_resolved', label: 'Incidente resolvido' },
                                                { key: 'review_needed', label: 'Revisão necessária' },
                                                { key: 'daily_digest', label: 'Resumo diário' },
                                                { key: 'weekly_digest', label: 'Resumo semanal' }
                                            ].map(event => (
                                                <tr key={event.key}>
                                                    <td>{event.label}</td>
                                                    {['slack', 'teams', 'email'].map(channel => (
                                                        <td key={channel} className="text-center">
                                                            <Form.Check
                                                                type="switch"
                                                                checked={notificationSettings[event.key]?.[channel] || false}
                                                                onChange={(e) => updateNotificationSetting(
                                                                    event.key, 
                                                                    channel, 
                                                                    e.target.checked
                                                                )}
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card.Body>
                        </Card>
                    )}
                </Tab>
            </Tabs>

            {/* Configuration Modal */}
            <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        {selectedIntegration && (
                            <>
                                {React.createElement(
                                    integrationIcons[selectedIntegration.type]?.icon || FaPlug,
                                    { 
                                        className: 'me-2',
                                        style: { color: integrationIcons[selectedIntegration.type]?.color }
                                    }
                                )}
                                Configurar {selectedIntegration.name}
                            </>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedIntegration && (
                        <>
                            <Alert variant="info" className="mb-4">
                                <i className="bi bi-info-circle me-2"></i>
                                {selectedIntegration.description}
                                {selectedIntegration.setup_url && (
                                    <div className="mt-2">
                                        <a 
                                            href={selectedIntegration.setup_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="btn btn-sm btn-outline-primary"
                                        >
                                            Documentação <FaExternalLinkAlt className="ms-1" size={10} />
                                        </a>
                                    </div>
                                )}
                            </Alert>
                            
                            <Form>
                                {renderConfigForm()}
                            </Form>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={testConnection} disabled={testing}>
                        {testing ? (
                            <><Spinner size="sm" className="me-2" />Testando...</>
                        ) : (
                            <><FaCheck className="me-2" />Testar Conexão</>
                        )}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowConfigModal(false)}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={saveConfiguration} disabled={saving}>
                        {saving ? (
                            <><Spinner size="sm" className="me-2" />Salvando...</>
                        ) : (
                            'Salvar Configuração'
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}
