import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Badge, Modal, Form, Spinner, ButtonGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { incidentAPI } from '../../services/api';

const SEVERITY_CONFIG = {
  low: { label: 'Baixa', color: 'success' },
  medium: { label: 'Média', color: 'warning' },
  high: { label: 'Alta', color: 'danger' },
  critical: { label: 'Crítica', color: 'dark' }
};

const STATUS_CONFIG = {
  open: { label: 'Aberto', color: 'danger', icon: 'bi-broadcast' },
  acknowledged: { label: 'Reconhecido', color: 'warning', icon: 'bi-pause-circle' },
  resolved: { label: 'Resolvido', color: 'success', icon: 'bi-check-circle' }
};

export default function IncidentList() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'medium',
    affected_services: ''
  });

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await incidentAPI.list(params);
      setIncidents(data.incidents || []);
    } catch (err) {
      console.error('Failed to load incidents:', err);
      toast.error('Erro ao carregar incidentes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const { data } = await incidentAPI.create({
        ...form,
        affected_services: form.affected_services
          ? form.affected_services.split(',').map(s => s.trim()).filter(Boolean)
          : []
      });
      toast.success('Incidente criado');
      setShowCreate(false);
      setForm({ title: '', description: '', severity: 'medium', affected_services: '' });
      navigate(`/incidents/${data.incidentId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar incidente');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h2 className="mb-0">Incidentes</h2>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <i className="bi bi-plus-circle me-2"></i>Novo Incidente
        </Button>
      </div>

      <div className="mb-3">
        <ButtonGroup>
          <Button
            size="sm"
            variant={statusFilter === '' ? 'primary' : 'outline-secondary'}
            onClick={() => setStatusFilter('')}
          >
            Todos
          </Button>
          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
            <Button
              key={value}
              size="sm"
              variant={statusFilter === value ? config.color : 'outline-secondary'}
              onClick={() => setStatusFilter(value)}
            >
              {config.label}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      <Card className="border-0 shadow-sm">
        {loading ? (
          <Card.Body className="text-center py-5">
            <Spinner animation="border" variant="primary" />
          </Card.Body>
        ) : incidents.length === 0 ? (
          <Card.Body className="text-center py-5">
            <i className="bi bi-inbox fs-1 text-muted"></i>
            <p className="text-muted mt-3 mb-0">Nenhum incidente encontrado</p>
            <p className="text-muted small">
              Incidentes também podem ser abertos automaticamente a partir de eventos monitorados.
              Veja <a href="/events">Eventos</a> para configurar as fontes.
            </p>
          </Card.Body>
        ) : (
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Título</th>
                <th>Severidade</th>
                <th>Status</th>
                <th>Origem</th>
                <th>Aberto</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map(incident => {
                const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.medium;
                const status = STATUS_CONFIG[incident.status] || STATUS_CONFIG.open;
                return (
                  <tr
                    key={incident._id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/incidents/${incident._id}`)}
                  >
                    <td className="fw-medium">{incident.title}</td>
                    <td><Badge bg={sev.color}>{sev.label}</Badge></td>
                    <td>
                      <Badge bg={status.color}>
                        <i className={`bi ${status.icon} me-1`}></i>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="text-muted small">
                      {incident.created_via === 'auto_ingest' ? (
                        <span><i className="bi bi-robot me-1"></i>Automático</span>
                      ) : (
                        <span><i className="bi bi-person me-1"></i>Manual</span>
                      )}
                    </td>
                    <td className="text-muted small">
                      {incident.created_at
                        ? formatDistanceToNow(new Date(incident.created_at), { addSuffix: true, locale: ptBR })
                        : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal show={showCreate} onHide={() => setShowCreate(false)}>
        <Form onSubmit={handleCreate}>
          <Modal.Header closeButton>
            <Modal.Title>Novo Incidente</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control
                autoFocus
                required
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: API de pagamentos fora do ar"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Severidade</Form.Label>
              <Form.Select
                value={form.severity}
                onChange={(e) => setForm(prev => ({ ...prev, severity: e.target.value }))}
              >
                {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Serviços afetados</Form.Label>
              <Form.Control
                value={form.affected_services}
                onChange={(e) => setForm(prev => ({ ...prev, affected_services: e.target.value }))}
                placeholder="Separe por vírgula: API, VPN, SAP..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={creating || !form.title.trim()}>
              {creating ? <Spinner size="sm" animation="border" /> : 'Criar Incidente'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
