import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Form, Button } from 'react-bootstrap';
import { recordAPI } from '../../services/api';
import api from '../../services/api';
import CustomPropertyFields from '../../components/properties/CustomPropertyFields';
import RichTextEditor from '../../components/RichTextEditor';

export default function KBEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    content_md: '',
    status: 'draft',
    custom_properties: {}
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
        custom_properties: data.record.custom_properties || {}
      });
    } catch (error) {
      alert('Failed to load KB');
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
      alert('Failed to update KB: ' + (error.response?.data?.error || 'Unknown error'));
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
          <i className="bi bi-arrow-left me-2"></i>Back to KB
        </Link>
      </div>
      
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h3 className="mb-0">Edit KB</h3>
        </Card.Header>
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Content (Markdown)</Form.Label>
              <RichTextEditor
                value={formData.content_md}
                onChange={(value) => setFormData({...formData, content_md: value})}
                placeholder="Enter your KB content..."
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
            
            <div className="d-flex gap-2">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Link to={`/kb/${id}`} className="btn btn-secondary">Cancel</Link>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </>
  );
}
