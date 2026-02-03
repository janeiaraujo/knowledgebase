/**
 * Post-Mortem Management Page
 * 
 * Based on best practices from:
 * - Google SRE
 * - Netflix
 * - AWS
 * 
 * Features:
 * - Create/Edit post-mortems
 * - Timeline builder
 * - 5 Whys analysis
 * - Fishbone diagram
 * - Action items tracking
 * - AI-assisted generation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Modal, Form, Tabs, Tab, Spinner, Alert, ListGroup, ProgressBar, Accordion, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaFileAlt, FaClock, FaUser, FaPlus, FaCheck, FaTimes, FaRobot, FaChartBar, FaFilter, FaExclamationTriangle, FaEye, FaEdit, FaTrash, FaDownload, FaBook, FaLightbulb, FaHistory, FaQuestionCircle, FaChevronRight, FaPlay, FaPause, FaFlag, FaUserCheck } from 'react-icons/fa';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';
import { toast } from 'react-toastify';

// Severity configurations
const severityConfig = {
    critical: { label: 'Crítico', color: 'danger', description: 'Impacto severo em produção' },
    high: { label: 'Alto', color: 'warning', description: 'Impacto significativo' },
    medium: { label: 'Médio', color: 'info', description: 'Impacto moderado' },
    low: { label: 'Baixo', color: 'secondary', description: 'Impacto mínimo' }
};

// Status configurations
const statusConfig = {
    draft: { label: 'Rascunho', color: 'secondary' },
    in_review: { label: 'Em Revisão', color: 'warning' },
    published: { label: 'Publicado', color: 'success' },
    archived: { label: 'Arquivado', color: 'dark' }
};

// Timeline entry types
const timelineTypes = {
    detection: { label: 'Detecção', color: 'danger', icon: FaExclamationTriangle },
    investigation: { label: 'Investigação', color: 'info', icon: FaEye },
    mitigation: { label: 'Mitigação', color: 'warning', icon: FaPlay },
    resolution: { label: 'Resolução', color: 'success', icon: FaCheck },
    event: { label: 'Evento', color: 'secondary', icon: FaClock }
};

export default function PostMortemList() {
    const navigate = useNavigate();
    
    // State
    const [postmortems, setPostmortems] = useState([]);
    const [stats, setStats] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    // Filters
    const [filters, setFilters] = useState({
        status: '',
        severity: '',
        search: ''
    });
    
    // Pagination
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
    });

    // New post-mortem form
    const [newForm, setNewForm] = useState({
        title: '',
        incident_date: new Date().toISOString().split('T')[0],
        severity: 'medium',
        template: 'google_sre',
        affected_services: ''
    });

    // Load post-mortems
    const loadPostmortems = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                sort: 'incident_date',
                order: 'desc'
            });

            if (filters.status) params.append('status', filters.status);
            if (filters.severity) params.append('severity', filters.severity);
            if (filters.search) params.append('search', filters.search);

            const response = await api.get(`/postmortem?${params}`);
            setPostmortems(response.data.postmortems || []);
            setPagination(prev => ({
                ...prev,
                ...response.data.pagination
            }));
        } catch (error) {
            console.error('Error loading post-mortems:', error);
            toast.error('Erro ao carregar post-mortems');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, filters]);

    // Load stats and templates
    const loadMetadata = useCallback(async () => {
        try {
            const [statsRes, templatesRes] = await Promise.all([
                api.get('/postmortem/stats'),
                api.get('/postmortem/templates')
            ]);
            setStats(statsRes.data);
            setTemplates(templatesRes.data.templates || []);
        } catch (error) {
            console.error('Error loading metadata:', error);
        }
    }, []);

    useEffect(() => {
        loadPostmortems();
        loadMetadata();
    }, [loadPostmortems, loadMetadata]);

    // Create new post-mortem
    const createPostMortem = async () => {
        if (!newForm.title.trim()) {
            toast.warning('Informe o título');
            return;
        }

        try {
            const response = await api.post('/postmortem', {
                ...newForm,
                affected_services: newForm.affected_services.split(',').map(s => s.trim()).filter(Boolean)
            });

            toast.success('Post-mortem criado!');
            setShowCreateModal(false);
            navigate(`/postmortem/${response.data.postmortem_id}`);
        } catch (error) {
            toast.error('Erro ao criar post-mortem');
        }
    };

    // Delete post-mortem
    const deletePostMortem = async (id) => {
        if (!window.confirm('Confirma exclusão do post-mortem?')) return;

        try {
            await api.delete(`/postmortem/${id}`);
            toast.success('Post-mortem excluído');
            loadPostmortems();
        } catch (error) {
            toast.error('Erro ao excluir');
        }
    };

    // Render severity badge
    const renderSeverity = (severity) => {
        const config = severityConfig[severity] || severityConfig.medium;
        return <Badge bg={config.color}>{config.label}</Badge>;
    };

    // Render status badge
    const renderStatus = (status) => {
        const config = statusConfig[status] || statusConfig.draft;
        return <Badge bg={config.color}>{config.label}</Badge>;
    };

    return (
        <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <h2>
                                <FaFileAlt className="me-2" />
                                Post-Mortems
                            </h2>
                            <p className="text-muted mb-0">
                                Documentação de incidentes e análise de causa raiz
                            </p>
                        </div>
                        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                            <FaPlus className="me-1" /> Novo Post-Mortem
                        </Button>
                    </div>
                </Col>
            </Row>

            {/* Stats Cards */}
            {stats && (
                <Row className="mb-4">
                    <Col md={3}>
                        <Card className="text-center h-100">
                            <Card.Body>
                                <h3>{stats.total}</h3>
                                <small className="text-muted">Total</small>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="text-center h-100">
                            <Card.Body>
                                <h3 className="text-danger">{stats.by_severity?.critical || 0}</h3>
                                <small className="text-muted">Críticos</small>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="text-center h-100">
                            <Card.Body>
                                <h3>{stats.avg_resolution_minutes ? `${Math.round(stats.avg_resolution_minutes)}min` : '-'}</h3>
                                <small className="text-muted">MTTR Médio</small>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="text-center h-100">
                            <Card.Body>
                                <h3 className="text-success">{stats.action_items?.completed || 0}</h3>
                                <small className="text-muted">Ações Concluídas</small>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Filters */}
            <Card className="mb-4">
                <Card.Body>
                    <Row className="align-items-end">
                        <Col md={3}>
                            <Form.Group>
                                <Form.Label><FaFilter className="me-1" /> Status</Form.Label>
                                <Form.Select
                                    value={filters.status}
                                    onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="">Todos</option>
                                    {Object.entries(statusConfig).map(([value, config]) => (
                                        <option key={value} value={value}>{config.label}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group>
                                <Form.Label>Severidade</Form.Label>
                                <Form.Select
                                    value={filters.severity}
                                    onChange={e => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                                >
                                    <option value="">Todas</option>
                                    {Object.entries(severityConfig).map(([value, config]) => (
                                        <option key={value} value={value}>{config.label}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Buscar</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Buscar por título..."
                                    value={filters.search}
                                    onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={2} className="text-end">
                            <Button variant="outline-secondary" onClick={() => setFilters({ status: '', severity: '', search: '' })}>
                                <FaTimes className="me-1" /> Limpar
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Post-mortems Table */}
            <Card>
                <Card.Body>
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" />
                        </div>
                    ) : postmortems.length === 0 ? (
                        <Alert variant="info" className="text-center">
                            <FaLightbulb className="me-2" />
                            Nenhum post-mortem encontrado
                        </Alert>
                    ) : (
                        <Table responsive hover>
                            <thead>
                                <tr>
                                    <th>Severidade</th>
                                    <th>Título</th>
                                    <th>Data do Incidente</th>
                                    <th>Status</th>
                                    <th>Serviços</th>
                                    <th>Ações</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {postmortems.map(pm => (
                                    <tr key={pm._id}>
                                        <td>{renderSeverity(pm.severity)}</td>
                                        <td>
                                            <Link to={`/postmortem/${pm._id}`} className="text-decoration-none">
                                                <strong>{pm.title}</strong>
                                            </Link>
                                        </td>
                                        <td>
                                            {format(new Date(pm.incident_date), 'dd/MM/yyyy', { locale: ptBR })}
                                        </td>
                                        <td>{renderStatus(pm.status)}</td>
                                        <td>
                                            {pm.affected_services?.slice(0, 2).map((service, i) => (
                                                <Badge key={i} bg="light" text="dark" className="me-1">
                                                    {service}
                                                </Badge>
                                            ))}
                                            {pm.affected_services?.length > 2 && (
                                                <Badge bg="light" text="dark">+{pm.affected_services.length - 2}</Badge>
                                            )}
                                        </td>
                                        <td>
                                            <Badge bg="secondary">
                                                {pm.action_items?.length || 0} itens
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline-primary"
                                                    as={Link}
                                                    to={`/postmortem/${pm._id}`}
                                                >
                                                    <FaEye />
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="outline-danger"
                                                    onClick={() => deletePostMortem(pm._id)}
                                                >
                                                    <FaTrash />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="d-flex justify-content-center gap-2 mt-3">
                            <Button
                                variant="outline-primary"
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            >
                                Anterior
                            </Button>
                            <span className="align-self-center">
                                Página {pagination.page} de {pagination.pages}
                            </span>
                            <Button
                                variant="outline-primary"
                                disabled={pagination.page === pagination.pages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                Próxima
                            </Button>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Create Modal */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaPlus className="me-2" />
                        Novo Post-Mortem
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Título do Incidente *</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Ex: Indisponibilidade do serviço de pagamentos"
                                value={newForm.title}
                                onChange={e => setNewForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </Form.Group>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Data do Incidente</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={newForm.incident_date}
                                        onChange={e => setNewForm(prev => ({ ...prev, incident_date: e.target.value }))}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Severidade</Form.Label>
                                    <Form.Select
                                        value={newForm.severity}
                                        onChange={e => setNewForm(prev => ({ ...prev, severity: e.target.value }))}
                                    >
                                        {Object.entries(severityConfig).map(([value, config]) => (
                                            <option key={value} value={value}>
                                                {config.label} - {config.description}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group className="mb-3">
                            <Form.Label>Template</Form.Label>
                            <div className="d-flex flex-wrap gap-2">
                                {templates.map(template => (
                                    <Card 
                                        key={template.id}
                                        className={`cursor-pointer ${newForm.template === template.id ? 'border-primary' : ''}`}
                                        style={{ width: '200px', cursor: 'pointer' }}
                                        onClick={() => setNewForm(prev => ({ ...prev, template: template.id }))}
                                    >
                                        <Card.Body className="p-2">
                                            <strong>{template.name}</strong>
                                            <p className="small text-muted mb-0">{template.description}</p>
                                        </Card.Body>
                                    </Card>
                                ))}
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Serviços Afetados</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Ex: API, Frontend, Database (separados por vírgula)"
                                value={newForm.affected_services}
                                onChange={e => setNewForm(prev => ({ ...prev, affected_services: e.target.value }))}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={createPostMortem}>
                        <FaPlus className="me-1" /> Criar
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}
