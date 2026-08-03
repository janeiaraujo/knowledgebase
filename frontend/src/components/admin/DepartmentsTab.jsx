import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

export default function DepartmentsTab() {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_department_id: ''
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
      alert(t('departmentsTab.erroAoCarregarDepartamentos'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept._id}`, formData);
      } else {
        await api.post('/departments', formData);
      }
      setShowModal(false);
      setFormData({ name: '', description: '', parent_department_id: '' });
      setEditingDept(null);
      loadDepartments();
    } catch (error) {
      console.error('Erro ao salvar departamento:', error);
      alert(error.response?.data?.error || 'Erro ao salvar departamento');
    }
  };

  const handleEdit = (dept) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      description: dept.description || '',
      parent_department_id: dept.parent_department_id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Deseja realmente excluir o departamento "${name}"?`)) return;
    
    try {
      await api.delete(`/departments/${id}`);
      loadDepartments();
    } catch (error) {
      console.error('Erro ao excluir departamento:', error);
      alert(error.response?.data?.error || 'Erro ao excluir departamento');
    }
  };

  const buildDepartmentTree = (depts, parentId = null, level = 0) => {
    return depts
      .filter(d => {
        const parent = d.parent_department_id;
        if (parentId === null) return parent === null || parent === undefined;
        return parent && parent.toString() === parentId.toString();
      })
      .map(dept => (
        <div key={dept._id}>
          <div className="card mb-2" style={{ marginLeft: `${level * 20}px` }}>
            <div className="card-body py-2">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>{dept.name}</strong>
                  {dept.description && (
                    <small className="text-muted ms-2">- {dept.description}</small>
                  )}
                </div>
                <div className="btn-group btn-group-sm">
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => handleEdit(dept)}
                  >
                    <i className="bi bi-pencil"></i>
                  </button>
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => handleDelete(dept._id, dept.name)}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {buildDepartmentTree(depts, dept._id, level + 1)}
        </div>
      ));
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">{t('departmentsTab.departamentos')}</h4>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingDept(null);
            setFormData({ name: '', description: '', parent_department_id: '' });
            setShowModal(true);
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>
          {t('departmentsTab.novoDepartamento')}
        </button>
      </div>

      {departments.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          {t('departmentsTab.nenhumDepartamentoCadastradoCrieOP')}
        </div>
      ) : (
        <div>{buildDepartmentTree(departments)}</div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingDept ? 'Editar Departamento' : 'Novo Departamento'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">{t('departmentsTab.nome')}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('common.description')}</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('departmentsTab.departamentoPaiHierarquia')}</label>
                    <select
                      className="form-select"
                      value={formData.parent_department_id}
                      onChange={(e) => setFormData({ ...formData, parent_department_id: e.target.value })}
                    >
                      <option value="">{t('departmentsTab.nenhumNivelRaiz')}</option>
                      {departments
                        .filter(d => !editingDept || d._id !== editingDept._id)
                        .map(dept => (
                          <option key={dept._id} value={dept._id}>
                            {dept.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingDept ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
