import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Spinner, Alert, Form, ListGroup, ProgressBar } from 'react-bootstrap';
import { analyticsAPI } from '../services/api';
import { Link } from 'react-router-dom';

// Icon components using Bootstrap Icons
const IconChartLine = () => <i className="bi bi-graph-up"></i>;
const IconBook = () => <i className="bi bi-journal-text"></i>;
const IconUsers = () => <i className="bi bi-people"></i>;
const IconComments = () => <i className="bi bi-chat-dots"></i>;
const IconEye = () => <i className="bi bi-eye"></i>;
const IconStar = () => <i className="bi bi-star-fill"></i>;
const IconCalendar = () => <i className="bi bi-calendar"></i>;
const IconTrophy = () => <i className="bi bi-trophy"></i>;
const IconHistory = () => <i className="bi bi-clock-history"></i>;
const IconTag = () => <i className="bi bi-tag"></i>;
const IconFolder = () => <i className="bi bi-folder"></i>;
const IconBrain = () => <i className="bi bi-cpu"></i>;

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');
  
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [statusDist, setStatusDist] = useState([]);
  const [categoryDist, setCategoryDist] = useState([]);
  const [tagDist, setTagDist] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activity, setActivity] = useState([]);
  
  useEffect(() => {
    fetchAllData();
  }, [period]);
  
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [
        overviewRes,
        trendsRes,
        statusRes,
        categoryRes,
        tagRes,
        leaderboardRes,
        activityRes
      ] = await Promise.all([
        analyticsAPI.getOverview(period),
        analyticsAPI.getKBTrends(period, period === '1y' ? 'month' : 'day'),
        analyticsAPI.getStatusDistribution(),
        analyticsAPI.getCategoryDistribution(),
        analyticsAPI.getTagDistribution(),
        analyticsAPI.getUserLeaderboard(period),
        analyticsAPI.getActivity(15)
      ]);
      
      setOverview(overviewRes.data);
      setTrends(trendsRes.data.trends || []);
      setStatusDist(statusRes.data.distribution || []);
      setCategoryDist(categoryRes.data.distribution || []);
      setTagDist(tagRes.data.distribution || []);
      setLeaderboard(leaderboardRes.data.leaderboard || []);
      setActivity(activityRes.data.activities || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusColor = (status) => {
    const colors = {
      draft: '#ffc107',
      captured: '#6c757d',
      in_review: '#17a2b8',
      approved: '#28a745',
      published: '#007bff',
      deprecated: '#dc3545'
    };
    return colors[status] || '#6c757d';
  };
  
  const getActionLabel = (action) => {
    const labels = {
      'record.created': 'Created KB',
      'record.updated': 'Updated KB',
      'record.approved': 'Approved KB',
      'record.published': 'Published KB',
      'record.rejected': 'Rejected KB',
      'comment.created': 'Added comment',
      'user.login': 'Logged in',
      'user.created': 'User created'
    };
    return labels[action] || action;
  };
  
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getPeriodLabel = () => {
    const labels = { '7d': 'últimos 7 dias', '30d': 'últimos 30 dias', '90d': 'últimos 90 dias', '1y': 'último ano' };
    return labels[period] || 'período';
  };
  
  if (loading) {
    return (
      <Container fluid className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="text-muted mt-2">Loading analytics...</p>
      </Container>
    );
  }
  
  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1">
                <IconChartLine className="me-2" />
                Analytics Dashboard
              </h2>
              <p className="text-muted mb-0">
                Insights and metrics for your knowledge base
              </p>
            </div>
            
            <Form.Select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </Form.Select>
          </div>
        </Col>
      </Row>
      
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Overview Cards */}
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100 bg-primary text-white">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="text-white-50 mb-1">Total KBs</h6>
                  <h2 className="mb-0">{overview?.totals?.kbs || 0}</h2>
                  <small>
                    +{overview?.periodStats?.kbsCreated || 0} {getPeriodLabel()}
                  </small>
                </div>
                <IconBook size={32} className="text-white-50" />
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100 bg-success text-white">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="text-white-50 mb-1">Published</h6>
                  <h2 className="mb-0">{overview?.totals?.published || 0}</h2>
                  <small>
                    {Math.round((overview?.totals?.published / overview?.totals?.kbs) * 100 || 0)}% of total
                  </small>
                </div>
                <IconStar size={32} className="text-white-50" />
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100 bg-info text-white">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="text-white-50 mb-1">Total Views</h6>
                  <h2 className="mb-0">{overview?.views?.total || 0}</h2>
                  <small>
                    Avg {overview?.views?.average || 0} per KB
                  </small>
                </div>
                <IconEye size={32} className="text-white-50" />
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100 bg-warning text-dark">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="text-dark-50 mb-1">In Review</h6>
                  <h2 className="mb-0">{overview?.totals?.inReview || 0}</h2>
                  <small>
                    {overview?.totals?.drafts || 0} drafts
                  </small>
                </div>
                <IconCalendar size={32} className="opacity-50" />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Row className="mb-4 g-3">
        {/* Status Distribution */}
        <Col lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom">
              <h6 className="mb-0">
                <IconFolder className="me-2 text-primary" />
                Status Distribution
              </h6>
            </Card.Header>
            <Card.Body>
              {statusDist.length > 0 ? (
                <div>
                  {statusDist.map((item) => (
                    <div key={item._id} className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-capitalize">{item._id?.replace('_', ' ')}</span>
                        <span className="text-muted">{item.count}</span>
                      </div>
                      <ProgressBar 
                        now={(item.count / overview?.totals?.kbs) * 100} 
                        style={{ height: '8px', backgroundColor: '#e9ecef' }}
                        variant={item._id === 'published' ? 'success' : 
                                item._id === 'draft' ? 'warning' : 
                                item._id === 'in_review' ? 'info' : 'secondary'}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center">No data</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        {/* Category Distribution */}
        <Col lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom">
              <h6 className="mb-0">
                <IconFolder className="me-2 text-success" />
                By Category
              </h6>
            </Card.Header>
            <Card.Body>
              {categoryDist.length > 0 ? (
                <ListGroup variant="flush">
                  {categoryDist.slice(0, 6).map((cat) => (
                    <ListGroup.Item key={cat._id} className="d-flex justify-content-between align-items-center px-0">
                      <div className="d-flex align-items-center">
                        <div 
                          className="rounded-circle me-2"
                          style={{ 
                            width: 12, 
                            height: 12, 
                            backgroundColor: cat.color || '#6c757d' 
                          }}
                        />
                        <span>{cat.name}</span>
                      </div>
                      <Badge bg="light" text="dark">{cat.count}</Badge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <p className="text-muted text-center">No categories used</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        {/* Popular Tags */}
        <Col lg={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom">
              <h6 className="mb-0">
                <IconTag className="me-2 text-info" />
                Popular Tags
              </h6>
            </Card.Header>
            <Card.Body>
              {tagDist.length > 0 ? (
                <div className="d-flex flex-wrap gap-2">
                  {tagDist.map((tag) => (
                    <Badge 
                      key={tag._id}
                      style={{ 
                        backgroundColor: tag.color || '#6c757d',
                        fontSize: '0.85rem'
                      }}
                    >
                      {tag.name} ({tag.count})
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-center">No tags used</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Row className="mb-4 g-3">
        {/* Top KBs */}
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom">
              <h6 className="mb-0">
                <IconEye className="me-2 text-primary" />
                Most Viewed KBs
              </h6>
            </Card.Header>
            <Card.Body className="p-0">
              {overview?.topKBs?.length > 0 ? (
                <ListGroup variant="flush">
                  {overview.topKBs.map((kb, index) => (
                    <ListGroup.Item 
                      key={kb._id} 
                      as={Link}
                      to={`/kb/${kb._id}`}
                      action
                      className="d-flex justify-content-between align-items-center"
                    >
                      <div className="d-flex align-items-center">
                        <span className="text-muted me-3 fw-bold">#{index + 1}</span>
                        <div>
                          <div className="fw-medium">{kb.title}</div>
                          <small className="text-muted">{kb.status}</small>
                        </div>
                      </div>
                      <Badge bg="primary">{kb.views} views</Badge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <p className="text-muted text-center py-4">No views recorded yet</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        {/* User Leaderboard */}
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white border-bottom">
              <h6 className="mb-0">
                <IconTrophy className="me-2 text-warning" />
                Top Contributors ({getPeriodLabel()})
              </h6>
            </Card.Header>
            <Card.Body className="p-0">
              {leaderboard.length > 0 ? (
                <ListGroup variant="flush">
                  {leaderboard.map((user, index) => (
                    <ListGroup.Item key={user.userId} className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        <div 
                          className={`rounded-circle me-3 d-flex align-items-center justify-content-center
                            ${index === 0 ? 'bg-warning' : index === 1 ? 'bg-secondary' : index === 2 ? 'bg-danger' : 'bg-light'}`}
                          style={{ width: 32, height: 32 }}
                        >
                          <span className={index < 3 ? 'text-white fw-bold' : 'text-dark'}>
                            {index + 1}
                          </span>
                        </div>
                        <div>
                          <div className="fw-medium">{user.name}</div>
                          <small className="text-muted">{user.email}</small>
                        </div>
                      </div>
                      <div className="text-end">
                        <Badge bg="primary" className="me-1">{user.kbsCreated} KBs</Badge>
                        <Badge bg="success">{user.published} published</Badge>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <p className="text-muted text-center py-4">No activity in this period</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Recent Activity */}
      <Row>
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom">
              <h6 className="mb-0">
                <IconHistory className="me-2 text-secondary" />
                Recent Activity
              </h6>
            </Card.Header>
            <Card.Body className="p-0">
              {activity.length > 0 ? (
                <ListGroup variant="flush">
                  {activity.map((item, index) => (
                    <ListGroup.Item key={index} className="d-flex align-items-center">
                      <div 
                        className="rounded-circle bg-light d-flex align-items-center justify-content-center me-3"
                        style={{ width: 40, height: 40, minWidth: 40 }}
                      >
                        <IconHistory className="text-muted" />
                      </div>
                      <div className="flex-grow-1">
                        <div>
                          <strong>{item.user?.name || 'System'}</strong>
                          {' '}
                          <span className="text-muted">{getActionLabel(item.action)}</span>
                        </div>
                        <small className="text-muted">
                          {formatDate(item.timestamp)}
                        </small>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : (
                <p className="text-muted text-center py-4">No recent activity</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
