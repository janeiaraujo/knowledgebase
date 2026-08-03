import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Button, Badge, Modal, Form, Alert, Dropdown, Tabs, Tab, Row, Col } from 'react-bootstrap';
import { recordAPI, exportAPI } from '../../services/api';
import api from '../../services/api';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import KBComments from '../../components/comments/KBComments';
import FavoriteButton from '../../components/favorites/FavoriteButton';
import KBRelations from '../../components/relations/KBRelations';
import RelatedKBs from '../../components/related/RelatedKBs';
import TableOfContents from '../../components/kb/TableOfContents';
import KBBreadcrumb from '../../components/kb/KBBreadcrumb';
import { useKBTracking } from '../../hooks/useKBTracking';
import KBViewStats from '../../components/kb/KBViewStats';

const isProbablyHtml = (value) => {
  if (!value) return false;
  return /<\/?[a-z][\s\S]*>/i.test(String(value));
};

// A API sempre manda { error: '<mensagem>' } em erros tratados, mas uma
// excecao nao tratada no servidor, ou uma falha de rede (sem response
// nenhum, ex.: CORS, timeout, servidor fora do ar) nao tem esse campo. Sem
// esses fallbacks, tudo isso virava um "Erro desconhecido" que escondia a
// causa real - inclusive de quem for depurar o problema depois.
const getErrorMessage = (error) =>
  error.response?.data?.error ||
  error.response?.data?.message ||
  (error.response ? `Erro ${error.response.status}` : error.message) ||
  t('common.unknownError');

