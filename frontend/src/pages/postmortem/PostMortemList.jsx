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
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Table, Badge, Button, Modal, Form, Spinner, Alert } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaFileAlt, FaPlus, FaTimes, FaFilter, FaEye, FaTrash, FaLightbulb } from 'react-icons/fa';
import { format } from 'date-fns';
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

export default function PostMortemList() {
  const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

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
        incident_id: null,
        incident_date: new Date().toISOString().split('T')[0],
        severity: 'medium',
        template: 'google_sre',
        affected_services: ''
    });

    // Chegando a partir de "Criar Post-Mortem" num incidente resolvido
    // (ver IncidentView) - pre-preenche e ja abre o modal de criacao.
    useEffect(() => {
        const prefill = location.state?.prefill;
        if (!prefill) return;

        setNewForm(prev => ({
            ...prev,
            title: prefill.title || prev.title,
            severity: prefill.severity || prev.severity,
            affected_services: prefill.affected_services || prev.affected_services,
            incident_id: prefill.incident_id || null
        }));
        setShowCreateModal(true);

        // Limpa o state de navegacao para nao reabrir o modal num refresh/voltar
        navigate(location.pathname, { replace: true, state: {} });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

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
            toast.error(t('postMortemList.erroAoCarregarPostMortems'));
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, filters, t]);

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
            toast.warning(t('postMortemList.informeOTitulo'));
            return;
        }

        try {
            const response = await api.post('/postmortem', {
                ...newForm,
                affected_services: newForm.affected_services.split(',').map(s => s.trim()).filter(Boolean)
            });

            toast.success(t('postMortemList.postMortemCriado'));
            setShowCreateModal(false);
            navigate(`/postmortem/${response.data.postmortem_id}`);
        } catch (error) {
            toast.error(t('postMortemList.erroAoCriarPostMortem'));
        }
    };

    // Delete post-mortem
    const deletePostMortem = async (id) => {
        if (!window.confirm(t('postMortemList.confirmaExclusaoDoPostMortem'))) return;

        try {
            await api.delete(`/postmortem/${id}`);
            toast.success(t('postMortemList.postMortemExcluido'));
            loadPostmortems();
        } catch (error) {
            toast.error(t('postMortemList.erroAoExcluir'));
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
                                {t('postMortemList.postMortems')}
                            </h2>
                            <p className="text-muted mb-0">
                                {t('postMortemList.documentacaoDeIncidentesEAnaliseDe')}
                            </p>
                        </div>
                        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                            <FaPlus className="me-1" /> {t('postMortemList.novoPostMortem')}
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
                                <small className="text-muted">{t('postMortemList.total')}</small>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="text-center h-100">
                            <Card.Body>
                                <h3 className="text-danger">{stats.by_severity?.critical || 0}</h3>
                                <small className="text-muted">{t('postMortemList.criticos')}</small>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="text-center h-100">
                            <Card.Body>
                                <h3>{stats.avg_resolution_minutes ? `${Math.round(stats.avg_resolution_minutes)}min` : '-'}</h3>
                                <small className="text-muted">{t('postMortemList.mttrMedio')}</small>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="text-center h-100">
                            <Card.Body>
                                <h3 className="text-success">{stats.action_items?.completed || 0}</h3>
                                <small className="text-muted">{t('postMortemList.acoesConcluidas')}</small>
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
                                <Form.Label><FaFilter className="me-1" /> {t('common.status')}</Form.Label>
                                <Form.Select
                                    value={filters.status}
                                    onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="">{t('postMortemList.todos')}</option>
                                    {Object.entries(statusConfig).map(([value, config]) => (
                                        <option key={value} value={value}>{config.label}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group>
                                <Form.Label>{t('postMortemList.severidade')}</Form.Label>
                                <Form.Select
                                    value={filters.severity}
                                    onChange={e => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                                >
                                    <option value="">{t('postMortemList.todas')}</option>
                                    {Object.entries(severityConfig).map(([value, config]) => (
                                        <option key={value} value={value}>{config.label}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>{t('postMortemList.buscar')}</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder={t('postMortemList.buscarPorTitulo')}
                                    value={filters.search}
                                    onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={2} className="text-end">
                            <Button variant="outline-secondary" onClick={() => setFilters({ status: '', severity: '', search: '' })}>
                                <FaTimes className="me-1" /> {t('postMortemList.limpar')}
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
                            {t('postMortemList.nenhumPostMortemEncontrado')}
                        </Alert>
                    ) : (
                        <Table responsive hover>
                            <thead>
                                <tr>
                                    <th>{t('postMortemList.severidade')}</th>
                                    <th>{t('common.title')}</th>
                                    <th>{t('postMortemList.dataDoIncidente')}</th>
                                    <th>{t('common.status')}</th>
                                    <th>{t('postMortemList.servicos')}</th>
                                    <th>{t('reviews.actions')}</th>
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
                                {t('search.previous')}
                            </Button>
                            <span className="align-self-center">
                                Página {pagination.page} de {pagination.pages}
                            </span>
                            <Button
                                variant="outline-primary"
                                disabled={pagination.page === pagination.pages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                {t('search.next')}
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
                        {t('postMortemList.novoPostMortem')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('postMortemList.tituloDoIncidente')}</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder={t('postMortemList.exIndisponibilidadeDoServicoDePaga')}
                                value={newForm.title}
                                onChange={e => setNewForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </Form.Group>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>{t('postMortemList.dataDoIncidente')}</Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={newForm.incident_date}
                                        onChange={e => setNewForm(prev => ({ ...prev, incident_date: e.target.value }))}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>{t('postMortemList.severidade')}</Form.Label>
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
                            <Form.Label>{t('postMortemList.template')}</Form.Label>
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
                            <Form.Label>{t('postMortemList.servicosAfetados')}</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder={t('postMortemList.exApiFrontendDatabaseSeparadosPor')}
                                value={newForm.affected_services}
                                onChange={e => setNewForm(prev => ({ ...prev, affected_services: e.target.value }))}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={createPostMortem}>
                        <FaPlus className="me-1" /> {t('postMortemList.criar')}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}
