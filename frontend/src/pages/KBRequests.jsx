/**
 * KB Requests Management Page
 * 
 * For senior analysts to:
 * - View pending KB requests
 * - Self-assign requests
 * - Create KBs from requests
 * - Track statistics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Table, Badge, Button, Modal, Form, Spinner, Alert, OverlayTrigger, Tooltip, ListGroup } from 'react-bootstrap';
import { FaBook, FaUser, FaPlus, FaCheck, FaTimes, FaRobot, FaFilter, FaEye, FaLightbulb } from 'react-icons/fa';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

// Urgency configurations
const urgencyConfig = {
    low: { label: 'Baixa', color: 'secondary', priority: 1 },
    normal: { label: 'Normal', color: 'primary', priority: 2 },
    high: { label: 'Alta', color: 'warning', priority: 3 },
    critical: { label: 'Crítica', color: 'danger', priority: 4 }
};

// Status configurations
const statusConfig = {
    pending: { label: 'Pendente', color: 'warning' },
    in_progress: { label: 'Em Progresso', color: 'info' },
    completed: { label: 'Concluído', color: 'success' },
    rejected: { label: 'Rejeitado', color: 'danger' }
};

export default function KBRequests() {
  const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // State
    const [requests, setRequests] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showCreateKBModal, setShowCreateKBModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    
    // Filters
    const [filters, setFilters] = useState({
        status: '',
        urgency: '',
        assigned_to_me: false
    });
    
    // Pagination
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
    });

    // New KB form
    const [newKBForm, setNewKBForm] = useState({
        title: '',
        content_md: '',
        tags: []
    });

    // Load requests
    const loadRequests = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                sort: 'urgency_priority',
                order: 'desc'
            });

            if (filters.status) params.append('status', filters.status);
            if (filters.urgency) params.append('urgency', filters.urgency);
            if (filters.assigned_to_me) params.append('assigned_to_me', 'true');

            const response = await api.get(`/smart-search/kb-requests?${params}`);
            setRequests(response.data.requests || []);
            setStats(response.data.stats || {});
            setPagination(prev => ({
                ...prev,
                ...response.data.pagination
            }));
        } catch (error) {
            console.error('Error loading requests:', error);
            toast.error(t('kbRequests.erroAoCarregarSolicitacoes'));
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, filters]);

    // Load stats - already included in main request
    const loadStats = useCallback(async () => {
        // Stats are now loaded with requests
    }, []);

    useEffect(() => {
        loadRequests();
        loadStats();
    }, [loadRequests, loadStats]);

    // Open detail modal
    const openDetail = (request) => {
        setSelectedRequest(request);
        setShowDetailModal(true);
    };

    // Self-assign request
    const assignToMe = async (requestId) => {
        setActionLoading(true);
        try {
            await api.post(`/smart-search/kb-requests/${requestId}/assign`);
            toast.success(t('kbRequests.solicitacaoAtribuidaAVoce'));
            loadRequests();
            loadStats();
        } catch (error) {
            toast.error(t('kbRequests.erroAoAtribuirSolicitacao'));
        } finally {
            setActionLoading(false);
        }
    };

    // Update status
    const updateStatus = async (requestId, status, notes = '') => {
        setActionLoading(true);
        try {
            await api.put(`/smart-search/kb-requests/${requestId}`, {
                status,
                resolution_notes: notes
            });
            toast.success(t('kbRequests.statusAtualizado'));
            loadRequests();
            loadStats();
            setShowDetailModal(false);
        } catch (error) {
            toast.error(t('kbRequests.erroAoAtualizarStatus'));
        } finally {
            setActionLoading(false);
        }
    };

    // Open Create KB modal
    const openCreateKB = (request) => {
        setSelectedRequest(request);
        setNewKBForm({
            title: request.suggested_title || request.title,
            content_md: `# ${request.suggested_title || request.title}\n\n## Problema\n\n${request.enhanced_description || request.description}\n\n## Solução\n\n<!-- Descreva a solução aqui -->\n\n## Referências\n\n- Solicitação #${request._id}`,
            tags: request.category ? [request.category] : []
        });
        setShowCreateKBModal(true);
    };

    // Create KB from request
    const createKBFromRequest = async () => {
        if (!selectedRequest) return;

        setActionLoading(true);
        try {
            const response = await api.post(`/smart-search/kb-requests/${selectedRequest._id}/create-kb`, {
                title: newKBForm.title,
                content_md: newKBForm.content_md,
                tags: newKBForm.tags
            });

            toast.success(t('kbRequests.kbCriadoComSucesso'));
            setShowCreateKBModal(false);
            loadRequests();
            loadStats();
            
            // Navigate to the new KB
            if (response.data.kb_id) {
                navigate(`/kb/${response.data.kb_id}/edit`);
            }
        } catch (error) {
            toast.error(t('kbRequests.erroAoCriarKb'));
        } finally {
            setActionLoading(false);
        }
    };

    // Render urgency badge
    const renderUrgency = (urgency) => {
        const config = urgencyConfig[urgency] || urgencyConfig.normal;
        return <Badge bg={config.color}>{config.label}</Badge>;
    };

    // Render status badge
    const renderStatus = (status) => {
        const config = statusConfig[status] || statusConfig.pending;
        return <Badge bg={config.color}>{config.label}</Badge>;
    };

    return (
        <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <h2>
                        <FaBook className="me-2" />
                        {t('kbRequests.solicitacoesDeKb')}
                    </h2>
                    <p className="text-muted">
                        {t('kbRequests.gerencieSolicitacoesDeCriacaoDeBas')}
                    </p>
                </Col>
            </Row>

            {/* Stats Cards */}
            {stats && (
                <Row className="mb-4">
                    <Col md={3}>
                        <Card className="text-center">
                            <Card.Body>
                                <h3 className="text-warning">{stats.pending || 0}</h3>
                                <small className="text-muted">{t('kbRequests.pendentes')}</small>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="text-center">
                            <Card.Body>
                                <h3 className="text-info">{stats.in_progress || 0}</h3>
                                <small className="text-muted">{t('kbRequests.emProgresso')}</small>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="text-center">
                            <Card.Body>
                                <h3 className="text-success">{stats.completed || 0}</h3>
                                <small className="text-muted">{t('kbRequests.concluidos')}</small>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="text-center">
                            <Card.Body>
                                <h3>{stats.avg_resolution_hours ? `${Math.round(stats.avg_resolution_hours)}h` : '-'}</h3>
                                <small className="text-muted">{t('kbRequests.tempoMedio')}</small>
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
                                    <option value="">{t('kbRequests.todos')}</option>
                                    {Object.entries(statusConfig).map(([value, config]) => (
                                        <option key={value} value={value}>{config.label}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group>
                                <Form.Label>{t('kbRequests.urgencia')}</Form.Label>
                                <Form.Select
                                    value={filters.urgency}
                                    onChange={e => setFilters(prev => ({ ...prev, urgency: e.target.value }))}
                                >
                                    <option value="">{t('kbRequests.todas')}</option>
                                    {Object.entries(urgencyConfig).map(([value, config]) => (
                                        <option key={value} value={value}>{config.label}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Check
                                type="switch"
                                id="assigned-to-me"
                                label={t('kbRequests.apenasMinhas')}
                                checked={filters.assigned_to_me}
                                onChange={e => setFilters(prev => ({ ...prev, assigned_to_me: e.target.checked }))}
                                className="mt-4"
                            />
                        </Col>
                        <Col md={3} className="text-end">
                            <Button variant="outline-secondary" onClick={() => setFilters({ status: '', urgency: '', assigned_to_me: false })}>
                                <FaTimes className="me-1" /> {t('kbRequests.limparFiltros')}
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Requests Table */}
            <Card>
                <Card.Body>
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" />
                        </div>
                    ) : requests.length === 0 ? (
                        <Alert variant="info" className="text-center">
                            <FaLightbulb className="me-2" />
                            {t('kbRequests.nenhumaSolicitacaoEncontrada')}
                        </Alert>
                    ) : (
                        <Table responsive hover>
                            <thead>
                                <tr>
                                    <th>{t('kbRequests.urgencia')}</th>
                                    <th>{t('common.title')}</th>
                                    <th>{t('kbRequests.solicitante')}</th>
                                    <th>{t('common.status')}</th>
                                    <th>{t('kbRequests.atribuido')}</th>
                                    <th>{t('kbRequests.data')}</th>
                                    <th>{t('reviews.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map(request => (
                                    <tr key={request._id} className={request.urgency === 'critical' ? 'table-danger' : ''}>
                                        <td>{renderUrgency(request.urgency)}</td>
                                        <td>
                                            <div>
                                                <strong>{request.title}</strong>
                                                {request.enhanced_description && (
                                                    <OverlayTrigger overlay={<Tooltip>{t('kbRequests.descricaoAprimoradaPorIa')}</Tooltip>}>
                                                        <Badge bg="info" className="ms-2"><FaRobot /></Badge>
                                                    </OverlayTrigger>
                                                )}
                                            </div>
                                            {request.category && (
                                                <small className="text-muted">{request.category}</small>
                                            )}
                                        </td>
                                        <td>
                                            <FaUser className="me-1 text-muted" />
                                            {request.requester?.name || 'Usuário'}
                                        </td>
                                        <td>{renderStatus(request.status)}</td>
                                        <td>
                                            {request.assigned_to ? (
                                                <span className="text-success">
                                                    <FaCheck className="me-1" />
                                                    {request.assigned_to._id === user?._id ? 'Você' : request.assigned_to.name}
                                                </span>
                                            ) : (
                                                <span className="text-muted">-</span>
                                            )}
                                        </td>
                                        <td>
                                            <small>
                                                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: ptBR })}
                                            </small>
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <Button size="sm" variant="outline-primary" onClick={() => openDetail(request)}>
                                                    <FaEye />
                                                </Button>
                                                {!request.assigned_to && request.status === 'pending' && (
                                                    <Button size="sm" variant="outline-success" onClick={() => assignToMe(request._id)} disabled={actionLoading}>
                                                        <FaUser />
                                                    </Button>
                                                )}
                                                {request.assigned_to?._id === user?._id && request.status === 'in_progress' && (
                                                    <Button size="sm" variant="success" onClick={() => openCreateKB(request)}>
                                                        <FaPlus />
                                                    </Button>
                                                )}
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

            {/* Detail Modal */}
            <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
                {selectedRequest && (
                    <>
                        <Modal.Header closeButton>
                            <Modal.Title>
                                {renderUrgency(selectedRequest.urgency)}
                                <span className="ms-2">{selectedRequest.title}</span>
                            </Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <Row>
                                <Col md={8}>
                                    <h6>{t('kbRequests.descricaoOriginal')}</h6>
                                    <Card className="mb-3">
                                        <Card.Body>{selectedRequest.description}</Card.Body>
                                    </Card>

                                    {selectedRequest.enhanced_description && (
                                        <>
                                            <h6>
                                                <FaRobot className="me-1 text-info" />
                                                {t('kbRequests.descricaoAprimoradaIa')}
                                            </h6>
                                            <Card className="mb-3 border-info">
                                                <Card.Body>{selectedRequest.enhanced_description}</Card.Body>
                                            </Card>
                                        </>
                                    )}

                                    {selectedRequest.related_search_query && (
                                        <Alert variant="secondary">
                                            <strong>{t('kbRequests.buscaRelacionada')}</strong> {selectedRequest.related_search_query}
                                        </Alert>
                                    )}
                                </Col>
                                <Col md={4}>
                                    <ListGroup variant="flush">
                                        <ListGroup.Item>
                                            <strong>{t('kbRequests.status')}</strong> {renderStatus(selectedRequest.status)}
                                        </ListGroup.Item>
                                        <ListGroup.Item>
                                            <strong>{t('kbRequests.solicitante2')}</strong> {selectedRequest.requester?.name || 'N/A'}
                                        </ListGroup.Item>
                                        <ListGroup.Item>
                                            <strong>{t('kbRequests.categoria')}</strong> {selectedRequest.category || 'N/A'}
                                        </ListGroup.Item>
                                        <ListGroup.Item>
                                            <strong>{t('kbRequests.criadoEm')}</strong><br />
                                            {format(new Date(selectedRequest.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </ListGroup.Item>
                                        {selectedRequest.assigned_to && (
                                            <ListGroup.Item>
                                                <strong>{t('kbRequests.atribuidoA')}</strong> {selectedRequest.assigned_to.name}
                                            </ListGroup.Item>
                                        )}
                                        {selectedRequest.created_kb_id && (
                                            <ListGroup.Item className="text-success">
                                                <FaCheck className="me-1" />
                                                <strong>{t('kbRequests.kbCriado')}</strong>
                                            </ListGroup.Item>
                                        )}
                                    </ListGroup>
                                </Col>
                            </Row>
                        </Modal.Body>
                        <Modal.Footer>
                            {selectedRequest.status === 'pending' && !selectedRequest.assigned_to && (
                                <Button variant="success" onClick={() => assignToMe(selectedRequest._id)} disabled={actionLoading}>
                                    <FaUser className="me-1" /> {t('kbRequests.atribuirAMim')}
                                </Button>
                            )}
                            {selectedRequest.assigned_to?._id === user?._id && selectedRequest.status === 'in_progress' && (
                                <>
                                    <Button variant="danger" onClick={() => updateStatus(selectedRequest._id, 'rejected', 'Solicitação não procede')} disabled={actionLoading}>
                                        <FaTimes className="me-1" /> {t('kbRequests.rejeitar')}
                                    </Button>
                                    <Button variant="success" onClick={() => openCreateKB(selectedRequest)} disabled={actionLoading}>
                                        <FaPlus className="me-1" /> {t('kbRequests.criarKb')}
                                    </Button>
                                </>
                            )}
                            <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                                {t('postmortem.close')}
                            </Button>
                        </Modal.Footer>
                    </>
                )}
            </Modal>

            {/* Create KB Modal */}
            <Modal show={showCreateKBModal} onHide={() => setShowCreateKBModal(false)} size="xl">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaPlus className="me-2" />
                        {t('kbRequests.criarKbAPartirDaSolicitacao')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('kbRequests.tituloDoKb')}</Form.Label>
                            <Form.Control
                                type="text"
                                value={newKBForm.title}
                                onChange={e => setNewKBForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>{t('kbRequests.conteudoMarkdown')}</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={15}
                                value={newKBForm.content_md}
                                onChange={e => setNewKBForm(prev => ({ ...prev, content_md: e.target.value }))}
                                style={{ fontFamily: 'monospace' }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>{t('kbRequests.tagsSeparadasPorVirgula')}</Form.Label>
                            <Form.Control
                                type="text"
                                value={newKBForm.tags.join(', ')}
                                onChange={e => setNewKBForm(prev => ({ 
                                    ...prev, 
                                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                                }))}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCreateKBModal(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={createKBFromRequest} disabled={actionLoading}>
                        {actionLoading ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                {t('kbRequests.criando')}
                            </>
                        ) : (
                            <>
                                <FaPlus className="me-1" /> {t('kbRequests.criarKb')}
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}
