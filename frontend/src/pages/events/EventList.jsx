import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Badge, Button, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { eventAPI } from '../../services/api';

const SEVERITY_COLORS = { info: 'secondary', low: 'success', medium: 'warning', high: 'danger', critical: 'dark' };

export default function EventList() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [converting, setConverting] = useState(null);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const { data } = await eventAPI.list({ limit: 50 });
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleConvert = async (eventId) => {
    setConverting(eventId);
    try {
      const { data } = await eventAPI.convertToIncident(eventId);
      toast.success('Incidente criado a partir do evento');
      navigate(`/incidents/${data.incidentId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao converter evento em incidente');
    } finally {
      setConverting(null);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h2 className="mb-0">Eventos</h2>
        <Link to="/integrations" className="btn btn-outline-primary btn-sm">
          <i className="bi bi-hdd-network me-1"></i>Gerenciar fontes de eventos
        </Link>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Header><i className="bi bi-activity me-2"></i>Eventos recentes</Card.Header>
        {loadingEvents ? (
          <Card.Body className="text-center py-5"><Spinner animation="border" variant="primary" /></Card.Body>
        ) : events.length === 0 ? (
          <Card.Body className="text-center py-5">
            <i className="bi bi-inbox fs-1 text-muted"></i>
            <p className="text-muted mt-3 mb-0">Nenhum evento recebido ainda</p>
            <p className="text-muted small">
              Configure uma fonte em <Link to="/integrations">Integrações → Entrada</Link> para começar a receber
              eventos de monitoramento (Zabbix, Grafana, Datadog, Sentry...).
            </p>
          </Card.Body>
        ) : (
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Título</th>
                <th>Fonte</th>
                <th>Severidade</th>
                <th>Ocorrências</th>
                <th>Recebido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev._id}>
                  <td>{ev.title}</td>
                  <td className="text-muted small">{ev.source}</td>
                  <td><Badge bg={SEVERITY_COLORS[ev.severity] || 'secondary'}>{ev.severity}</Badge></td>
                  <td>{ev.occurrence_count > 1 ? `×${ev.occurrence_count}` : '-'}</td>
                  <td className="text-muted small">
                    {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: ptBR })}
                  </td>
                  <td>
                    {ev.related_incidents?.length > 0 ? (
                      <Button size="sm" variant="outline-secondary" onClick={() => navigate(`/incidents/${ev.related_incidents[0]}`)}>
                        Ver incidente
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={converting === ev._id}
                        onClick={() => handleConvert(ev._id)}
                      >
                        {converting === ev._id ? <Spinner size="sm" animation="border" /> : 'Converter em incidente'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
