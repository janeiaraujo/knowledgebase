import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Card, Form, Button, Badge, ButtonGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { recordAPI, tagAPI, categoryAPI } from '../../services/api';
import BatchExportModal from '../../components/export/BatchExportModal';

// Icon components using Bootstrap Icons
const IconDownload = () => <i className="bi bi-download"></i>;
const IconFilter = () => <i className="bi bi-funnel"></i>;
const IconCheck = () => <i className="bi bi-check-lg"></i>;
const IconTimes = () => <i className="bi bi-x-lg"></i>;
const IconTag = () => <i className="bi bi-tag"></i>;
const IconFolder = () => <i className="bi bi-folder"></i>;

const STATUS_OPTIONS = [
  { value: '', labelKey: 'kb.statusFilter.all' },
  { value: 'draft', labelKey: 'kb.status.draft' },
  { value: 'in_review', labelKey: 'kb.status.in_review' },
  { value: 'approved', labelKey: 'kb.status.approved' },
  { value: 'published', labelKey: 'kb.status.published' },
  { value: 'rejected', labelKey: 'kb.status.rejected' },
];

const STATUS_BADGES = {
  captured: 'secondary',
  draft: 'warning',
  in_review: 'info',
  approved: 'success',
  published: 'primary',
  rejected: 'danger',
  deprecated: 'dark'
};

const STATUS_LABELS = {
  captured: 'kb.status.captured',
  draft: 'kb.status.draft',
  in_review: 'kb.status.in_review',
  approved: 'kb.status.approved',
  published: 'kb.status.published',
  rejected: 'kb.status.rejected',
  deprecated: 'kb.status.deprecated'
};

