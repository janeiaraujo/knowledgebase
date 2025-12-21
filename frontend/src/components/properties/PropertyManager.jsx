import { useState, useEffect } from 'react';
import api from '../../services/api';

const PROPERTY_TYPES = [
  { value: 'text', label: 'Texto Curto', icon: '📝' },
  { value: 'textarea', label: 'Texto Longo', icon: '📄' },
  { value: 'number', label: 'Número', icon: '🔢' },
  { value: 'select', label: 'Seleção', icon: '☑️' },
  { value: 'multiselect', label: 'Seleção Múltipla', icon: '✅' },
  { value: 'date', label: 'Data', icon: '📅' },
  { value: 'url', label: 'URL', icon: '🔗' },
  { value: 'email', label: 'E-mail', icon: '📧' },
  { value: 'phone', label: 'Telefone', icon: '📱' },
  { value: 'checkbox', label: 'Caixa de Seleção', icon: '☑️' },
  { value: 'file', label: 'Arquivo', icon: '📎' }
];

function PropertyModal({ show, onHide, property, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'text',
    options: [],
    required: false,
    defaultValue: ''
  });
  const [optionInput, setOptionInput] = useState('');

  useEffect(() => {
    if (property) {
      setFormData({
        name: property.name || '',
        type: property.type || 'text',
        options: property.options || [],
        required: property.required || false,
        defaultValue: property.defaultValue || ''
      });
    } else {
      setFormData({
        name: '',
        type: 'text',
        options: [],
        required: false,
        defaultValue: ''
      });
    }
  }, [property, show]);

  const handleAddOption = () => {
    if (optionInput.trim()) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, optionInput.trim()]
      }));
      setOptionInput('');
    }
  };

  const handleRemoveOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData);
  };

  const needsOptions = ['select', 'multiselect'].includes(formData.type);

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">
                {property ? 'Editar Propriedade' : 'Nova Propriedade'}
              </h5>
              <button type="button" className="btn-close" onClick={onHide}></button>
            </div>
            
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Nome da Propriedade</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ex: Prioridade, Categoria, Responsável"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Tipo</label>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  {PROPERTY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {needsOptions && (
                <div className="mb-3">
                  <label className="form-label">Opções</label>
                  <div className="input-group mb-2">
                    <input
                      type="text"
                      className="form-control"
                      value={optionInput}
                      onChange={(e) => setOptionInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                      placeholder="Digite uma opção e pressione Enter"
                    />
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={handleAddOption}
                    >
                      <i className="bi bi-plus-circle"></i>
                    </button>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {formData.options.map((option, index) => (
                      <span key={index} className="badge bg-secondary d-flex align-items-center gap-1">
                        {option}
                        <button
                          type="button"
                          className="btn-close btn-close-white"
                          style={{ fontSize: '0.6rem' }}
                          onClick={() => handleRemoveOption(index)}
                        ></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="required"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="required">
                  Campo obrigatório
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onHide}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                {property ? 'Salvar Alterações' : 'Criar Propriedade'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function PropertyManager() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const response = await api.get('/properties');
      setProperties(response.data.properties);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData) => {
    try {
      if (editingProperty) {
        await api.put(`/properties/${editingProperty._id}`, formData);
      } else {
        await api.post('/properties', formData);
      }
      await loadProperties();
      setShowModal(false);
      setEditingProperty(null);
    } catch (error) {
      console.error('Error saving property:', error);
      alert('Erro ao salvar propriedade');
    }
  };

  const handleDelete = async (propertyId) => {
    if (!confirm('Tem certeza que deseja excluir esta propriedade? Os valores serão removidos de todos os registros.')) {
      return;
    }

    try {
      await api.delete(`/properties/${propertyId}`);
      await loadProperties();
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('Erro ao excluir propriedade');
    }
  };

  const handleEdit = (property) => {
    setEditingProperty(property);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingProperty(null);
    setShowModal(true);
  };

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border"></div></div>;
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>Propriedades Customizadas</h2>
          <p className="text-muted">Defina campos personalizados para seus registros de conhecimento</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>
          <i className="bi bi-plus-circle me-2"></i>
          Nova Propriedade
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="alert alert-info">
          <h5>Nenhuma propriedade customizada criada</h5>
          <p className="mb-0">Crie propriedades personalizadas para adicionar campos aos seus registros, como prioridade, categoria, responsável, etc.</p>
        </div>
      ) : (
        <div className="card">
          <div className="list-group list-group-flush">
            {properties.map((property) => {
              const typeInfo = PROPERTY_TYPES.find(t => t.value === property.type);
              return (
                <div key={property._id} className="list-group-item">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-grip-vertical text-muted me-3" style={{ cursor: 'grab', fontSize: '1.2rem' }}></i>
                    
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span style={{ fontSize: '1.2rem' }}>{typeInfo?.icon}</span>
                        <strong>{property.name}</strong>
                        {property.required && (
                          <span className="badge bg-danger">Obrigatório</span>
                        )}
                      </div>
                      <small className="text-muted">
                        {typeInfo?.label}
                        {property.options && property.options.length > 0 && (
                          <> · {property.options.length} opções</>
                        )}
                      </small>
                      {property.options && property.options.length > 0 && (
                        <div className="mt-2">
                          {property.options.map((opt, idx) => (
                            <span key={idx} className="badge bg-light text-dark me-1">{opt}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="btn-group">
                      <button 
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handleEdit(property)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(property._id)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PropertyModal
        show={showModal}
        onHide={() => {
          setShowModal(false);
          setEditingProperty(null);
        }}
        property={editingProperty}
        onSave={handleSave}
      />
    </div>
  );
}
