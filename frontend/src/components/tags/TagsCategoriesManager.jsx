import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Badge, Spinner, Alert, Row, Col, Tabs, Tab } from 'react-bootstrap';
import { tagAPI, categoryAPI } from '../../services/api';

export default function TagsCategoriesManager() {
  const [activeTab, setActiveTab] = useState('tags');
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modals
  const [showTagModal, setShowTagModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form data
  const [tagForm, setTagForm] = useState({ name: '', color: '#6c757d', description: '' });
  const [categoryForm, setCategoryForm] = useState({ 
    name: '', 
    description: '', 
    icon: 'bi-folder', 
    color: '#6c757d',
    parent_id: '',
    order: 0
  });
  
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [tagsRes, categoriesRes] = await Promise.all([
        tagAPI.list(),
        categoryAPI.list({ flat: 'true' })
      ]);
      setTags(tagsRes.data.tags || []);
      setCategories(categoriesRes.data.categories || []);
    } catch (error) {
      setError('Falha ao carregar dados');
    } finally {
      setLoading(false);
    }
  };
  
  // Tags handlers
  const handleTagSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (editingItem) {
        await tagAPI.update(editingItem._id, tagForm);
      } else {
        await tagAPI.create(tagForm);
      }
      setShowTagModal(false);
      setEditingItem(null);
      setTagForm({ name: '', color: '#6c757d', description: '' });
      fetchData();
    } catch (error) {
      setError(error.response?.data?.error || 'Falha ao salvar tag');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleEditTag = (tag) => {
    setEditingItem(tag);
    setTagForm({
      name: tag.name,
      color: tag.color || '#6c757d',
      description: tag.description || ''
    });
    setShowTagModal(true);
  };
  
  const handleDeleteTag = async (tag) => {
    if (!window.confirm(`Excluir a tag "${tag.name}"? Ela será removida de todos os KBs.`)) {
      return;
    }
    
    try {
      await tagAPI.delete(tag._id);
      fetchData();
    } catch (error) {
      setError(error.response?.data?.error || 'Falha ao excluir tag');
    }
  };
  
  // Categories handlers
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const data = { ...categoryForm };
      if (!data.parent_id) delete data.parent_id;
      
      if (editingItem) {
        await categoryAPI.update(editingItem._id, data);
      } else {
        await categoryAPI.create(data);
      }
      setShowCategoryModal(false);
      setEditingItem(null);
      setCategoryForm({ name: '', description: '', icon: 'bi-folder', color: '#6c757d', parent_id: '', order: 0 });
      fetchData();
    } catch (error) {
      setError(error.response?.data?.error || 'Falha ao salvar categoria');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleEditCategory = (category) => {
    setEditingItem(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || 'bi-folder',
      color: category.color || '#6c757d',
      parent_id: category.parent_id || '',
      order: category.order || 0
    });
    setShowCategoryModal(true);
  };
  
  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) {
      return;
    }
    
    try {
      await categoryAPI.delete(category._id);
      fetchData();
    } catch (error) {
      setError(error.response?.data?.error || 'Falha ao excluir categoria');
    }
  };
  
  const iconOptions = [
    'bi-folder', 'bi-folder-fill', 'bi-file-text', 'bi-book', 'bi-journal',
    'bi-gear', 'bi-tools', 'bi-code-slash', 'bi-bug', 'bi-shield-check',
    'bi-people', 'bi-person', 'bi-building', 'bi-diagram-3', 'bi-lightbulb',
    'bi-star', 'bi-flag', 'bi-bookmark', 'bi-tag', 'bi-hash'
  ];
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }
  
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Tags & Categorias</h2>
      </div>
      
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
        <Tab eventKey="tags" title={<><i className="bi bi-tags me-2"></i>Tags ({tags.length})</>}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center py-3">
              <h5 className="mb-0">Gerenciar Tags</h5>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setTagForm({ name: '', color: '#6c757d', description: '' });
                  setShowTagModal(true);
                }}
              >
                <i className="bi bi-plus-lg me-1"></i>Nova Tag
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {tags.length > 0 ? (
                <Table responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Descrição</th>
                      <th>KBs</th>
                      <th width="120">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tags.map(tag => (
                      <tr key={tag._id}>
                        <td>
                          <Badge 
                            style={{ 
                              backgroundColor: tag.color,
                              color: isLightColor(tag.color) ? '#000' : '#fff'
                            }}
                          >
                            {tag.name}
                          </Badge>
                        </td>
                        <td className="text-muted">{tag.description || '-'}</td>
                        <td>
                          <Badge bg="secondary">{tag.record_count || 0}</Badge>
                        </td>
                        <td>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 me-2"
                            onClick={() => handleEditTag(tag)}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 text-danger"
                            onClick={() => handleDeleteTag(tag)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-tags fs-1 d-block mb-3"></i>
                  <p className="mb-0">Nenhuma tag criada ainda</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="categories" title={<><i className="bi bi-folder me-2"></i>Categorias ({categories.length})</>}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center py-3">
              <h5 className="mb-0">Gerenciar Categorias</h5>
              <Button 
                variant="primary" 
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setCategoryForm({ name: '', description: '', icon: 'bi-folder', color: '#6c757d', parent_id: '', order: 0 });
                  setShowCategoryModal(true);
                }}
              >
                <i className="bi bi-plus-lg me-1"></i>Nova Categoria
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {categories.length > 0 ? (
                <Table responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Descrição</th>
                      <th>Pai</th>
                      <th>KBs</th>
                      <th width="120">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(category => (
                      <tr key={category._id}>
                        <td>
                          <i className={`${category.icon || 'bi-folder'} me-2`} style={{ color: category.color }}></i>
                          {category.name}
                        </td>
                        <td className="text-muted">{category.description || '-'}</td>
                        <td>
                          {category.parent_id ? (
                            categories.find(c => c._id === category.parent_id)?.name || '-'
                          ) : '-'}
                        </td>
                        <td>
                          <Badge bg="secondary">{category.record_count || 0}</Badge>
                        </td>
                        <td>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 me-2"
                            onClick={() => handleEditCategory(category)}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 text-danger"
                            onClick={() => handleDeleteCategory(category)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-folder fs-1 d-block mb-3"></i>
                  <p className="mb-0">Nenhuma categoria criada ainda</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
      
      {/* Tag Modal */}
      <Modal show={showTagModal} onHide={() => setShowTagModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editingItem ? 'Editar Tag' : 'Nova Tag'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleTagSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Nome *</Form.Label>
              <Form.Control
                type="text"
                value={tagForm.name}
                onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                required
                maxLength={50}
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Cor</Form.Label>
              <div className="d-flex gap-2 align-items-center">
                <Form.Control
                  type="color"
                  value={tagForm.color}
                  onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                  style={{ width: '50px', height: '38px' }}
                />
                <Badge style={{ backgroundColor: tagForm.color, color: isLightColor(tagForm.color) ? '#000' : '#fff' }}>
                  {tagForm.name || 'Preview'}
                </Badge>
              </div>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={tagForm.description}
                onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                maxLength={500}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowTagModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      
      {/* Category Modal */}
      <Modal show={showCategoryModal} onHide={() => setShowCategoryModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingItem ? 'Editar Categoria' : 'Nova Categoria'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCategorySubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome *</Form.Label>
                  <Form.Control
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    required
                    maxLength={100}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Categoria Pai</Form.Label>
                  <Form.Select
                    value={categoryForm.parent_id}
                    onChange={(e) => setCategoryForm({ ...categoryForm, parent_id: e.target.value })}
                  >
                    <option value="">Nenhuma (raiz)</option>
                    {categories
                      .filter(c => c._id !== editingItem?._id)
                      .map(cat => (
                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                      ))
                    }
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                maxLength={500}
              />
            </Form.Group>
            
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Ícone</Form.Label>
                  <Form.Select
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  >
                    {iconOptions.map(icon => (
                      <option key={icon} value={icon}>{icon.replace('bi-', '')}</option>
                    ))}
                  </Form.Select>
                  <div className="mt-2">
                    <i className={`${categoryForm.icon} fs-4`} style={{ color: categoryForm.color }}></i>
                  </div>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Cor</Form.Label>
                  <Form.Control
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Ordem</Form.Label>
                  <Form.Control
                    type="number"
                    value={categoryForm.order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

// Helper function to determine if a color is light
function isLightColor(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}
