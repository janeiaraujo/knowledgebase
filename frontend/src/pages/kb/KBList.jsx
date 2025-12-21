import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Form, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { recordAPI } from '../../services/api';

export default function KBList() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  useEffect(() => {
    fetchRecords();
  }, [statusFilter]);
  
  const fetchRecords = async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      
      const { data } = await recordAPI.list(params);
      setRecords(data.records);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredRecords = records.filter(record =>
    record.title.toLowerCase().includes(search.toLowerCase())
  );
  
  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }
  
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Knowledge Base</h2>
        <Link to="/kb/new" className="btn btn-primary">
          <i className="bi bi-plus-circle me-2"></i>New KB
        </Link>
      </div>
      
      <Row className="mb-4">
        <Col md={6}>
          <Form.Control
            type="search"
            placeholder="Search KBs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="captured">Captured</option>
            <option value="draft">Draft</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </Form.Select>
        </Col>
      </Row>
      
      <Row className="g-3">
        {filteredRecords.map(record => (
          <Col key={record._id} md={6} lg={4}>
            <Card className="kb-card h-100 border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between mb-2">
                  <Badge bg={getStatusBadge(record.status)}>{record.status}</Badge>
                  {record.properties?.priority && (
                    <Badge bg="secondary">{record.properties.priority}</Badge>
                  )}
                </div>
                <Card.Title as="h5">{record.title}</Card.Title>
                <Card.Text className="text-muted">
                  {record.content_md?.substring(0, 100)}...
                </Card.Text>
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <small className="text-muted">
                    {new Date(record.created_at).toLocaleDateString()}
                  </small>
                  <Link to={`/kb/${record._id}`} className="btn btn-sm btn-outline-primary">
                    View <i className="bi bi-arrow-right"></i>
                  </Link>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      
      {filteredRecords.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-inbox fs-1 text-muted"></i>
          <p className="text-muted mt-3">No KBs found</p>
        </div>
      )}
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
