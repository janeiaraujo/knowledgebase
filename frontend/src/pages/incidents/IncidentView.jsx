import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Badge, Button, Spinner, Form, ListGroup, Alert } from 'react-bootstrap';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { incidentAPI } from '../../services/api';

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

const TIMELINE_ICONS = {
  created: 'bi-plus-circle text-primary',
  created_from_event: 'bi-lightning-charge text-primary',
  status_acknowledged: 'bi-pause-circle text-warning',
  status_resolved: 'bi-check-circle text-success',
  status_open: 'bi-arrow-counterclockwise text-danger',
  note_added: 'bi-chat-left-text text-secondary',
  kb_created: 'bi-journal-text text-info',
  updated: 'bi-pencil text-secondary'
};

export default function IncidentView() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [incident, setIncident] = useState(null);
  const [relatedKBs, setRelatedKBs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const loadIncident = useCallback(async () => {
    try {
      const { data } = await incidentAPI.get(id);
      setIncident(data.incident);
      setRelatedKBs(data.relatedKBs || []);
    } catch (err) {
      console.error('Failed to load incident:', err);
      toast.error(t('incidents.loadOneError'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  const handleTransition = async (nextStatus) => {
    setTransitioning(true);
    try {
      const { data } = await incidentAPI.updateStatus(id, nextStatus);
      toast.success(t('incidents.statusChanged', { status: t(STATUS_CONFIG[nextStatus].labelKey) }));
      setSuggestions(data.suggestions || null);
      await loadIncident();
    } catch (err) {
      toast.error(err.response?.data?.error || t('incidents.statusChangeError'));
    } finally {
      setTransitioning(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await incidentAPI.addNote(id, noteText.trim());
      setNoteText('');
      await loadIncident();
    } catch (err) {
      toast.error(t('incidents.noteError'));
    } finally {
      setAddingNote(false);
    }
  };

  const goToQuickCapture = () => {
    navigate('/quick-capture', {
      state: {
        prefill: {
          problem: `${incident.title}\n\n${incident.description || ''}`.trim(),
          severity: incident.severity,
          affected_services: (incident.affected_services || []).join(', '),
          incident_id: incident._id
        }
      }
    });
  };

  const goToPostmortem = () => {
    navigate('/postmortem', {
      state: {
        prefill: {
          title: incident.title,
          severity: incident.severity,
          affected_services: (incident.affected_services || []).join(', '),
          incident_id: incident._id
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (!incident) {
    return (
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-5">
          <p className="text-muted">{t('incidents.notFound')}</p>
          <Link to="/incidents" className="btn btn-outline-secondary">{t('common.back')}</Link>
        </Card.Body>
      </Card>
    );
  }

  const sev = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.medium;
  const status = STATUS_CONFIG[incident.status] || STATUS_CONFIG.open;

  return (
    <>
      <div className="mb-3">
        <Link to="/incidents" className="btn btn-link ps-0">
          <i className="bi bi-arrow-left me-2"></i>{t('incidents.backToList')}
        </Link>
      </div>

      {suggestions && (
        <Alert variant="success" onClose={() => setSuggestions(null)} dismissible>
          <Alert.Heading className="h6"><i className="bi bi-check-circle me-2"></i>{t('incidents.resolvedTitle')}</Alert.Heading>
          <p className="mb-2 small">{t('incidents.resolvedHelp')}</p>
          <div className="d-flex gap-2 flex-wrap">
            {suggestions.kb && (
              <Button size="sm" variant="success" onClick={goToQuickCapture}>
                <i className="bi bi-lightning-charge me-1"></i>{t('incidents.createKb')}
              </Button>
            )}
            {suggestions.postmortem && (
              <Button size="sm" variant="outline-success" onClick={goToPostmortem}>
                <i className="bi bi-file-earmark-text me-1"></i>{t('incidents.createPostmortem')}
              </Button>
            )}
          </div>
        </Alert>
      )}

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <Badge bg={status.color} className="fs-6"><i className={`bi ${status.icon} me-1`}></i>{t(status.labelKey)}</Badge>
                <Badge bg={sev.color}>{t(sev.labelKey)}</Badge>
                {incident.created_via === 'auto_ingest' && (
                  <Badge bg="secondary"><i className="bi bi-robot me-1"></i>{t('incidents.autoOpened')}</Badge>
                )}
              </div>
              <h3 className="mb-1">{incident.title}</h3>
              {incident.description && <p className="text-muted mb-2">{incident.description}</p>}
              {incident.affected_services?.length > 0 && (
                <div className="mb-2">
                  <small className="text-muted">{t('incidents.affectedServices')}: </small>
                  {incident.affected_services.map(s => (
                    <Badge key={s} bg="light" text="dark" className="me-1 border">{s}</Badge>
                  ))}
                </div>
              )}
              <small className="text-muted">
                Aberto {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true, locale: ptBR })}
              </small>
            </div>

            <div className="d-flex gap-2">
              {incident.status === 'open' && (
                <Button variant="warning" disabled={transitioning} onClick={() => handleTransition('acknowledged')}>
                  <i className="bi bi-pause-circle me-1"></i>{t('incidents.acknowledge')}
                </Button>
              )}
              {(incident.status === 'open' || incident.status === 'acknowledged') && (
                <Button variant="success" disabled={transitioning} onClick={() => handleTransition('resolved')}>
                  <i className="bi bi-check-circle me-1"></i>{t('incidents.resolve')}
                </Button>
              )}
              {incident.status !== 'open' && (
                <Button variant="outline-danger" disabled={transitioning} onClick={() => handleTransition('open')}>
                  <i className="bi bi-arrow-counterclockwise me-1"></i>{t('incidents.reopen')}
                </Button>
              )}
            </div>
          </div>
        </Card.Body>
      </Card>

      <div className="row">
        <div className="col-lg-8">
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header><i className="bi bi-clock-history me-2"></i>{t('incidents.timeline')}</Card.Header>
            <ListGroup variant="flush">
              {(incident.timeline || []).slice().reverse().map((entry, i) => (
                <ListGroup.Item key={i} className="d-flex gap-2">
                  <i className={`bi ${TIMELINE_ICONS[entry.action] || 'bi-dot'} fs-5`}></i>
                  <div>
                    <div>{entry.note}</div>
                    <small className="text-muted">
                      {entry.timestamp ? format(new Date(entry.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ''}
                    </small>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
            <Card.Body>
              <Form onSubmit={handleAddNote} className="d-flex gap-2">
                <Form.Control
                  placeholder={t('incidents.addNotePlaceholder')}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <Button type="submit" variant="outline-primary" disabled={addingNote || !noteText.trim()}>
                  {addingNote ? <Spinner size="sm" animation="border" /> : t('common.add')}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </div>

        <div className="col-lg-4">
          <Card className="border-0 shadow-sm">
            <Card.Header><i className="bi bi-journal-text me-2"></i>{t('incidents.relatedKbs')}</Card.Header>
            <ListGroup variant="flush">
              {relatedKBs.length === 0 ? (
                <ListGroup.Item className="text-muted small">{t('incidents.noRelatedKbs')}</ListGroup.Item>
              ) : (
                relatedKBs.map(kb => (
                  <ListGroup.Item key={kb._id}>
                    <Link to={`/kb/${kb._id}`} className="text-decoration-none">{kb.title}</Link>
                  </ListGroup.Item>
                ))
              )}
            </ListGroup>
            <Card.Body>
              <Button size="sm" variant="outline-primary" className="w-100" onClick={goToQuickCapture}>
                <i className="bi bi-lightning-charge me-1"></i>{t('incidents.createKb')}
              </Button>
            </Card.Body>
          </Card>
        </div>
      </div>
    </>
  );
}
