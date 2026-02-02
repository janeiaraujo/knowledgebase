import React from 'react';
import { Breadcrumb } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const KBBreadcrumb = ({ record, category }) => {
  return (
    <Breadcrumb className="mb-3">
      <Breadcrumb.Item linkAs={Link} linkProps={{ to: '/dashboard' }}>
        <i className="bi bi-house-door me-1"></i>
        Dashboard
      </Breadcrumb.Item>
      <Breadcrumb.Item linkAs={Link} linkProps={{ to: '/kb' }}>
        <i className="bi bi-journal-text me-1"></i>
        Knowledge Base
      </Breadcrumb.Item>
      {category && (
        <Breadcrumb.Item linkAs={Link} linkProps={{ to: `/kb?category=${category._id}` }}>
          <i className="bi bi-folder me-1"></i>
          {category.name}
        </Breadcrumb.Item>
      )}
      <Breadcrumb.Item active>
        {record?.title?.length > 50 
          ? record.title.substring(0, 50) + '...' 
          : record?.title || 'Carregando...'
        }
      </Breadcrumb.Item>
    </Breadcrumb>
  );
};

export default KBBreadcrumb;
