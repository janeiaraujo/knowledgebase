/**
 * SmartSearch Component
 * 
 * Intelligent search that combines:
 * - Text search
 * - Semantic/AI search
 * - Problem-based search
 * 
 * Features:
 * - KB Request when no solution found
 * - AI-enhanced problem descriptions
 * - Search result breakdown by type
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Container, Row, Col, Form, Button, Card, Badge, Alert, Spinner, Modal, ListGroup, Tab, Tabs, OverlayTrigger, Tooltip, ProgressBar } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FaSearch, FaRobot, FaMagic, FaExclamationTriangle, FaPlus, FaLightbulb, FaBook, FaClock, FaUser, FaArrowRight, FaTimes, FaFilter, FaHistory, FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import api from '../services/api';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

// Severity/Urgency options
const urgencyOptions = [
    { value: 'low', color: 'secondary' },
    { value: 'normal', color: 'primary' },
    { value: 'high', color: 'warning' },
    { value: 'critical', color: 'danger' }
];

export default function SmartSearch() {
    const { t, i18n } = useTranslation();
    const dateLocale = i18n.language === 'en' ? enUS : ptBR;
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Search state
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [searchMode, setSearchMode] = useState('smart'); // smart, text, semantic, problem
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [searchHistory, setSearchHistory] = useState([]);
    
    // Filters
    const [filters, setFilters] = useState({
        include_related: true,
        min_score: 0.3,
        max_results: 20
    });
    const [showFilters, setShowFilters] = useState(false);
    
    // KB Request Modal
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestForm, setRequestForm] = useState({
        title: '',
        description: '',
        urgency: 'normal',
        category: '',
        use_ai_enhancement: true
    });
    const [submittingRequest, setSubmittingRequest] = useState(false);
    const [enhancedPreview, setEnhancedPreview] = useState(null);
    
    // Feedback state
    const [feedbackGiven, setFeedbackGiven] = useState({});

    // Load search history
    useEffect(() => {
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        setSearchHistory(history.slice(0, 10));
    }, []);

    // Save to search history
    const saveToHistory = (searchQuery) => {
        if (!searchQuery.trim()) return;
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        const filtered = history.filter(h => h.query !== searchQuery);
        filtered.unshift({ query: searchQuery, timestamp: new Date().toISOString() });
        localStorage.setItem('searchHistory', JSON.stringify(filtered.slice(0, 20)));
        setSearchHistory(filtered.slice(0, 10));
    };

    // Perform search
    const performSearch = async (searchQuery, mode = searchMode) => {
        if (!searchQuery.trim() || searchQuery.trim().length < 3) {
            if (searchQuery.trim().length > 0 && searchQuery.trim().length < 3) {
                toast.warning(t('smartSearch.minChars'));
            }
            setResults(null);
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/smart-search/search', {
                query: searchQuery,
                search_type: mode,
                include_draft: filters.include_related,
                limit: filters.max_results,
                min_similarity: filters.min_score
            });

            setResults(response.data);
            saveToHistory(searchQuery);
            setSearchParams({ q: searchQuery, mode });
        } catch (error) {
            console.error('Search error:', error);
            toast.error(t('smartSearch.searchError'));
        } finally {
            setLoading(false);
        }
    };

    // Debounced search
    const debouncedSearch = useCallback(
        debounce((q) => performSearch(q), 500),
        [searchMode, filters]
    );

    // Handle query change
    const handleQueryChange = (e) => {
        const newQuery = e.target.value;
        setQuery(newQuery);
        
        // Auto-search after typing
        if (newQuery.length >= 3) {
            debouncedSearch(newQuery);
        }
    };

    // Handle search submit
    const handleSearch = (e) => {
        e.preventDefault();
        performSearch(query);
    };

    // Handle history item click
    const handleHistoryClick = (historyQuery) => {
        setQuery(historyQuery);
        performSearch(historyQuery);
    };

    // Open KB Request modal
    const openRequestModal = () => {
        setRequestForm({
            title: query,
            description: query,
            urgency: 'normal',
            category: '',
            use_ai_enhancement: true
        });
        setEnhancedPreview(null);
        setShowRequestModal(true);
    };

    // Preview AI enhancement
    const previewEnhancement = async () => {
        if (!requestForm.description.trim()) return;

        setSubmittingRequest(true);
        try {
            // First create with AI enhancement to see preview
            const response = await api.post('/smart-search/kb-requests', {
                ...requestForm,
                related_search_query: query
            });

            if (response.data.kb_request) {
                setEnhancedPreview({
                    enhanced_description: response.data.kb_request.enhanced_description,
                    suggested_title: response.data.kb_request.suggested_title
                });
                
                // Delete the preview request (we just wanted to see the enhancement)
                // Actually, let's keep it since user might want it
                toast.success(t('smartSearch.requestCreated'));
                setShowRequestModal(false);
                setResults(prev => prev ? {
                    ...prev,
                    kb_request_submitted: true
                } : prev);
            }
        } catch (error) {
            console.error('Enhancement preview error:', error);
            toast.error(t('smartSearch.requestProcessError'));
        } finally {
            setSubmittingRequest(false);
        }
    };

    // Submit KB request
    const submitKBRequest = async () => {
        if (!requestForm.title.trim() || !requestForm.description.trim()) {
            toast.warning(t('smartSearch.fillTitleDesc'));
            return;
        }

        if (requestForm.description.trim().length < 20) {
            toast.warning(t('smartSearch.descTooShort'));
            return;
        }

        setSubmittingRequest(true);
        try {
            await api.post('/smart-search/kb-requests', {
                title: requestForm.title,
                problem_description: requestForm.description,
                urgency: requestForm.urgency,
                search_query: query,
                context: {
                    category: requestForm.category,
                    use_ai_enhancement: requestForm.use_ai_enhancement
                }
            });

            toast.success(t('smartSearch.kbRequestCreated'));
            setShowRequestModal(false);
            setResults(prev => prev ? {
                ...prev,
                kb_request_submitted: true
            } : prev);
        } catch (error) {
            console.error('KB request error:', error);
            toast.error(t('smartSearch.requestCreateError'));
        } finally {
            setSubmittingRequest(false);
        }
    };

    // Submit search feedback
    const submitFeedback = async (resultId, helpful) => {
        try {
            await api.post('/smart-search/feedback', {
                search_query: query,
                result_id: resultId,
                helpful,
                search_mode: searchMode
            });
            
            setFeedbackGiven(prev => ({ ...prev, [resultId]: helpful }));
            toast.success(t('smartSearch.thanksFeedback'));
        } catch (error) {
            // Silently fail - feedback is optional
        }
    };

    // Render result card
    const renderResultCard = (result, index) => {
        const score = result.score || result.relevance_score || 0;
        const scorePercent = Math.round(score * 100);
        
        return (
            <Card key={result._id} className="mb-3 result-card">
                <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <Badge bg={result.match_type === 'exact' ? 'success' : result.match_type === 'semantic' ? 'info' : 'warning'}>
                                    {t(`smartSearch.matchType.${['exact', 'semantic'].includes(result.match_type) ? result.match_type : 'problem'}`)}
                                </Badge>
                                <Badge bg="secondary">{t('search.relevantPct', { pct: scorePercent })}</Badge>
                                {result.status && (
                                    <Badge bg={result.status === 'published' ? 'success' : 'secondary'}>
                                        {result.status}
                                    </Badge>
                                )}
                            </div>
                            
                            <h5 className="mb-2">
                                <Link to={`/kb/${result._id}`} className="text-decoration-none">
                                    {result.title}
                                </Link>
                            </h5>
                            
                            {result.highlight && (
                                <p className="text-muted mb-2" 
                                   dangerouslySetInnerHTML={{ __html: result.highlight }} 
                                />
                            )}
                            
                            {!result.highlight && result.content_md && (
                                <p className="text-muted mb-2">
                                    {result.content_md.substring(0, 200)}...
                                </p>
                            )}
                            
                            <div className="d-flex flex-wrap gap-2 mb-2">
                                {result.tags?.map(tag => (
                                    <Badge key={tag} bg="light" text="dark" className="small">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                            
                            <small className="text-muted">
                                <FaClock className="me-1" />
                                {t('smartSearch.updated')} {formatDistanceToNow(new Date(result.updated_at), { addSuffix: true, locale: dateLocale })}
                            </small>
                        </div>
                        
                        <div className="ms-3 d-flex flex-column gap-1">
                            {!feedbackGiven[result._id] ? (
                                <>
                                    <OverlayTrigger overlay={<Tooltip>{t('smartSearch.helpful')}</Tooltip>}>
                                        <Button 
                                            size="sm" 
                                            variant="outline-success"
                                            onClick={() => submitFeedback(result._id, true)}
                                        >
                                            <FaThumbsUp />
                                        </Button>
                                    </OverlayTrigger>
                                    <OverlayTrigger overlay={<Tooltip>{t('smartSearch.notHelpful')}</Tooltip>}>
                                        <Button 
                                            size="sm" 
                                            variant="outline-danger"
                                            onClick={() => submitFeedback(result._id, false)}
                                        >
                                            <FaThumbsDown />
                                        </Button>
                                    </OverlayTrigger>
                                </>
                            ) : (
                                <small className="text-success">
                                    ✓ {t('smartSearch.feedbackSent')}
                                </small>
                            )}
                        </div>
                    </div>
                </Card.Body>
            </Card>
        );
    };

    return (
        <Container fluid className="py-4">
            <Row className="justify-content-center">
                <Col lg={10} xl={8}>
                    {/* Header */}
                    <div className="text-center mb-4">
                        <h2>
                            <FaRobot className="me-2 text-primary" />
                            {t('smartSearch.title')}
                        </h2>
                        <p className="text-muted">
                            {t('smartSearch.subtitle')}
                        </p>
                    </div>

                    {/* Search Form */}
                    <Card className="mb-4 shadow-sm">
                        <Card.Body>
                            <Form onSubmit={handleSearch}>
                                <div className="d-flex gap-2 mb-3">
                                    <Form.Control
                                        type="text"
                                        size="lg"
                                        placeholder={t('smartSearch.placeholder')}
                                        value={query}
                                        onChange={handleQueryChange}
                                        autoFocus
                                    />
                                    <Button type="submit" size="lg" disabled={loading}>
                                        {loading ? <Spinner animation="border" size="sm" /> : <FaSearch />}
                                    </Button>
                                    <Button 
                                        variant="outline-secondary" 
                                        size="lg"
                                        onClick={() => setShowFilters(!showFilters)}
                                    >
                                        <FaFilter />
                                    </Button>
                                </div>

                                {/* Search Mode Tabs */}
                                <div className="d-flex gap-2 flex-wrap mb-3">
                                    <Button 
                                        variant={searchMode === 'smart' ? 'primary' : 'outline-primary'}
                                        size="sm"
                                        onClick={() => setSearchMode('smart')}
                                    >
                                        <FaMagic className="me-1" /> {t('smartSearch.modeSmart')}
                                    </Button>
                                    <Button 
                                        variant={searchMode === 'text' ? 'primary' : 'outline-primary'}
                                        size="sm"
                                        onClick={() => setSearchMode('text')}
                                    >
                                        <FaSearch className="me-1" /> {t('smartSearch.modeText')}
                                    </Button>
                                    <Button 
                                        variant={searchMode === 'semantic' ? 'primary' : 'outline-primary'}
                                        size="sm"
                                        onClick={() => setSearchMode('semantic')}
                                    >
                                        <FaRobot className="me-1" /> {t('smartSearch.modeSemantic')}
                                    </Button>
                                    <Button 
                                        variant={searchMode === 'problem' ? 'primary' : 'outline-primary'}
                                        size="sm"
                                        onClick={() => setSearchMode('problem')}
                                    >
                                        <FaExclamationTriangle className="me-1" /> {t('smartSearch.modeProblem')}
                                    </Button>
                                </div>

                                {/* Mode description */}
                                <small className="text-muted">
                                    {searchMode === 'smart' && (
                                        <><FaLightbulb className="me-1" /> {t('smartSearch.helpSmart')}</>
                                    )}
                                    {searchMode === 'text' && (
                                        <><FaSearch className="me-1" /> {t('smartSearch.helpText')}</>
                                    )}
                                    {searchMode === 'semantic' && (
                                        <><FaRobot className="me-1" /> {t('smartSearch.helpSemantic')}</>
                                    )}
                                    {searchMode === 'problem' && (
                                        <><FaExclamationTriangle className="me-1" /> {t('smartSearch.helpProblem')}</>
                                    )}
                                </small>

                                {/* Filters */}
                                {showFilters && (
                                    <div className="border rounded p-3 mt-3 bg-light">
                                        <h6>{t('smartSearch.advancedFilters')}</h6>
                                        <Row>
                                            <Col md={4}>
                                                <Form.Group className="mb-2">
                                                    <Form.Label className="small">{t('smartSearch.minRelevance')}</Form.Label>
                                                    <Form.Range 
                                                        min={0} 
                                                        max={100} 
                                                        value={filters.min_score * 100}
                                                        onChange={e => setFilters(prev => ({
                                                            ...prev,
                                                            min_score: parseInt(e.target.value) / 100
                                                        }))}
                                                    />
                                                    <small>{Math.round(filters.min_score * 100)}%</small>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group className="mb-2">
                                                    <Form.Label className="small">{t('smartSearch.maxResults')}</Form.Label>
                                                    <Form.Select 
                                                        size="sm"
                                                        value={filters.max_results}
                                                        onChange={e => setFilters(prev => ({
                                                            ...prev,
                                                            max_results: parseInt(e.target.value)
                                                        }))}
                                                    >
                                                        <option value={10}>10</option>
                                                        <option value={20}>20</option>
                                                        <option value={50}>50</option>
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group className="mb-2">
                                                    <Form.Check 
                                                        type="switch"
                                                        label={t('smartSearch.includeRelated')}
                                                        checked={filters.include_related}
                                                        onChange={e => setFilters(prev => ({
                                                            ...prev,
                                                            include_related: e.target.checked
                                                        }))}
                                                    />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                    </div>
                                )}
                            </Form>
                        </Card.Body>
                    </Card>

                    {/* Search History */}
                    {!query && searchHistory.length > 0 && (
                        <Card className="mb-4">
                            <Card.Header>
                                <FaHistory className="me-2" />
                                {t('smartSearch.recentSearches')}
                            </Card.Header>
                            <ListGroup variant="flush">
                                {searchHistory.map((item, index) => (
                                    <ListGroup.Item 
                                        key={index}
                                        action
                                        onClick={() => handleHistoryClick(item.query)}
                                        className="d-flex justify-content-between align-items-center"
                                    >
                                        <span>{item.query}</span>
                                        <small className="text-muted">
                                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: dateLocale })}
                                        </small>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </Card>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2 text-muted">{t('search.searching')}</p>
                        </div>
                    )}

                    {/* Results */}
                    {results && !loading && (
                        <>
                            {/* Summary */}
                            <Alert variant="info" className="mb-4">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <Trans
                                            i18nKey="search.resultsFound"
                                            count={results.total || results.results?.length || 0}
                                            components={{ b: <strong /> }}
                                        />
                                        {results.search_breakdown && (
                                            <span className="ms-2">
                                                {t('smartSearch.breakdown', {
                                                    exact: results.search_breakdown.exact || 0,
                                                    semantic: results.search_breakdown.semantic || 0,
                                                    problem: results.search_breakdown.problem || 0
                                                })}
                                            </span>
                                        )}
                                    </div>
                                    {results.query_type === 'problem' && (
                                        <Badge bg="warning">
                                            <FaExclamationTriangle className="me-1" />
                                            {t('smartSearch.detectedProblem')}
                                        </Badge>
                                    )}
                                </div>
                            </Alert>

                            {/* Results List */}
                            {results.results && results.results.length > 0 ? (
                                <div className="results-list">
                                    {results.results.map((result, index) => renderResultCard(result, index))}
                                </div>
                            ) : (
                                /* No Results - Show KB Request Option */
                                <Card className="text-center py-5">
                                    <Card.Body>
                                        <FaBook size={48} className="text-muted mb-3" />
                                        <h4>{t('smartSearch.noKbFound')}</h4>
                                        <p className="text-muted mb-4">
                                            {t('smartSearch.noKbHelp')}
                                        </p>
                                        
                                        {!results.kb_request_submitted ? (
                                            <Button 
                                                variant="primary" 
                                                size="lg"
                                                onClick={openRequestModal}
                                            >
                                                <FaPlus className="me-2" />
                                                {t('smartSearch.requestKb')}
                                            </Button>
                                        ) : (
                                            <Alert variant="success">
                                                <FaLightbulb className="me-2" />
                                                {t('smartSearch.requestSent')}
                                            </Alert>
                                        )}
                                        
                                        <p className="text-muted mt-3 small">
                                            {t('smartSearch.requestReviewNote')}
                                        </p>
                                    </Card.Body>
                                </Card>
                            )}

                            {/* Suggestions */}
                            {results.suggestions && results.suggestions.length > 0 && (
                                <Card className="mt-4">
                                    <Card.Header>
                                        <FaLightbulb className="me-2" />
                                        {t('smartSearch.searchSuggestions')}
                                    </Card.Header>
                                    <Card.Body>
                                        <div className="d-flex flex-wrap gap-2">
                                            {results.suggestions.map((suggestion, index) => (
                                                <Button
                                                    key={index}
                                                    variant="outline-secondary"
                                                    size="sm"
                                                    onClick={() => {
                                                        setQuery(suggestion);
                                                        performSearch(suggestion);
                                                    }}
                                                >
                                                    {suggestion}
                                                </Button>
                                            ))}
                                        </div>
                                    </Card.Body>
                                </Card>
                            )}

                            {/* Still not finding? */}
                            {results.results && results.results.length > 0 && results.results.length < 5 && (
                                <Card className="mt-4 bg-light">
                                    <Card.Body className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <strong>{t('smartSearch.notFoundQuestion')}</strong>
                                            <p className="mb-0 text-muted small">
                                                {t('smartSearch.notFoundHelp')}
                                            </p>
                                        </div>
                                        <Button variant="outline-primary" onClick={openRequestModal}>
                                            {t('smartSearch.requestKbShort')} <FaArrowRight className="ms-1" />
                                        </Button>
                                    </Card.Body>
                                </Card>
                            )}
                        </>
                    )}
                </Col>
            </Row>

            {/* KB Request Modal */}
            <Modal show={showRequestModal} onHide={() => setShowRequestModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaPlus className="me-2" />
                        {t('smartSearch.requestKb')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Alert variant="info" className="mb-4">
                        <FaLightbulb className="me-2" />
                        {t('smartSearch.modalIntro')}
                    </Alert>

                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>{t('common.title')} *</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder={t('smartSearch.titlePlaceholder')}
                                value={requestForm.title}
                                onChange={e => setRequestForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>{t('smartSearch.problemDescription')} *</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={5}
                                placeholder={t('smartSearch.problemPlaceholder')}
                                value={requestForm.description}
                                onChange={e => setRequestForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                            <Form.Text className="text-muted">
                                {t('smartSearch.moreDetailsHelp')}
                            </Form.Text>
                        </Form.Group>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>{t('smartSearch.urgency')}</Form.Label>
                                    <div>
                                        {urgencyOptions.map(option => (
                                            <Form.Check
                                                key={option.value}
                                                type="radio"
                                                name="urgency"
                                                id={`urgency-${option.value}`}
                                                label={
                                                    <span>
                                                        <Badge bg={option.color} className="me-2">{t(`smartSearch.urgencyLevels.${option.value}.label`)}</Badge>
                                                        <small className="text-muted">{t(`smartSearch.urgencyLevels.${option.value}.description`)}</small>
                                                    </span>
                                                }
                                                checked={requestForm.urgency === option.value}
                                                onChange={() => setRequestForm(prev => ({ ...prev, urgency: option.value }))}
                                            />
                                        ))}
                                    </div>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>{t('smartSearch.categoryOptional')}</Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder={t('smartSearch.categoryPlaceholder')}
                                        value={requestForm.category}
                                        onChange={e => setRequestForm(prev => ({ ...prev, category: e.target.value }))}
                                    />
                                </Form.Group>

                                <Form.Group>
                                    <Form.Check
                                        type="switch"
                                        id="use-ai-enhancement"
                                        label={
                                            <span>
                                                <FaRobot className="me-1" />
                                                {t('smartSearch.useAi')}
                                            </span>
                                        }
                                        checked={requestForm.use_ai_enhancement}
                                        onChange={e => setRequestForm(prev => ({ ...prev, use_ai_enhancement: e.target.checked }))}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        {/* Enhanced Preview */}
                        {enhancedPreview && (
                            <Alert variant="success" className="mt-3">
                                <Alert.Heading>
                                    <FaMagic className="me-2" />
                                    {t('smartSearch.aiPreview')}
                                </Alert.Heading>
                                {enhancedPreview.suggested_title && (
                                    <p><strong>{t('smartSearch.suggestedTitle')}</strong> {enhancedPreview.suggested_title}</p>
                                )}
                                <p className="mb-0">{enhancedPreview.enhanced_description}</p>
                            </Alert>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowRequestModal(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={submitKBRequest}
                        disabled={submittingRequest || !requestForm.title.trim() || !requestForm.description.trim()}
                    >
                        {submittingRequest ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                {t('smartSearch.processing')}
                            </>
                        ) : (
                            <>
                                <FaPlus className="me-2" />
                                {t('smartSearch.submitRequest')}
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            <style>{`
                .result-card {
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .result-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
            `}</style>
        </Container>
    );
}