export default function KBView() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [showTOC, setShowTOC] = useState(true);
  const contentRef = useRef(null);
  
  // Track KB view - records who is viewing this KB and for how long
  useKBTracking(id, !!record);
  
  useEffect(() => {
    fetchRecord();
    loadProperties();
  }, [id]);
  
  const loadProperties = async () => {
    try {
      const response = await api.get('/properties');
      setProperties(response.data.properties);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };
  
  const fetchRecord = async () => {
    try {
      const { data } = await recordAPI.get(id);
      setRecord(data.record);
    } catch (error) {
      console.error('Failed to fetch record:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmitForReview = async () => {
    setActionLoading(true);
    try {
      await recordAPI.submitForReview(id);
      fetchRecord();
    } catch (error) {
      alert(t('kbView.submitError') + ': ' + getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await recordAPI.approve(id);
      fetchRecord();
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      if (error.response?.status === 403) {
        if (errorMsg.includes('own KB')) {
          alert(t('kbView.cannotApproveOwn'));
        } else {
          alert(t('kbView.noApprovePermission'));
        }
      } else {
        alert(t('kbView.approveError') + ': ' + errorMsg);
      }
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleReject = async () => {
    setActionLoading(true);
    try {
      await recordAPI.reject(id, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
      fetchRecord();
    } catch (error) {
      alert(t('kbView.rejectError') + ': ' + getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };
  
  const handlePublish = async () => {
    setActionLoading(true);
    try {
      await recordAPI.publish(id);
      fetchRecord();
    } catch (error) {
      alert(t('kbView.publishError') + ': ' + getErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleDelete = async () => {
    try {
      await recordAPI.delete(id);
      navigate('/kb');
    } catch (error) {
      alert(t('kbView.deleteError') + ': ' + getErrorMessage(error));
    }
  };
  
  // Export functions
  const handleExportMarkdown = async () => {
    try {
      const response = await exportAPI.toMarkdown(id);
      const blob = new Blob([response.data], { type: 'text/markdown' });
      downloadBlob(blob, `${record.title.replace(/[^a-zA-Z0-9]/g, '-')}.md`);
    } catch (error) {
      alert(t('kbView.exportError') + ': ' + getErrorMessage(error));
    }
  };
  
  const handleExportPDF = async () => {
    try {
      const { data } = await exportAPI.toHTML(id);
      
      // Open print dialog with HTML content
      const printWindow = window.open('', '_blank');
      printWindow.document.write(data.html);
      printWindow.document.close();
      
      // Wait for content to load then trigger print
      printWindow.onload = () => {
        printWindow.print();
      };
    } catch (error) {
      alert(t('kbView.exportError') + ' PDF: ' + getErrorMessage(error));
    }
  };

  const handleExportJSON = async () => {
    try {
      const response = await api.get(`/export/kb/${id}/json`, { responseType: 'text' });
      const blob = new Blob([response.data], { type: 'application/json' });
      downloadBlob(blob, `${record.title.replace(/[^a-zA-Z0-9]/g, '-')}.json`);
    } catch (error) {
      alert(t('kbView.exportError') + ' JSON: ' + getErrorMessage(error));
    }
  };

  const handleExportWord = async () => {
    try {
      const response = await api.get(`/export/kb/${id}/docx-html`, { responseType: 'text' });
      const blob = new Blob([response.data], { type: 'application/vnd.ms-word' });
      downloadBlob(blob, `${record.title.replace(/[^a-zA-Z0-9]/g, '-')}.doc`);
    } catch (error) {
      alert(t('kbView.exportError') + ' Word: ' + getErrorMessage(error));
    }
  };

  const handleExportText = async () => {
    try {
      const response = await api.get(`/export/kb/${id}/txt`, { responseType: 'text' });
      const blob = new Blob([response.data], { type: 'text/plain' });
      downloadBlob(blob, `${record.title.replace(/[^a-zA-Z0-9]/g, '-')}.txt`);
    } catch (error) {
      alert(t('kbView.exportError') + ' TXT: ' + getErrorMessage(error));
    }
  };

  // Helper function to download blob
  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };
  
  // Check if user can approve (not the creator)
  const createdById = record?.created_by?.toString() || record?.created_by;
  const currentUserId = user?._id?.toString() || user?._id;
  const canApprove = record && user && createdById !== currentUserId && ['owner', 'admin'].includes(user.role);
  const canEdit = record && ['draft', 'rejected'].includes(record.status);
  const isCreator = record && user && createdById === currentUserId;
  
  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }
  
  if (!record) {
    return <div className="alert alert-danger">{t('kbView.notFound')}</div>;
  }
  
  return (
    <>
      {/* Breadcrumb Navigation */}
      <KBBreadcrumb 
        record={record} 
        category={record.category_info || (record.properties?.category ? { name: record.properties.category } : null)} 
      />
      
      {/* Rejection Alert */}
      {record.status === 'rejected' && record.rejection_reason && (
        <Alert variant="danger" className="mb-3">
          <Alert.Heading className="h6">
            <i className="bi bi-x-circle me-2"></i>{t('kbView.rejected')}
          </Alert.Heading>
          <p className="mb-0"><strong>{t('kbView.reason')}</strong> {record.rejection_reason}</p>
        </Alert>
      )}
      
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-0 py-3">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h2 className="mb-2">{record.title}</h2>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <Badge bg={getStatusBadge(record.status)} className="text-capitalize">
                  {getStatusLabel(record.status)}
                </Badge>
                {record.properties?.priority && (
                  <Badge bg="secondary">{record.properties.priority}</Badge>
                )}
                {record.properties?.category && (
                  <Badge bg="info">{record.properties.category}</Badge>
                )}
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {/* Favorite Button */}
              <FavoriteButton recordId={id} />
              
              {/* Workflow Actions */}
              {(record.status === 'draft' || record.status === 'rejected') && (
                <Button 
                  variant="info" 
                  size="sm" 
                  onClick={handleSubmitForReview}
                  disabled={actionLoading}
                >
                  <i className="bi bi-send me-1"></i>{t('kbView.submitForReview')}
                </Button>
              )}
              
              {record.status === 'in_review' && canApprove && (
                <>
                  <Button 
                    variant="success" 
                    size="sm" 
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    <i className="bi bi-check-circle me-1"></i>{t('kbView.approve')}
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                  >
                    <i className="bi bi-x-circle me-1"></i>{t('kbView.reject')}
                  </Button>
                </>
              )}
              
              {record.status === 'in_review' && isCreator && (
                <Badge bg="warning" text="dark" className="d-flex align-items-center">
                  <i className="bi bi-hourglass-split me-1"></i>{t('kbView.awaitingApproval')}
                </Badge>
              )}
              
              {record.status === 'approved' && (
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={handlePublish}
                  disabled={actionLoading}
                >
                  <i className="bi bi-globe me-1"></i>{t('kbView.publish')}
                </Button>
              )}
              
              {/* Edit button (only for draft/rejected) */}
              {canEdit && (
                <Link to={`/kb/${id}/edit`} className="btn btn-outline-primary btn-sm">
                  <i className="bi bi-pencil me-1"></i>{t('common.edit')}
                </Link>
              )}
              
              {/* Delete button */}
              <Button 
                variant="outline-danger" 
                size="sm" 
                onClick={() => setShowDeleteModal(true)}
              >
                <i className="bi bi-trash me-1"></i>{t('common.delete')}
              </Button>
              
              {/* Version History */}
              <Link to={`/kb/${id}/history`} className="btn btn-outline-info btn-sm">
                <i className="bi bi-clock-history me-1"></i>{t('kbView.history')}
              </Link>
              
              {/* Permissions (admin only) */}
              {user && ['owner', 'admin'].includes(user.role) && (
                <Link to={`/kb/${id}/permissions`} className="btn btn-outline-secondary btn-sm">
                  <i className="bi bi-shield-lock me-1"></i>{t('kbView.permissions')}
                </Link>
              )}
              
              {/* Export dropdown */}
              <Dropdown>
                <Dropdown.Toggle variant="outline-secondary" size="sm" id="export-dropdown">
                  <i className="bi bi-download me-1"></i>{t('kbView.export')}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Header>{t('kbView.documents')}</Dropdown.Header>
                  <Dropdown.Item onClick={handleExportMarkdown}>
                    <i className="bi bi-file-text me-2"></i>Markdown (.md)
                  </Dropdown.Item>
                  <Dropdown.Item onClick={handleExportPDF}>
                    <i className="bi bi-file-pdf me-2"></i>{t('kbView.pdfPrint')}
                  </Dropdown.Item>
                  <Dropdown.Item onClick={handleExportWord}>
                    <i className="bi bi-file-word me-2"></i>Word (.doc)
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Header>{t('kbView.otherFormats')}</Dropdown.Header>
                  <Dropdown.Item onClick={handleExportJSON}>
                    <i className="bi bi-filetype-json me-2"></i>JSON
                  </Dropdown.Item>
                  <Dropdown.Item onClick={handleExportText}>
                    <i className="bi bi-file-earmark-text me-2"></i>{t('kbView.plainText')} (.txt)
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>
        </Card.Header>
        
        <Card.Body className="p-4">
          {/* Custom Properties Display */}
          {record.custom_properties && Object.keys(record.custom_properties).length > 0 && (
            <div className="mb-4 pb-3 border-bottom">
              <div className="row">
                {properties.map((property) => {
                  const value = record.custom_properties[property._id];
                  if (!value) return null;
                  
                  return (
                    <div key={property._id} className="col-md-6 mb-3">
                      <small className="text-muted d-block mb-1">{property.name}</small>
                      <div>
                        {property.type === 'multiselect' ? (
                          <div className="d-flex flex-wrap gap-1">
                            {(Array.isArray(value) ? value : [value]).map((v, idx) => (
                              <Badge key={idx} bg="secondary">{v}</Badge>
                            ))}
                          </div>
                        ) : property.type === 'checkbox' ? (
                          <span>
                            <i className={`bi ${value ? 'bi-check-square-fill text-success' : 'bi-square'}`}></i>
                          </span>
                        ) : property.type === 'url' ? (
                          <a href={value} target="_blank" rel="noopener noreferrer">
                            {value}
                          </a>
                        ) : property.type === 'email' ? (
                          <a href={`mailto:${value}`}>{value}</a>
                        ) : property.type === 'phone' ? (
                          <a href={`tel:${value}`}>{value}</a>
                        ) : property.type === 'date' ? (
                          <span>{new Date(value).toLocaleDateString()}</span>
                        ) : property.type === 'textarea' ? (
                          <div dangerouslySetInnerHTML={{ __html: value }} />
                        ) : (
                          <span>{value}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TOC Toggle Button */}
          <div className="d-flex justify-content-end mb-3">
            <Button 
              variant="outline-secondary" 
              size="sm"
              onClick={() => setShowTOC(!showTOC)}
              title={showTOC ? t('kbView.hideToc') : t('kbView.showToc')}
            >
              <i className={`bi bi-${showTOC ? 'layout-sidebar-inset-reverse' : 'list-ul'} me-1`}></i>
              {showTOC ? t('kbView.hideToc') : t('kbView.showToc')}
            </Button>
          </div>
          
          {/* Content with TOC Sidebar */}
          <Row>
            <Col md={showTOC ? 9 : 12}>
              <div className="content-preview" ref={contentRef}>
                {isProbablyHtml(record.content_md) ? (
                  <div dangerouslySetInnerHTML={{ __html: record.content_md }} />
                ) : (
                  <ReactMarkdown
                    components={{
                      h1: ({node, children, ...props}) => <h1 id={`heading-${node.position?.start?.line || Math.random()}`} className="mt-4 mb-3 pb-2 border-bottom" {...props}>{children}</h1>,
                      h2: ({node, children, ...props}) => <h2 id={`heading-${node.position?.start?.line || Math.random()}`} className="mt-4 mb-3" {...props}>{children}</h2>,
                      h3: ({node, children, ...props}) => <h3 id={`heading-${node.position?.start?.line || Math.random()}`} className="mt-3 mb-2" {...props}>{children}</h3>,
                      h4: ({node, children, ...props}) => <h4 id={`heading-${node.position?.start?.line || Math.random()}`} className="mt-3 mb-2" {...props}>{children}</h4>,
                      h5: ({node, children, ...props}) => <h5 id={`heading-${node.position?.start?.line || Math.random()}`} className="mt-2 mb-2" {...props}>{children}</h5>,
                      h6: ({node, children, ...props}) => <h6 id={`heading-${node.position?.start?.line || Math.random()}`} className="mt-2 mb-2" {...props}>{children}</h6>,
                      // Handle pre tag to avoid nesting issues
                      pre: ({children, ...props}) => (
                        <pre className="bg-dark text-light p-3 rounded" {...props}>{children}</pre>
                      ),
                      // Handle code - inline only, block code is wrapped by pre
                      code: ({node, inline, className, children, ...props}) => {
                        // If it's inline code (not inside a pre)
                        if (inline) {
                          return <code className="bg-light px-1 rounded" {...props}>{children}</code>;
                        }
                        // Block code - just return the code element, pre is handled separately
                        return <code className={className} {...props}>{children}</code>;
                      }
                    }}
                  >
                    {record.content_md || ''}
                  </ReactMarkdown>
                )}
              </div>
            </Col>
            {showTOC && (
              <Col md={3}>
                <TableOfContents content={record.content_md || ''} />
                
                {/* View Statistics - only for admin/owner */}
                {(user?.role === 'admin' || user?.role === 'owner') && (
                  <KBViewStats kbId={id} />
                )}
              </Col>
            )}
          </Row>
        </Card.Body>
        
        <Card.Footer className="bg-white border-0 text-muted small">
          <div className="d-flex justify-content-between flex-wrap gap-2">
            <div>
              Criado: {new Date(record.created_at).toLocaleString()}
              {record.approved_at && (
                <span className="ms-3">| Aprovado: {new Date(record.approved_at).toLocaleString()}</span>
              )}
              {record.published_at && (
                <span className="ms-3">| Publicado: {new Date(record.published_at).toLocaleString()}</span>
              )}
            </div>
            <div>
              Versão: {record.version}
            </div>
          </div>
        </Card.Footer>
      </Card>
      
      {/* Tabbed Sections for Comments, Relations, and Related KBs */}
      <Card className="border-0 shadow-sm mt-4">
        <Card.Body className="p-0">
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-0 px-3 pt-3"
          >
            <Tab 
              eventKey="comments" 
              title={
                <span>
                  <i className="bi bi-chat-dots me-2"></i>
                  {t('kbView.comments')}
                </span>
              }
            >
              <div className="p-4">
                <KBComments recordId={id} />
              </div>
            </Tab>
            <Tab 
              eventKey="relations" 
              title={
                <span>
                  <i className="bi bi-link-45deg me-2"></i>
                  {t('kbView.manualRelations')}
                </span>
              }
            >
              <div className="p-4">
                <KBRelations recordId={id} />
              </div>
            </Tab>
            <Tab 
              eventKey="related" 
              title={
                <span>
                  <i className="bi bi-diagram-3 me-2"></i>
                  {t('kbView.relatedKbs')}
                </span>
              }
            >
              <div className="p-4">
                <RelatedKBs recordId={id} limit={6} />
              </div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
      
      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('kbView.deleteTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {t('kbView.deleteConfirm')}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            {t('common.delete')}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Reject Modal */}
      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('kbView.rejectTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>{t('kbView.rejectReason')}</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('kbView.rejectReasonPlaceholder')}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            variant="danger" 
            onClick={handleReject}
            disabled={actionLoading}
          >
            {actionLoading ? 'Rejeitando...' : 'Rejeitar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function getStatusBadge(status) {
  const badges = {
    captured: 'secondary',
    draft: 'warning',
    in_review: 'info',
    approved: 'success',
    published: 'primary',
    rejected: 'danger',
    deprecated: 'dark'
  };
  return badges[status] || 'secondary';
}

function getStatusLabel(status) {
  const labels = {
    captured: 'Capturado',
    draft: 'Rascunho',
    in_review: 'Em Revisão',
    approved: 'Aprovado',
    published: 'Publicado',
    rejected: 'Rejeitado',
    deprecated: 'Descontinuado'
  };
  return labels[status] || status;
}
