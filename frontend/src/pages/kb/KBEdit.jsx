import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Form, Button, Row, Col } from 'react-bootstrap';
import { recordAPI } from '../../services/api';
import api from '../../services/api';
import CustomPropertyFields from '../../components/properties/CustomPropertyFields';
import RichTextEditor from '../../components/RichTextEditor';
import { TagSelector, CategorySelector } from '../../components/tags/TagSelector';

export default function KBEdit() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    content_md: '',
    status: 'draft',
    custom_properties: {},
    tags: [],
    category_id: null
  });
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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
      setFormData({
        title: data.record.title,
        content_md: data.record.content_md,
        status: data.record.status,
        custom_properties: data.record.custom_properties || {},
        tags: data.record.tags?.map(tag => typeof tag === 'object' ? tag._id : tag) || [],
        category_id: data.record.category_id || null
      });
    } catch (error) {
      alert(t('kbEdit.failedToLoadKb'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await recordAPI.update(id, formData);
      navigate(`/kb/${id}`);
    } catch (error) {
      alert(t('kbEdit.failedToUpdateKb') + (error.response?.data?.error || 'Unknown error'));
      setSaving(false);
    }
  };
  
  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }
  
  return (
    <>
      <div className="mb-4">
        <Link to={`/kb/${id}`} className="btn btn-link ps-0">
          <i className="bi bi-arrow-left me-2"></i>{t('kbEdit.backToKb')}
        </Link>
      </div>
      
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h3 className="mb-0">{t('kbEdit.editKb')}</h3>
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
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>{t('kbEdit.contentMarkdown')}</Form.Label>
              <RichTextEditor
                value={formData.content_md}
                onChange={(value) => setFormData({...formData, content_md: value})}
                placeholder={t('kbEdit.enterYourKbContent')}
                height="400px"
              />
            </Form.Group>
            
            {/* Custom Properties */}
            {properties.length > 0 && (
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
                    <i className="bi bi-tags me-1"></i>{t('kbEdit.tags')}
                  </Form.Label>
                  <TagSelector
                    selectedTags={formData.tags}
                    onChange={(tags) => setFormData({...formData, tags})}
                  />
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
                </Form.Group>
              </Col>
            </Row>
            
            <div className="d-flex gap-2">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Link to={`/kb/${id}`} className="btn btn-secondary">{t('common.cancel')}</Link>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </>
  );
}
