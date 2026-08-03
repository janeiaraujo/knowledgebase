import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Form, Row, Col, Alert, Spinner, Badge, ListGroup, Tabs, Tab, Modal, ProgressBar } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Import = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState('markdown');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  
  // Common options
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  
  // Markdown import
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  
  // JSON import
  const [jsonContent, setJsonContent] = useState('');
  
  // Confluence import
  const [confluenceConfig, setConfluenceConfig] = useState({
    url: '',
    email: '',
    api_token: '',
    space_key: '',
    page_ids: ''
  });
  
  // Notion import
  const [notionConfig, setNotionConfig] = useState({
    api_key: '',
    database_id: '',
    page_ids: ''
  });
  
  // Import result
  const [importResult, setImportResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  useEffect(() => {
    fetchCategoriesAndTags();
  }, []);

  const fetchCategoriesAndTags = async () => {
    try {
      const [catRes, tagRes] = await Promise.all([
        api.get('/categories'),
        api.get('/tags')
      ]);
      setCategories(catRes.data.categories || []);
      setTags(tagRes.data.tags || []);
    } catch (err) {
      console.error('Error fetching categories/tags:', err);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setPreview(null);
    
    // Preview first file
    if (selectedFiles.length > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview({
          filename: selectedFiles[0].name,
          content: e.target.result.slice(0, 2000),
          full_length: e.target.result.length
        });
      };
      reader.readAsText(selectedFiles[0]);
    }
  };

  const handleMarkdownImport = async () => {
    if (files.length === 0) {
      setError('Selecione pelo menos um arquivo');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      if (selectedCategory) formData.append('category_id', selectedCategory);
      formData.append('tags', JSON.stringify(selectedTags));
      
      const { data } = await api.post('/import/markdown', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportResult(data);
      setShowResultModal(true);
      setFiles([]);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao importar arquivos');
    } finally {
      setLoading(false);
    }
  };

  const handleJsonImport = async () => {
    if (!jsonContent.trim()) {
      setError('Insira o conteúdo JSON');
      return;
    }
    
    let records;
    try {
      const parsed = JSON.parse(jsonContent);
      records = Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
      setError('JSON inválido');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await api.post('/import/json', {
        records,
        category_id: selectedCategory || null,
        tags: selectedTags
      });
      
      setImportResult(data);
      setShowResultModal(true);
      setJsonContent('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao importar JSON');
    } finally {
      setLoading(false);
    }
  };

  const handleConfluenceImport = async () => {
    const { url, email, api_token, space_key, page_ids } = confluenceConfig;
    
    if (!url || !email || !api_token) {
      setError('URL, email e API token são obrigatórios');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await api.post('/import/confluence', {
        confluence_url: url,
        email,
        api_token,
        space_key,
        page_ids: page_ids ? page_ids.split(',').map(id => id.trim()) : [],
        category_id: selectedCategory || null,
        tags: selectedTags
      });
      
      setImportResult(data);
      setShowResultModal(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao importar do Confluence');
    } finally {
      setLoading(false);
    }
  };

  const handleNotionImport = async () => {
    const { api_key, database_id, page_ids } = notionConfig;
    
    if (!api_key) {
      setError('API key é obrigatória');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await api.post('/import/notion', {
        api_key,
        database_id,
        page_ids: page_ids ? page_ids.split(',').map(id => id.trim()) : [],
        category_id: selectedCategory || null,
        tags: selectedTags
      });
      
      setImportResult(data);
      setShowResultModal(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao importar do Notion');
    } finally {
      setLoading(false);
    }
  };

  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-cloud-upload me-2"></i>
            {t('import.importarConteudo')}
          </h2>
          <p className="text-muted mb-0">
            {t('import.importeKbsDeArquivosMarkdownJson')}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          <i className="bi bi-check-circle me-2"></i>
          {success}
        </Alert>
      )}

      <Row>
        {/* Import Options */}
        <Col lg={8}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
                
                {/* Markdown Tab */}
                <Tab eventKey="markdown" title={<><i className="bi bi-markdown me-2"></i>{t('import.markdown')}</>}>
                  <div className="mb-3">
                    <Form.Label>{t('import.selecionarArquivosMarkdown')}</Form.Label>
                    <Form.Control
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.markdown,.txt"
                      multiple
                      onChange={handleFileSelect}
                    />
                    <Form.Text className="text-muted">
                      {t('import.selecioneUmOuMaisArquivosMd')}
                    </Form.Text>
                  </div>

                  {files.length > 0 && (
                    <div className="mb-3">
                      <Badge bg="primary">{files.length} arquivo(s) selecionado(s)</Badge>
                      <ListGroup className="mt-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {files.map((file, idx) => (
                          <ListGroup.Item key={idx} className="py-2 d-flex justify-content-between">
                            <span><i className="bi bi-file-text me-2"></i>{file.name}</span>
                            <small className="text-muted">{(file.size / 1024).toFixed(1)} KB</small>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </div>
                  )}

                  {preview && (
                    <div className="mb-3">
                      <Form.Label>{t('import.preview')}</Form.Label>
                      <Card className="bg-light">
                        <Card.Body style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          <pre className="mb-0" style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                            {preview.content}
                            {preview.full_length > 2000 && <span className="text-muted">... ({preview.full_length} caracteres)</span>}
                          </pre>
                        </Card.Body>
                      </Card>
                    </div>
                  )}

                  <Button 
                    variant="primary" 
                    onClick={handleMarkdownImport}
                    disabled={loading || files.length === 0}
                  >
                    {loading ? <Spinner size="sm" className="me-2" /> : <i className="bi bi-upload me-2"></i>}
                    Importar Markdown
                  </Button>
                </Tab>

                {/* JSON Tab */}
                <Tab eventKey="json" title={<><i className="bi bi-braces me-2"></i>{t('import.json')}</>}>
                  <div className="mb-3">
                    <Form.Label>{t('import.conteudoJson')}</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={10}
                      value={jsonContent}
                      onChange={(e) => setJsonContent(e.target.value)}
                      placeholder={`[
  {
    "title": "Título do KB",
    "content": "# Conteúdo em Markdown\\n\\nTexto aqui...",
    "status": "draft"
  }
]`}
                      style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                    />
                    <Form.Text className="text-muted">
                      {t('import.arrayDeObjetosComCamposTitle')}
                    </Form.Text>
                  </div>

                  <Button 
                    variant="primary" 
                    onClick={handleJsonImport}
                    disabled={loading || !jsonContent.trim()}
                  >
                    {loading ? <Spinner size="sm" className="me-2" /> : <i className="bi bi-upload me-2"></i>}
                    Importar JSON
                  </Button>
                </Tab>

                {/* Confluence Tab */}
                <Tab eventKey="confluence" title={<><i className="bi bi-box me-2"></i>{t('import.confluence')}</>}>
                  <Row className="g-3 mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>{t('import.urlDoConfluence')}</Form.Label>
                        <Form.Control
                          type="url"
                          placeholder="https://sua-empresa.atlassian.net"
                          value={confluenceConfig.url}
                          onChange={(e) => setConfluenceConfig(prev => ({ ...prev, url: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>{t('import.email')}</Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="seu@email.com"
                          value={confluenceConfig.email}
                          onChange={(e) => setConfluenceConfig(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>{t('import.apiToken')}</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder={t('import.tokenDeApiDoAtlassian')}
                          value={confluenceConfig.api_token}
                          onChange={(e) => setConfluenceConfig(prev => ({ ...prev, api_token: e.target.value }))}
                        />
                        <Form.Text className="text-muted">
                          <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">
                            {t('import.criarApiToken')}
                          </a>
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>{t('import.spaceKeyOpcional')}</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder={t('import.engDocEtc')}
                          value={confluenceConfig.space_key}
                          onChange={(e) => setConfluenceConfig(prev => ({ ...prev, space_key: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>{t('import.idsDasPaginasOpcional')}</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="123456, 789012"
                          value={confluenceConfig.page_ids}
                          onChange={(e) => setConfluenceConfig(prev => ({ ...prev, page_ids: e.target.value }))}
                        />
                        <Form.Text className="text-muted">{t('import.idsSeparadosPorVirgula')}</Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Button 
                    variant="primary" 
                    onClick={handleConfluenceImport}
                    disabled={loading || !confluenceConfig.url || !confluenceConfig.api_token}
                  >
                    {loading ? <Spinner size="sm" className="me-2" /> : <i className="bi bi-cloud-download me-2"></i>}
                    Importar do Confluence
                  </Button>
                </Tab>

                {/* Notion Tab */}
                <Tab eventKey="notion" title={<><i className="bi bi-journal-text me-2"></i>{t('import.notion')}</>}>
                  <Row className="g-3 mb-3">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>{t('import.apiKeyDoNotion')}</Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="secret_xxxxxxxxxxxxx"
                          value={notionConfig.api_key}
                          onChange={(e) => setNotionConfig(prev => ({ ...prev, api_key: e.target.value }))}
                        />
                        <Form.Text className="text-muted">
                          <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">
                            {t('import.criarIntegracaoNoNotion')}
                          </a>
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>{t('import.databaseIdOpcional')}</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={notionConfig.database_id}
                          onChange={(e) => setNotionConfig(prev => ({ ...prev, database_id: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>{t('import.idsDasPaginasOpcional')}</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder={t('import.pageId1PageId2')}
                          value={notionConfig.page_ids}
                          onChange={(e) => setNotionConfig(prev => ({ ...prev, page_ids: e.target.value }))}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Alert variant="info" className="mb-3">
                    <i className="bi bi-info-circle me-2"></i>
                    {t('import.certifiqueSeDeQueAIntegracao')}
                  </Alert>

                  <Button 
                    variant="primary" 
                    onClick={handleNotionImport}
                    disabled={loading || !notionConfig.api_key}
                  >
                    {loading ? <Spinner size="sm" className="me-2" /> : <i className="bi bi-cloud-download me-2"></i>}
                    Importar do Notion
                  </Button>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </Col>

        {/* Options Sidebar */}
        <Col lg={4}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-light">
              <strong><i className="bi bi-gear me-2"></i>{t('import.opcoesDeImportacao')}</strong>
            </Card.Header>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Label>{t('search.category')}</Form.Label>
                <Form.Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">{t('import.semCategoria')}</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group>
                <Form.Label>{t('import.tags')}</Form.Label>
                <div className="d-flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge
                      key={tag._id}
                      bg={selectedTags.includes(tag._id) ? 'primary' : 'light'}
                      text={selectedTags.includes(tag._id) ? 'white' : 'dark'}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleTagToggle(tag._id)}
                    >
                      {selectedTags.includes(tag._id) && <i className="bi bi-check me-1"></i>}
                      {tag.name}
                    </Badge>
                  ))}
                </div>
                {tags.length === 0 && (
                  <small className="text-muted">{t('import.nenhumaTagDisponivel')}</small>
                )}
              </Form.Group>
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-light">
              <strong><i className="bi bi-lightbulb me-2"></i>{t('import.dicas')}</strong>
            </Card.Header>
            <Card.Body>
              <ul className="mb-0 ps-3">
                <li className="mb-2">{t('import.arquivosMarkdownDevemUsarUtf8')}</li>
                <li className="mb-2">{t('import.oTituloSeraExtraidoDoPrimeiro')}</li>
                <li className="mb-2">{t('import.kbsImportadosFicamComoRascunho')}</li>
                <li className="mb-2">{t('import.paraConfluenceNotionCrieApiTokens')}</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Result Modal */}
      <Modal show={showResultModal} onHide={() => setShowResultModal(false)} size="lg">
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            <i className="bi bi-check-circle text-success me-2"></i>
            {t('import.importacaoConcluida')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {importResult && (
            <>
              <div className="d-flex gap-4 mb-4">
                <div className="text-center">
                  <h3 className="text-success mb-0">{importResult.imported}</h3>
                  <small className="text-muted">{t('import.importados')}</small>
                </div>
                <div className="text-center">
                  <h3 className="text-danger mb-0">{importResult.failed}</h3>
                  <small className="text-muted">{t('import.erros')}</small>
                </div>
              </div>

              {importResult.records?.length > 0 && (
                <div className="mb-3">
                  <h6>{t('import.kbsImportados')}</h6>
                  <ListGroup style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {importResult.records.map((record, idx) => (
                      <ListGroup.Item key={idx} className="d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-file-earmark-text me-2"></i>{record.title}</span>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setShowResultModal(false);
                            navigate(`/kb/${record.id}/edit`);
                          }}
                        >
                          {t('common.edit')}
                        </Button>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              )}

              {importResult.errors?.length > 0 && (
                <div>
                  <h6 className="text-danger">{t('import.erros2')}</h6>
                  <ListGroup>
                    {importResult.errors.map((err, idx) => (
                      <ListGroup.Item key={idx} variant="danger">
                        <strong>{err.filename || err.title || err.page_id}:</strong> {err.error}
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowResultModal(false)}>
            {t('postmortem.close')}
          </Button>
          <Button variant="primary" onClick={() => {
            setShowResultModal(false);
            navigate('/kb');
          }}>
            {t('import.verKbs')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Import;
