import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Badge, Modal, Form, Spinner, ButtonGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { useTranslation, Trans } from 'react-i18next';
import { incidentAPI } from '../../services/api';

// `labelKey` em vez de texto: o rotulo e resolvido no render, para
// acompanhar a troca de idioma sem recarregar a pagina.
const SEVERITY_CONFIG = {
  low: { labelKey: 'incidents.severityLevels.low', color: 'success' },
  medium: { labelKey: 'incidents.severityLevels.medium', color: 'warning' },
  high: { labelKey: 'incidents.severityLevels.high', color: 'danger' },
  critical: { labelKey: 'incidents.severityLevels.critical', color: 'dark' }
};

const STATUS_CONFIG = {
  open: { labelKey: 'incidents.statuses.open', color: 'danger', icon: 'bi-broadcast' },
  acknowledged: { labelKey: 'incidents.statuses.acknowledged', color: 'warning', icon: 'bi-pause-circle' },
  resolved: { labelKey: 'incidents.statuses.resolved', color: 'success', icon: 'bi-check-circle' }
};

export default function IncidentList() {
  const { t } = useTranslation();
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
      toast.error(t('incidents.loadError'));
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
      toast.success(t('incidents.created'));
      setShowCreate(false);
      setForm({ title: '', description: '', severity: 'medium', affected_services: '' });
      navigate(`/incidents/${data.incidentId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || t('incidents.createError'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h2 className="mb-0">{t('nav.items.incidents')}</h2>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <i className="bi bi-plus-circle me-2"></i>{t('incidents.new')}
        </Button>
      </div>

      <div className="mb-3">
        <ButtonGroup>
          <Button
            size="sm"
            variant={statusFilter === '' ? 'primary' : 'outline-secondary'}
            onClick={() => setStatusFilter('')}
          >
            {t('common.all')}
          </Button>
          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
            <Button
              key={value}
              size="sm"
              variant={statusFilter === value ? config.color : 'outline-secondary'}
              onClick={() => setStatusFilter(value)}
            >
              {t(config.labelKey)}
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
            <p className="text-muted mt-3 mb-0">{t('incidents.empty')}</p>
            <p className="text-muted small">
              <Trans i18nKey="incidents.emptyHelp">
                Incidentes também podem ser abertos automaticamente a partir de eventos monitorados.
                Veja <a href="/events">Eventos</a> para configurar as fontes.
              </Trans>
            </p>
          </Card.Body>
        ) : (
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>{t('common.title')}</th>
                <th>{t('incidents.severity')}</th>
                <th>{t('common.status')}</th>
                <th>{t('incidents.origin')}</th>
                <th>{t('incidents.openedAt')}</th>
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
                    <td><Badge bg={sev.color}>{t(sev.labelKey)}</Badge></td>
                    <td>
                      <Badge bg={status.color}>
                        <i className={`bi ${status.icon} me-1`}></i>
                        {t(status.labelKey)}
                      </Badge>
                    </td>
                    <td className="text-muted small">
                      {incident.created_via === 'auto_ingest' ? (
                        <span><i className="bi bi-robot me-1"></i>{t('incidents.automatic')}</span>
                      ) : (
                        <span><i className="bi bi-person me-1"></i>{t('incidents.manual')}</span>
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
            <Modal.Title>{t('incidents.new')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('common.title')}</Form.Label>
              <Form.Control
                autoFocus
                required
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t('incidents.titlePlaceholder')}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('common.description')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('incidents.severity')}</Form.Label>
              <Form.Select
                value={form.severity}
                onChange={(e) => setForm(prev => ({ ...prev, severity: e.target.value }))}
              >
                {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>{t(config.labelKey)}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>{t('incidents.affectedServices')}</Form.Label>
              <Form.Control
                value={form.affected_services}
                onChange={(e) => setForm(prev => ({ ...prev, affected_services: e.target.value }))}
                placeholder={t('incidents.servicesPlaceholder')}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" disabled={creating || !form.title.trim()}>
              {creating ? <Spinner size="sm" animation="border" /> : t('incidents.create')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
