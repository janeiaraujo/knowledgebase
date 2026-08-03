import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Form, Button, Badge, Row, Col, InputGroup, Pagination, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ACTION_LABELS = {
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  view: 'Visualização',
  login: 'Login',
  logout: 'Logout',
  submit_review: 'Envio para Revisão',
  approve: 'Aprovação',
  reject: 'Rejeição',
  publish: 'Publicação',
  archive: 'Arquivamento',
  restore: 'Restauração',
  export: 'Exportação',
  import: 'Importação',
  comment: 'Comentário',
  favorite: 'Favoritar',
  unfavorite: 'Desfavoritar'
};

const ACTION_BADGES = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  view: 'secondary',
  login: 'primary',
  logout: 'secondary',
  submit_review: 'warning',
  approve: 'success',
  reject: 'danger',
  publish: 'primary',
  archive: 'secondary',
  restore: 'info',
  export: 'info',
  import: 'info',
  comment: 'warning',
  favorite: 'warning',
  unfavorite: 'secondary'
};

const ENTITY_LABELS = {
  record: 'KB',
  user: 'Usuário',
  organization: 'Organização',
  incident: 'Incidente',
  comment: 'Comentário',
  tag: 'Tag',
  category: 'Categoria',
  template: 'Template',
  file: 'Arquivo',
  relation: 'Relação'
};

