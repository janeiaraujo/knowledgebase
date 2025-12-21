import React, { useState, useEffect } from 'react';
import { Row, Col, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { recordAPI, incidentAPI, billingAPI } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalKBs: 0,
    recentKBs: [],
    openIncidents: 0,
    recentIncidents: [],
    usage: null
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchDashboardData();
  }, []);
  
  const fetchDashboardData = async () => {
    try {
      const [kbData, incidentData, usageData] = await Promise.all([
        recordAPI.list({ limit: 5 }),
        incidentAPI.list({ limit: 5 }),
        billingAPI.getUsage()
      ]);
      
      setStats({
        totalKBs: kbData.data.pagination.total,
        recentKBs: kbData.data.records,
        openIncidents: incidentData.data.incidents.filter(i => i.status === 'open').length,
        recentIncidents: incidentData.data.incidents,
        usage: usageData.data.usage
      });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <h2 className="mb-4">Dashboard</h2>
      
      <Row className="g-4 mb-4">
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-muted small">Total KBs</div>
                  <h3 className="mb-0">{stats.totalKBs}</h3>
                </div>
                <i className="bi bi-book fs-1 text-primary"></i>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-muted small">Open Incidents</div>
                  <h3 className="mb-0">{stats.openIncidents}</h3>
                </div>
                <i className="bi bi-exclamation-triangle fs-1 text-warning"></i>
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        {stats.usage && (
          <>
            <Col md={3}>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <div className="text-muted small">Users</div>
                  <h3 className="mb-0">
                    {stats.usage.users.used} / {stats.usage.users.limit}
                  </h3>
                  <div className="progress mt-2" style={{ height: '4px' }}>
                    <div 
                      className="progress-bar" 
                      style={{ width: `${stats.usage.users.percentage}%` }}
                    />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={3}>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <div className="text-muted small">AI Credits</div>
                  <h3 className="mb-0">
                    {stats.usage.ai_credits.used} / {stats.usage.ai_credits.limit}
                  </h3>
                  <div className="progress mt-2" style={{ height: '4px' }}>
                    <div 
                      className="progress-bar bg-success" 
                      style={{ width: `${stats.usage.ai_credits.percentage}%` }}
                    />
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </>
        )}
      </Row>
      
      <Row className="g-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-0 py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Recent Knowledge Base</h5>
                <Link to="/kb" className="btn btn-sm btn-link">View all</Link>
              </div>
            </Card.Header>
            <Card.Body>
              {stats.recentKBs.length > 0 ? (
                <div className="list-group list-group-flush">
                  {stats.recentKBs.map(kb => (
                    <Link
                      key={kb._id}
                      to={`/kb/${kb._id}`}
                      className="list-group-item list-group-item-action border-0"
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h6 className="mb-1">{kb.title}</h6>
                          <small className="text-muted">
                            {new Date(kb.created_at).toLocaleDateString()}
                          </small>
                        </div>
                        <span className={`badge bg-${getStatusBadge(kb.status)}`}>
                          {kb.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center py-4">No KBs yet</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-0 py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Recent Incidents</h5>
                <Link to="/incidents" className="btn btn-sm btn-link">View all</Link>
              </div>
            </Card.Header>
            <Card.Body>
              {stats.recentIncidents.length > 0 ? (
                <div className="list-group list-group-flush">
                  {stats.recentIncidents.map(incident => (
                    <Link
                      key={incident._id}
                      to={`/incidents/${incident._id}`}
                      className="list-group-item list-group-item-action border-0"
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h6 className="mb-1">{incident.title}</h6>
                          <small className="text-muted">
                            {new Date(incident.created_at).toLocaleDateString()}
                          </small>
                        </div>
                        <span className={`badge bg-${getSeverityBadge(incident.severity)}`}>
                          {incident.severity}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center py-4">No incidents yet</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
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

function getSeverityBadge(severity) {
  const badges = {
    low: 'info',
    medium: 'warning',
    high: 'danger',
    critical: 'danger'
  };
  return badges[severity] || 'secondary';
}
