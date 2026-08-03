import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

const ROLES = [
  { value: 'admin', label: 'Administrador', color: 'danger' },
  { value: 'reviewer', label: 'Revisor', color: 'warning' },
  { value: 'editor', label: 'Editor', color: 'info' },
  { value: 'viewer', label: 'Visualizador', color: 'secondary' }
];

export default function UsersTab() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'viewer'
  });
  const [filterRole, setFilterRole] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, groupsRes] = await Promise.all([
        api.get('/users'),
        api.get('/groups')
      ]);
      setUsers(usersRes.data.users || []);
      setGroups(groupsRes.data.groups || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert(t('usersTab.erroAoCarregarDados'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password;
        await api.put(`/users/${editingUser._id}`, updateData);
      } else {
        await api.post('/users', formData);
      }
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'viewer' });
      setEditingUser(null);
      loadData();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      alert(error.response?.data?.error || 'Erro ao salvar usuário');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role || 'viewer'
    });
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Deseja realmente excluir o usuário "${name}"?`)) return;
    
    try {
      await api.delete(`/users/${id}`);
      loadData();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      alert(error.response?.data?.error || 'Erro ao excluir usuário');
    }
  };

  const getRoleInfo = (role) => {
    return ROLES.find(r => r.value === role) || ROLES[3];
  };

  const getUserGroups = async (userId) => {
    // Esta funcionalidade pode ser implementada depois
    return [];
  };

  const filteredUsers = filterRole
    ? users.filter(u => u.role === filterRole)
    : users;

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
        <h4 className="mb-0">{t('usersTab.usuarios')}</h4>
        <div className="d-flex gap-2">
          <select
            className="form-select"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">{t('usersTab.todosOsRoles')}</option>
            {ROLES.map(role => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingUser(null);
              setFormData({ name: '', email: '', password: '', role: 'viewer' });
              setShowModal(true);
            }}
          >
            <i className="bi bi-plus-circle me-2"></i>
            {t('usersTab.novoUsuario')}
          </button>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          {t('usersTab.nenhumUsuarioEncontrado')}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>{t('gpsEditor.name')}</th>
                <th>{t('usersTab.email')}</th>
                <th>{t('usersTab.role')}</th>
                <th>{t('usersTab.criadoEm')}</th>
                <th>{t('reviews.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const roleInfo = getRoleInfo(user.role);
                return (
                  <tr key={user._id}>
                    <td>
                      <strong>{user.name}</strong>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge bg-${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </td>
                    <td>
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => handleEdit(user)}
                          title={t('common.edit')}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleDelete(user._id, user.name)}
                          title={t('common.delete')}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Estatísticas */}
      <div className="row mt-4">
        <div className="col-md-12">
          <h5 className="mb-3">{t('usersTab.estatisticas')}</h5>
        </div>
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role.value).length;
          return (
            <div key={role.value} className="col-md-3 mb-3">
              <div className="card">
                <div className="card-body">
                  <h3 className="mb-0">{count}</h3>
                  <small className="text-muted">{role.label}s</small>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
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
                    <label className="form-label">{t('usersTab.nome')}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('usersTab.email2')}</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={!!editingUser}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      Senha {editingUser ? '(deixe em branco para não alterar)' : '*'}
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingUser}
                      minLength="6"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('usersTab.rolePermissao')}</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                    >
                      {ROLES.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">
                      <strong>{t('usersTab.admin')}</strong> {t('usersTab.acessoTotal')}<br />
                      <strong>{t('usersTab.revisor')}</strong> {t('usersTab.aprovarKbs')}<br />
                      <strong>{t('usersTab.editor')}</strong> {t('usersTab.criarEEditarKbsProprias')}<br />
                      <strong>{t('usersTab.visualizador')}</strong> {t('usersTab.apenasLeitura')}
                    </div>
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
                    {editingUser ? 'Salvar' : 'Criar'}
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
