import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Button, Modal, Form, Badge, Spinner, Alert, InputGroup } from 'react-bootstrap';
import api from '../../services/api';

export default function TagsSettings() {
  const { t } = useTranslation();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#6c757d',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  
  // Delete confirmation
  const [deleteModal, setDeleteModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/tags');
      setTags(data.tags || []);
    } catch (err) {
      setError('Falha ao carregar tags');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (tag = null) => {
    if (tag) {
      setEditingTag(tag);
      setFormData({
        name: tag.name,
        color: tag.color || '#6c757d',
        description: tag.description || ''
      });
    } else {
      setEditingTag(null);
      setFormData({
        name: '',
        color: '#6c757d',
        description: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTag(null);
    setFormData({ name: '', color: '#6c757d', description: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingTag) {
        await api.patch(`/tags/${editingTag._id}`, formData);
        setSuccess('Tag atualizada com sucesso!');
      } else {
        await api.post('/tags', formData);
        setSuccess('Tag criada com sucesso!');
      }
      handleCloseModal();
      fetchTags();
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao salvar tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tagToDelete) return;
    
    setDeleting(true);
    try {
      await api.delete(`/tags/${tagToDelete._id}`);
      setSuccess('Tag excluída com sucesso!');
      setDeleteModal(false);
      setTagToDelete(null);
      fetchTags();
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao excluir tag');
    } finally {
      setDeleting(false);
    }
  };

  const predefinedColors = [
    '#dc3545', '#fd7e14', '#ffc107', '#28a745', '#20c997',
    '#17a2b8', '#007bff', '#6610f2', '#e83e8c', '#6c757d'
  ];

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2 text-muted">{t('tagsSettings.carregandoTags')}</p>
      </div>
    );
  }

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
              <i className="bi bi-tags me-2"></i>
              {t('tagsSettings.gerenciarTags')}
            </h5>
            <small className="text-muted">{t('tagsSettings.configureAsTagsDisponiveisParaCate')}</small>
          </div>
          <Button variant="primary" onClick={() => handleOpenModal()}>
            <i className="bi bi-plus-lg me-1"></i>
            {t('tagsSettings.novaTag')}
          </Button>
        </Card.Header>
        
        <Card.Body className="p-0">
          {tags.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-tags text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="text-muted mt-3">{t('tagsSettings.nenhumaTagCadastrada')}</p>
              <Button variant="outline-primary" onClick={() => handleOpenModal()}>
                <i className="bi bi-plus-lg me-1"></i>
                {t('tagsSettings.criarPrimeiraTag')}
              </Button>
            </div>
          ) : (
            <Table hover responsive className="mb-0">
              <thead className="bg-light">
                <tr>
                  <th>{t('tagsSettings.tag')}</th>
                  <th>{t('common.description')}</th>
                  <th>{t('tagsSettings.kbsVinculados')}</th>
                  <th>{t('tagsSettings.criadaEm')}</th>
                  <th className="text-end">{t('reviews.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tags.map(tag => (
                  <tr key={tag._id}>
                    <td>
                      <Badge 
                        style={{ backgroundColor: tag.color || '#6c757d' }}
                        className="px-3 py-2"
                      >
                        {tag.name}
                      </Badge>
                    </td>
                    <td className="text-muted">
                      {tag.description || '-'}
                    </td>
                    <td>
                      <Badge bg="light" text="dark">
                        {tag.usage_count || 0} KBs
                      </Badge>
                    </td>
                    <td className="text-muted small">
                      {new Date(tag.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="text-end">
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        className="me-1"
                        onClick={() => handleOpenModal(tag)}
                      >
                        <i className="bi bi-pencil"></i>
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={() => {
                          setTagToDelete(tag);
                          setDeleteModal(true);
                        }}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Modal de Criação/Edição */}
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingTag ? 'Editar Tag' : 'Nova Tag'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('tagsSettings.nomeDaTag')}</Form.Label>
              <Form.Control
                type="text"
                placeholder={t('tagsSettings.exUrgenteTutorialFaq')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t('tagsSettings.cor')}</Form.Label>
              <div className="d-flex flex-wrap gap-2 mb-2">
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
              <InputGroup size="sm">
                <InputGroup.Text>{t('tagsSettings.personalizada')}</InputGroup.Text>
                <Form.Control
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  style={{ width: '60px', padding: '2px' }}
                />
                <Form.Control
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#000000"
                />
              </InputGroup>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t('common.description')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder={t('tagsSettings.descricaoOpcionalDaTag')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Form.Group>

            <div className="mt-3 p-3 bg-light rounded">
              <small className="text-muted">{t('tagsSettings.preVisualizacao')}</small>
              <div className="mt-2">
                <Badge 
                  style={{ backgroundColor: formData.color }}
                  className="px-3 py-2"
                >
                  {formData.name || 'Nome da Tag'}
                </Badge>
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
                  {editingTag ? 'Atualizar' : 'Criar Tag'}
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal show={deleteModal} onHide={() => setDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('tagsSettings.confirmarExclusao')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{t('tagsSettings.temCertezaQueDesejaExcluirA')} <strong>{tagToDelete?.name}</strong>?</p>
          {tagToDelete?.usage_count > 0 && (
            <Alert variant="warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              Esta tag está vinculada a {tagToDelete.usage_count} KB(s). 
              A tag será removida desses artigos.
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
                {t('tagsSettings.excluindo')}
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
