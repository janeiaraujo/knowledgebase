/**
 * Help Center Page
 * 
 * Features:
 * - Searchable documentation
 * - Category browsing
 * - FAQ accordion
 * - Feature tours
 */

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, InputGroup, Button, Accordion, Badge, Spinner, Tab, Tabs, ListGroup, Alert } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import { toast } from 'react-toastify';
import api from '../services/api';

const CATEGORY_ICONS = {
    basics: '📖',
    features: '⚡',
    guides: '📝',
    tips: '💡',
    advanced: '🔧'
};

const CATEGORY_NAMES = {
    basics: 'Básico',
    features: 'Funcionalidades',
    guides: 'Guias',
    tips: 'Dicas',
    advanced: 'Avançado'
};

export default function HelpCenter() {
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [categories, setCategories] = useState([]);
    const [articles, setArticles] = useState({});
    const [faq, setFaq] = useState([]);
    const [tours, setTours] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [loadingArticle, setLoadingArticle] = useState(false);
    const [activeTab, setActiveTab] = useState('browse');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [categoriesRes, articlesRes, faqRes, toursRes] = await Promise.all([
                api.get('/help-center/categories'),
                api.get('/help-center/articles'),
                api.get('/help-center/faq'),
                api.get('/help-center/tours')
            ]);

            setCategories(categoriesRes.data.categories || []);
            setArticles(articlesRes.data.articles || {});
            setFaq(faqRes.data.faq || []);
            setTours(toursRes.data.tours || []);
        } catch (error) {
            console.error('Error loading help data:', error);
            toast.error('Erro ao carregar central de ajuda');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim() || searchQuery.length < 2) return;

        try {
            const response = await api.get(`/help-center/search?q=${encodeURIComponent(searchQuery)}`);
            setSearchResults(response.data.results);
        } catch (error) {
            console.error('Error searching:', error);
        }
    };

    const loadArticle = async (articleId) => {
        setLoadingArticle(true);
        try {
            const response = await api.get(`/help-center/articles/${articleId}`);
            setSelectedArticle(response.data.article);
        } catch (error) {
            console.error('Error loading article:', error);
            toast.error('Erro ao carregar artigo');
        } finally {
            setLoadingArticle(false);
        }
    };

    const startTour = async (tourId) => {
        toast.info(`Tour "${tourId}" será iniciado em breve...`, { icon: '🎯' });
        // Tour implementation would use a library like react-joyride
    };

    const submitFeedback = async (articleId, helpful) => {
        try {
            await api.post('/help-center/feedback', {
                article_id: articleId,
                helpful
            });
            toast.success('Obrigado pelo feedback!');
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2">Carregando Central de Ajuda...</p>
            </div>
        );
    }

    return (
        <Container fluid>
            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <div className="text-center py-4 bg-primary bg-opacity-10 rounded-3 mb-4">
                        <h2 className="mb-2">
                            <i className="bi bi-question-circle me-2"></i>
                            Central de Ajuda
                        </h2>
                        <p className="text-muted mb-4">Como podemos ajudar você hoje?</p>

                        {/* Search */}
                        <Form onSubmit={handleSearch} className="mx-auto" style={{ maxWidth: 600 }}>
                            <InputGroup size="lg">
                                <Form.Control
                                    type="text"
                                    placeholder="Buscar na documentação..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Button variant="primary" type="submit">
                                    <i className="bi bi-search"></i>
                                </Button>
                            </InputGroup>
                        </Form>
                    </div>
                </Col>
            </Row>

            {/* Search Results */}
            {searchResults && (
                <Row className="mb-4">
                    <Col>
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                                <h6 className="mb-0">
                                    Resultados para "{searchQuery}"
                                </h6>
                                <Button 
                                    variant="link" 
                                    size="sm"
                                    onClick={() => setSearchResults(null)}
                                >
                                    Limpar
                                </Button>
                            </Card.Header>
                            <Card.Body>
                                {searchResults.articles?.length > 0 ? (
                                    <Row xs={1} md={2} className="g-3">
                                        {searchResults.articles.map(article => (
                                            <Col key={article.id}>
                                                <div 
                                                    className="border rounded p-3 h-100 cursor-pointer hover-bg-light"
                                                    onClick={() => loadArticle(article.id)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="d-flex align-items-start">
                                                        <span className="fs-3 me-2">{article.icon}</span>
                                                        <div>
                                                            <h6 className="mb-1">{article.title}</h6>
                                                            <small className="text-muted">{article.description}</small>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>
                                ) : (
                                    <Alert variant="info" className="mb-0">
                                        Nenhum resultado encontrado. Tente termos diferentes.
                                    </Alert>
                                )}

                                {searchResults.faq?.length > 0 && (
                                    <div className="mt-4">
                                        <h6>Perguntas Frequentes Relacionadas</h6>
                                        {searchResults.faq.map((item, idx) => (
                                            <div key={idx} className="border-bottom py-2">
                                                <strong>{item.question}</strong>
                                                <p className="text-muted small mb-0">{item.answer}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Selected Article */}
            {selectedArticle && (
                <Row className="mb-4">
                    <Col>
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-white">
                                <Button 
                                    variant="link" 
                                    className="p-0 text-decoration-none"
                                    onClick={() => setSelectedArticle(null)}
                                >
                                    <i className="bi bi-arrow-left me-2"></i>
                                    Voltar
                                </Button>
                            </Card.Header>
                            <Card.Body className="p-4">
                                {loadingArticle ? (
                                    <div className="text-center py-5">
                                        <Spinner animation="border" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="d-flex align-items-center mb-4">
                                            <span className="fs-1 me-3">{selectedArticle.icon}</span>
                                            <div>
                                                <h3 className="mb-1">{selectedArticle.title}</h3>
                                                <Badge bg="secondary">
                                                    {CATEGORY_NAMES[selectedArticle.category] || selectedArticle.category}
                                                </Badge>
                                            </div>
                                        </div>
                                        
                                        <div className="markdown-content">
                                            <ReactMarkdown>{selectedArticle.content}</ReactMarkdown>
                                        </div>

                                        <hr className="my-4" />

                                        <div className="text-center">
                                            <p className="text-muted mb-3">Este artigo foi útil?</p>
                                            <Button 
                                                variant="outline-success" 
                                                className="me-2"
                                                onClick={() => submitFeedback(selectedArticle.id, true)}
                                            >
                                                <i className="bi bi-hand-thumbs-up me-1"></i>
                                                Sim
                                            </Button>
                                            <Button 
                                                variant="outline-danger"
                                                onClick={() => submitFeedback(selectedArticle.id, false)}
                                            >
                                                <i className="bi bi-hand-thumbs-down me-1"></i>
                                                Não
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Main Content */}
            {!selectedArticle && !searchResults && (
                <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
                    {/* Browse Tab */}
                    <Tab eventKey="browse" title={<span><i className="bi bi-grid me-2"></i>Navegar</span>}>
                        {/* Categories */}
                        <Row xs={2} md={3} lg={5} className="g-3 mb-4">
                            {categories.map(category => (
                                <Col key={category.id}>
                                    <Card 
                                        className="h-100 border-0 shadow-sm text-center"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            const element = document.getElementById(`category-${category.id}`);
                                            element?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                    >
                                        <Card.Body>
                                            <div className="fs-2 mb-2">{category.icon}</div>
                                            <h6 className="mb-1">{category.name}</h6>
                                            <small className="text-muted">{category.description}</small>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            ))}
                        </Row>

                        {/* Articles by Category */}
                        {Object.entries(articles).map(([category, categoryArticles]) => (
                            <div key={category} id={`category-${category}`} className="mb-4">
                                <h5 className="mb-3">
                                    {CATEGORY_ICONS[category]} {CATEGORY_NAMES[category] || category}
                                </h5>
                                <Row xs={1} md={2} lg={3} className="g-3">
                                    {categoryArticles.map(article => (
                                        <Col key={article.id}>
                                            <Card 
                                                className="h-100 border-0 shadow-sm"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => loadArticle(article.id)}
                                            >
                                                <Card.Body>
                                                    <div className="d-flex align-items-start">
                                                        <span className="fs-3 me-2">{article.icon}</span>
                                                        <div>
                                                            <h6 className="mb-1">{article.title}</h6>
                                                            <small className="text-muted">{article.description}</small>
                                                        </div>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                            </div>
                        ))}
                    </Tab>

                    {/* FAQ Tab */}
                    <Tab eventKey="faq" title={<span><i className="bi bi-chat-dots me-2"></i>FAQ</span>}>
                        <Card className="border-0 shadow-sm">
                            <Card.Header className="bg-white">
                                <h5 className="mb-0">Perguntas Frequentes</h5>
                            </Card.Header>
                            <Card.Body>
                                <Accordion flush>
                                    {faq.map((item, index) => (
                                        <Accordion.Item key={index} eventKey={index.toString()}>
                                            <Accordion.Header>{item.question}</Accordion.Header>
                                            <Accordion.Body className="text-muted">
                                                {item.answer}
                                            </Accordion.Body>
                                        </Accordion.Item>
                                    ))}
                                </Accordion>
                            </Card.Body>
                        </Card>
                    </Tab>

                    {/* Tours Tab */}
                    <Tab eventKey="tours" title={<span><i className="bi bi-signpost me-2"></i>Tours</span>}>
                        <Row xs={1} md={2} className="g-4">
                            {tours.map(tour => (
                                <Col key={tour.id}>
                                    <Card className="border-0 shadow-sm">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <h5 className="mb-1">{tour.name}</h5>
                                                    <p className="text-muted mb-2">{tour.description}</p>
                                                    <Badge bg="secondary" className="me-2">
                                                        {tour.steps} passos
                                                    </Badge>
                                                    {tour.completed && (
                                                        <Badge bg="success">
                                                            <i className="bi bi-check me-1"></i>
                                                            Concluído
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Button 
                                                    variant={tour.completed ? 'outline-primary' : 'primary'}
                                                    size="sm"
                                                    onClick={() => startTour(tour.id)}
                                                >
                                                    {tour.completed ? 'Refazer' : 'Iniciar'}
                                                </Button>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    </Tab>

                    {/* Shortcuts Tab */}
                    <Tab eventKey="shortcuts" title={<span><i className="bi bi-keyboard me-2"></i>Atalhos</span>}>
                        <Card className="border-0 shadow-sm">
                            <Card.Body>
                                <Row>
                                    <Col md={6}>
                                        <h6 className="mb-3">Navegação Global</h6>
                                        <ListGroup variant="flush">
                                            <ListGroup.Item className="d-flex justify-content-between">
                                                <span>Busca rápida</span>
                                                <kbd>Ctrl + K</kbd>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="d-flex justify-content-between">
                                                <span>Novo KB</span>
                                                <kbd>Ctrl + N</kbd>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="d-flex justify-content-between">
                                                <span>Atalhos de teclado</span>
                                                <kbd>Ctrl + /</kbd>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="d-flex justify-content-between">
                                                <span>Fechar modal</span>
                                                <kbd>Esc</kbd>
                                            </ListGroup.Item>
                                        </ListGroup>
                                    </Col>
                                    <Col md={6}>
                                        <h6 className="mb-3">Editor de KB</h6>
                                        <ListGroup variant="flush">
                                            <ListGroup.Item className="d-flex justify-content-between">
                                                <span>Salvar</span>
                                                <kbd>Ctrl + S</kbd>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="d-flex justify-content-between">
                                                <span>Negrito</span>
                                                <kbd>Ctrl + B</kbd>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="d-flex justify-content-between">
                                                <span>Itálico</span>
                                                <kbd>Ctrl + I</kbd>
                                            </ListGroup.Item>
                                            <ListGroup.Item className="d-flex justify-content-between">
                                                <span>Inserir link</span>
                                                <kbd>Ctrl + K</kbd>
                                            </ListGroup.Item>
                                        </ListGroup>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    </Tab>
                </Tabs>
            )}

            {/* Quick Help */}
            <Row className="mt-4">
                <Col>
                    <Alert variant="info" className="d-flex align-items-center">
                        <i className="bi bi-info-circle fs-4 me-3"></i>
                        <div>
                            <strong>Precisa de mais ajuda?</strong>
                            <p className="mb-0 small">
                                Entre em contato com o suporte pelo email support@incidentkb.com ou
                                use o chat no canto inferior direito da tela.
                            </p>
                        </div>
                    </Alert>
                </Col>
            </Row>
        </Container>
    );
}
