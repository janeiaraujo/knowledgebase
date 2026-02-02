import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function KBAccessTab() {
  const [kbs, setKbs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedKB, setSelectedKB] = useState(null);
  const [accessData, setAccessData] = useState({
    visibility: 'restricted',
    allowed_departments: [],
    allowed_groups: []
  });
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedKBs, setSelectedKBs] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [kbsRes, deptsRes, groupsRes] = await Promise.all([
        api.get('/records'),
        api.get('/departments'),
        api.get('/groups')
      ]);
      setKbs(kbsRes.data.records || []);
      setDepartments(deptsRes.data.departments || []);
      setGroups(groupsRes.data.groups || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      alert('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadKBAccess = async (kbId) => {
    try {
      const response = await api.get(`/kb-access/${kbId}`);
      const data = response.data;
      setAccessData({
        visibility: data.visibility || 'restricted',
        allowed_departments: data.allowed_departments?.map(d => d.toString()) || [],
        allowed_groups: data.allowed_groups?.map(g => g.toString()) || []
      });
    } catch (error) {
      // Se não existe, usa default
      setAccessData({
        visibility: 'restricted',
        allowed_departments: [],
        allowed_groups: []
      });
    }
  };

  const handleConfigureAccess = async (kb) => {
    setSelectedKB(kb);
    await loadKBAccess(kb._id);
    setBulkMode(false);
    setShowModal(true);
  };

  const handleBulkConfigure = () => {
    if (selectedKBs.length === 0) {
      alert('Selecione ao menos um KB');
      return;
    }
    setAccessData({
      visibility: 'restricted',
      allowed_departments: [],
      allowed_groups: []
    });
    setBulkMode(true);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (bulkMode) {
        await api.post('/kb-access/bulk', {
          kb_ids: selectedKBs,
          ...accessData
        });
        setSelectedKBs([]);
      } else {
        await api.post(`/kb-access/${selectedKB._id}`, accessData);
      }
      setShowModal(false);
      alert('Controle de acesso configurado com sucesso!');
    } catch (error) {
      console.error('Erro ao configurar acesso:', error);
      alert(error.response?.data?.error || 'Erro ao configurar acesso');
    }
  };

  const toggleKBSelection = (kbId) => {
    setSelectedKBs(prev =>
      prev.includes(kbId)
        ? prev.filter(id => id !== kbId)
        : [...prev, kbId]
    );
  };

  const toggleDepartment = (deptId) => {
    setAccessData(prev => ({
      ...prev,
      allowed_departments: prev.allowed_departments.includes(deptId)
        ? prev.allowed_departments.filter(id => id !== deptId)
        : [...prev.allowed_departments, deptId]
    }));
  };

  const toggleGroup = (groupId) => {
    setAccessData(prev => ({
      ...prev,
      allowed_groups: prev.allowed_groups.includes(groupId)
        ? prev.allowed_groups.filter(id => id !== groupId)
        : [...prev.allowed_groups, groupId]
    }));
  };

  const getKBStatus = (kb) => {
    const statusColors = {
      draft: 'secondary',
      in_review: 'warning',
      approved: 'success',
      published: 'primary'
    };
    return statusColors[kb.status] || 'secondary';
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Controle de Acesso a KBs</h4>
        <button
          className="btn btn-warning"
          onClick={handleBulkConfigure}
          disabled={selectedKBs.length === 0}
        >
          <i className="bi bi-stack me-2"></i>
          Configurar em Lote ({selectedKBs.length})
        </button>
      </div>

      <div className="alert alert-info">
        <i className="bi bi-info-circle me-2"></i>
        <strong>Visibilidade:</strong> "Global" = todos veem | "Restrita" = apenas departamentos/grupos selecionados
      </div>

      {kbs.length === 0 ? (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Nenhum KB cadastrado ainda.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedKBs(kbs.map(kb => kb._id));
                      } else {
                        setSelectedKBs([]);
                      }
                    }}
                    checked={selectedKBs.length === kbs.length && kbs.length > 0}
                  />
                </th>
                <th>Título</th>
                <th>Status</th>
                <th>Criado por</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {kbs.map(kb => (
                <tr key={kb._id}>
                  <td>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={selectedKBs.includes(kb._id)}
                      onChange={() => toggleKBSelection(kb._id)}
                    />
                  </td>
                  <td>
                    <strong>{kb.title}</strong>
                  </td>
                  <td>
                    <span className={`badge bg-${getKBStatus(kb)}`}>
                      {kb.status}
                    </span>
                  </td>
                  <td>
                    <small className="text-muted">
                      {kb.created_by?.name || 'N/A'}
                    </small>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => handleConfigureAccess(kb)}
                    >
                      <i className="bi bi-shield-lock me-1"></i>
                      Configurar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Configurar Acesso */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {bulkMode
                    ? `Configurar Acesso em Lote (${selectedKBs.length} KBs)`
                    : `Configurar Acesso: ${selectedKB?.title}`}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {/* Visibilidade */}
                  <div className="mb-4">
                    <label className="form-label">
                      <strong>Visibilidade</strong>
                    </label>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="visibility"
                        id="visibilityGlobal"
                        value="global"
                        checked={accessData.visibility === 'global'}
                        onChange={(e) => setAccessData({ ...accessData, visibility: e.target.value })}
                      />
                      <label className="form-check-label" htmlFor="visibilityGlobal">
                        <strong>Global</strong> - Todos os usuários podem ver
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="visibility"
                        id="visibilityRestricted"
                        value="restricted"
                        checked={accessData.visibility === 'restricted'}
                        onChange={(e) => setAccessData({ ...accessData, visibility: e.target.value })}
                      />
                      <label className="form-check-label" htmlFor="visibilityRestricted">
                        <strong>Restrita</strong> - Apenas departamentos/grupos selecionados
                      </label>
                    </div>
                  </div>

                  {/* Departamentos */}
                  {accessData.visibility === 'restricted' && (
                    <>
                      <div className="mb-4">
                        <label className="form-label">
                          <strong>Departamentos com Acesso</strong>
                        </label>
                        {departments.length === 0 ? (
                          <div className="alert alert-warning">
                            Nenhum departamento cadastrado
                          </div>
                        ) : (
                          <div className="list-group">
                            {departments.map(dept => (
                              <label
                                key={dept._id}
                                className="list-group-item list-group-item-action"
                                style={{ cursor: 'pointer' }}
                              >
                                <input
                                  className="form-check-input me-2"
                                  type="checkbox"
                                  checked={accessData.allowed_departments.includes(dept._id)}
                                  onChange={() => toggleDepartment(dept._id)}
                                />
                                {dept.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Grupos */}
                      <div className="mb-3">
                        <label className="form-label">
                          <strong>Grupos com Acesso</strong>
                        </label>
                        {groups.length === 0 ? (
                          <div className="alert alert-warning">
                            Nenhum grupo cadastrado
                          </div>
                        ) : (
                          <div className="list-group" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {groups.map(group => (
                              <label
                                key={group._id}
                                className="list-group-item list-group-item-action"
                                style={{ cursor: 'pointer' }}
                              >
                                <input
                                  className="form-check-input me-2"
                                  type="checkbox"
                                  checked={accessData.allowed_groups.includes(group._id)}
                                  onChange={() => toggleGroup(group._id)}
                                />
                                {group.name}
                                <small className="text-muted ms-2">
                                  ({departments.find(d => d._id === group.department_id)?.name || 'N/A'})
                                </small>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-shield-check me-2"></i>
                    Salvar Configuração
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
