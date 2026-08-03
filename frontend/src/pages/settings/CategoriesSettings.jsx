import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Button, Modal, Form, Badge, Spinner, Alert } from 'react-bootstrap';
import api from '../../services/api';

export default function CategoriesSettings() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: '',
    icon: 'bi-folder',
    color: '#6c757d'
  });
  const [saving, setSaving] = useState(false);
  
  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Expanded categories
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/categories?flat=true');
      setCategories(data.categories || []);
    } catch (err) {
      setError('Falha ao carregar categorias');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Build category tree
  const buildTree = (items, parentId = null) => {
    return items
      .filter(item => (item.parent_id || null) === parentId)
      .map(item => ({
        ...item,
        children: buildTree(items, item._id)
      }));
  };

  const handleOpenModal = (category = null, parentId = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        parent_id: category.parent_id || '',
        icon: category.icon || 'bi-folder',
        color: category.color || '#6c757d'
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
        parent_id: parentId || '',
        icon: 'bi-folder',
        color: '#6c757d'
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '', parent_id: '', icon: 'bi-folder', color: '#6c757d' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = { ...formData };
      if (!payload.parent_id) delete payload.parent_id;

      if (editingCategory) {
        await api.patch(`/categories/${editingCategory._id}`, payload);
        setSuccess('Categoria atualizada com sucesso!');
      } else {
        await api.post('/categories', payload);
        setSuccess('Categoria criada com sucesso!');
      }
      handleCloseModal();
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao salvar categoria');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    
    setDeleting(true);
    try {
      await api.delete(`/categories/${categoryToDelete._id}`);
      setSuccess('Categoria excluída com sucesso!');
      setDeleteModal(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao excluir categoria');
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getParentCategories = () => {
    // Return only root categories for parent selection
    return categories.filter(c => !c.parent_id);
  };

  const icons = [
    'bi-folder', 'bi-folder-fill', 'bi-book', 'bi-file-text', 
    'bi-lightbulb', 'bi-gear', 'bi-question-circle', 'bi-info-circle',
    'bi-shield', 'bi-code', 'bi-database', 'bi-cloud',
    'bi-people', 'bi-person', 'bi-star', 'bi-flag',
    'bi-bell', 'bi-chat', 'bi-envelope', 'bi-calendar'
  ];

  const predefinedColors = [
    '#dc3545', '#fd7e14', '#ffc107', '#28a745', '#20c997',
    '#17a2b8', '#007bff', '#6610f2', '#e83e8c', '#6c757d'
  ];

  const renderCategoryRow = (category, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expanded[category._id];

    return (
      <React.Fragment key={category._id}>
        <tr>
          <td style={{ paddingLeft: `${level * 24 + 12}px` }}>
            <div className="d-flex align-items-center">
              {hasChildren && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="p-0 me-2"
                  onClick={() => toggleExpand(category._id)}
                >
                  <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                </Button>
              )}
              {!hasChildren && <span style={{ width: '24px', display: 'inline-block' }}></span>}
              <i 
                className={`${category.icon || 'bi-folder'} me-2`} 
                style={{ color: category.color || '#6c757d' }}
              ></i>
              <strong>{category.name}</strong>
              {hasChildren && (
                <Badge bg="light" text="dark" className="ms-2">
                  {category.children.length}
                </Badge>
              )}
            </div>
          </td>
          <td className="text-muted">
            {category.description || '-'}
          </td>
          <td>
            <Badge bg="light" text="dark">
              {category.usage_count || 0} KBs
            </Badge>
          </td>
          <td className="text-end">
            <Button 
              variant="outline-success" 
              size="sm" 
              className="me-1"
              onClick={() => handleOpenModal(null, category._id)}
              title={t('categoriesSettings.adicionarSubcategoria')}
            >
              <i className="bi bi-plus"></i>
            </Button>
            <Button 
              variant="outline-primary" 
              size="sm" 
              className="me-1"
              onClick={() => handleOpenModal(category)}
            >
              <i className="bi bi-pencil"></i>
            </Button>
            <Button 
              variant="outline-danger" 
              size="sm"
              onClick={() => {
                setCategoryToDelete(category);
                setDeleteModal(true);
              }}
            >
              <i className="bi bi-trash"></i>
            </Button>
          </td>
        </tr>
        {hasChildren && isExpanded && category.children.map(child => 
          renderCategoryRow(child, level + 1)
        )}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">{t('categoriesSettings.carregandoCategorias')}</p>
      </div>
    );
  }

  const categoryTree = buildTree(categories);

  return (
    <>
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0">
              <i className="bi bi-folder me-2"></i>
              {t('categoriesSettings.gerenciarCategorias')}
            </h5>
            <small className="text-muted">{t('categoriesSettings.organizeKbsEmCategoriasHierarquica')}</small>
          </div>
          <Button variant="primary" onClick={() => handleOpenModal()}>
            <i className="bi bi-plus-lg me-1"></i>
            {t('categoriesSettings.novaCategoria')}
          </Button>
        </Card.Header>
        
        <Card.Body className="p-0">
          {categories.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-folder text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">{t('categoriesSettings.nenhumaCategoriaCadastrada')}</p>
              <Button variant="outline-primary" onClick={() => handleOpenModal()}>
                <i className="bi bi-plus-lg me-1"></i>
                {t('categoriesSettings.criarPrimeiraCategoria')}
              </Button>
            </div>
          ) : (
            <Table hover responsive className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th>{t('search.category')}</th>
                  <th>{t('common.description')}</th>
                  <th>{t('categoriesSettings.kbsVinculados')}</th>
                  <th className="text-end">{t('reviews.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {categoryTree.map(category => renderCategoryRow(category))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Modal de Criação/Edição */}
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('categoriesSettings.nomeDaCategoria')}</Form.Label>
              <Form.Control
                type="text"
                placeholder={t('categoriesSettings.exTutoriaisDocumentacaoFaqs')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t('categoriesSettings.categoriaPai')}</Form.Label>
              <Form.Select
                value={formData.parent_id}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
              >
                <option value="">{t('categoriesSettings.nenhumaCategoriaRaiz')}</option>
                {getParentCategories()
                  .filter(c => c._id !== editingCategory?._id)
                  .map(category => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {t('categoriesSettings.selecioneParaCriarUmaSubcategoria')}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t('categoriesSettings.icone')}</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {icons.map(icon => (
                  <div
                    key={icon}
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`p-2 rounded cursor-pointer ${formData.icon === icon ? 'bg-primary text-white' : 'bg-light'}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <i className={icon}></i>
                  </div>
                ))}
              </div>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t('categoriesSettings.cor')}</Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {predefinedColors.map(color => (
                  <div
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: color,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: formData.color === color ? '3px solid #000' : '1px solid #ddd'
                    }}
                  />
                ))}
              </div>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t('common.description')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder={t('categoriesSettings.descricaoOpcionalDaCategoria')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Form.Group>

            <div className="mt-3 p-3 bg-light rounded">
              <small className="text-muted">{t('categoriesSettings.preVisualizacao')}</small>
              <div className="mt-2 d-flex align-items-center">
                <i 
                  className={`${formData.icon} me-2`} 
                  style={{ color: formData.color, fontSize: '1.25rem' }}
                ></i>
                <span className="fw-medium">{formData.name || 'Nome da Categoria'}</span>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={saving || !formData.name}>
              {saving ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  {t('integrations.saving')}
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg me-1"></i>
                  {editingCategory ? 'Atualizar' : 'Criar Categoria'}
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal show={deleteModal} onHide={() => setDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('categoriesSettings.confirmarExclusao')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{t('categoriesSettings.temCertezaQueDesejaExcluirA')} <strong>{categoryToDelete?.name}</strong>?</p>
          {categoryToDelete?.children?.length > 0 && (
            <Alert variant="danger">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {t('categoriesSettings.estaCategoriaPossuiSubcategoriasQu')}
            </Alert>
          )}
          {categoryToDelete?.usage_count > 0 && (
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              Esta categoria está vinculada a {categoryToDelete.usage_count} KB(s).
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                {t('categoriesSettings.excluindo')}
              </>
            ) : (
              <>
                <i className="bi bi-trash me-1"></i>
                {t('common.delete')}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
