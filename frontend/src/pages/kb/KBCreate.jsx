import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Button } from 'react-bootstrap';
import { recordAPI, databaseAPI } from '../../services/api';
import api from '../../services/api';
import CustomPropertyFields from '../../components/properties/CustomPropertyFields';
import RichTextEditor from '../../components/RichTextEditor';

export default function KBCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    content_md: '',
    status: 'draft',
    custom_properties: {}
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
      alert('Failed to create KB: ' + (error.response?.data?.error || 'Unknown error'));
      setLoading(false);
    }
  };
  
  return (
    <>
      <div className="mb-4">
        <Link to="/kb" className="btn btn-link ps-0">
          <i className="bi bi-arrow-left me-2"></i>Back to KBs
        </Link>
      </div>
      
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h3 className="mb-0">Create New KB</h3>
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
                placeholder="E.g., Database Connection Pool Exhaustion"
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
              <Form.Text className="text-muted">
                Rich text editor with formatting options
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
            
            <Form.Group className="mb-4">
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="draft">Draft</option>
                <option value="captured">Captured</option>
              </Form.Select>
            </Form.Group>
            
            <div className="d-flex gap-2 justify-content-between align-items-center">
              <div>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create KB'}
                </Button>
                <Link to="/kb" className="btn btn-secondary ms-2">Cancel</Link>
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