export default function AuditLogs() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 1
  });
  
  // Filters
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    user_id: '',
    search: '',
    date_from: '',
    date_to: ''
  });
  
  const [users, setUsers] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  useEffect(() => {
    fetchUsers();
  }, []);
  
  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters]);
  
  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };
  
  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit
      });
      
      if (filters.action) params.append('action', filters.action);
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.search) params.append('search', filters.search);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      
      const { data } = await api.get(`/audit/logs?${params.toString()}`);
      
      setLogs(data.logs || []);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        pages: data.pagination?.pages || 1
      }));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  const clearFilters = () => {
    setFilters({
      action: '',
      entity_type: '',
      user_id: '',
      search: '',
      date_from: '',
      date_to: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  const showLogDetail = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };
  
  const getUserName = (userId) => {
    const u = users.find(user => user._id === userId);
    return u ? (u.name || u.email) : 'Usuário desconhecido';
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };
  
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString('pt-BR');
  };
  
  // Check if user is admin
  if (!user || !['owner', 'admin'].includes(user.role)) {
    return (
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-5">
          <i className="bi bi-shield-lock display-1 text-muted"></i>
          <h4 className="mt-3">{t('auditLogs.acessoRestrito')}</h4>
          <p className="text-muted">{t('auditLogs.apenasAdministradoresPodemVisualiz')}</p>
          <Link to="/" className="btn btn-primary">{t('auditLogs.voltarAoDashboard')}</Link>
        </Card.Body>
      </Card>
    );
  }
  
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">
          <i className="bi bi-journal-text me-2"></i>
          {t('auditLogs.logsDeAuditoria')}
        </h2>
        <Button variant="outline-secondary" size="sm" onClick={() => fetchLogs()}>
          <i className="bi bi-arrow-clockwise me-1"></i>{t('auditLogs.atualizar')}
        </Button>
      </div>
      
      {/* Filters */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-muted">{t('auditLogs.acao')}</Form.Label>
                <Form.Select 
                  size="sm"
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                >
                  <option value="">{t('auditLogs.todasAsAcoes')}</option>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small text-muted">{t('gpsEditor.type')}</Form.Label>
                <Form.Select 
                  size="sm"
                  value={filters.entity_type}
                  onChange={(e) => handleFilterChange('entity_type', e.target.value)}
                >
                  <option value="">{t('auditLogs.todosOsTipos')}</option>
                  {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small text-muted">{t('userActivity.user')}</Form.Label>
                <Form.Select 
                  size="sm"
                  value={filters.user_id}
                  onChange={(e) => handleFilterChange('user_id', e.target.value)}
                >
                  <option value="">{t('auditLogs.todosOsUsuarios')}</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>{u.name || u.email}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small text-muted">De</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={filters.date_from}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                />
              </Form.Group>
            </Col>
            
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small text-muted">{t('auditLogs.ate')}</Form.Label>
                <Form.Control
                  type="date"
                  size="sm"
                  value={filters.date_to}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                />
              </Form.Group>
            </Col>
            
            <Col md={1} className="d-flex align-items-end">
              <Button 
                variant="outline-secondary" 
                size="sm"
                onClick={clearFilters}
                title={t('auditLogs.limparFiltros')}
              >
                <i className="bi bi-x-lg"></i>
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      
      {/* Logs Table */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">{t('common.loading')}</span>
              </div>
            </div>
          ) : logs.length > 0 ? (
            <Table hover responsive className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th style={{ width: '150px' }}>{t('auditLogs.dataHora')}</th>
                  <th style={{ width: '150px' }}>{t('userActivity.user')}</th>
                  <th style={{ width: '120px' }}>{t('auditLogs.acao')}</th>
                  <th style={{ width: '100px' }}>{t('gpsEditor.type')}</th>
                  <th>{t('common.description')}</th>
                  <th style={{ width: '80px' }}>{t('postmortem.details')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log._id}>
                    <td>
                      <small className="text-muted d-block">{formatDate(log.created_at)}</small>
                      <small className="text-muted">{formatTimeAgo(log.created_at)}</small>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <i className="bi bi-person-circle text-muted me-2"></i>
                        <div>
                          <small>{log.user_info?.name || log.user_info?.email || 'Sistema'}</small>
                          {log.ip_address && (
                            <small className="d-block text-muted">{log.ip_address}</small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge bg={ACTION_BADGES[log.action] || 'secondary'}>
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </td>
                    <td>
                      <small className="text-muted">
                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                      </small>
                    </td>
                    <td>
                      <small>{log.description || `${ACTION_LABELS[log.action] || log.action} de ${ENTITY_LABELS[log.entity_type] || log.entity_type}`}</small>
                      {log.entity_id && (
                        <small className="d-block text-muted text-truncate" style={{ maxWidth: '300px' }}>
                          ID: {log.entity_id}
                        </small>
                      )}
                    </td>
                    <td>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0"
                        onClick={() => showLogDetail(log)}
                      >
                        <i className="bi bi-eye"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="text-center py-5">
              <i className="bi bi-journal-x display-4 text-muted"></i>
              <p className="text-muted mt-3">{t('auditLogs.nenhumLogEncontradoComOsFiltros')}</p>
            </div>
          )}
        </Card.Body>
        
        {/* Pagination */}
        {pagination.pages > 1 && (
          <Card.Footer className="bg-white border-top-0">
            <div className="d-flex justify-content-between align-items-center">
              <small className="text-muted">
                Mostrando {logs.length} de {pagination.total} registros
              </small>
              <Pagination size="sm" className="mb-0">
                <Pagination.First 
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(p => ({ ...p, page: 1 }))}
                />
                <Pagination.Prev 
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                />
                
                {[...Array(Math.min(5, pagination.pages))].map((_, idx) => {
                  let pageNum;
                  if (pagination.pages <= 5) {
                    pageNum = idx + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = idx + 1;
                  } else if (pagination.page >= pagination.pages - 2) {
                    pageNum = pagination.pages - 4 + idx;
                  } else {
                    pageNum = pagination.page - 2 + idx;
                  }
                  
                  return (
                    <Pagination.Item 
                      key={pageNum}
                      active={pageNum === pagination.page}
                      onClick={() => setPagination(p => ({ ...p, page: pageNum }))}
                    >
                      {pageNum}
                    </Pagination.Item>
                  );
                })}
                
                <Pagination.Next 
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                />
                <Pagination.Last 
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPagination(p => ({ ...p, page: pagination.pages }))}
                />
              </Pagination>
            </div>
          </Card.Footer>
        )}
      </Card>
      
      {/* Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-journal-text me-2"></i>
            {t('auditLogs.detalhesDoLog')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLog && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <small className="text-muted">{t('auditLogs.dataHora')}</small>
                  <p className="mb-0">{formatDate(selectedLog.created_at)}</p>
                </Col>
                <Col md={6}>
                  <small className="text-muted">IP</small>
                  <p className="mb-0">{selectedLog.ip_address || 'N/A'}</p>
                </Col>
              </Row>
              
              <Row className="mb-3">
                <Col md={6}>
                  <small className="text-muted">{t('userActivity.user')}</small>
                  <p className="mb-0">
                    {selectedLog.user_info?.name || selectedLog.user_info?.email || 'Sistema'}
                  </p>
                </Col>
                <Col md={6}>
                  <small className="text-muted">{t('auditLogs.userAgent')}</small>
                  <p className="mb-0 small text-truncate" title={selectedLog.user_agent}>
                    {selectedLog.user_agent || 'N/A'}
                  </p>
                </Col>
              </Row>
              
              <Row className="mb-3">
                <Col md={4}>
                  <small className="text-muted">{t('auditLogs.acao')}</small>
                  <p className="mb-0">
                    <Badge bg={ACTION_BADGES[selectedLog.action] || 'secondary'}>
                      {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                    </Badge>
                  </p>
                </Col>
                <Col md={4}>
                  <small className="text-muted">{t('auditLogs.tipoDeEntidade')}</small>
                  <p className="mb-0">{ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type}</p>
                </Col>
                <Col md={4}>
                  <small className="text-muted">{t('auditLogs.idDaEntidade')}</small>
                  <p className="mb-0 font-monospace small">{selectedLog.entity_id || 'N/A'}</p>
                </Col>
              </Row>
              
              {selectedLog.description && (
                <div className="mb-3">
                  <small className="text-muted">{t('common.description')}</small>
                  <p className="mb-0">{selectedLog.description}</p>
                </div>
              )}
              
              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div className="mb-3">
                  <small className="text-muted">{t('auditLogs.alteracoes')}</small>
                  <div className="bg-light p-3 rounded mt-1">
                    <pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <small className="text-muted">{t('auditLogs.metadados')}</small>
                  <div className="bg-light p-3 rounded mt-1">
                    <pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            {t('postmortem.close')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
