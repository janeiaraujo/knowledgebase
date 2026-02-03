/**
 * Post-Mortem Editor Page
 * 
 * Full post-mortem editing with:
 * - Timeline builder
 * - 5 Whys analysis
 * - Fishbone diagram
 * - Action items
 * - AI generation
 * - Export options
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Badge, Button, Modal, Form, Tabs, Tab, Spinner, Alert, ListGroup, ProgressBar, Accordion, OverlayTrigger, Tooltip, Table } from 'react-bootstrap';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaFileAlt, FaClock, FaUser, FaPlus, FaCheck, FaTimes, FaRobot, FaSave, FaDownload, FaBook, FaLightbulb, FaHistory, FaQuestionCircle, FaTrash, FaEdit, FaArrowLeft, FaPlay, FaProjectDiagram, FaExclamationTriangle, FaChevronDown, FaChevronUp, FaShare, FaEye } from 'react-icons/fa';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';
import { toast } from 'react-toastify';

// Severity configurations
const severityConfig = {
    critical: { label: 'Crítico', color: 'danger' },
    high: { label: 'Alto', color: 'warning' },
    medium: { label: 'Médio', color: 'info' },
    low: { label: 'Baixo', color: 'secondary' }
};

// Timeline entry types
const timelineTypes = [
    { value: 'detection', label: 'Detecção', color: 'danger' },
    { value: 'investigation', label: 'Investigação', color: 'info' },
    { value: 'mitigation', label: 'Mitigação', color: 'warning' },
    { value: 'resolution', label: 'Resolução', color: 'success' },
    { value: 'event', label: 'Evento', color: 'secondary' }
];

// Action item priorities
const priorityConfig = {
    critical: { label: 'Crítica', color: 'danger' },
    high: { label: 'Alta', color: 'warning' },
    medium: { label: 'Média', color: 'info' },
    low: { label: 'Baixa', color: 'secondary' }
};

// Action item categories
const categoryConfig = {
    preventive: { label: 'Preventiva', color: 'success', description: 'Evitar recorrência' },
    detective: { label: 'Detectiva', color: 'info', description: 'Melhorar detecção' },
    corrective: { label: 'Corretiva', color: 'warning', description: 'Corrigir problema' }
};

export default function PostMortemEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    // State
    const [postmortem, setPostmortem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [hasChanges, setHasChanges] = useState(false);
    
    // Modals
    const [showTimelineModal, setShowTimelineModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showRCAModal, setShowRCAModal] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    
    // Forms
    const [timelineForm, setTimelineForm] = useState({
        timestamp: '',
        description: '',
        type: 'event',
        actor: ''
    });
    
    const [actionForm, setActionForm] = useState({
        title: '',
        description: '',
        priority: 'medium',
        category: 'preventive',
        due_date: ''
    });
    
    const [rcaForm, setRcaForm] = useState({
        method: 'five_whys',
        initial_problem: ''
    });

    // AI Generation state
    const [generating, setGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);

    // Load post-mortem
    const loadPostmortem = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(`/postmortem/${id}`);
            setPostmortem(response.data.postMortem);
        } catch (error) {
            console.error('Error loading post-mortem:', error);
            toast.error('Erro ao carregar post-mortem');
            navigate('/postmortem');
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        loadPostmortem();
    }, [loadPostmortem]);

    // Auto-save on changes
    useEffect(() => {
        if (!hasChanges || !postmortem) return;
        
        const timer = setTimeout(() => {
            savePostmortem(true);
        }, 3000);

        return () => clearTimeout(timer);
    }, [hasChanges, postmortem]);

    // Save post-mortem
    const savePostmortem = async (silent = false) => {
        if (!postmortem) return;
        
        setSaving(true);
        try {
            await api.put(`/postmortem/${id}`, postmortem);
            setHasChanges(false);
            if (!silent) toast.success('Salvo com sucesso!');
        } catch (error) {
            toast.error('Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    // Update field
    const updateField = (field, value) => {
        setPostmortem(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    // Update nested field
    const updateNestedField = (parent, field, value) => {
        setPostmortem(prev => ({
            ...prev,
            [parent]: { ...prev[parent], [field]: value }
        }));
        setHasChanges(true);
    };

    // Update section content
    const updateSection = (sectionKey, content) => {
        setPostmortem(prev => ({
            ...prev,
            sections: {
                ...prev.sections,
                [sectionKey]: { ...prev.sections[sectionKey], content }
            }
        }));
        setHasChanges(true);
    };

    // Add timeline entry
    const addTimelineEntry = async () => {
        if (!timelineForm.timestamp || !timelineForm.description) {
            toast.warning('Preencha data/hora e descrição');
            return;
        }

        try {
            await api.post(`/postmortem/${id}/timeline`, timelineForm);
            toast.success('Entrada adicionada!');
            setShowTimelineModal(false);
            setTimelineForm({ timestamp: '', description: '', type: 'event', actor: '' });
            loadPostmortem();
        } catch (error) {
            toast.error('Erro ao adicionar entrada');
        }
    };

    // Remove timeline entry
    const removeTimelineEntry = async (entryId) => {
        if (!window.confirm('Remover esta entrada?')) return;
        
        try {
            await api.delete(`/postmortem/${id}/timeline/${entryId}`);
            loadPostmortem();
        } catch (error) {
            toast.error('Erro ao remover');
        }
    };

    // Add action item
    const addActionItem = async () => {
        if (!actionForm.title) {
            toast.warning('Informe o título da ação');
            return;
        }

        try {
            await api.post(`/postmortem/${id}/action-items`, actionForm);
            toast.success('Ação adicionada!');
            setShowActionModal(false);
            setActionForm({ title: '', description: '', priority: 'medium', category: 'preventive', due_date: '' });
            loadPostmortem();
        } catch (error) {
            toast.error('Erro ao adicionar ação');
        }
    };

    // Update action item status
    const updateActionStatus = async (itemId, status) => {
        try {
            await api.put(`/postmortem/${id}/action-items/${itemId}`, { status });
            loadPostmortem();
        } catch (error) {
            toast.error('Erro ao atualizar');
        }
    };

    // Run 5 Whys analysis
    const runFiveWhys = async () => {
        if (!rcaForm.initial_problem) {
            toast.warning('Descreva o problema inicial');
            return;
        }

        setGenerating(true);
        try {
            const response = await api.post(`/postmortem/${id}/rca/five-whys`, {
                initial_problem: rcaForm.initial_problem
            });
            
            toast.success('Análise 5 Porquês gerada!');
            setShowRCAModal(false);
            loadPostmortem();
        } catch (error) {
            toast.error('Erro na análise');
        } finally {
            setGenerating(false);
        }
    };

    // Run Fishbone analysis
    const runFishbone = async () => {
        if (!rcaForm.initial_problem) {
            toast.warning('Descreva o problema');
            return;
        }

        setGenerating(true);
        try {
            const response = await api.post(`/postmortem/${id}/rca/fishbone`, {
                problem_statement: rcaForm.initial_problem
            });
            
            toast.success('Diagrama de Ishikawa gerado!');
            setShowRCAModal(false);
            loadPostmortem();
        } catch (error) {
            toast.error('Erro na análise');
        } finally {
            setGenerating(false);
        }
    };

    // Generate content with AI
    const generateWithAI = async (type) => {
        setGenerating(true);
        try {
            let response;
            
            if (type === 'summary') {
                response = await api.post(`/postmortem/${id}/generate`, { sections_to_generate: 'summary' });
                if (response.data.generated?.executive_summary) {
                    updateField('executive_summary', response.data.generated.executive_summary);
                }
            } else if (type === 'actions') {
                response = await api.post(`/postmortem/${id}/generate-actions`);
                setGeneratedContent({ type: 'actions', data: response.data.suggested_actions });
                setShowGenerateModal(true);
            } else if (type === 'all') {
                response = await api.post(`/postmortem/${id}/generate`, { sections_to_generate: 'all' });
                setGeneratedContent({ type: 'all', data: response.data.generated });
                setShowGenerateModal(true);
            }
            
            toast.success('Conteúdo gerado!');
        } catch (error) {
            toast.error('Erro ao gerar conteúdo');
        } finally {
            setGenerating(false);
        }
    };

    // Publish post-mortem
    const publishPostmortem = async () => {
        if (!window.confirm('Publicar este post-mortem?')) return;

        try {
            await api.post(`/postmortem/${id}/publish`);
            toast.success('Publicado!');
            loadPostmortem();
        } catch (error) {
            toast.error('Erro ao publicar');
        }
    };

    // Export to Markdown
    const exportMarkdown = async () => {
        try {
            const response = await api.get(`/postmortem/${id}/export/markdown`, {
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `postmortem-${id}.md`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error('Erro ao exportar');
        }
    };

    // Create KB from post-mortem
    const createKB = async () => {
        if (!window.confirm('Criar KB a partir deste post-mortem?')) return;

        try {
            const response = await api.post(`/postmortem/${id}/create-kb`);
            toast.success('KB criado!');
            navigate(`/kb/${response.data.kb_id}/edit`);
        } catch (error) {
            toast.error('Erro ao criar KB');
        }
    };

    if (loading) {
        return (
            <Container className="py-5 text-center">
                <Spinner animation="border" />
            </Container>
        );
    }

    if (!postmortem) {
        return (
            <Container className="py-5">
                <Alert variant="danger">Post-mortem não encontrado</Alert>
            </Container>
        );
    }

    return (
        <Container fluid className="py-4">
            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <div className="d-flex justify-content-between align-items-start">
                        <div>
                            <Button variant="link" className="p-0 mb-2" onClick={() => navigate('/postmortem')}>
                                <FaArrowLeft className="me-1" /> Voltar
                            </Button>
                            <h2 className="mb-1">
                                <Badge bg={severityConfig[postmortem.severity]?.color} className="me-2">
                                    {severityConfig[postmortem.severity]?.label}
                                </Badge>
                                {postmortem.title}
                            </h2>
                            <div className="text-muted">
                                <FaClock className="me-1" />
                                {format(new Date(postmortem.incident_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                {' • '}
                                <Badge bg={postmortem.status === 'published' ? 'success' : 'secondary'}>
                                    {postmortem.status === 'draft' ? 'Rascunho' : postmortem.status === 'published' ? 'Publicado' : postmortem.status}
                                </Badge>
                            </div>
                        </div>
                        <div className="d-flex gap-2">
                            {hasChanges && (
                                <Badge bg="warning" className="align-self-center">Alterações não salvas</Badge>
                            )}
                            <Button variant="outline-secondary" onClick={exportMarkdown}>
                                <FaDownload className="me-1" /> Exportar
                            </Button>
                            <Button variant="outline-primary" onClick={createKB}>
                                <FaBook className="me-1" /> Criar KB
                            </Button>
                            {postmortem.status === 'draft' && (
                                <Button variant="success" onClick={publishPostmortem}>
                                    <FaShare className="me-1" /> Publicar
                                </Button>
                            )}
                            <Button variant="primary" onClick={() => savePostmortem(false)} disabled={saving}>
                                {saving ? <Spinner animation="border" size="sm" /> : <FaSave className="me-1" />}
                                Salvar
                            </Button>
                        </div>
                    </div>
                </Col>
            </Row>

            {/* Main Content Tabs */}
            <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
                <Tab eventKey="overview" title="Visão Geral">
                    <Row>
                        <Col lg={8}>
                            {/* Executive Summary */}
                            <Card className="mb-4">
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <span>Resumo Executivo</span>
                                    <Button 
                                        size="sm" 
                                        variant="outline-primary"
                                        onClick={() => generateWithAI('summary')}
                                        disabled={generating}
                                    >
                                        <FaRobot className="me-1" /> Gerar com IA
                                    </Button>
                                </Card.Header>
                                <Card.Body>
                                    <Form.Control
                                        as="textarea"
                                        rows={6}
                                        placeholder="Descreva o incidente, impacto e resolução..."
                                        value={postmortem.executive_summary || ''}
                                        onChange={e => updateField('executive_summary', e.target.value)}
                                    />
                                </Card.Body>
                            </Card>

                            {/* Sections */}
                            {postmortem.sections && (
                                <Accordion defaultActiveKey="0" className="mb-4">
                                    {Object.entries(postmortem.sections)
                                        .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
                                        .map(([key, section], index) => (
                                            <Accordion.Item key={key} eventKey={String(index)}>
                                                <Accordion.Header>{section.title}</Accordion.Header>
                                                <Accordion.Body>
                                                    <Form.Control
                                                        as="textarea"
                                                        rows={4}
                                                        placeholder={`Conteúdo para ${section.title}...`}
                                                        value={section.content || ''}
                                                        onChange={e => updateSection(key, e.target.value)}
                                                    />
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        ))}
                                </Accordion>
                            )}
                        </Col>

                        <Col lg={4}>
                            {/* Impact */}
                            <Card className="mb-4">
                                <Card.Header>Impacto</Card.Header>
                                <Card.Body>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Duração (minutos)</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={postmortem.impact?.duration_minutes || ''}
                                            onChange={e => updateNestedField('impact', 'duration_minutes', parseInt(e.target.value) || null)}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Usuários Afetados</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={postmortem.impact?.users_affected || ''}
                                            onChange={e => updateNestedField('impact', 'users_affected', parseInt(e.target.value) || null)}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Check
                                            type="switch"
                                            label="SLA Violado"
                                            checked={postmortem.impact?.sla_breached || false}
                                            onChange={e => updateNestedField('impact', 'sla_breached', e.target.checked)}
                                        />
                                    </Form.Group>
                                    <Form.Group>
                                        <Form.Label>Descrição do Impacto</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            value={postmortem.impact?.description || ''}
                                            onChange={e => updateNestedField('impact', 'description', e.target.value)}
                                        />
                                    </Form.Group>
                                </Card.Body>
                            </Card>

                            {/* Affected Services */}
                            <Card className="mb-4">
                                <Card.Header>Serviços Afetados</Card.Header>
                                <Card.Body>
                                    <Form.Control
                                        type="text"
                                        placeholder="Serviços separados por vírgula"
                                        value={postmortem.affected_services?.join(', ') || ''}
                                        onChange={e => updateField('affected_services', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    />
                                </Card.Body>
                            </Card>

                            {/* Participants */}
                            <Card>
                                <Card.Header>Participantes</Card.Header>
                                <Card.Body>
                                    <Form.Control
                                        type="text"
                                        placeholder="Nomes separados por vírgula"
                                        value={postmortem.participants?.join(', ') || ''}
                                        onChange={e => updateField('participants', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    />
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Tab>

                <Tab eventKey="timeline" title={`Timeline (${postmortem.timeline?.length || 0})`}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <span>Linha do Tempo do Incidente</span>
                            <Button variant="primary" size="sm" onClick={() => setShowTimelineModal(true)}>
                                <FaPlus className="me-1" /> Adicionar Entrada
                            </Button>
                        </Card.Header>
                        <Card.Body>
                            {postmortem.timeline?.length > 0 ? (
                                <div className="timeline">
                                    {postmortem.timeline.map((entry, index) => {
                                        const typeConfig = timelineTypes.find(t => t.value === entry.type) || timelineTypes[4];
                                        return (
                                            <div key={entry._id} className="timeline-item d-flex mb-3">
                                                <div className="timeline-marker me-3">
                                                    <Badge bg={typeConfig.color} className="p-2">
                                                        {typeConfig.label}
                                                    </Badge>
                                                </div>
                                                <div className="timeline-content flex-grow-1">
                                                    <div className="d-flex justify-content-between">
                                                        <strong>
                                                            {format(new Date(entry.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                        </strong>
                                                        <Button 
                                                            variant="link" 
                                                            size="sm" 
                                                            className="text-danger p-0"
                                                            onClick={() => removeTimelineEntry(entry._id)}
                                                        >
                                                            <FaTrash />
                                                        </Button>
                                                    </div>
                                                    <p className="mb-1">{entry.description}</p>
                                                    {entry.actor && (
                                                        <small className="text-muted">
                                                            <FaUser className="me-1" /> {entry.actor}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Alert variant="info">
                                    Nenhuma entrada na timeline. Adicione eventos para documentar o incidente.
                                </Alert>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>

                <Tab eventKey="rca" title="Análise de Causa Raiz">
                    <Row>
                        <Col lg={8}>
                            <Card className="mb-4">
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <span>Análise de Causa Raiz (RCA)</span>
                                    <div className="d-flex gap-2">
                                        <Button 
                                            variant="outline-primary" 
                                            size="sm"
                                            onClick={() => {
                                                setRcaForm(prev => ({ ...prev, method: 'five_whys' }));
                                                setShowRCAModal(true);
                                            }}
                                        >
                                            <FaQuestionCircle className="me-1" /> 5 Porquês
                                        </Button>
                                        <Button 
                                            variant="outline-info" 
                                            size="sm"
                                            onClick={() => {
                                                setRcaForm(prev => ({ ...prev, method: 'fishbone' }));
                                                setShowRCAModal(true);
                                            }}
                                        >
                                            <FaProjectDiagram className="me-1" /> Ishikawa
                                        </Button>
                                    </div>
                                </Card.Header>
                                <Card.Body>
                                    {postmortem.rca?.method ? (
                                        <>
                                            <Badge bg="primary" className="mb-3">
                                                Método: {postmortem.rca.method === 'five_whys' ? '5 Porquês' : 'Diagrama de Ishikawa'}
                                            </Badge>

                                            {postmortem.rca.method === 'five_whys' && postmortem.rca.analysis?.whys && (
                                                <div className="five-whys">
                                                    {postmortem.rca.analysis.whys.map((why, index) => (
                                                        <Card key={index} className="mb-2">
                                                            <Card.Body className="py-2">
                                                                <strong>{index + 1}º Por quê?</strong>
                                                                <p className="mb-1">{why.why}</p>
                                                                <p className="text-muted mb-0">→ {why.answer}</p>
                                                            </Card.Body>
                                                        </Card>
                                                    ))}
                                                </div>
                                            )}

                                            {postmortem.rca.method === 'fishbone' && postmortem.rca.analysis?.categories && (
                                                <Row>
                                                    {Object.entries(postmortem.rca.analysis.categories).map(([key, category]) => (
                                                        <Col md={4} key={key} className="mb-3">
                                                            <Card className="h-100">
                                                                <Card.Header className="py-2">{category.name}</Card.Header>
                                                                <Card.Body className="py-2">
                                                                    <ul className="small mb-0">
                                                                        {category.causes?.map((cause, i) => (
                                                                            <li key={i}>{cause}</li>
                                                                        ))}
                                                                    </ul>
                                                                </Card.Body>
                                                            </Card>
                                                        </Col>
                                                    ))}
                                                </Row>
                                            )}

                                            {postmortem.rca.root_causes?.length > 0 && (
                                                <Alert variant="danger" className="mt-3">
                                                    <strong>Causas Raiz Identificadas:</strong>
                                                    <ul className="mb-0 mt-2">
                                                        {postmortem.rca.root_causes.map((cause, i) => (
                                                            <li key={i}>{cause}</li>
                                                        ))}
                                                    </ul>
                                                </Alert>
                                            )}
                                        </>
                                    ) : (
                                        <Alert variant="info">
                                            <FaLightbulb className="me-2" />
                                            Selecione um método de análise: <strong>5 Porquês</strong> ou <strong>Ishikawa (Fishbone)</strong>
                                        </Alert>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col lg={4}>
                            <Card>
                                <Card.Header>Lições Aprendidas</Card.Header>
                                <Card.Body>
                                    <Form.Control
                                        as="textarea"
                                        rows={8}
                                        placeholder="Uma lição por linha..."
                                        value={postmortem.lessons_learned?.join('\n') || ''}
                                        onChange={e => updateField('lessons_learned', e.target.value.split('\n').filter(Boolean))}
                                    />
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Tab>

                <Tab eventKey="actions" title={`Ações (${postmortem.action_items?.length || 0})`}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <span>Itens de Ação</span>
                            <div className="d-flex gap-2">
                                <Button 
                                    variant="outline-primary" 
                                    size="sm"
                                    onClick={() => generateWithAI('actions')}
                                    disabled={generating}
                                >
                                    <FaRobot className="me-1" /> Sugerir Ações (IA)
                                </Button>
                                <Button variant="primary" size="sm" onClick={() => setShowActionModal(true)}>
                                    <FaPlus className="me-1" /> Nova Ação
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {postmortem.action_items?.length > 0 ? (
                                <Table responsive hover>
                                    <thead>
                                        <tr>
                                            <th>Prioridade</th>
                                            <th>Ação</th>
                                            <th>Categoria</th>
                                            <th>Status</th>
                                            <th>Prazo</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {postmortem.action_items.map(item => (
                                            <tr key={item._id}>
                                                <td>
                                                    <Badge bg={priorityConfig[item.priority]?.color}>
                                                        {priorityConfig[item.priority]?.label}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <strong>{item.title}</strong>
                                                    {item.description && (
                                                        <p className="small text-muted mb-0">{item.description}</p>
                                                    )}
                                                </td>
                                                <td>
                                                    <Badge bg={categoryConfig[item.category]?.color}>
                                                        {categoryConfig[item.category]?.label}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <Form.Select 
                                                        size="sm"
                                                        value={item.status}
                                                        onChange={e => updateActionStatus(item._id, e.target.value)}
                                                        style={{ width: '120px' }}
                                                    >
                                                        <option value="open">Aberto</option>
                                                        <option value="in_progress">Em Progresso</option>
                                                        <option value="completed">Concluído</option>
                                                        <option value="cancelled">Cancelado</option>
                                                    </Form.Select>
                                                </td>
                                                <td>
                                                    {item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy') : '-'}
                                                </td>
                                                <td>
                                                    <Button 
                                                        variant="link" 
                                                        size="sm" 
                                                        className={item.status === 'completed' ? 'text-success' : 'text-secondary'}
                                                        onClick={() => updateActionStatus(item._id, item.status === 'completed' ? 'open' : 'completed')}
                                                    >
                                                        <FaCheck />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            ) : (
                                <Alert variant="info">
                                    Nenhum item de ação. Adicione ações para prevenir recorrências.
                                </Alert>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>
            </Tabs>

            {/* Timeline Modal */}
            <Modal show={showTimelineModal} onHide={() => setShowTimelineModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><FaClock className="me-2" /> Adicionar Entrada na Timeline</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Data/Hora *</Form.Label>
                            <Form.Control
                                type="datetime-local"
                                value={timelineForm.timestamp}
                                onChange={e => setTimelineForm(prev => ({ ...prev, timestamp: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Tipo</Form.Label>
                            <Form.Select
                                value={timelineForm.type}
                                onChange={e => setTimelineForm(prev => ({ ...prev, type: e.target.value }))}
                            >
                                {timelineTypes.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Descrição *</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={timelineForm.description}
                                onChange={e => setTimelineForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>Responsável</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Nome do responsável"
                                value={timelineForm.actor}
                                onChange={e => setTimelineForm(prev => ({ ...prev, actor: e.target.value }))}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowTimelineModal(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={addTimelineEntry}>Adicionar</Button>
                </Modal.Footer>
            </Modal>

            {/* Action Modal */}
            <Modal show={showActionModal} onHide={() => setShowActionModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><FaPlus className="me-2" /> Nova Ação</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Título *</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Descrição da ação"
                                value={actionForm.title}
                                onChange={e => setActionForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Detalhes</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={actionForm.description}
                                onChange={e => setActionForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </Form.Group>
                        <Row>
                            <Col>
                                <Form.Group className="mb-3">
                                    <Form.Label>Prioridade</Form.Label>
                                    <Form.Select
                                        value={actionForm.priority}
                                        onChange={e => setActionForm(prev => ({ ...prev, priority: e.target.value }))}
                                    >
                                        {Object.entries(priorityConfig).map(([value, config]) => (
                                            <option key={value} value={value}>{config.label}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col>
                                <Form.Group className="mb-3">
                                    <Form.Label>Categoria</Form.Label>
                                    <Form.Select
                                        value={actionForm.category}
                                        onChange={e => setActionForm(prev => ({ ...prev, category: e.target.value }))}
                                    >
                                        {Object.entries(categoryConfig).map(([value, config]) => (
                                            <option key={value} value={value}>{config.label}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group>
                            <Form.Label>Prazo</Form.Label>
                            <Form.Control
                                type="date"
                                value={actionForm.due_date}
                                onChange={e => setActionForm(prev => ({ ...prev, due_date: e.target.value }))}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowActionModal(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={addActionItem}>Adicionar</Button>
                </Modal.Footer>
            </Modal>

            {/* RCA Modal */}
            <Modal show={showRCAModal} onHide={() => setShowRCAModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        {rcaForm.method === 'five_whys' ? (
                            <><FaQuestionCircle className="me-2" /> Análise 5 Porquês</>
                        ) : (
                            <><FaProjectDiagram className="me-2" /> Diagrama de Ishikawa</>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Alert variant="info">
                        {rcaForm.method === 'five_whys' ? (
                            <>
                                <strong>5 Porquês:</strong> Técnica iterativa para identificar a causa raiz perguntando "Por quê?" 
                                repetidamente até chegar à origem do problema.
                            </>
                        ) : (
                            <>
                                <strong>Diagrama de Ishikawa:</strong> Também conhecido como "espinha de peixe", categoriza as possíveis 
                                causas em Pessoas, Processo, Tecnologia, Ambiente, Medição e Materiais.
                            </>
                        )}
                    </Alert>
                    <Form.Group>
                        <Form.Label>Descreva o problema *</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={4}
                            placeholder="Ex: O sistema de pagamentos ficou indisponível por 30 minutos..."
                            value={rcaForm.initial_problem}
                            onChange={e => setRcaForm(prev => ({ ...prev, initial_problem: e.target.value }))}
                        />
                        <Form.Text className="text-muted">
                            A IA irá analisar o problema e gerar a análise automaticamente.
                        </Form.Text>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRCAModal(false)}>Cancelar</Button>
                    <Button 
                        variant="primary" 
                        onClick={rcaForm.method === 'five_whys' ? runFiveWhys : runFishbone}
                        disabled={generating}
                    >
                        {generating ? (
                            <><Spinner animation="border" size="sm" className="me-1" /> Analisando...</>
                        ) : (
                            <><FaRobot className="me-1" /> Gerar Análise</>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Generated Content Modal */}
            <Modal show={showGenerateModal} onHide={() => setShowGenerateModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaRobot className="me-2" /> Conteúdo Gerado pela IA
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {generatedContent?.type === 'actions' && (
                        <>
                            <p>A IA sugeriu as seguintes ações baseadas na análise:</p>
                            <ListGroup>
                                {generatedContent.data?.map((action, index) => (
                                    <ListGroup.Item key={index}>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <Badge bg={priorityConfig[action.priority]?.color} className="me-2">
                                                    {priorityConfig[action.priority]?.label}
                                                </Badge>
                                                <Badge bg={categoryConfig[action.category]?.color} className="me-2">
                                                    {categoryConfig[action.category]?.label}
                                                </Badge>
                                                <strong>{action.title}</strong>
                                                {action.description && <p className="mb-0 mt-1 small">{action.description}</p>}
                                            </div>
                                            <Button 
                                                size="sm" 
                                                variant="outline-success"
                                                onClick={async () => {
                                                    try {
                                                        await api.post(`/postmortem/${id}/action-items`, action);
                                                        toast.success('Ação adicionada!');
                                                        loadPostmortem();
                                                    } catch (error) {
                                                        toast.error('Erro ao adicionar');
                                                    }
                                                }}
                                            >
                                                <FaPlus />
                                            </Button>
                                        </div>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </>
                    )}

                    {generatedContent?.type === 'all' && (
                        <>
                            {generatedContent.data?.executive_summary && (
                                <Card className="mb-3">
                                    <Card.Header>Resumo Executivo</Card.Header>
                                    <Card.Body>
                                        {generatedContent.data.executive_summary}
                                    </Card.Body>
                                </Card>
                            )}

                            {generatedContent.data?.lessons_learned && (
                                <Card className="mb-3">
                                    <Card.Header>Lições Aprendidas</Card.Header>
                                    <Card.Body>
                                        {generatedContent.data.lessons_learned.map((group, i) => (
                                            <div key={i} className="mb-2">
                                                <strong>{group.type}:</strong>
                                                <ul className="mb-0">
                                                    {group.items?.map((item, j) => <li key={j}>{item}</li>)}
                                                </ul>
                                            </div>
                                        ))}
                                    </Card.Body>
                                </Card>
                            )}

                            {generatedContent.data?.recommendations && (
                                <Card>
                                    <Card.Header>Recomendações</Card.Header>
                                    <Card.Body>
                                        <ul className="mb-0">
                                            {generatedContent.data.recommendations.map((rec, i) => (
                                                <li key={i}>{rec}</li>
                                            ))}
                                        </ul>
                                    </Card.Body>
                                </Card>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>Fechar</Button>
                </Modal.Footer>
            </Modal>

            <style>{`
                .timeline-item {
                    position: relative;
                    padding-left: 10px;
                    border-left: 2px solid #dee2e6;
                }
                .timeline-item::before {
                    content: '';
                    position: absolute;
                    left: -6px;
                    top: 8px;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #6c757d;
                }
            `}</style>
        </Container>
    );
}
