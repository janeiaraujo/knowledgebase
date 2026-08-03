import React, { useState, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Container, Row, Col, Card, Form, Button, Badge, Spinner, Alert, ListGroup, ProgressBar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { kbAPI, aiAPI, tagAPI, categoryAPI } from '../services/api';

// Icon components using Bootstrap Icons
const IconSearch = () => <i className="bi bi-search"></i>;
const IconBrain = () => <i className="bi bi-cpu"></i>;
const IconFilter = () => <i className="bi bi-funnel"></i>;
const IconTimes = () => <i className="bi bi-x-lg"></i>;
const IconTag = () => <i className="bi bi-tag"></i>;
const IconFolder = () => <i className="bi bi-folder"></i>;
const IconCalendar = () => <i className="bi bi-calendar"></i>;
const IconUser = () => <i className="bi bi-person"></i>;
const IconEye = () => <i className="bi bi-eye"></i>;
const IconRobot = () => <i className="bi bi-robot"></i>;

export default function Search() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('text'); // 'text' or 'semantic'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [indexStatus, setIndexStatus] = useState(null);
  const [indexing, setIndexing] = useState(false);
  const [indexMessage, setIndexMessage] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    category_id: '',
    tags: [],
    dateFrom: '',
    dateTo: '',
    sortBy: 'relevance'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter options
  const [categories, setCategories] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const limit = 10;
  
  useEffect(() => {
    fetchFilterOptions();
    fetchIndexStatus();
  }, []);
  
  const fetchIndexStatus = async () => {
    try {
      const { data } = await aiAPI.getIndexStatus();
      setIndexStatus(data);
    } catch (error) {
      console.error('Error fetching index status:', error);
    }
  };
  
  const handleIndexAll = async () => {
    setIndexing(true);
    setIndexMessage(null);
    try {
      const { data } = await aiAPI.indexAll();
      setIndexMessage({ type: 'success', text: data.message });
      fetchIndexStatus();
      
      // If there are remaining KBs, ask to continue
      if (data.remaining > 0) {
        setTimeout(() => {
          if (window.confirm(`Ainda restam ${data.remaining} KBs para indexar. Deseja continuar?`)) {
            handleIndexAll();
          }
        }, 500);
      }
    } catch (error) {
      setIndexMessage({ 
        type: 'danger', 
        text: error.response?.data?.error || t('search.indexError') 
      });
    } finally {
      setIndexing(false);
    }
  };
  
  const fetchFilterOptions = async () => {
    try {
      const [catRes, tagsRes] = await Promise.all([
        categoryAPI.list(),
        tagAPI.list()
      ]);
      setCategories(catRes.data.categories || []);
      setAvailableTags(tagsRes.data.tags || []);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };
  
  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    setSearched(true);
    
    try {
      if (searchType === 'semantic') {
        await performSemanticSearch();
      } else {
        await performTextSearch();
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.response?.data?.error || t('search.searchError'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };
  
  const performTextSearch = async () => {
    const params = {
      q: query,
      page,
      limit,
      ...(filters.status && { status: filters.status }),
      ...(filters.category_id && { category_id: filters.category_id }),
      ...(filters.tags.length > 0 && { tags: filters.tags.join(',') }),
      ...(filters.dateFrom && { date_from: filters.dateFrom }),
      ...(filters.dateTo && { date_to: filters.dateTo }),
      ...(filters.sortBy && { sort_by: filters.sortBy })
    };
    
    const { data } = await kbAPI.search(params);
    setResults(data.results || []);
    setTotalResults(data.total || data.results?.length || 0);
  };
  
  const performSemanticSearch = async () => {
    const { data } = await aiAPI.semanticSearch({
      query,
      limit: 20
    });
    
    let filteredResults = data.results || [];
    
    // Show fallback message if semantic search is not available
    if (data.fallback) {
      setError(data.message || 'Busca semântica indisponível. Mostrando resultados de busca por texto.');
    }
    
    // Apply client-side filters for semantic search
    if (filters.status) {
      filteredResults = filteredResults.filter(r => r.status === filters.status);
    }
    if (filters.category_id) {
      filteredResults = filteredResults.filter(r => 
        r.category_id?.toString() === filters.category_id
      );
    }
    if (filters.tags.length > 0) {
      filteredResults = filteredResults.filter(r => 
        r.tags?.some(tag => filters.tags.includes(tag.toString()))
      );
    }
    
    setResults(filteredResults);
    setTotalResults(filteredResults.length);
  };
  
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const handleTagToggle = (tagId) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      status: '',
      category_id: '',
      tags: [],
      dateFrom: '',
      dateTo: '',
      sortBy: 'relevance'
    });
  };
  
  const getStatusBadge = (status) => {
    const badges = {
      captured: 'secondary',
      draft: 'warning',
      in_review: 'info',
      approved: 'success',
      published: 'primary',
      deprecated: 'danger'
    };
    return badges[status] || 'secondary';
  };
  
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };
  
  const getSimilarityColor = (similarity) => {
    if (similarity >= 0.8) return 'success';
    if (similarity >= 0.6) return 'info';
    if (similarity >= 0.4) return 'warning';
    return 'secondary';
  };
  
  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="mb-1">
            <IconSearch className="me-2" />
            {t('search.title')}
          </h2>
          <p className="text-muted">
            {t('search.subtitle')}
          </p>
        </Col>
      </Row>
      
      {/* Search Form */}
      <Row className="mb-4">
        <Col lg={10}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <Form onSubmit={handleSearch}>
                <Row className="align-items-end g-3">
                  <Col md={7}>
                    <Form.Group>
                      <Form.Label className="small text-muted">{t('search.query')}</Form.Label>
                      <Form.Control
                        type="text"
                        size="lg"
                        placeholder={searchType === 'semantic'
                          ? t('search.placeholderSemantic')
                          : t('search.placeholderText')
                        }
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label className="small text-muted">{t('search.type')}</Form.Label>
                      <Form.Select
                        size="lg"
                        value={searchType}
                        onChange={(e) => setSearchType(e.target.value)}
                      >
                        <option value="text">{t('search.typeText')}</option>
                        <option value="semantic">
                          🧠 {t('search.typeSemantic')}
                        </option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  
                  <Col md={2}>
                    <div className="d-grid gap-2">
                      <Button 
                        type="submit" 
                        variant="primary" 
                        size="lg"
                        disabled={loading || !query.trim()}
                      >
                        {loading ? (
                          <Spinner size="sm" animation="border" />
                        ) : (
                          <>
                            <IconSearch className="me-2" />
                            {t('search.submit')}
                          </>
                        )}
                      </Button>
                    </div>
                  </Col>
                </Row>
                
                {/* Filter Toggle */}
                <div className="mt-3">
                  <Button
                    variant="link"
                    className="p-0 text-decoration-none"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <IconFilter className="me-1" />
                    {showFilters ? t('search.hideFilters') : t('search.showFilters')}
                    {(filters.status || filters.category_id || filters.tags.length > 0) && (
                      <Badge bg="primary" className="ms-2">
                        {[
                          filters.status ? 1 : 0,
                          filters.category_id ? 1 : 0,
                          filters.tags.length
                        ].reduce((a, b) => a + b, 0)}
                      </Badge>
                    )}
                  </Button>
                </div>
                
                {/* Filters Panel */}
                {showFilters && (
                  <div className="mt-3 p-3 bg-light rounded">
                    <Row className="g-3">
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className="small">{t('common.status')}</Form.Label>
                          <Form.Select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                          >
                            <option value="">{t('search.allStatuses')}</option>
                            <option value="draft">{t('kb.status.draft')}</option>
                            <option value="in_review">{t('kb.status.in_review')}</option>
                            <option value="approved">{t('kb.status.approved')}</option>
                            <option value="published">{t('kb.status.published')}</option>
                            <option value="deprecated">{t('kb.status.deprecated')}</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className="small">{t('search.category')}</Form.Label>
                          <Form.Select
                            value={filters.category_id}
                            onChange={(e) => handleFilterChange('category_id', e.target.value)}
                          >
                            <option value="">{t('kb.allCategories')}</option>
                            {categories.map(cat => (
                              <option key={cat._id} value={cat._id}>
                                {cat.name}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className="small">Date From</Form.Label>
                          <Form.Control
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className="small">Date To</Form.Label>
                          <Form.Control
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                      
                      <Col md={9}>
                        <Form.Group>
                          <Form.Label className="small">{t('search.tags')}</Form.Label>
                          <div className="d-flex flex-wrap gap-2">
                            {availableTags.map(tag => (
                              <Badge
                                key={tag._id}
                                bg={filters.tags.includes(tag._id) ? 'primary' : 'light'}
                                text={filters.tags.includes(tag._id) ? 'white' : 'dark'}
                                style={{ 
                                  cursor: 'pointer',
                                  borderColor: tag.color,
                                  borderWidth: '2px',
                                  borderStyle: 'solid'
                                }}
                                onClick={() => handleTagToggle(tag._id)}
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </Form.Group>
                      </Col>
                      
                      <Col md={3}>
                        <Form.Group>
                          <Form.Label className="small">{t('search.sortBy')}</Form.Label>
                          <Form.Select
                            value={filters.sortBy}
                            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                          >
                            <option value="relevance">{t('search.sortRelevance')}</option>
                            <option value="date_desc">{t('search.sortNewest')}</option>
                            <option value="date_asc">{t('search.sortOldest')}</option>
                            <option value="title">{t('search.sortTitle')}</option>
                            <option value="views">{t('search.sortViews')}</option>
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      
                      <Col xs={12}>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={clearFilters}
                        >
                          <IconTimes className="me-1" />
                          {t('kb.clearFilters')}
                        </Button>
                      </Col>
                    </Row>
                  </div>
                )}
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Search Tips & AI Status */}
        <Col lg={2}>
          <Card className="border-0 shadow-sm bg-light mb-3">
            <Card.Body>
              <h6 className="text-muted mb-3">
                <IconBrain className="me-2" />
                {t('search.tips')}
              </h6>
              <ul className="small text-muted mb-0" style={{ paddingLeft: '1.2rem' }}>
                <li className="mb-2">
                  <Trans i18nKey="search.tip1" components={{ b: <strong /> }} />
                </li>
                <li className="mb-2">{t('search.tip2')}</li>
                <li className="mb-2">{t('search.tip3')}</li>
                <li>{t('search.tip4')}</li>
              </ul>
            </Card.Body>
          </Card>
          
          {/* AI Indexing Status */}
          <Card className="border-0 shadow-sm bg-white">
            <Card.Body>
              <h6 className="text-muted mb-3">
                <IconRobot className="me-2" />
                {t('search.aiIndexing')}
              </h6>
              {indexStatus && (
                <>
                  <div className="small mb-2">
                    <span className="text-muted">{t('search.indexedKbs')}</span>
                    <strong className="ms-1">{indexStatus.indexed}/{indexStatus.total}</strong>
                  </div>
                  <ProgressBar 
                    now={indexStatus.percentage} 
                    variant={indexStatus.percentage === 100 ? 'success' : 'primary'}
                    className="mb-2"
                    style={{ height: '6px' }}
                  />
                  {indexStatus.pending > 0 && (
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="w-100"
                      onClick={handleIndexAll}
                      disabled={indexing}
                    >
                      {indexing ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-1" />
                          {t('search.indexing')}
                        </>
                      ) : (
                        <>
                          <IconBrain className="me-1" />
                          {t('search.indexNow', { count: indexStatus.pending })}
                        </>
                      )}
                    </Button>
                  )}
                  {indexStatus.percentage === 100 && (
                    <Badge bg="success" className="w-100">
                      <i className="bi bi-check-circle me-1"></i>
                      {t('search.fullyIndexed')}
                    </Badge>
                  )}
                </>
              )}
              {indexMessage && (
                <Alert 
                  variant={indexMessage.type} 
                  className="mt-2 mb-0 py-1 px-2 small"
                  dismissible
                  onClose={() => setIndexMessage(null)}
                >
                  {indexMessage.text}
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Error Alert */}
      {error && (
        <Alert variant="warning" className="mb-4" dismissible onClose={() => setError(null)}>
          <i className="bi bi-info-circle me-2"></i>
          {error}
        </Alert>
      )}
      
      {/* Results */}
      {searched && (
        <Row>
          <Col lg={10}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-bottom">
                <div className="d-flex justify-content-between align-items-center">
                  <span>
                    <Trans
                      i18nKey="search.resultsFound"
                      count={totalResults}
                      components={{ b: <strong /> }}
                    />
                    {searchType === 'semantic' && (
                      <Badge bg="info" className="ms-2">IA</Badge>
                    )}
                  </span>
                  {query && (
                    <span className="text-muted">
                      <Trans i18nKey="search.forQuery" values={{ query }} components={{ b: <strong /> }} />
                    </span>
                  )}
                </div>
              </Card.Header>
              
              <Card.Body className="p-0">
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="text-muted mt-3">
                      {searchType === 'semantic' ? t('search.analyzing') : t('search.searching')}
                    </p>
                  </div>
                ) : results.length > 0 ? (
                  <ListGroup variant="flush">
                    {results.map((result, index) => (
                      <ListGroup.Item 
                        key={result._id} 
                        className="p-4 border-bottom"
                        action
                        as={Link}
                        to={`/kb/${result._id}`}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="flex-grow-1">
                            <h5 className="mb-1">
                              {result.title}
                              {searchType === 'semantic' && result.similarity && (
                                <Badge 
                                  bg={getSimilarityColor(result.similarity)} 
                                  className="ms-2"
                                  title={t('search.similarityScore')}
                                >
                                  {t('search.relevantPct', { pct: (result.similarity * 100).toFixed(0) })}
                                </Badge>
                              )}
                            </h5>
                            
                            {/* Metadata */}
                            <div className="text-muted small mb-2">
                              <span className="me-3">
                                <IconCalendar className="me-1" />
                                {formatDate(result.created_at)}
                              </span>
                              {result.creator_info?.name && (
                                <span className="me-3">
                                  <IconUser className="me-1" />
                                  {result.creator_info.name}
                                </span>
                              )}
                              {result.views > 0 && (
                                <span className="me-3">
                                  <IconEye className="me-1" />
                                  {t('search.views', { count: result.views })}
                                </span>
                              )}
                            </div>
                            
                            {/* Description/Summary */}
                            {result.properties?.summary && (
                              <p className="text-muted mb-2" style={{ maxWidth: '700px' }}>
                                {result.properties.summary.substring(0, 200)}
                                {result.properties.summary.length > 200 ? '...' : ''}
                              </p>
                            )}
                            
                            {/* Tags */}
                            {result.tags_info && result.tags_info.length > 0 && (
                              <div className="d-flex flex-wrap gap-1 mt-2">
                                {result.tags_info.map(tag => (
                                  <Badge
                                    key={tag._id}
                                    style={{ 
                                      backgroundColor: tag.color || '#6c757d',
                                      fontSize: '0.7rem'
                                    }}
                                  >
                                    <IconTag className="me-1" />
                                    {tag.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="ms-3 text-end">
                            <Badge bg={getStatusBadge(result.status)}>
                              {result.status}
                            </Badge>
                            {result.category_info && (
                              <div className="small text-muted mt-2">
                                <IconFolder className="me-1" />
                                {result.category_info.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                ) : (
                  <div className="text-center py-5">
                    <IconSearch size={48} className="text-muted mb-3" />
                    <h5 className="text-muted">{t('search.noResults')}</h5>
                    <p className="text-muted">
                      {t('search.noResultsHelp')}
                    </p>
                  </div>
                )}
              </Card.Body>
              
              {/* Pagination */}
              {searchType === 'text' && totalResults > limit && (
                <Card.Footer className="bg-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">
                      {t('search.pageOf', { page, total: Math.ceil(totalResults / limit) })}
                    </span>
                    <div className="btn-group">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => {
                          setPage(p => p - 1);
                          handleSearch();
                        }}
                      >
                        {t('search.previous')}
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        disabled={page >= Math.ceil(totalResults / limit)}
                        onClick={() => {
                          setPage(p => p + 1);
                          handleSearch();
                        }}
                      >
                        {t('search.next')}
                      </Button>
                    </div>
                  </div>
                </Card.Footer>
              )}
            </Card>
          </Col>
        </Row>
      )}
      
      {/* Initial State */}
      {!searched && (
        <Row>
          <Col lg={10}>
            <Card className="border-0 shadow-sm text-center py-5">
              <Card.Body>
                <IconSearch size={64} className="text-muted mb-4" />
                <h4 className="text-muted">{t('search.startTitle')}</h4>
                <p className="text-muted">
                  {t('search.startHelp')}
                </p>
                
                <div className="mt-4">
                  <Row className="justify-content-center g-3">
                    <Col md={4}>
                      <Card className="bg-light border-0 h-100">
                        <Card.Body>
                          <IconSearch className="text-primary mb-2" size={24} />
                          <h6>{t('search.typeText')}</h6>
                          <small className="text-muted">
                            {t('search.textCardHelp')}
                          </small>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card className="bg-light border-0 h-100">
                        <Card.Body>
                          <IconBrain className="text-success mb-2" size={24} />
                          <h6>{t('search.typeSemantic')}</h6>
                          <small className="text-muted">
                            {t('search.semanticCardHelp')}
                          </small>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}
