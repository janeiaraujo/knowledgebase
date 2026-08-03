import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import DepartmentsTab from '../components/admin/DepartmentsTab';
import GroupsTab from '../components/admin/GroupsTab';
import UsersTab from '../components/admin/UsersTab';
import KBAccessTab from '../components/admin/KBAccessTab';

export default function Admin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('departments');

  // Only admin or owner can access
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          <h4>{t('admin.acessoNegado')}</h4>
          <p>{t('admin.apenasAdministradoresEOwnersPodemA')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col">
          <h2 className="mb-0">
            <i className="bi bi-gear-fill me-2"></i>
            {t('admin.administracao')}
          </h2>
          <p className="text-muted">{t('admin.gerencieDepartamentosGruposUsuario')}</p>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <ul className="nav nav-tabs mb-4" role="tablist">
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${activeTab === 'departments' ? 'active' : ''}`}
                onClick={() => setActiveTab('departments')}
                type="button"
              >
                <i className="bi bi-diagram-3 me-2"></i>
                {t('admin.departamentos')}
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => setActiveTab('groups')}
                type="button"
              >
                <i className="bi bi-people-fill me-2"></i>
                {t('admin.grupos')}
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
                type="button"
              >
                <i className="bi bi-person-badge me-2"></i>
                {t('admin.usuarios')}
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${activeTab === 'kb-access' ? 'active' : ''}`}
                onClick={() => setActiveTab('kb-access')}
                type="button"
              >
                <i className="bi bi-shield-lock me-2"></i>
                {t('admin.controleDeAcesso')}
              </button>
            </li>
          </ul>

          <div className="tab-content">
            {activeTab === 'departments' && <DepartmentsTab />}
            {activeTab === 'groups' && <GroupsTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'kb-access' && <KBAccessTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
