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
import { Trans, useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Badge, Button, Modal, Form, Tabs, Tab, Spinner, Alert, ListGroup, Accordion, Table } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaClock, FaUser, FaPlus, FaCheck, FaRobot, FaSave, FaDownload, FaBook, FaLightbulb, FaQuestionCircle, FaTrash, FaArrowLeft, FaProjectDiagram, FaShare } from 'react-icons/fa';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import api from '../../services/api';
import { toast } from 'react-toastify';

// Severity configurations
const severityConfig = {
    critical: { color: 'danger' },
    high: { color: 'warning' },
    medium: { color: 'info' },
    low: { color: 'secondary' }
};

// Timeline entry types
const timelineTypes = [
    { value: 'detection', color: 'danger' },
    { value: 'investigation', color: 'info' },
    { value: 'mitigation', color: 'warning' },
    { value: 'resolution', color: 'success' },
    { value: 'event', color: 'secondary' }
];

// Action item priorities
const priorityConfig = {
    critical: { color: 'danger' },
    high: { color: 'warning' },
    medium: { color: 'info' },
    low: { color: 'secondary' }
};

// Action item categories
const categoryConfig = {
    preventive: { color: 'success' },
    detective: { color: 'info' },
    corrective: { color: 'warning' }
};

export default function PostMortemEditor() {
    const { t, i18n } = useTranslation();
    const dateLocale = i18n.language === 'en' ? enUS : ptBR;
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
            toast.error(t('postmortem.loadError'));
            navigate('/postmortem');
        } finally {
            setLoading(false);
        }
    }, [id, navigate, t]);

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
            if (!silent) toast.success(t('postmortem.saved'));
        } catch (error) {
            toast.error(t('postmortem.saveError'));
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
            toast.warning(t('postmortem.fillTimestampDesc'));
            return;
        }

        try {
            await api.post(`/postmortem/${id}/timeline`, timelineForm);
            toast.success(t('postmortem.entryAdded'));
            setShowTimelineModal(false);
            setTimelineForm({ timestamp: '', description: '', type: 'event', actor: '' });
            loadPostmortem();
        } catch (error) {
            toast.error(t('postmortem.addEntryError'));
        }
    };

    // Remove timeline entry
    const removeTimelineEntry = async (entryId) => {
        if (!window.confirm(t('postmortem.confirmRemoveEntry'))) return;
        
        try {
            await api.delete(`/postmortem/${id}/timeline/${entryId}`);
            loadPostmortem();
        } catch (error) {
            toast.error(t('postmortem.removeError'));
        }
    };

    // Add action item
    const addActionItem = async () => {
        if (!actionForm.title) {
            toast.warning(t('postmortem.fillActionTitle'));
            return;
        }

        try {
            await api.post(`/postmortem/${id}/action-items`, actionForm);
            toast.success(t('postmortem.actionAdded'));
            setShowActionModal(false);
            setActionForm({ title: '', description: '', priority: 'medium', category: 'preventive', due_date: '' });
            loadPostmortem();
        } catch (error) {
            toast.error(t('postmortem.addActionError'));
        }
    };

    // Update action item status
    const updateActionStatus = async (itemId, status) => {
        try {
            await api.put(`/postmortem/${id}/action-items/${itemId}`, { status });
            loadPostmortem();
        } catch (error) {
            toast.error(t('postmortem.updateError'));
        }
    };

    // Run 5 Whys analysis
    const runFiveWhys = async () => {
        if (!rcaForm.initial_problem) {
            toast.warning(t('postmortem.describeInitialProblem'));
            return;
        }

        setGenerating(true);
        try {
            await api.post(`/postmortem/${id}/rca/five-whys`, {
                initial_problem: rcaForm.initial_problem
            });
            
            toast.success(t('postmortem.fiveWhysGenerated'));
            setShowRCAModal(false);
            loadPostmortem();
        } catch (error) {
            toast.error(t('postmortem.analysisError'));
        } finally {
            setGenerating(false);
        }
    };

    // Run Fishbone analysis
    const runFishbone = async () => {
        if (!rcaForm.initial_problem) {
            toast.warning(t('postmortem.describeProblem'));
            return;
        }

        setGenerating(true);
        try {
            await api.post(`/postmortem/${id}/rca/fishbone`, {
                problem_statement: rcaForm.initial_problem
            });
            
            toast.success(t('postmortem.fishboneGenerated'));
            setShowRCAModal(false);
            loadPostmortem();
        } catch (error) {
            toast.error(t('postmortem.analysisError'));
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
            
            toast.success(t('postmortem.contentGenerated'));
        } catch (error) {
            toast.error(t('postmortem.generateError'));
        } finally {
            setGenerating(false);
        }
    };

    // Publish post-mortem
    const publishPostmortem = async () => {
        if (!window.confirm(t('postmortem.confirmPublish'))) return;

        try {
            await api.post(`/postmortem/${id}/publish`);
            toast.success(t('postmortem.published'));
            loadPostmortem();
        } catch (error) {
            toast.error(t('postmortem.publishError'));
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
            toast.error(t('postmortem.exportError'));
        }
    };

    // Create KB from post-mortem
    const createKB = async () => {
        if (!window.confirm(t('postmortem.confirmCreateKb'))) return;

        try {
            const response = await api.post(`/postmortem/${id}/create-kb`);
            toast.success(t('postmortem.kbCreated'));
            navigate(`/kb/${response.data.kb_id}/edit`);
        } catch (error) {
            toast.error(t('postmortem.createKbError'));
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
                <Alert variant="danger">{t('postmortem.notFound')}</Alert>
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
                                <FaArrowLeft className="me-1" /> {t('common.back')}
                            </Button>
                            <h2 className="mb-1">
                                <Badge bg={severityConfig[postmortem.severity]?.color} className="me-2">
                                    {t(`postmortem.severities.${postmortem.severity}`)}
                                </Badge>
                                {postmortem.title}
                            </h2>
                            <div className="text-muted">
                                <FaClock className="me-1" />
                                {format(new Date(postmortem.incident_date), t('postmortem.longDateFormat'), { locale: dateLocale })}
                                {' • '}
                                <Badge bg={postmortem.status === 'published' ? 'success' : 'secondary'}>
                                    {['draft', 'published'].includes(postmortem.status) ? t(`kb.status.${postmortem.status}`) : postmortem.status}
                                </Badge>
                            </div>
                        </div>
                        <div className="d-flex gap-2">
                            {hasChanges && (
                                <Badge bg="warning" className="align-self-center">{t('gpsEditor.unsavedChanges')}</Badge>
                            )}
                            <Button variant="outline-secondary" onClick={exportMarkdown}>
                                <FaDownload className="me-1" /> {t('kbView.export')}
                            </Button>
                            <Button variant="outline-primary" onClick={createKB}>
                                <FaBook className="me-1" /> {t('postmortem.createKb')}
                            </Button>
                            {postmortem.status === 'draft' && (
                                <Button variant="success" onClick={publishPostmortem}>
                                    <FaShare className="me-1" /> {t('kbView.publish')}
                                </Button>
                            )}
                            <Button variant="primary" onClick={() => savePostmortem(false)} disabled={saving}>
                                {saving ? <Spinner animation="border" size="sm" /> : <FaSave className="me-1" />}
                                {t('gpsEditor.save')}
                            </Button>
                        </div>
                    </div>
                </Col>
            </Row>

            {/* Main Content Tabs */}
            <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
                <Tab eventKey="overview" title={t('userActivity.tabOverview')}>
                    <Row>
                        <Col lg={8}>
                            {/* Executive Summary */}
                            <Card className="mb-4">
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <span>{t('postmortem.executiveSummary')}</span>
                                    <Button 
                                        size="sm" 
                                        variant="outline-primary"
                                        onClick={() => generateWithAI('summary')}
                                        disabled={generating}
                                    >
                                        <FaRobot className="me-1" /> {t('postmortem.generateWithAi')}
                                    </Button>
                                </Card.Header>
                                <Card.Body>
                                    <Form.Control
                                        as="textarea"
                                        rows={6}
                                        placeholder={t('postmortem.summaryPlaceholder')}
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
                                                        placeholder={t('postmortem.sectionPlaceholder', { section: section.title })}
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
                                <Card.Header>{t('postmortem.impact')}</Card.Header>
                                <Card.Body>
                                    <Form.Group className="mb-3">
                                        <Form.Label>{t('postmortem.durationMinutes')}</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={postmortem.impact?.duration_minutes || ''}
                                            onChange={e => updateNestedField('impact', 'duration_minutes', parseInt(e.target.value) || null)}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>{t('postmortem.usersAffected')}</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={postmortem.impact?.users_affected || ''}
                                            onChange={e => updateNestedField('impact', 'users_affected', parseInt(e.target.value) || null)}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Check
                                            type="switch"
                                            label={t('postmortem.slaBreached')}
                                            checked={postmortem.impact?.sla_breached || false}
                                            onChange={e => updateNestedField('impact', 'sla_breached', e.target.checked)}
                                        />
                                    </Form.Group>
                                    <Form.Group>
                                        <Form.Label>{t('postmortem.impactDescription')}</Form.Label>
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
                                <Card.Header>{t('postmortem.affectedServices')}</Card.Header>
                                <Card.Body>
                                    <Form.Control
                                        type="text"
                                        placeholder={t('postmortem.servicesPlaceholder')}
                                        value={postmortem.affected_services?.join(', ') || ''}
                                        onChange={e => updateField('affected_services', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    />
                                </Card.Body>
                            </Card>

                            {/* Participants */}
                            <Card>
                                <Card.Header>{t('postmortem.participants')}</Card.Header>
                                <Card.Body>
                                    <Form.Control
                                        type="text"
                                        placeholder={t('postmortem.namesPlaceholder')}
                                        value={postmortem.participants?.join(', ') || ''}
                                        onChange={e => updateField('participants', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    />
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Tab>

                <Tab eventKey="timeline" title={t('postmortem.tabTimeline', { count: postmortem.timeline?.length || 0 })}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <span>{t('postmortem.incidentTimeline')}</span>
                            <Button variant="primary" size="sm" onClick={() => setShowTimelineModal(true)}>
                                <FaPlus className="me-1" /> {t('postmortem.addEntry')}
                            </Button>
                        </Card.Header>
                        <Card.Body>
                            {postmortem.timeline?.length > 0 ? (
                                <div className="timeline">
                                    {postmortem.timeline.map((entry, index) => {
                                        const typeConfig = timelineTypes.find(tt => tt.value === entry.type) || timelineTypes[4];
                                        return (
                                            <div key={entry._id} className="timeline-item d-flex mb-3">
                                                <div className="timeline-marker me-3">
                                                    <Badge bg={typeConfig.color} className="p-2">
                                                        {t(`postmortem.timelineTypes.${typeConfig.value}`)}
                                                    </Badge>
                                                </div>
                                                <div className="timeline-content flex-grow-1">
                                                    <div className="d-flex justify-content-between">
                                                        <strong>
                                                            {format(new Date(entry.timestamp), "dd/MM/yyyy HH:mm", { locale: dateLocale })}
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
                                    {t('postmortem.emptyTimeline')}
                                </Alert>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>

                <Tab eventKey="rca" title={t('postmortem.tabRca')}>
                    <Row>
                        <Col lg={8}>
                            <Card className="mb-4">
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <span>{t('postmortem.rcaTitle')}</span>
                                    <div className="d-flex gap-2">
                                        <Button 
                                            variant="outline-primary" 
                                            size="sm"
                                            onClick={() => {
                                                setRcaForm(prev => ({ ...prev, method: 'five_whys' }));
                                                setShowRCAModal(true);
                                            }}
                                        >
                                            <FaQuestionCircle className="me-1" /> {t('postmortem.fiveWhys')}
                                        </Button>
                                        <Button 
                                            variant="outline-info" 
                                            size="sm"
                                            onClick={() => {
                                                setRcaForm(prev => ({ ...prev, method: 'fishbone' }));
                                                setShowRCAModal(true);
                                            }}
                                        >
                                            <FaProjectDiagram className="me-1" /> {t('postmortem.ishikawa')}
                                        </Button>
                                    </div>
                                </Card.Header>
                                <Card.Body>
                                    {postmortem.rca?.method ? (
                                        <>
                                            <Badge bg="primary" className="mb-3">
                                                {t('postmortem.method')}: {postmortem.rca.method === 'five_whys' ? t('postmortem.fiveWhys') : t('postmortem.fishboneDiagram')}
                                            </Badge>

                                            {postmortem.rca.method === 'five_whys' && postmortem.rca.analysis?.whys && (
                                                <div className="five-whys">
                                                    {postmortem.rca.analysis.whys.map((why, index) => (
                                                        <Card key={index} className="mb-2">
                                                            <Card.Body className="py-2">
                                                                <strong>{t('postmortem.nthWhy', { n: index + 1 })}</strong>
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
                                                    <strong>{t('postmortem.rootCauses')}</strong>
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
                                            <Trans i18nKey="postmortem.pickMethod" components={{ b: <strong /> }} />
                                        </Alert>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col lg={4}>
                            <Card>
                                <Card.Header>{t('postmortem.lessonsLearned')}</Card.Header>
                                <Card.Body>
                                    <Form.Control
                                        as="textarea"
                                        rows={8}
                                        placeholder={t('postmortem.lessonsPlaceholder')}
                                        value={postmortem.lessons_learned?.join('\n') || ''}
                                        onChange={e => updateField('lessons_learned', e.target.value.split('\n').filter(Boolean))}
                                    />
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Tab>

                <Tab eventKey="actions" title={t('postmortem.tabActions', { count: postmortem.action_items?.length || 0 })}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <span>{t('postmortem.actionItems')}</span>
                            <div className="d-flex gap-2">
                                <Button 
                                    variant="outline-primary" 
                                    size="sm"
                                    onClick={() => generateWithAI('actions')}
                                    disabled={generating}
                                >
                                    <FaRobot className="me-1" /> {t('postmortem.suggestActions')}
                                </Button>
                                <Button variant="primary" size="sm" onClick={() => setShowActionModal(true)}>
                                    <FaPlus className="me-1" /> {t('postmortem.newAction')}
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {postmortem.action_items?.length > 0 ? (
                                <Table responsive hover>
                                    <thead>
                                        <tr>
                                            <th>{t('postmortem.priority')}</th>
                                            <th>{t('postmortem.action')}</th>
                                            <th>{t('search.category')}</th>
                                            <th>{t('common.status')}</th>
                                            <th>{t('postmortem.dueDate')}</th>
                                            <th>{t('reviews.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {postmortem.action_items.map(item => (
                                            <tr key={item._id}>
                                                <td>
                                                    <Badge bg={priorityConfig[item.priority]?.color}>
                                                        {t(`postmortem.priorities.${item.priority}`)}
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
                                                        {t(`postmortem.actionCategories.${item.category}`)}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <Form.Select 
                                                        size="sm"
                                                        value={item.status}
                                                        onChange={e => updateActionStatus(item._id, e.target.value)}
                                                        style={{ width: '120px' }}
                                                    >
                                                        <option value="open">{t('postmortem.statuses.open')}</option>
                                                        <option value="in_progress">{t('postmortem.statuses.in_progress')}</option>
                                                        <option value="completed">{t('postmortem.statuses.completed')}</option>
                                                        <option value="cancelled">{t('postmortem.statuses.cancelled')}</option>
                                                    </Form.Select>
                                                </td>
                                                <td>
                                                    {item.due_date ? format(new Date(item.due_date), t('postmortem.shortDateFormat')) : '-'}
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
                                    {t('postmortem.emptyActions')}
                                </Alert>
                            )}
                        </Card.Body>
                    </Card>
                </Tab>
            </Tabs>

            {/* Timeline Modal */}
            <Modal show={showTimelineModal} onHide={() => setShowTimelineModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><FaClock className="me-2" /> {t('postmortem.addTimelineEntry')}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('postmortem.dateTime')} *</Form.Label>
                            <Form.Control
                                type="datetime-local"
                                value={timelineForm.timestamp}
                                onChange={e => setTimelineForm(prev => ({ ...prev, timestamp: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('gpsEditor.type')}</Form.Label>
                            <Form.Select
                                value={timelineForm.type}
                                onChange={e => setTimelineForm(prev => ({ ...prev, type: e.target.value }))}
                            >
                                {timelineTypes.map(type => (
                                    <option key={type.value} value={type.value}>{t(`postmortem.timelineTypes.${type.value}`)}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('common.description')} *</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={timelineForm.description}
                                onChange={e => setTimelineForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>{t('postmortem.actor')}</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder={t('postmortem.actorPlaceholder')}
                                value={timelineForm.actor}
                                onChange={e => setTimelineForm(prev => ({ ...prev, actor: e.target.value }))}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowTimelineModal(false)}>{t('common.cancel')}</Button>
                    <Button variant="primary" onClick={addTimelineEntry}>{t('common.add')}</Button>
                </Modal.Footer>
            </Modal>

            {/* Action Modal */}
            <Modal show={showActionModal} onHide={() => setShowActionModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title><FaPlus className="me-2" /> {t('postmortem.newAction')}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('common.title')} *</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder={t('postmortem.actionTitlePlaceholder')}
                                value={actionForm.title}
                                onChange={e => setActionForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('postmortem.details')}</Form.Label>
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
                                    <Form.Label>{t('postmortem.priority')}</Form.Label>
                                    <Form.Select
                                        value={actionForm.priority}
                                        onChange={e => setActionForm(prev => ({ ...prev, priority: e.target.value }))}
                                    >
                                        {Object.keys(priorityConfig).map(value => (
                                            <option key={value} value={value}>{t(`postmortem.priorities.${value}`)}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col>
                                <Form.Group className="mb-3">
                                    <Form.Label>{t('search.category')}</Form.Label>
                                    <Form.Select
                                        value={actionForm.category}
                                        onChange={e => setActionForm(prev => ({ ...prev, category: e.target.value }))}
                                    >
                                        {Object.keys(categoryConfig).map(value => (
                                            <option key={value} value={value}>{t(`postmortem.actionCategories.${value}`)}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group>
                            <Form.Label>{t('postmortem.dueDate')}</Form.Label>
                            <Form.Control
                                type="date"
                                value={actionForm.due_date}
                                onChange={e => setActionForm(prev => ({ ...prev, due_date: e.target.value }))}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowActionModal(false)}>{t('common.cancel')}</Button>
                    <Button variant="primary" onClick={addActionItem}>{t('common.add')}</Button>
                </Modal.Footer>
            </Modal>

            {/* RCA Modal */}
            <Modal show={showRCAModal} onHide={() => setShowRCAModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        {rcaForm.method === 'five_whys' ? (
                            <><FaQuestionCircle className="me-2" /> {t('postmortem.fiveWhysAnalysis')}</>
                        ) : (
                            <><FaProjectDiagram className="me-2" /> {t('postmortem.fishboneDiagram')}</>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Alert variant="info">
                        {rcaForm.method === 'five_whys' ? (
                            <>
                                <Trans i18nKey="postmortem.fiveWhysHelp" components={{ b: <strong /> }} />
                            </>
                        ) : (
                            <>
                                <Trans i18nKey="postmortem.fishboneHelp" components={{ b: <strong /> }} />
                            </>
                        )}
                    </Alert>
                    <Form.Group>
                        <Form.Label>{t('postmortem.describeProblemLabel')} *</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={4}
                            placeholder={t('postmortem.problemPlaceholder')}
                            value={rcaForm.initial_problem}
                            onChange={e => setRcaForm(prev => ({ ...prev, initial_problem: e.target.value }))}
                        />
                        <Form.Text className="text-muted">
                            {t('postmortem.aiWillAnalyze')}
                        </Form.Text>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRCAModal(false)}>{t('common.cancel')}</Button>
                    <Button 
                        variant="primary" 
                        onClick={rcaForm.method === 'five_whys' ? runFiveWhys : runFishbone}
                        disabled={generating}
                    >
                        {generating ? (
                            <><Spinner animation="border" size="sm" className="me-1" /> {t('postmortem.analyzing')}</>
                        ) : (
                            <><FaRobot className="me-1" /> {t('postmortem.generateAnalysis')}</>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Generated Content Modal */}
            <Modal show={showGenerateModal} onHide={() => setShowGenerateModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaRobot className="me-2" /> {t('postmortem.aiGeneratedContent')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {generatedContent?.type === 'actions' && (
                        <>
                            <p>{t('postmortem.aiSuggestedActions')}</p>
                            <ListGroup>
                                {generatedContent.data?.map((action, index) => (
                                    <ListGroup.Item key={index}>
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <Badge bg={priorityConfig[action.priority]?.color} className="me-2">
                                                    {t(`postmortem.priorities.${action.priority}`)}
                                                </Badge>
                                                <Badge bg={categoryConfig[action.category]?.color} className="me-2">
                                                    {t(`postmortem.actionCategories.${action.category}`)}
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
                                                        toast.success(t('postmortem.actionAdded'));
                                                        loadPostmortem();
                                                    } catch (error) {
                                                        toast.error(t('postmortem.addError'));
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
                                    <Card.Header>{t('postmortem.executiveSummary')}</Card.Header>
                                    <Card.Body>
                                        {generatedContent.data.executive_summary}
                                    </Card.Body>
                                </Card>
                            )}

                            {generatedContent.data?.lessons_learned && (
                                <Card className="mb-3">
                                    <Card.Header>{t('postmortem.lessonsLearned')}</Card.Header>
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
                                    <Card.Header>{t('postmortem.recommendations')}</Card.Header>
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
                    <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>{t('postmortem.close')}</Button>
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
