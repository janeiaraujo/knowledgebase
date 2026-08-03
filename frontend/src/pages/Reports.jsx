/**
 * Reports Page
 * 
 * Features:
 * - Report templates selection
 * - Generate reports (PDF/Excel)
 * - Scheduled reports
 * - Report history
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Button, Form, Modal, Badge, Table, Tabs, Tab, Spinner, Alert } from 'react-bootstrap';
import { FaFilePdf, FaFileExcel, FaFileCsv, FaDownload, FaCalendarAlt, FaPlay, FaTrash, FaEnvelope } from 'react-icons/fa';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import api from '../services/api';
import { toast } from 'react-toastify';

// Template icons mapping
const templateIcons = {
    'kb-summary': 'bi-book',
    'incident-report': 'bi-exclamation-triangle',
    'user-activity': 'bi-people',
    'content-health': 'bi-heart-pulse',
    'postmortem-summary': 'bi-file-medical',
    'analytics-overview': 'bi-graph-up',
    'search-analytics': 'bi-search',
    'team-performance': 'bi-trophy'
};

// Format icons
const formatIcons = {
    pdf: { icon: FaFilePdf, color: '#dc3545' },
    excel: { icon: FaFileExcel, color: '#198754' },
    csv: { icon: FaFileCsv, color: '#0d6efd' }
};

// Period options
const periodOptions = [
    { value: '7d' },
    { value: '30d' },
    { value: '90d' },
    { value: '1y' }
];

// Frequency options for scheduling
const frequencyOptions = [
    { value: 'daily' },
    { value: 'weekly' },
    { value: 'monthly' }
];

const dayOfWeekOptions = [
    { value: 0 },
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
    { value: 6 }
];

export default function Reports() {
    const { t, i18n } = useTranslation();
    const dateLocale = i18n.language === 'en' ? enUS : ptBR;
    const [activeTab, setActiveTab] = useState('templates');
    const [templates, setTemplates] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    // Modal states
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    
    // Generate form
    const [generateForm, setGenerateForm] = useState({
        format: 'pdf',
        period: '30d',
        delivery: 'download'
    });
    
    // Schedule form
    const [scheduleForm, setScheduleForm] = useState({
        name: '',
        format: 'pdf',
        period: '30d',
        frequency: 'weekly',
        day: 1,
        time: '08:00',
        recipients: ''
    });

    // Load data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [templatesRes, schedulesRes, historyRes] = await Promise.all([
                api.get('/reports/templates'),
                api.get('/reports/schedules'),
                api.get('/reports/history?limit=20')
            ]);
            
            setTemplates(templatesRes.data.templates || []);
            setSchedules(schedulesRes.data.schedules || []);
            setHistory(historyRes.data.reports || []);
        } catch (error) {
            console.error('Error loading reports data:', error);
            toast.error(t('reports.loadError'));
        } finally {
            setLoading(false);
        }
    };

    // Open generate modal
    const openGenerateModal = (template) => {
        setSelectedTemplate(template);
        setGenerateForm({
            format: template.formats[0] || 'pdf',
            period: '30d',
            delivery: 'download'
        });
        setShowGenerateModal(true);
    };

    // Open schedule modal
    const openScheduleModal = (template) => {
        setSelectedTemplate(template);
        setScheduleForm({
            name: `${template.name} - Automático`,
            format: template.formats[0] || 'pdf',
            period: '30d',
            frequency: 'weekly',
            day: 1,
            time: '08:00',
            recipients: ''
        });
        setShowScheduleModal(true);
    };

    // Generate report
    const generateReport = async () => {
        if (!selectedTemplate) return;
        
        setGenerating(true);
        try {
            const response = await api.post('/reports/generate', {
                template_id: selectedTemplate.id,
                format: generateForm.format,
                parameters: {
                    period: generateForm.period
                },
                delivery: generateForm.delivery
            });

            if (generateForm.delivery === 'download' && response.data.data) {
                // Download the report
                downloadReport(response.data.data, selectedTemplate.name, generateForm.format);
            }

            toast.success(t('reports.generated'));
            setShowGenerateModal(false);
            loadData(); // Refresh history
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error(t('reports.generateError'));
        } finally {
            setGenerating(false);
        }
    };

    // Download report data
    const downloadReport = (data, name, format) => {
        let content, mimeType, extension;
        
        if (format === 'csv') {
            content = convertToCSV(data);
            mimeType = 'text/csv';
            extension = 'csv';
        } else if (format === 'excel') {
            // For Excel, we'll download as CSV (proper Excel export would need a library)
            content = convertToCSV(data);
            mimeType = 'text/csv';
            extension = 'csv';
        } else {
            // For PDF, we'll download as JSON (proper PDF export would need a library)
            content = JSON.stringify(data, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    // Convert data to CSV
    const convertToCSV = (data) => {
        if (!data || typeof data !== 'object') return '';
        
        const flattenObject = (obj, prefix = '') => {
            return Object.keys(obj).reduce((acc, k) => {
                const key = prefix ? `${prefix}_${k}` : k;
                if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                    Object.assign(acc, flattenObject(obj[k], key));
                } else if (Array.isArray(obj[k])) {
                    acc[key] = JSON.stringify(obj[k]);
                } else {
                    acc[key] = obj[k];
                }
                return acc;
            }, {});
        };
        
        const flat = flattenObject(data);
        const headers = Object.keys(flat);
        const values = Object.values(flat);
        
        return headers.join(',') + '\n' + values.map(v => `"${v}"`).join(',');
    };

    // Create schedule
    const createSchedule = async () => {
        if (!selectedTemplate || !scheduleForm.name.trim()) {
            toast.warning(t('reports.fillScheduleName'));
            return;
        }
        
        try {
            await api.post('/reports/schedules', {
                template_id: selectedTemplate.id,
                name: scheduleForm.name,
                format: scheduleForm.format,
                parameters: {
                    period: scheduleForm.period
                },
                schedule: {
                    frequency: scheduleForm.frequency,
                    day: scheduleForm.frequency !== 'daily' ? scheduleForm.day : undefined,
                    time: scheduleForm.time
                },
                recipients: scheduleForm.recipients.split(',').map(e => e.trim()).filter(Boolean)
            });
            
            toast.success(t('reports.scheduleCreated'));
            setShowScheduleModal(false);
            loadData();
        } catch (error) {
            console.error('Error creating schedule:', error);
            toast.error(t('reports.scheduleCreateError'));
        }
    };

    // Delete schedule
    const deleteSchedule = async (scheduleId) => {
        if (!window.confirm(t('reports.confirmDeleteSchedule'))) return;
        
        try {
            await api.delete(`/reports/schedules/${scheduleId}`);
            toast.success(t('reports.scheduleDeleted'));
            loadData();
        } catch (error) {
            toast.error(t('reports.scheduleDeleteError'));
        }
    };

    // Toggle schedule enabled
    const toggleSchedule = async (schedule) => {
        try {
            await api.put(`/reports/schedules/${schedule._id}`, {
                enabled: !schedule.enabled
            });
            toast.success(schedule.enabled ? t('reports.schedulePaused') : t('reports.scheduleEnabled'));
            loadData();
        } catch (error) {
            toast.error(t('reports.scheduleUpdateError'));
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2">{t('reports.loading')}</p>
            </div>
        );
    }

    return (
        <Container fluid>
            <Row className="mb-4">
                <Col>
                    <h2 className="mb-1">
                        <i className="bi bi-file-earmark-bar-graph me-2"></i>
                        {t('reports.title')}
                    </h2>
                    <p className="text-muted">{t('reports.subtitle')}</p>
                </Col>
            </Row>

            <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
                <Tab eventKey="templates" title={<span><i className="bi bi-grid me-2"></i>{t('reports.tabTemplates')}</span>}>
                    <Row xs={1} md={2} lg={3} xl={4} className="g-4">
                        {templates.map(template => (
                            <Col key={template.id}>
                                <Card className="h-100 shadow-sm border-0 hover-lift">
                                    <Card.Body>
                                        <div className="d-flex align-items-start mb-3">
                                            <div className="bg-primary bg-opacity-10 p-3 rounded me-3">
                                                <i className={`bi ${templateIcons[template.id] || 'bi-file-text'} fs-4 text-primary`}></i>
                                            </div>
                                            <div className="flex-grow-1">
                                                <h5 className="mb-1">{template.name}</h5>
                                                <Badge bg="secondary" className="text-capitalize">
                                                    {template.category}
                                                </Badge>
                                            </div>
                                        </div>
                                        <p className="text-muted small mb-3">{template.description}</p>
                                        <div className="d-flex gap-1 mb-3">
                                            {template.formats.map(fmt => {
                                                const FormatIcon = formatIcons[fmt]?.icon || FaFilePdf;
                                                return (
                                                    <Badge 
                                                        key={fmt} 
                                                        bg="light" 
                                                        text="dark"
                                                        className="d-flex align-items-center gap-1"
                                                    >
                                                        <FormatIcon style={{ color: formatIcons[fmt]?.color }} />
                                                        {fmt.toUpperCase()}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </Card.Body>
                                    <Card.Footer className="bg-white border-0 pt-0">
                                        <div className="d-flex gap-2">
                                            <Button 
                                                variant="primary" 
                                                size="sm"
                                                className="flex-grow-1"
                                                onClick={() => openGenerateModal(template)}
                                            >
                                                <FaPlay className="me-1" /> {t('reports.generate')}
                                            </Button>
                                            <Button 
                                                variant="outline-secondary" 
                                                size="sm"
                                                onClick={() => openScheduleModal(template)}
                                                title={t('reports.schedule')}
                                            >
                                                <FaCalendarAlt />
                                            </Button>
                                        </div>
                                    </Card.Footer>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Tab>

                <Tab eventKey="schedules" title={<span><i className="bi bi-calendar-check me-2"></i>{t('reports.tabSchedules')}</span>}>
                    {schedules.length === 0 ? (
                        <Alert variant="info">
                            <i className="bi bi-info-circle me-2"></i>
                            {t('reports.noSchedules')}
                        </Alert>
                    ) : (
                        <Card className="shadow-sm border-0">
                            <Table responsive hover className="mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th>{t('reports.name')}</th>
                                        <th>{t('reports.template')}</th>
                                        <th>{t('reports.frequency')}</th>
                                        <th>{t('reports.nextRun')}</th>
                                        <th>{t('common.status')}</th>
                                        <th width="120">{t('reviews.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedules.map(schedule => (
                                        <tr key={schedule._id}>
                                            <td>
                                                <strong>{schedule.name}</strong>
                                                <div className="small text-muted">
                                                    {schedule.recipients?.join(', ')}
                                                </div>
                                            </td>
                                            <td>
                                                <Badge bg="secondary">{schedule.template_id}</Badge>
                                            </td>
                                            <td>
                                                <i className="bi bi-clock me-1"></i>
                                                {t(`reports.frequencies.${schedule.schedule?.frequency}`)}
                                                {` ${t('reports.at')} `}{schedule.schedule?.time}
                                            </td>
                                            <td>
                                                {schedule.next_run && (
                                                    <span title={format(new Date(schedule.next_run), 'PPpp', { locale: dateLocale })}>
                                                        {formatDistanceToNow(new Date(schedule.next_run), { 
                                                            addSuffix: true, 
                                                            locale: dateLocale 
                                                        })}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <Badge bg={schedule.enabled ? 'success' : 'secondary'}>
                                                    {schedule.enabled ? t('reports.active') : t('reports.paused')}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Button 
                                                    variant="link" 
                                                    size="sm"
                                                    onClick={() => toggleSchedule(schedule)}
                                                    title={schedule.enabled ? t('reports.pause') : t('reports.activate')}
                                                >
                                                    <i className={`bi bi-${schedule.enabled ? 'pause' : 'play'}`}></i>
                                                </Button>
                                                <Button 
                                                    variant="link" 
                                                    size="sm"
                                                    className="text-danger"
                                                    onClick={() => deleteSchedule(schedule._id)}
                                                    title={t('common.delete')}
                                                >
                                                    <FaTrash />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Card>
                    )}
                </Tab>

                <Tab eventKey="history" title={<span><i className="bi bi-clock-history me-2"></i>{t('reports.tabHistory')}</span>}>
                    {history.length === 0 ? (
                        <Alert variant="info">
                            <i className="bi bi-info-circle me-2"></i>
                            {t('reports.noHistory')}
                        </Alert>
                    ) : (
                        <Card className="shadow-sm border-0">
                            <Table responsive hover className="mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th>{t('reports.report')}</th>
                                        <th>{t('reports.format')}</th>
                                        <th>{t('reports.generatedBy')}</th>
                                        <th>{t('reports.date')}</th>
                                        <th>{t('common.status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(report => (
                                        <tr key={report._id}>
                                            <td>
                                                <i className={`bi ${templateIcons[report.template_id] || 'bi-file-text'} me-2`}></i>
                                                {report.template_id}
                                            </td>
                                            <td>
                                                <Badge bg="light" text="dark">
                                                    {report.format?.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td>{report.generated_by_name}</td>
                                            <td>
                                                {format(new Date(report.created_at), 'PPp', { locale: dateLocale })}
                                            </td>
                                            <td>
                                                <Badge bg={report.status === 'completed' ? 'success' : 'warning'}>
                                                    {report.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Card>
                    )}
                </Tab>
            </Tabs>

            {/* Generate Modal */}
            <Modal show={showGenerateModal} onHide={() => setShowGenerateModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <i className={`bi ${templateIcons[selectedTemplate?.id] || 'bi-file-text'} me-2`}></i>
                        {t('reports.generateReport')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedTemplate && (
                        <>
                            <h6 className="mb-3">{selectedTemplate.name}</h6>
                            <p className="text-muted small">{selectedTemplate.description}</p>
                            
                            <Form.Group className="mb-3">
                                <Form.Label>{t('reports.format')}</Form.Label>
                                <div className="d-flex gap-2">
                                    {selectedTemplate.formats.map(fmt => {
                                        const FormatIcon = formatIcons[fmt]?.icon || FaFilePdf;
                                        return (
                                            <Button
                                                key={fmt}
                                                variant={generateForm.format === fmt ? 'primary' : 'outline-secondary'}
                                                onClick={() => setGenerateForm(prev => ({ ...prev, format: fmt }))}
                                                className="d-flex align-items-center gap-2"
                                            >
                                                <FormatIcon />
                                                {fmt.toUpperCase()}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </Form.Group>
                            
                            <Form.Group className="mb-3">
                                <Form.Label>{t('reports.period')}</Form.Label>
                                <Form.Select
                                    value={generateForm.period}
                                    onChange={(e) => setGenerateForm(prev => ({ ...prev, period: e.target.value }))}
                                >
                                    {periodOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{t(`reports.periods.${opt.value}`)}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                            
                            <Form.Group>
                                <Form.Label>{t('reports.delivery')}</Form.Label>
                                <Form.Select
                                    value={generateForm.delivery}
                                    onChange={(e) => setGenerateForm(prev => ({ ...prev, delivery: e.target.value }))}
                                >
                                    <option value="download">{t('reports.deliveryDownload')}</option>
                                    <option value="email">{t('reports.deliveryEmail')}</option>
                                    <option value="save">{t('reports.deliverySave')}</option>
                                </Form.Select>
                            </Form.Group>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={generateReport} disabled={generating}>
                        {generating ? (
                            <>
                                <Spinner size="sm" className="me-2" />
                                {t('reports.generating')}
                            </>
                        ) : (
                            <>
                                <FaDownload className="me-2" />
                                {t('reports.generateReport')}
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Schedule Modal */}
            <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaCalendarAlt className="me-2" />
                        {t('reports.scheduleReport')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedTemplate && (
                        <>
                            <Form.Group className="mb-3">
                                <Form.Label>{t('reports.scheduleName')}</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={scheduleForm.name}
                                    onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder={t('reports.scheduleNamePlaceholder')}
                                />
                            </Form.Group>
                            
                            <Row className="mb-3">
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label>{t('reports.format')}</Form.Label>
                                        <Form.Select
                                            value={scheduleForm.format}
                                            onChange={(e) => setScheduleForm(prev => ({ ...prev, format: e.target.value }))}
                                        >
                                            {selectedTemplate.formats.map(fmt => (
                                                <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label>{t('reports.dataPeriod')}</Form.Label>
                                        <Form.Select
                                            value={scheduleForm.period}
                                            onChange={(e) => setScheduleForm(prev => ({ ...prev, period: e.target.value }))}
                                        >
                                            {periodOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{t(`reports.periods.${opt.value}`)}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            </Row>
                            
                            <Row className="mb-3">
                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label>{t('reports.frequency')}</Form.Label>
                                        <Form.Select
                                            value={scheduleForm.frequency}
                                            onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                                        >
                                            {frequencyOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{t(`reports.frequencies.${opt.value}`)}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                {scheduleForm.frequency === 'weekly' && (
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>{t('reports.weekday')}</Form.Label>
                                            <Form.Select
                                                value={scheduleForm.day}
                                                onChange={(e) => setScheduleForm(prev => ({ ...prev, day: parseInt(e.target.value) }))}
                                            >
                                                {dayOfWeekOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{t(`reports.weekdays.${opt.value}`)}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                )}
                                {scheduleForm.frequency === 'monthly' && (
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>{t('reports.monthDay')}</Form.Label>
                                            <Form.Select
                                                value={scheduleForm.day}
                                                onChange={(e) => setScheduleForm(prev => ({ ...prev, day: parseInt(e.target.value) }))}
                                            >
                                                {[...Array(28)].map((_, i) => (
                                                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                )}
                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label>{t('reports.time')}</Form.Label>
                                        <Form.Control
                                            type="time"
                                            value={scheduleForm.time}
                                            onChange={(e) => setScheduleForm(prev => ({ ...prev, time: e.target.value }))}
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                            
                            <Form.Group>
                                <Form.Label>
                                    <FaEnvelope className="me-2" />
                                    {t('reports.recipients')}
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    value={scheduleForm.recipients}
                                    onChange={(e) => setScheduleForm(prev => ({ ...prev, recipients: e.target.value }))}
                                    placeholder="email1@empresa.com, email2@empresa.com"
                                />
                                <Form.Text className="text-muted">
                                    {t('reports.recipientsHelp')}
                                </Form.Text>
                            </Form.Group>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={createSchedule}>
                        <FaCalendarAlt className="me-2" />
                        {t('reports.createSchedule')}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}
