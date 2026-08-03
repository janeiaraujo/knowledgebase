import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Button, Row, Col } from 'react-bootstrap';
import { recordAPI } from '../../services/api';
import api from '../../services/api';
import CustomPropertyFields from '../../components/properties/CustomPropertyFields';
import RichTextEditor from '../../components/RichTextEditor';
import { TagSelector, CategorySelector } from '../../components/tags/TagSelector';
import TemplateSelector from '../../components/templates/TemplateSelector';

// Icon component using Bootstrap Icons
const IconFileAlt = () => <i className="bi bi-file-earmark-text"></i>;

export default function KBCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showTemplateSelector, setShowTemplateSelector] = useState(true); // Show on load
  const [formData, setFormData] = useState({
    title: '',
    content_md: '',
    status: 'draft',
    custom_properties: {},
    tags: [],
    category_id: null
  });
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(true);
  
  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const response = await api.get('/properties');
      setProperties(response.data.properties);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoadingProperties(false);
    }
  };
  
  const handleTemplateSelect = (templateData) => {
    setFormData(prev => ({
      ...prev,
      content_md: templateData.content_md || '',
      custom_properties: templateData.custom_properties || {}
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data } = await recordAPI.create({
        ...formData,
        database_id: null, // Will be set by backend
        properties: {}
      });
      navigate(`/kb/${data.recordId}`);
    } catch (error) {
      alert(t('kbCreate.failedToCreateKb') + (error.response?.data?.error || 'Unknown error'));
      setLoading(false);
    }
  };
  
  return (
    <>
      {/* Template Selector Modal */}
      <TemplateSelector
        show={showTemplateSelector}
        onHide={() => setShowTemplateSelector(false)}
        onSelect={handleTemplateSelect}
      />
      
      <div className="mb-4">
        <Link to="/kb" className="btn btn-link ps-0">
          <i className="bi bi-arrow-left me-2"></i>{t('kbCreate.backToKbs')}
        </Link>
      </div>
      
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
          <h3 className="mb-0">{t('kbCreate.createNewKb')}</h3>
          <Button 
            variant="outline-secondary" 
            size="sm"
            onClick={() => setShowTemplateSelector(true)}
          >
            <IconFileAlt className="me-1" />
            {t('kbCreate.chooseTemplate')}
          </Button>
        </Card.Header>
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>{t('common.title')}</Form.Label>
              <Form.Control
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
                placeholder={t('kbCreate.eGDatabaseConnectionPoolExhaustion')}
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>{t('kbCreate.contentMarkdown')}</Form.Label>
              <RichTextEditor
                value={formData.content_md}
                onChange={(value) => setFormData({...formData, content_md: value})}
                placeholder={t('kbCreate.enterYourKbContent')}
                height="400px"
              />
              <Form.Text className="text-muted">
                {t('kbCreate.richTextEditorWithFormattingOption')}
              </Form.Text>
            </Form.Group>
            
            {/* Custom Properties - Integrated */}
            {!loadingProperties && properties.length > 0 && (
              <CustomPropertyFields
                properties={properties}
                values={formData.custom_properties}
                onChange={(values) => setFormData({...formData, custom_properties: values})}
              />
            )}
            
            {/* Tags and Category */}
            <Row className="mb-4">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>
                    <i className="bi bi-tags me-1"></i>{t('kbCreate.tags')}
                  </Form.Label>
                  <TagSelector
                    selectedTags={formData.tags}
                    onChange={(tags) => setFormData({...formData, tags})}
                  />
                  <Form.Text className="text-muted">
                    {t('kbCreate.adicioneTagsParaFacilitarABusca')}
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>
                    <i className="bi bi-folder me-1"></i>{t('search.category')}
                  </Form.Label>
                  <CategorySelector
                    selectedCategory={formData.category_id}
                    onChange={(category_id) => setFormData({...formData, category_id})}
                  />
                  <Form.Text className="text-muted">
                    {t('kbCreate.organizeEmCategorias')}
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-4">
              <Form.Label>{t('common.status')}</Form.Label>
              <Form.Select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="draft">{t('kbCreate.draft')}</option>
                <option value="captured">{t('kbCreate.captured')}</option>
              </Form.Select>
            </Form.Group>
            
            <div className="d-flex gap-2 justify-content-between align-items-center">
              <div>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create KB'}
                </Button>
                <Link to="/kb" className="btn btn-secondary ms-2">{t('common.cancel')}</Link>
              </div>
              {properties.length === 0 && !loadingProperties && (
                <Link to="/properties" className="btn btn-outline-secondary btn-sm">
                  + Adicionar Propriedades Customizadas
                </Link>
              )}
            </div>
          </Form>
        </Card.Body>
      </Card>
    </>
  );
}
