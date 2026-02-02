import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Form, Button, Badge, Alert, Row, Col, Tabs, Tab, Table, Modal } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function KBPermissions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [record, setRecord] = useState(null);
  const [permissions, setPermissions] = useState({
    visibility: 'public',
    allowed_departments: [],
    allowed_groups: [],
    allowed_users: [],
    editors: [],
    viewers: []
  });
  const [departments, setDepartments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserType, setAddUserType] = useState('viewer');
  const [selectedUserId, setSelectedUserId] = useState('');
  
  useEffect(() => {
    fetchData();
  }, [id]);
  
  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [recordRes, permRes, depsRes, groupsRes, usersRes] = await Promise.all([
        api.get(`/records/${id}`),
        api.get(`/kb-access/${id}`).catch(() => ({ data: { access: null } })),
        api.get('/departments'),
        api.get('/groups'),
        api.get('/users')
      ]);
      
      setRecord(recordRes.data.record);
      setDepartments(depsRes.data.departments || []);
      setGroups(groupsRes.data.groups || []);
      setUsers(usersRes.data.users || []);
      
      if (permRes.data.access) {
        setPermissions({
          visibility: permRes.data.access.visibility || 'public',
          allowed_departments: permRes.data.access.allowed_departments || [],
          allowed_groups: permRes.data.access.allowed_groups || [],
          allowed_users: permRes.data.access.allowed_users || [],
          editors: permRes.data.access.editors || [],
          viewers: permRes.data.access.viewers || []
        });
      }
    } catch (err) {
      setError('Falha ao carregar dados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await api.put(`/kb-access/${id}`, permissions);
      
      setSuccess('Permissões salvas com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Falha ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };
  
  const toggleDepartment = (depId) => {
    setPermissions(prev => ({
      ...prev,
      allowed_departments: prev.allowed_departments.includes(depId)
        ? prev.allowed_departments.filter(d => d !== depId)
        : [...prev.allowed_departments, depId]
    }));
  };
  
  const toggleGroup = (groupId) => {
    setPermissions(prev => ({
      ...prev,
      allowed_groups: prev.allowed_groups.includes(groupId)
        ? prev.allowed_groups.filter(g => g !== groupId)
        : [...prev.allowed_groups, groupId]
    }));
  };
  
  const addUserPermission = () => {
    if (!selectedUserId) return;
    
    const field = addUserType === 'editor' ? 'editors' : 'viewers';
    
    if (!permissions[field].includes(selectedUserId)) {
      setPermissions(prev => ({
        ...prev,
        [field]: [...prev[field], selectedUserId]
      }));
    }
    
    setSelectedUserId('');
    setShowAddUserModal(false);
  };
  
  const removeUserPermission = (userId, type) => {
    const field = type === 'editor' ? 'editors' : 'viewers';
    setPermissions(prev => ({
      ...prev,
      [field]: prev[field].filter(u => u !== userId)
    }));
  };
  
  const getUserName = (userId) => {
    const u = users.find(user => user._id === userId);
    return u ? (u.name || u.email) : 'Usuário desconhecido';
  };
  
  const getDepartmentName = (depId) => {
    const d = departments.find(dep => dep._id === depId);
    return d ? d.name : 'Departamento desconhecido';
  };
  
  const getGroupName = (groupId) => {
    const g = groups.find(group => group._id === groupId);
    return g ? g.name : 'Grupo desconhecido';
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
  
  if (!record) {
    return <Alert variant="danger">KB não encontrado</Alert>;
  }
  
  // Check if user can manage permissions
  const canManagePermissions = user && ['owner', 'admin'].includes(user.role);
  
  if (!canManagePermissions) {
    return (
      <Alert variant="warning">
        <i className="bi bi-shield-lock me-2"></i>
        Você não tem permissão para gerenciar as permissões deste KB.
        <Link to={`/kb/${id}`} className="btn btn-sm btn-outline-secondary ms-3">
          Voltar para KB
        </Link>
      </Alert>
    );
  }
  
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Link to={`/kb/${id}`} className="text-decoration-none text-muted">
            <i className="bi bi-arrow-left me-2"></i>Voltar para KB
          </Link>
          <h2 className="mt-2 mb-0">
            <i className="bi bi-shield-lock me-2"></i>
            Permissões: {record.title}
          </h2>
        </div>
        <Button 
          variant="primary" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Salvando...
            </>
          ) : (
            <>
              <i className="bi bi-check-lg me-2"></i>Salvar Permissões
            </>
          )}
        </Button>
      </div>
      
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}
      
      <Row>
        <Col lg={8}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white border-0 py-3">
              <h5 className="mb-0">
                <i className="bi bi-eye me-2"></i>
                Visibilidade
              </h5>
            </Card.Header>
            <Card.Body>
              <Form.Group className="mb-3">
                <Form.Check
                  type="radio"
                  id="visibility-public"
                  name="visibility"
                  label={
                    <div>
                      <strong>Público</strong>
                      <p className="text-muted mb-0 small">Todos os usuários do tenant podem ver este KB</p>
                    </div>
                  }
                  checked={permissions.visibility === 'public'}
                  onChange={() => setPermissions(p => ({ ...p, visibility: 'public' }))}
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Check
                  type="radio"
                  id="visibility-restricted"
                  name="visibility"
                  label={
                    <div>
                      <strong>Restrito</strong>
                      <p className="text-muted mb-0 small">Apenas departamentos, grupos e usuários selecionados podem ver</p>
                    </div>
                  }
                  checked={permissions.visibility === 'restricted'}
                  onChange={() => setPermissions(p => ({ ...p, visibility: 'restricted' }))}
                />
              </Form.Group>
              
              <Form.Group className="mb-0">
                <Form.Check
                  type="radio"
                  id="visibility-private"
                  name="visibility"
                  label={
                    <div>
                      <strong>Privado</strong>
                      <p className="text-muted mb-0 small">Apenas o criador e administradores podem ver</p>
                    </div>
                  }
                  checked={permissions.visibility === 'private'}
                  onChange={() => setPermissions(p => ({ ...p, visibility: 'private' }))}
                />
              </Form.Group>
            </Card.Body>
          </Card>
          
          {permissions.visibility === 'restricted' && (
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white border-0 py-3">
                <h5 className="mb-0">
                  <i className="bi bi-people me-2"></i>
                  Acesso Restrito
                </h5>
              </Card.Header>
              <Card.Body>
                <Tabs defaultActiveKey="departments" className="mb-3">
                  <Tab eventKey="departments" title={`Departamentos (${permissions.allowed_departments.length})`}>
                    <div className="py-2">
                      {departments.length > 0 ? (
                        <Row>
                          {departments.map(dep => (
                            <Col md={6} key={dep._id}>
                              <Form.Check
                                type="checkbox"
                                id={`dep-${dep._id}`}
                                label={dep.name}
                                checked={permissions.allowed_departments.includes(dep._id)}
                                onChange={() => toggleDepartment(dep._id)}
                                className="mb-2"
                              />
                            </Col>
                          ))}
                        </Row>
                      ) : (
                        <p className="text-muted">Nenhum departamento cadastrado</p>
                      )}
                    </div>
                  </Tab>
                  
                  <Tab eventKey="groups" title={`Grupos (${permissions.allowed_groups.length})`}>
                    <div className="py-2">
                      {groups.length > 0 ? (
                        <Row>
                          {groups.map(group => (
                            <Col md={6} key={group._id}>
                              <Form.Check
                                type="checkbox"
                                id={`group-${group._id}`}
                                label={group.name}
                                checked={permissions.allowed_groups.includes(group._id)}
                                onChange={() => toggleGroup(group._id)}
                                className="mb-2"
                              />
                            </Col>
                          ))}
                        </Row>
                      ) : (
                        <p className="text-muted">Nenhum grupo cadastrado</p>
                      )}
                    </div>
                  </Tab>
                </Tabs>
              </Card.Body>
            </Card>
          )}
          
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-0 py-3 d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-person-check me-2"></i>
                Permissões Individuais
              </h5>
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={() => {
                  setAddUserType('viewer');
                  setShowAddUserModal(true);
                }}
              >
                <i className="bi bi-plus-lg me-1"></i>Adicionar Usuário
              </Button>
            </Card.Header>
            <Card.Body>
              <h6 className="text-muted mb-3">
                <i className="bi bi-pencil me-2"></i>Editores
                <Badge bg="primary" pill className="ms-2">{permissions.editors.length}</Badge>
              </h6>
              
              {permissions.editors.length > 0 ? (
                <Table hover size="sm" className="mb-4">
                  <tbody>
                    {permissions.editors.map(userId => (
                      <tr key={userId}>
                        <td>
                          <i className="bi bi-person text-muted me-2"></i>
                          {getUserName(userId)}
                        </td>
                        <td className="text-end">
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="text-danger p-0"
                            onClick={() => removeUserPermission(userId, 'editor')}
                          >
                            <i className="bi bi-x-lg"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-muted small mb-4">Nenhum editor adicional</p>
              )}
              
              <h6 className="text-muted mb-3">
                <i className="bi bi-eye me-2"></i>Visualizadores
                <Badge bg="secondary" pill className="ms-2">{permissions.viewers.length}</Badge>
              </h6>
              
              {permissions.viewers.length > 0 ? (
                <Table hover size="sm">
                  <tbody>
                    {permissions.viewers.map(userId => (
                      <tr key={userId}>
                        <td>
                          <i className="bi bi-person text-muted me-2"></i>
                          {getUserName(userId)}
                        </td>
                        <td className="text-end">
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="text-danger p-0"
                            onClick={() => removeUserPermission(userId, 'viewer')}
                          >
                            <i className="bi bi-x-lg"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-muted small">Nenhum visualizador adicional</p>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        <Col lg={4}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white border-0 py-3">
              <h5 className="mb-0">
                <i className="bi bi-info-circle me-2"></i>
                Informações
              </h5>
            </Card.Header>
            <Card.Body>
              <p className="small text-muted mb-2"><strong>Status:</strong></p>
              <Badge bg={getStatusBadge(record.status)} className="mb-3">
                {getStatusLabel(record.status)}
              </Badge>
              
              <p className="small text-muted mb-2"><strong>Criado por:</strong></p>
              <p className="mb-3">{record.creator_info?.name || record.creator_info?.email || 'Desconhecido'}</p>
              
              <p className="small text-muted mb-2"><strong>Criado em:</strong></p>
              <p className="mb-0">{new Date(record.created_at).toLocaleDateString('pt-BR')}</p>
            </Card.Body>
          </Card>
          
          <Card className="border-0 shadow-sm bg-light">
            <Card.Body>
              <h6>
                <i className="bi bi-lightbulb me-2 text-warning"></i>
                Dicas
              </h6>
              <ul className="small text-muted mb-0">
                <li className="mb-2">
                  <strong>Público:</strong> Ideal para documentação geral
                </li>
                <li className="mb-2">
                  <strong>Restrito:</strong> Use para informações de equipe específica
                </li>
                <li className="mb-2">
                  <strong>Privado:</strong> Para rascunhos ou informações sensíveis
                </li>
                <li>
                  <strong>Editores:</strong> Podem modificar o conteúdo
                </li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Add User Modal */}
      <Modal show={showAddUserModal} onHide={() => setShowAddUserModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Adicionar Usuário</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Tipo de Permissão</Form.Label>
            <Form.Select 
              value={addUserType}
              onChange={(e) => setAddUserType(e.target.value)}
            >
              <option value="viewer">Visualizador</option>
              <option value="editor">Editor</option>
            </Form.Select>
          </Form.Group>
          
          <Form.Group>
            <Form.Label>Usuário</Form.Label>
            <Form.Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Selecione um usuário...</option>
              {users
                .filter(u => 
                  !permissions.editors.includes(u._id) && 
                  !permissions.viewers.includes(u._id)
                )
                .map(u => (
                  <option key={u._id} value={u._id}>
                    {u.name || u.email}
                  </option>
                ))
              }
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddUserModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={addUserPermission} disabled={!selectedUserId}>
            Adicionar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function getStatusBadge(status) {
  const badges = {
    draft: 'warning',
    in_review: 'info',
    approved: 'success',
    published: 'primary',
    rejected: 'danger'
  };
  return badges[status] || 'secondary';
}

function getStatusLabel(status) {
  const labels = {
    draft: 'Rascunho',
    in_review: 'Em Revisão',
    approved: 'Aprovado',
    published: 'Publicado',
    rejected: 'Rejeitado'
  };
  return labels[status] || status;
}