export default function KBList() {
  const { t } = useTranslation();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const requestSeq = useRef(0);
  
  // Selection state
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Filter options
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  
  useEffect(() => {
    fetchFilterOptions();
    // Initial load: show spinner
    fetchRecords({ showSpinner: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const fetchFilterOptions = async () => {
    try {
      const [catRes, tagRes] = await Promise.all([
        categoryAPI.list(),
        tagAPI.list()
      ]);
      setCategories(catRes.data.categories || []);
      setTags(tagRes.data.tags || []);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  useEffect(() => {
    // Subsequent searches/filters: keep list rendered (no full-page spinner)
    const t = setTimeout(() => {
      fetchRecords({ showSpinner: false });
    }, 450);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, categoryFilter, tagFilter]);
  
  const fetchRecords = async ({ showSpinner }) => {
    try {
      const current = ++requestSeq.current;

      if (showSpinner) {
        setLoading(true);
      } else {
        setIsFetching(true);
      }

      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search && search.trim()) params.search = search.trim();
      if (categoryFilter) params.category_id = categoryFilter;
      if (tagFilter) params.tag_id = tagFilter;
      
      const { data } = await recordAPI.list(params);

      // Ignore out-of-order responses (user typed fast)
      if (current !== requestSeq.current) return;

      setRecords(data.records || []);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };
  
  const filteredRecords = records;
  
  // Selection handlers
  const isSelected = (recordId) => selectedRecords.some(r => r._id === recordId);
  
  const toggleSelect = (record) => {
    setSelectedRecords(prev => 
      isSelected(record._id)
        ? prev.filter(r => r._id !== record._id)
        : [...prev, record]
    );
  };
  
  const selectAll = () => {
    if (selectedRecords.length === filteredRecords.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords([...filteredRecords]);
    }
  };
  
  const clearSelection = () => setSelectedRecords([]);
  
  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setTagFilter('');
    setSearch('');
  };
  
  const hasActiveFilters = statusFilter || categoryFilter || tagFilter;
  
  if (loading && records.length === 0) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>;
  }
  
  return (
    <>
      {/* Export Modal */}
      <BatchExportModal
        show={showExportModal}
        onHide={() => setShowExportModal(false)}
        selectedRecords={selectedRecords}
      />
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{t('kb.title')}</h2>
        <div>
          {selectedRecords.length > 0 && (
            <ButtonGroup className="me-2">
              <Button 
                variant="outline-primary" 
                onClick={() => setShowExportModal(true)}
              >
                <IconDownload className="me-1" />
                Exportar ({selectedRecords.length})
              </Button>
              <Button 
                variant="outline-secondary"
                onClick={clearSelection}
              >
                <IconTimes />
              </Button>
            </ButtonGroup>
          )}
          <Link to="/kb/new" className="btn btn-primary">
            <i className="bi bi-plus-circle me-2"></i>Novo KB
          </Link>
        </div>
      </div>
      
      {/* Search and Filters */}
      <Row className="mb-3 g-2">
        <Col md={5}>
          <Form.Control
            type="search"
            placeholder={t('kb.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </Form.Select>
        </Col>
        <Col md={2}>
          <Button 
            variant={showFilters ? 'primary' : 'outline-secondary'} 
            onClick={() => setShowFilters(!showFilters)}
            className="w-100"
          >
            <IconFilter className="me-1" />
            Filtros
            {hasActiveFilters && <Badge bg="danger" className="ms-1">!</Badge>}
          </Button>
        </Col>
        <Col md={2}>
          {filteredRecords.length > 0 && (
            <Button 
              variant="outline-secondary" 
              onClick={selectAll}
              className="w-100"
            >
              <IconCheck className="me-1" />
              {selectedRecords.length === filteredRecords.length ? t('common.clear') : t('common.select')}
            </Button>
          )}
        </Col>
      </Row>
      
      {/* Advanced Filters */}
      {showFilters && (
        <Row className="mb-3 g-2 bg-light p-3 rounded">
          <Col md={4}>
            <Form.Group>
              <Form.Label className="small text-muted">
                <IconFolder className="me-1" />
                Categoria
              </Form.Label>
              <Form.Select 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                size="sm"
              >
                <option value="">{t('kb.allCategories')}</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label className="small text-muted">
                <IconTag className="me-1" />
                Tag
              </Form.Label>
              <Form.Select 
                value={tagFilter} 
                onChange={(e) => setTagFilter(e.target.value)}
                size="sm"
              >
                <option value="">{t('kb.allTags')}</option>
                {tags.map(tag => (
                  <option key={tag._id} value={tag._id}>{tag.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={4} className="d-flex align-items-end">
            <Button 
              variant="outline-secondary" 
              size="sm"
              onClick={clearFilters}
              className="w-100"
            >
              <IconTimes className="me-1" />
              {t('kb.clearFilters')}
            </Button>
          </Col>
        </Row>
      )}
      
      {isFetching && (
        <div className="text-center py-2 mb-3">
          <div className="spinner-border spinner-border-sm text-primary me-2" />
          <small className="text-muted">{t('common.loading')}</small>
        </div>
      )}
      
      <Row className="g-3">
        {filteredRecords.map(record => (
          <Col key={record._id} md={6} lg={4}>
            <Card 
              className={`kb-card h-100 border-0 shadow-sm ${isSelected(record._id) ? 'border border-primary' : ''}`}
              style={{ cursor: 'pointer' }}
            >
              <Card.Body>
                <div className="d-flex justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      checked={isSelected(record._id)}
                      onChange={() => toggleSelect(record)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Badge bg={STATUS_BADGES[record.status] || 'secondary'}>
                      {STATUS_LABELS[record.status] ? t(STATUS_LABELS[record.status]) : record.status}
                    </Badge>
                  </div>
                  {record.views > 0 && (
                    <small className="text-muted">
                      <i className="bi bi-eye me-1"></i>
                      {record.views}
                    </small>
                  )}
                </div>
                <Card.Title as="h5">{record.title}</Card.Title>
                <Card.Text className="text-muted small">
                  {record.content_md?.substring(0, 100)}...
                </Card.Text>
                
                {/* Tags display */}
                {record.tags_info && record.tags_info.length > 0 && (
                  <div className="mb-2">
                    {record.tags_info.slice(0, 3).map(tag => (
                      <Badge 
                        key={tag._id}
                        style={{ backgroundColor: tag.color || '#6c757d', marginRight: '4px' }}
                        className="me-1"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {record.tags_info.length > 3 && (
                      <Badge bg="light" text="dark">+{record.tags_info.length - 3}</Badge>
                    )}
                  </div>
                )}
                
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <small className="text-muted">
                    {new Date(record.created_at).toLocaleDateString('pt-BR')}
                  </small>
                  <Link to={`/kb/${record._id}`} className="btn btn-sm btn-outline-primary">
                    Ver <i className="bi bi-arrow-right"></i>
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
          <p className="text-muted mt-3">Nenhum KB encontrado</p>
        </div>
      )}
    </>
  );
}
