import React from 'react';
import { Card, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function StatCard({
  title,
  value,
  icon,
  iconBg = 'primary',
  subtitle,
  trend,
  trendText,
  link,
  loading = false,
  tooltip
}) {
  const cardContent = (
    <Card className="border-0 shadow-sm h-100 stat-card">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className="text-muted small text-uppercase">{title}</div>
            {loading ? (
              <div className="placeholder-glow">
                <span className="placeholder col-6 fs-2"></span>
              </div>
            ) : (
              <h2 className="mb-0 mt-1">{value}</h2>
            )}
            {subtitle && !loading && (
              <small className="text-muted">{subtitle}</small>
            )}
            {trend !== undefined && !loading && (
              <small className={`text-${trend >= 0 ? 'success' : 'danger'}`}>
                <i className={`bi bi-arrow-${trend >= 0 ? 'up' : 'down'} me-1`}></i>
                {Math.abs(trend)}%{trendText && ` ${trendText}`}
              </small>
            )}
          </div>
          <div className={`bg-${iconBg} bg-opacity-10 p-3 rounded`}>
            <i className={`bi ${icon} fs-4 text-${iconBg}`}></i>
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  const wrappedCard = tooltip ? (
    <OverlayTrigger
      placement="top"
      overlay={<Tooltip id={`stat-tooltip-${title}`}>{tooltip}</Tooltip>}
    >
      {cardContent}
    </OverlayTrigger>
  ) : cardContent;

  if (link) {
    return (
      <Link to={link} className="text-decoration-none">
        {wrappedCard}
      </Link>
    );
  }

  return wrappedCard;
}

// Versão compacta para dashboards densos
export function StatCardCompact({ title, value, icon, variant = 'primary' }) {
  return (
    <div className="d-flex align-items-center p-3 border rounded bg-white">
      <div className={`bg-${variant} bg-opacity-10 p-2 rounded me-3`}>
        <i className={`bi ${icon} text-${variant}`}></i>
      </div>
      <div>
        <div className="small text-muted">{title}</div>
        <div className="fw-bold">{value}</div>
      </div>
    </div>
  );
}

// Grid de estatísticas
export function StatGrid({ children, cols = 4 }) {
  return (
    <div className={`row row-cols-1 row-cols-sm-2 row-cols-lg-${cols} g-3`}>
      {React.Children.map(children, child => (
        <div className="col">{child}</div>
      ))}
    </div>
  );
}
