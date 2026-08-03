import React from 'react';
import { useTranslation } from 'react-i18next';
import { Breadcrumb as BsBreadcrumb } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

const ROUTE_LABELS = {
  '': 'Dashboard',
  'kb': 'Knowledge Base',
  'new': 'Novo',
  'edit': 'Editar',
  'history': 'Histórico',
  'permissions': 'Permissões',
  'incidents': 'Incidentes',
  'events': 'Eventos',
  'favorites': 'Favoritos',
  'search': 'Busca',
  'quick-capture': 'Captura Rápida',
  'gps': 'Diagnóstico GPS',
  'flows': 'Fluxos',
  'sessions': 'Sessões',
  'player': 'Player',
  'analytics': 'Analytics',
  'settings': 'Configurações',
  'admin': 'Administração',
  'properties': 'Propriedades',
  'tags': 'Tags',
  'templates': 'Templates',
  'import': 'Importar',
  'reviews': 'Revisões',
  'audit-logs': 'Logs de Auditoria',
  'notifications': 'Notificações'
};

export default function Breadcrumb({ items, currentPage }) {
  const { t } = useTranslation();
  const location = useLocation();

  // Auto-generate from path if items not provided
  const getBreadcrumbItems = () => {
    if (items) return items;

    const pathParts = location.pathname.split('/').filter(Boolean);
    const breadcrumbItems = [];
    let currentPath = '';

    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      
      // Skip IDs (MongoDB ObjectId pattern)
      const isId = /^[a-f\d]{24}$/i.test(part);
      
      if (!isId) {
        breadcrumbItems.push({
          label: ROUTE_LABELS[part] || part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
          path: currentPath,
          active: index === pathParts.length - 1
        });
      }
    });

    return breadcrumbItems;
  };

  const breadcrumbItems = getBreadcrumbItems();

  if (breadcrumbItems.length <= 1 && !currentPage) {
    return null;
  }

  return (
    <BsBreadcrumb className="mb-3 bg-transparent p-0">
      <BsBreadcrumb.Item linkAs={Link} linkProps={{ to: '/' }}>
        <i className="bi bi-house-door me-1"></i>
        {t('breadcrumb.home')}
      </BsBreadcrumb.Item>
      {breadcrumbItems.map((item, index) => (
        <BsBreadcrumb.Item
          key={item.path}
          active={item.active || index === breadcrumbItems.length - 1}
          linkAs={!item.active ? Link : undefined}
          linkProps={!item.active ? { to: item.path } : undefined}
        >
          {item.label}
        </BsBreadcrumb.Item>
      ))}
      {currentPage && (
        <BsBreadcrumb.Item active>
          {currentPage}
        </BsBreadcrumb.Item>
      )}
    </BsBreadcrumb>
  );
}
