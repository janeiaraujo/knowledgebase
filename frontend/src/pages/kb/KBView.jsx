import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Button, Badge, Modal } from 'react-bootstrap';
import { recordAPI } from '../../services/api';
import api from '../../services/api';
import ReactMarkdown from 'react-markdown';

export default function KBView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
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
  
  const handleApprove = async () => {
    try {
      await recordAPI.approve(id);
      fetchRecord();
    } catch (error) {
      alert('Failed to approve: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };
  
  const handlePublish = async () => {
    try {
      await recordAPI.publish(id);
      fetchRecord();
    } catch (error) {
      alert('Failed to publish: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };
  
  const handleDelete = async () => {
    try {
      await recordAPI.delete(id);
      navigate('/kb');
    } catch (error) {
      alert('Failed to delete: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };
  
  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }
  
  if (!record) {
    return <div className="alert alert-danger">KB not found</div>;
  }
  
  return (
    <>
      <div className="mb-4">
        <Link to="/kb" className="btn btn-link ps-0">
          <i className="bi bi-arrow-left me-2"></i>Back to KBs
        </Link>
      </div>
      
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-0 py-3">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h2 className="mb-2">{record.title}</h2>
              <div className="d-flex gap-2">
                <Badge bg={getStatusBadge(record.status)}>{record.status}</Badge>
                {record.properties?.priority && (
                  <Badge bg="secondary">{record.properties.priority}</Badge>
                )}
                {record.properties?.category && (
                  <Badge bg="info">{record.properties.category}</Badge>
                )}
              </div>
            </div>
            <div className="d-flex gap-2">
              {record.status === 'in_review' && (
                <Button variant="success" size="sm" onClick={handleApprove}>
                  <i className="bi bi-check-circle me-1"></i>Approve
                </Button>
              )}
              {record.status === 'approved' && (
                <Button variant="primary" size="sm" onClick={handlePublish}>
                  <i className="bi bi-upload me-1"></i>Publish
                </Button>
              )}
              <Link to={`/kb/${id}/edit`} className="btn btn-outline-primary btn-sm">
                <i className="bi bi-pencil me-1"></i>Edit
              </Link>
              <Button variant="outline-danger" size="sm" onClick={() => setShowDeleteModal(true)}>
                <i className="bi bi-trash me-1"></i>Delete
              </Button>
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
          
          <div className="content-preview">
            <div dangerouslySetInnerHTML={{ __html: record.content_md }} />
          </div>
        </Card.Body>
        
        <Card.Footer className="bg-white border-0 text-muted small">
          <div className="d-flex justify-content-between">
            <div>
              Created: {new Date(record.created_at).toLocaleString()}
            </div>
            <div>
              Version: {record.version}
            </div>
          </div>
        </Card.Footer>
      </Card>
      
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete KB</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this KB? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
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
    deprecated: 'danger'
  };
  return badges[status] || 'secondary';
}
