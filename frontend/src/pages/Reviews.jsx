import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Form, Row, Col, Alert, Spinner, Badge, ListGroup, Tabs, Tab, Modal, Table, ProgressBar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../services/api';

const Reviews = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data
  const [pendingReviews, setPendingReviews] = useState([]);
  const [staleKBs, setStaleKBs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [summary, setSummary] = useState({ overdue: 0, urgent: 0, upcoming: 0 });
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  
  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [scheduleData, setScheduleData] = useState({ days: 90, notes: '' });

  useEffect(() => {
    fetchSettings();
    fetchPendingReviews();
  }, [statusFilter, pagination.page]);

  useEffect(() => {
    if (activeTab === 'stale') {
      fetchStaleKBs();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/review/settings');
      setSettings(data.settings);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchPendingReviews = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/review/pending', {
        params: {
          status: statusFilter,
          page: pagination.page,
          limit: 20
        }
      });
      setPendingReviews(data.records || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
      setSummary(data.summary || { overdue: 0, urgent: 0, upcoming: 0 });
    } catch (err) {
      setError(t('reviews.loadPendingError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStaleKBs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/review/stale', {
        params: { days: 90, page: 1, limit: 50 }
      });
      setStaleKBs(data.records || []);
    } catch (err) {
      setError(t('reviews.loadStaleError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.put('/review/settings', settings);
      setShowSettingsModal(false);
    } catch (err) {
      setError(t('reviews.saveSettingsError'));
    }
  };

  const handleScheduleReview = async () => {
    if (!selectedRecord) return;
    
    try {
      await api.post(`/review/records/${selectedRecord._id}/schedule`, {
        review_period_days: scheduleData.days,
        notes: scheduleData.notes
      });
      setShowScheduleModal(false);
      setSelectedRecord(null);
      fetchPendingReviews();
      if (activeTab === 'stale') fetchStaleKBs();
    } catch (err) {
      setError(t('reviews.scheduleError'));
    }
  };

  const handleCompleteReview = async (recordId) => {
    if (!window.confirm(t('reviews.confirmComplete'))) return;
    
    try {
      await api.post(`/review/records/${recordId}/complete`, {
        schedule_next: true
      });
      fetchPendingReviews();
    } catch (err) {
      setError(t('reviews.completeError'));
    }
  };

  const handleBulkSchedule = async (recordIds) => {
    if (!window.confirm(`Agendar revisão para ${recordIds.length} KB(s)?`)) return;
    
    try {
      await api.post('/review/bulk-schedule', {
        record_ids: recordIds,
        review_period_days: settings?.default_review_period_days || 90
      });
      fetchStaleKBs();
      fetchPendingReviews();
    } catch (err) {
      setError(t('reviews.bulkScheduleError'));
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      overdue: { bg: 'danger', labelKey: 'reviews.statusOverdue' },
      urgent: { bg: 'warning', labelKey: 'reviews.statusUrgent' },
      upcoming: { bg: 'info', labelKey: 'reviews.statusSoon' },
      scheduled: { bg: 'secondary', labelKey: 'reviews.statusScheduled' }
    };
    return badges[status] || badges.scheduled;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'pt-BR');
  };

  const formatDaysUntil = (days) => {
    if (days < 0) return t('reviews.daysOverdue', { count: Math.abs(days) });
    if (days === 0) return t('reviews.today');
    if (days === 1) return t('reviews.tomorrow');
    return t('reviews.inDays', { count: days });
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-calendar-check me-2"></i>
            {t('reviews.title')}
          </h2>
          <p className="text-muted mb-0">
            {t('reviews.subtitle')}
          </p>
        </div>
        <Button variant="outline-primary" onClick={() => setShowSettingsModal(true)}>
          <i className="bi bi-gear me-2"></i>
          {t('reviews.settings')}
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="border-0 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #dc3545' }}>
            <Card.Body>
              <h3 className="text-danger mb-0">{summary.overdue}</h3>
              <small className="text-muted">{t('reviews.overdue')}</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #ffc107' }}>
            <Card.Body>
              <h3 className="text-warning mb-0">{summary.urgent}</h3>
              <small className="text-muted">{t('reviews.thisWeek')}</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="border-0 shadow-sm text-center h-100" style={{ borderLeft: '4px solid #0dcaf0' }}>
            <Card.Body>
              <h3 className="text-info mb-0">{summary.upcoming}</h3>
              <small className="text-muted">{t('reviews.thisMonth')}</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
            
            {/* Pending Reviews Tab */}
            <Tab eventKey="pending" title={<><i className="bi bi-clock me-2"></i>{t('reviews.tabPending')}</>}>
              {/* Filters */}
              <div className="d-flex gap-2 mb-3">
                <Form.Select 
                  size="sm" 
                  style={{ width: '200px' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">{t('reviews.filterAll')}</option>
                  <option value="overdue">{t('reviews.overdue')}</option>
                  <option value="this_week">{t('reviews.thisWeek')}</option>
                  <option value="this_month">{t('reviews.thisMonth')}</option>
                  <option value="upcoming">{t('reviews.upcoming')}</option>
                </Form.Select>
              </div>

              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : pendingReviews.length === 0 ? (
                <Alert variant="success">
                  <i className="bi bi-check-circle me-2"></i>
                  {t('reviews.nonePending')}
                </Alert>
              ) : (
                <Table responsive hover>
                  <thead className="bg-light">
                    <tr>
                      <th>KB</th>
                      <th>{t('reviews.category')}</th>
                      <th>{t('reviews.lastReview')}</th>
                      <th>{t('reviews.nextReview')}</th>
                      <th>{t('common.status')}</th>
                      <th>{t('reviews.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReviews.map(record => {
                      const statusBadge = getStatusBadge(record.review_status);
                      
                      return (
                        <tr key={record._id}>
                          <td>
                            <Link to={`/kb/view/${record._id}`} className="text-decoration-none fw-semibold">
                              {record.title}
                            </Link>
                            <br />
                            <small className="text-muted">{t('reviews.by', { name: record.owner?.name || t('reviews.unknownAuthor') })}</small>
                          </td>
                          <td>
                            <Badge bg="light" text="dark">
                              {record.category?.name || '-'}
                            </Badge>
                          </td>
                          <td>
                            {record.last_reviewed_at 
                              ? formatDate(record.last_reviewed_at)
                              : <span className="text-muted">{t('reviews.never')}</span>
                            }
                          </td>
                          <td>
                            {formatDate(record.next_review_date)}
                            <br />
                            <small className={`text-${record.review_status === 'overdue' ? 'danger' : 'muted'}`}>
                              {formatDaysUntil(record.days_until_review)}
                            </small>
                          </td>
                          <td>
                            <Badge bg={statusBadge.bg}>{t(statusBadge.labelKey)}</Badge>
                          </td>
                          <td>
                            <Button
                              variant="success"
                              size="sm"
                              className="me-1"
                              onClick={() => handleCompleteReview(record._id)}
                              title={t('reviews.markReviewed')}
                            >
                              <i className="bi bi-check"></i>
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedRecord(record);
                                setShowScheduleModal(true);
                              }}
                              title={t('reviews.reschedule')}
                            >
                              <i className="bi bi-calendar"></i>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Tab>

            {/* Stale KBs Tab */}
            <Tab eventKey="stale" title={<><i className="bi bi-exclamation-triangle me-2"></i>{t('reviews.tabStale')}</>}>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                </div>
              ) : staleKBs.length === 0 ? (
                <Alert variant="success">
                  <i className="bi bi-check-circle me-2"></i>
                  {t('reviews.allScheduled')}
                </Alert>
              ) : (
                <>
                  <div className="mb-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleBulkSchedule(staleKBs.map(r => r._id))}
                    >
                      <i className="bi bi-calendar-plus me-2"></i>
                      {t('reviews.scheduleAll', { count: staleKBs.length })}
                    </Button>
                  </div>
                  
                  <ListGroup>
                    {staleKBs.map(record => (
                      <ListGroup.Item 
                        key={record._id} 
                        className="d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <Link to={`/kb/view/${record._id}`} className="text-decoration-none fw-semibold">
                            {record.title}
                          </Link>
                          <br />
                          <small className="text-muted">
                            {t('reviews.updatedAgo', { count: record.days_since_update })}{' • '}
                            {t('reviews.by', { name: record.owner?.name || t('reviews.unknownAuthor') })}
                          </small>
                        </div>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            setSelectedRecord(record);
                            setShowScheduleModal(true);
                          }}
                        >
                          <i className="bi bi-calendar-plus me-1"></i>
                          {t('reviews.schedule')}
                        </Button>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </>
              )}
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* Settings Modal */}
      <Modal show={showSettingsModal} onHide={() => setShowSettingsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-gear me-2"></i>
            {t('reviews.settingsTitle')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {settings && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>{t('reviews.defaultPeriod')}</Form.Label>
                <Form.Control
                  type="number"
                  min="1"
                  value={settings.default_review_period_days}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    default_review_period_days: parseInt(e.target.value)
                  }))}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('reviews.reminders')}</Form.Label>
                <Form.Control
                  type="text"
                  value={(settings.reminder_days_before || []).join(', ')}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    reminder_days_before: e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
                  }))}
                  placeholder="30, 7, 1"
                />
                <Form.Text className="text-muted">
                  {t('reviews.remindersHelp')}
                </Form.Text>
              </Form.Group>

              <Form.Check
                type="switch"
                id="notify-owner"
                label={t('reviews.notifyOwner')}
                checked={settings.notify_owner}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  notify_owner: e.target.checked
                }))}
                className="mb-2"
              />

              <Form.Check
                type="switch"
                id="notify-admins"
                label={t('reviews.notifyAdmins')}
                checked={settings.notify_admins}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  notify_admins: e.target.checked
                }))}
                className="mb-2"
              />

              <Form.Check
                type="switch"
                id="enabled"
                label={t('reviews.enabled')}
                checked={settings.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  enabled: e.target.checked
                }))}
              />
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSettingsModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSaveSettings}>
            {t('reviews.save')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Schedule Modal */}
      <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-calendar-plus me-2"></i>
            {t('reviews.scheduleTitle')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRecord && (
            <>
              <p className="text-muted mb-3">
                <strong>{selectedRecord.title}</strong>
              </p>
              
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>{t('reviews.reviewInDays')}</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    value={scheduleData.days}
                    onChange={(e) => setScheduleData(prev => ({
                      ...prev,
                      days: parseInt(e.target.value)
                    }))}
                  />
                </Form.Group>

                <Form.Group>
                  <Form.Label>{t('reviews.notes')}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={scheduleData.notes}
                    onChange={(e) => setScheduleData(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    placeholder={t('reviews.notesPlaceholder')}
                  />
                </Form.Group>
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleScheduleReview}>
            {t('reviews.schedule')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Reviews;
