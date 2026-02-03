/**
 * Reports Page
 * 
 * Features:
 * - Report templates selection
 * - Generate reports (PDF/Excel)
 * - Scheduled reports
 * - Report history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Form, Modal, Badge, Table, Tabs, Tab, Spinner, Alert, ListGroup, ProgressBar } from 'react-bootstrap';
import { FaFilePdf, FaFileExcel, FaFileCsv, FaDownload, FaCalendarAlt, FaClock, FaPlay, FaHistory, FaPlus, FaTrash, FaEdit, FaEnvelope } from 'react-icons/fa';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' },
    { value: '1y', label: 'Último ano' }
];

// Frequency options for scheduling
const frequencyOptions = [
    { value: 'daily', label: 'Diariamente' },
    { value: 'weekly', label: 'Semanalmente' },
    { value: 'monthly', label: 'Mensalmente' }
];

const dayOfWeekOptions = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' }
];

export default function Reports() {
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
            toast.error('Erro ao carregar dados de relatórios');
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

            toast.success('Relatório gerado com sucesso!');
            setShowGenerateModal(false);
            loadData(); // Refresh history
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Erro ao gerar relatório');
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
            toast.warning('Preencha o nome do agendamento');
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
            
            toast.success('Agendamento criado com sucesso!');
            setShowScheduleModal(false);
            loadData();
        } catch (error) {
            console.error('Error creating schedule:', error);
            toast.error('Erro ao criar agendamento');
        }
    };

    // Delete schedule
    const deleteSchedule = async (scheduleId) => {
        if (!window.confirm('Excluir este agendamento?')) return;
        
        try {
            await api.delete(`/reports/schedules/${scheduleId}`);
            toast.success('Agendamento excluído');
            loadData();
        } catch (error) {
            toast.error('Erro ao excluir agendamento');
        }
    };

    // Toggle schedule enabled
    const toggleSchedule = async (schedule) => {
        try {
            await api.put(`/reports/schedules/${schedule._id}`, {
                enabled: !schedule.enabled
            });
            toast.success(schedule.enabled ? 'Agendamento pausado' : 'Agendamento ativado');
            loadData();
        } catch (error) {
            toast.error('Erro ao atualizar agendamento');
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2">Carregando relatórios...</p>
            </div>
        );
    }

    return (
        <Container fluid>
            <Row className="mb-4">
                <Col>
                    <h2 className="mb-1">
                        <i className="bi bi-file-earmark-bar-graph me-2"></i>
                        Relatórios
                    </h2>
                    <p className="text-muted">Gere e agende relatórios personalizados</p>
                </Col>
            </Row>

            <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
                <Tab eventKey="templates" title={<span><i className="bi bi-grid me-2"></i>Templates</span>}>
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
                                                <FaPlay className="me-1" /> Gerar
                                            </Button>
                                            <Button 
                                                variant="outline-secondary" 
                                                size="sm"
                                                onClick={() => openScheduleModal(template)}
                                                title="Agendar"
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

                <Tab eventKey="schedules" title={<span><i className="bi bi-calendar-check me-2"></i>Agendamentos</span>}>
                    {schedules.length === 0 ? (
                        <Alert variant="info">
                            <i className="bi bi-info-circle me-2"></i>
                            Nenhum relatório agendado. Selecione um template e clique em "Agendar".
                        </Alert>
                    ) : (
                        <Card className="shadow-sm border-0">
                            <Table responsive hover className="mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th>Nome</th>
                                        <th>Template</th>
                                        <th>Frequência</th>
                                        <th>Próxima Execução</th>
                                        <th>Status</th>
                                        <th width="120">Ações</th>
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
                                                {frequencyOptions.find(f => f.value === schedule.schedule?.frequency)?.label}
                                                {' às '}{schedule.schedule?.time}
                                            </td>
                                            <td>
                                                {schedule.next_run && (
                                                    <span title={format(new Date(schedule.next_run), 'PPpp', { locale: ptBR })}>
                                                        {formatDistanceToNow(new Date(schedule.next_run), { 
                                                            addSuffix: true, 
                                                            locale: ptBR 
                                                        })}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <Badge bg={schedule.enabled ? 'success' : 'secondary'}>
                                                    {schedule.enabled ? 'Ativo' : 'Pausado'}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Button 
                                                    variant="link" 
                                                    size="sm"
                                                    onClick={() => toggleSchedule(schedule)}
                                                    title={schedule.enabled ? 'Pausar' : 'Ativar'}
                                                >
                                                    <i className={`bi bi-${schedule.enabled ? 'pause' : 'play'}`}></i>
                                                </Button>
                                                <Button 
                                                    variant="link" 
                                                    size="sm"
                                                    className="text-danger"
                                                    onClick={() => deleteSchedule(schedule._id)}
                                                    title="Excluir"
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

                <Tab eventKey="history" title={<span><i className="bi bi-clock-history me-2"></i>Histórico</span>}>
                    {history.length === 0 ? (
                        <Alert variant="info">
                            <i className="bi bi-info-circle me-2"></i>
                            Nenhum relatório gerado ainda.
                        </Alert>
                    ) : (
                        <Card className="shadow-sm border-0">
                            <Table responsive hover className="mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th>Relatório</th>
                                        <th>Formato</th>
                                        <th>Gerado por</th>
                                        <th>Data</th>
                                        <th>Status</th>
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
                                                {format(new Date(report.created_at), 'PPp', { locale: ptBR })}
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
                        Gerar Relatório
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedTemplate && (
                        <>
                            <h6 className="mb-3">{selectedTemplate.name}</h6>
                            <p className="text-muted small">{selectedTemplate.description}</p>
                            
                            <Form.Group className="mb-3">
                                <Form.Label>Formato</Form.Label>
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
                                <Form.Label>Período</Form.Label>
                                <Form.Select
                                    value={generateForm.period}
                                    onChange={(e) => setGenerateForm(prev => ({ ...prev, period: e.target.value }))}
                                >
                                    {periodOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                            
                            <Form.Group>
                                <Form.Label>Entrega</Form.Label>
                                <Form.Select
                                    value={generateForm.delivery}
                                    onChange={(e) => setGenerateForm(prev => ({ ...prev, delivery: e.target.value }))}
                                >
                                    <option value="download">Download direto</option>
                                    <option value="email">Enviar por email</option>
                                    <option value="save">Salvar no histórico</option>
                                </Form.Select>
                            </Form.Group>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={generateReport} disabled={generating}>
                        {generating ? (
                            <>
                                <Spinner size="sm" className="me-2" />
                                Gerando...
                            </>
                        ) : (
                            <>
                                <FaDownload className="me-2" />
                                Gerar Relatório
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
                        Agendar Relatório
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedTemplate && (
                        <>
                            <Form.Group className="mb-3">
                                <Form.Label>Nome do Agendamento</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={scheduleForm.name}
                                    onChange={(e) => setScheduleForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Relatório Semanal de KBs"
                                />
                            </Form.Group>
                            
                            <Row className="mb-3">
                                <Col md={6}>
                                    <Form.Group>
                                        <Form.Label>Formato</Form.Label>
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
                                        <Form.Label>Período dos Dados</Form.Label>
                                        <Form.Select
                                            value={scheduleForm.period}
                                            onChange={(e) => setScheduleForm(prev => ({ ...prev, period: e.target.value }))}
                                        >
                                            {periodOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            </Row>
                            
                            <Row className="mb-3">
                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label>Frequência</Form.Label>
                                        <Form.Select
                                            value={scheduleForm.frequency}
                                            onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                                        >
                                            {frequencyOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                {scheduleForm.frequency === 'weekly' && (
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>Dia da Semana</Form.Label>
                                            <Form.Select
                                                value={scheduleForm.day}
                                                onChange={(e) => setScheduleForm(prev => ({ ...prev, day: parseInt(e.target.value) }))}
                                            >
                                                {dayOfWeekOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                )}
                                {scheduleForm.frequency === 'monthly' && (
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>Dia do Mês</Form.Label>
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
                                        <Form.Label>Horário</Form.Label>
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
                                    Destinatários (emails separados por vírgula)
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    value={scheduleForm.recipients}
                                    onChange={(e) => setScheduleForm(prev => ({ ...prev, recipients: e.target.value }))}
                                    placeholder="email1@empresa.com, email2@empresa.com"
                                />
                                <Form.Text className="text-muted">
                                    Deixe em branco para enviar apenas para você
                                </Form.Text>
                            </Form.Group>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={createSchedule}>
                        <FaCalendarAlt className="me-2" />
                        Criar Agendamento
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}
