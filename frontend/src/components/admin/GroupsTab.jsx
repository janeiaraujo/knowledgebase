import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

export default function GroupsTab() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: '',
    parent_group_id: ''
  });
  const [memberForm, setMemberForm] = useState({
    user_id: '',
    role_in_group: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsRes, deptsRes, usersRes] = await Promise.all([
        api.get('/groups'),
        api.get('/departments'),
        api.get('/users')
      ]);
      setGroups(groupsRes.data.groups || []);
      setDepartments(deptsRes.data.departments || []);
      setUsers(usersRes.data.users || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert(t('groupsTab.erroAoCarregarDados'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await api.put(`/groups/${editingGroup._id}`, formData);
      } else {
        await api.post('/groups', formData);
      }
      setShowModal(false);
      setFormData({ name: '', description: '', department_id: '', parent_group_id: '' });
      setEditingGroup(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar grupo:', error);
      alert(error.response?.data?.error || 'Erro ao salvar grupo');
    }
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      department_id: group.department_id || '',
      parent_group_id: group.parent_group_id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Deseja realmente excluir o grupo "${name}"?`)) return;
    
    try {
      await api.delete(`/groups/${id}`);
      loadData();
    } catch (error) {
      console.error('Erro ao excluir grupo:', error);
      alert(error.response?.data?.error || 'Erro ao excluir grupo');
    }
  };

  const handleManageMembers = async (group) => {
    setSelectedGroup(group);
    try {
      const response = await api.get(`/groups/${group._id}/users`);
      setGroupMembers(response.data.users || []);
      setShowMembersModal(true);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      alert(t('groupsTab.erroAoCarregarMembros'));
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/groups/${selectedGroup._id}/users`, memberForm);
      setMemberForm({ user_id: '', role_in_group: '' });
      const response = await api.get(`/groups/${selectedGroup._id}/users`);
      setGroupMembers(response.data.users || []);
    } catch (error) {
      console.error('Erro ao adicionar membro:', error);
      alert(error.response?.data?.error || 'Erro ao adicionar membro');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm(t('groupsTab.desejaRemoverEsteUsuarioDoGrupo'))) return;
    
    try {
      await api.delete(`/groups/${selectedGroup._id}/users/${userId}`);
      const response = await api.get(`/groups/${selectedGroup._id}/users`);
      setGroupMembers(response.data.users || []);
    } catch (error) {
      console.error('Erro ao remover membro:', error);
      alert(t('groupsTab.erroAoRemoverMembro'));
    }
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d._id === deptId);
    return dept ? dept.name : 'N/A';
  };

  const groupsByDepartment = departments.map(dept => ({
    department: dept,
    groups: groups.filter(g => g.department_id?.toString() === dept._id?.toString())
  })).filter(item => item.groups.length > 0);

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
        <h4 className="mb-0">{t('groupsTab.grupos')}</h4>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingGroup(null);
            setFormData({ name: '', description: '', department_id: '', parent_group_id: '' });
            setShowModal(true);
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>
          {t('groupsTab.novoGrupo')}
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          {t('groupsTab.nenhumGrupoCadastradoCrieOPrimeiro')}
        </div>
      ) : (
        <div className="accordion" id="groupsAccordion">
          {groupsByDepartment.map((item, idx) => (
            <div className="accordion-item" key={item.department._id}>
              <h2 className="accordion-header">
                <button
                  className="accordion-button"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target={`#collapse${idx}`}
                >
                  <i className="bi bi-diagram-3 me-2"></i>
                  {item.department.name}
                  <span className="badge bg-primary ms-2">{item.groups.length}</span>
                </button>
              </h2>
              <div
                id={`collapse${idx}`}
                className="accordion-collapse collapse show"
              >
                <div className="accordion-body">
                  <div className="list-group">
                    {item.groups.map(group => (
                      <div key={group._id} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h6 className="mb-1">{group.name}</h6>
                            {group.description && (
                              <small className="text-muted">{group.description}</small>
                            )}
                          </div>
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-outline-info"
                              onClick={() => handleManageMembers(group)}
                              title={t('groupsTab.gerenciarMembros')}
                            >
                              <i className="bi bi-people"></i>
                            </button>
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => handleEdit(group)}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => handleDelete(group._id, group.name)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar/Editar Grupo */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingGroup ? 'Editar Grupo' : 'Novo Grupo'}
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
                    <label className="form-label">{t('groupsTab.nome')}</label>
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
                      rows="2"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('groupsTab.departamento')}</label>
                    <select
                      className="form-select"
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                      required
                    >
                      <option value="">{t('groupsTab.selecione')}</option>
                      {departments.map(dept => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('groupsTab.grupoPaiHierarquia')}</label>
                    <select
                      className="form-select"
                      value={formData.parent_group_id}
                      onChange={(e) => setFormData({ ...formData, parent_group_id: e.target.value })}
                    >
                      <option value="">{t('groupsTab.nenhumNivelRaiz')}</option>
                      {groups
                        .filter(g => !editingGroup || g._id !== editingGroup._id)
                        .map(group => (
                          <option key={group._id} value={group._id}>
                            {group.name}
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
                    {editingGroup ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Membros */}
      {showMembersModal && selectedGroup && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Membros do Grupo: {selectedGroup.name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowMembersModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Form Adicionar Membro */}
                <form onSubmit={handleAddMember} className="mb-4">
                  <div className="row g-2">
                    <div className="col-md-6">
                      <select
                        className="form-select"
                        value={memberForm.user_id}
                        onChange={(e) => setMemberForm({ ...memberForm, user_id: e.target.value })}
                        required
                      >
                        <option value="">{t('groupsTab.selecioneUmUsuario')}</option>
                        {users
                          .filter(u => !groupMembers.find(m => m._id === u._id))
                          .map(user => (
                            <option key={user._id} value={user._id}>
                              {user.name} ({user.email})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <input
                        type="text"
                        className="form-control"
                        placeholder={t('groupsTab.funcaoNoGrupoOpcional')}
                        value={memberForm.role_in_group}
                        onChange={(e) => setMemberForm({ ...memberForm, role_in_group: e.target.value })}
                      />
                    </div>
                    <div className="col-md-2">
                      <button type="submit" className="btn btn-primary w-100">
                        <i className="bi bi-plus-circle"></i> {t('common.add')}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Lista de Membros */}
                <h6 className="mb-3">Membros Atuais ({groupMembers.length})</h6>
                {groupMembers.length === 0 ? (
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    {t('groupsTab.nenhumMembroNesteGrupoAinda')}
                  </div>
                ) : (
                  <div className="list-group">
                    {groupMembers.map(member => (
                      <div key={member._id} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong>{member.name}</strong>
                            <br />
                            <small className="text-muted">{member.email}</small>
                            {member.role && (
                              <span className="badge bg-secondary ms-2">{member.role}</span>
                            )}
                          </div>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleRemoveMember(member._id)}
                          >
                            <i className="bi bi-x-circle"></i> {t('integrations.remove')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowMembersModal(false)}
                >
                  {t('postmortem.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
