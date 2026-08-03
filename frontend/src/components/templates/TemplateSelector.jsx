import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Card, Row, Col, Badge, Form, Spinner, Alert } from 'react-bootstrap';
import { templateAPI } from '../../services/api';

// Icon components using Bootstrap Icons
const IconFileAlt = () => <i className="bi bi-file-earmark-text"></i>;
const IconPlus = () => <i className="bi bi-plus-lg"></i>;
const IconStar = () => <i className="bi bi-star-fill"></i>;
const IconCheck = () => <i className="bi bi-check-lg"></i>;
const IconSearch = () => <i className="bi bi-search"></i>;

export default function TemplateSelector({ show, onHide, onSelect }) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  
  useEffect(() => {
    if (show) {
      fetchTemplates();
    }
  }, [show]);
  
  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await templateAPI.list();
      setTemplates(data.templates || []);
      
      // Extract unique categories
      const cats = [...new Set(data.templates?.map(tpl => tpl.category) || [])];
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectTemplate = async (template) => {
    try {
      // Use the template (increments usage count and returns content)
      const { data } = await templateAPI.use(template._id);
      onSelect({
        content_md: data.template.content_md,
        properties: data.template.properties,
        custom_properties: data.template.custom_properties
      });
      onHide();
    } catch (err) {
      console.error('Error using template:', err);
      setError('Failed to load template content');
    }
  };
  
  const handleStartBlank = () => {
    onSelect({
      content_md: '',
      properties: {},
      custom_properties: {}
    });
    onHide();
  };
  
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  
  const getCategoryLabel = (category) => {
    const labels = {
      incident: 'Incident Response',
      guide: 'How-To Guide',
      troubleshooting: 'Troubleshooting',
      api: 'API Documentation',
      runbook: 'Runbook',
      meeting: 'Meeting Notes',
      general: 'General'
    };
    return labels[category] || category;
  };
  
  const getCategoryColor = (category) => {
    const colors = {
      incident: 'danger',
      guide: 'primary',
      troubleshooting: 'warning',
      api: 'info',
      runbook: 'success',
      meeting: 'secondary',
      general: 'dark'
    };
    return colors[category] || 'secondary';
  };
  
  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <IconFileAlt className="me-2" />
          {t('templateSelector.chooseATemplate')}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {/* Filters */}
        <Row className="mb-4 g-2">
          <Col md={6}>
            <Form.Control
              type="text"
              placeholder={t('templateSelector.searchTemplates')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-light"
            />
          </Col>
          <Col md={6}>
            <Form.Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border-0 bg-light"
            >
              <option value="">{t('templateSelector.allCategories')}</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
              ))}
            </Form.Select>
          </Col>
        </Row>
        
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="text-muted mt-2">{t('templateSelector.loadingTemplates')}</p>
          </div>
        ) : (
          <>
            {/* Blank Document Option */}
            <Card 
              className="mb-3 cursor-pointer hover-shadow border-dashed"
              onClick={handleStartBlank}
              style={{ cursor: 'pointer' }}
            >
              <Card.Body className="d-flex align-items-center py-3">
                <div 
                  className="rounded-circle bg-light d-flex align-items-center justify-content-center me-3"
                  style={{ width: 48, height: 48 }}
                >
                  <IconPlus className="text-muted" />
                </div>
                <div>
                  <h6 className="mb-0">{t('templateSelector.startWithBlankDocument')}</h6>
                  <small className="text-muted">{t('templateSelector.beginFromScratch')}</small>
                </div>
              </Card.Body>
            </Card>
            
            {/* Templates Grid */}
            <Row className="g-3">
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map(template => (
                  <Col md={6} key={template._id}>
                    <Card 
                      className="h-100 cursor-pointer hover-shadow"
                      onClick={() => handleSelectTemplate(template)}
                      style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h6 className="mb-0">
                            {template.name}
                            {template.is_default && (
                              <IconStar className="text-warning ms-2" size={12} />
                            )}
                          </h6>
                          <Badge bg={getCategoryColor(template.category)}>
                            {getCategoryLabel(template.category)}
                          </Badge>
                        </div>
                        
                        <p className="text-muted small mb-2">
                          {template.description || 'No description'}
                        </p>
                        
                        <div className="d-flex justify-content-between align-items-center">
                          <small className="text-muted">
                            {template.is_system ? (
                              <Badge bg="light" text="dark">{t('templateSelector.system')}</Badge>
                            ) : (
                              <Badge bg="light" text="dark">{t('templateSelector.custom')}</Badge>
                            )}
                          </small>
                          <small className="text-muted">
                            Used {template.usage_count || 0} times
                          </small>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))
              ) : (
                <Col xs={12}>
                  <div className="text-center py-4 text-muted">
                    <IconSearch size={32} className="mb-2" />
                    <p>{t('templateSelector.noTemplatesFoundMatchingYourCriter')}</p>
                  </div>
                </Col>
              )}
            </Row>
          </>
        )}
      </Modal.Body>
      
      <Modal.Footer className="bg-light">
        <small className="text-muted me-auto">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
        </small>
        <Button variant="secondary" onClick={onHide}>
          {t('common.cancel')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// Template Manager Component for creating/editing templates
export function TemplateManager() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  useEffect(() => {
    fetchTemplates();
  }, []);
  
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await templateAPI.list();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };
  
  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };
  
  const handleDelete = async (templateId) => {
    if (!window.confirm(t('templateSelector.areYouSureYouWantTo'))) return;
    
    try {
      await templateAPI.delete(templateId);
      setSuccess('Template deleted successfully');
      fetchTemplates();
    } catch (err) {
      setError('Failed to delete template');
    }
  };
  
  const handleDuplicate = async (template) => {
    try {
      await templateAPI.duplicate(template._id, `${template.name} (Copy)`);
      setSuccess('Template duplicated successfully');
      fetchTemplates();
    } catch (err) {
      setError('Failed to duplicate template');
    }
  };
  
  const handleSeedDefaults = async () => {
    try {
      await templateAPI.seedDefaults();
      setSuccess('Default templates seeded successfully');
      fetchTemplates();
    } catch (err) {
      setError('Failed to seed default templates');
    }
  };
  
  const handleSave = async (templateData) => {
    try {
      if (editingTemplate) {
        await templateAPI.update(editingTemplate._id, templateData);
        setSuccess('Template updated successfully');
      } else {
        await templateAPI.create(templateData);
        setSuccess('Template created successfully');
      }
      setShowEditor(false);
      fetchTemplates();
    } catch (err) {
      setError('Failed to save template');
    }
  };
  
  const getCategoryColor = (category) => {
    const colors = {
      incident: 'danger',
      guide: 'primary',
      troubleshooting: 'warning',
      api: 'info',
      runbook: 'success',
      meeting: 'secondary',
      general: 'dark'
    };
    return colors[category] || 'secondary';
  };
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }
  
  return (
    <div>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          <IconFileAlt className="me-2" />
          {t('templateSelector.kbTemplates')}
        </h5>
        <div>
          <Button variant="outline-secondary" size="sm" className="me-2" onClick={handleSeedDefaults}>
            {t('templateSelector.seedDefaults')}
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate}>
            <IconPlus className="me-1" /> {t('templateSelector.newTemplate')}
          </Button>
        </div>
      </div>
      
      <Row className="g-3">
        {templates.map(template => (
          <Col md={6} lg={4} key={template._id}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h6 className="mb-0">
                    {template.name}
                    {template.is_default && <IconStar className="text-warning ms-1" size={12} />}
                  </h6>
                  <Badge bg={getCategoryColor(template.category)}>
                    {template.category}
                  </Badge>
                </div>
                
                <p className="text-muted small mb-3">
                  {template.description || 'No description'}
                </p>
                
                <div className="d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    {template.is_system ? 'System' : 'Custom'} • Used {template.usage_count || 0}x
                  </small>
                  
                  {!template.is_system && (
                    <div>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 me-2"
                        onClick={() => handleEdit(template)}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 me-2"
                        onClick={() => handleDuplicate(template)}
                      >
                        {t('templateSelector.copy')}
                      </Button>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 text-danger"
                        onClick={() => handleDelete(template._id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  )}
                  {template.is_system && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="p-0"
                      onClick={() => handleDuplicate(template)}
                    >
                      {t('templateSelector.copy')}
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      
      {/* Template Editor Modal */}
      <TemplateEditorModal
        show={showEditor}
        onHide={() => setShowEditor(false)}
        template={editingTemplate}
        onSave={handleSave}
      />
    </div>
  );
}

// Template Editor Modal
function TemplateEditorModal({ show, onHide, template, onSave }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    content_md: '',
    is_default: false
  });
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        description: template.description || '',
        category: template.category || 'general',
        content_md: template.content_md || '',
        is_default: template.is_default || false
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'general',
        content_md: '',
        is_default: false
      });
    }
  }, [template, show]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>
            {template ? 'Edit Template' : 'Create Template'}
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <Row className="g-3">
            <Col md={8}>
              <Form.Group>
                <Form.Label>{t('templateSelector.templateName')}</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </Form.Group>
            </Col>
            
            <Col md={4}>
              <Form.Group>
                <Form.Label>{t('templateSelector.category')}</Form.Label>
                <Form.Select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="general">{t('templateSelector.general')}</option>
                  <option value="incident">{t('templateSelector.incidentResponse')}</option>
                  <option value="guide">{t('templateSelector.howToGuide')}</option>
                  <option value="troubleshooting">{t('templateSelector.troubleshooting')}</option>
                  <option value="api">{t('templateSelector.apiDocumentation')}</option>
                  <option value="runbook">{t('templateSelector.runbook')}</option>
                  <option value="meeting">{t('templateSelector.meetingNotes')}</option>
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col xs={12}>
              <Form.Group>
                <Form.Label>{t('common.description')}</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('templateSelector.briefDescriptionOfThisTemplate')}
                />
              </Form.Group>
            </Col>
            
            <Col xs={12}>
              <Form.Group>
                <Form.Label>{t('templateSelector.contentMarkdown')}</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={12}
                  value={formData.content_md}
                  onChange={(e) => setFormData(prev => ({ ...prev, content_md: e.target.value }))}
                  style={{ fontFamily: 'monospace' }}
                  required
                />
                <Form.Text className="text-muted">
                  {t('templateSelector.useMarkdownFormattingUsePlaceholde')}
                </Form.Text>
              </Form.Group>
            </Col>
            
            <Col xs={12}>
              <Form.Check
                type="checkbox"
                label={t('templateSelector.setAsDefaultTemplateForThis')}
                checked={formData.is_default}
                onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
              />
            </Col>
          </Row>
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                {t('templateSelector.saving')}
              </>
            ) : (
              <>
                <IconCheck className="me-1" />
                {t('templateSelector.saveTemplate')}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
