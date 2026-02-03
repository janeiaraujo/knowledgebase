import React from 'react';
import { OverlayTrigger, Tooltip as BsTooltip, Popover } from 'react-bootstrap';

// Tooltip simples
export function Tooltip({ children, text, placement = 'top' }) {
  return (
    <OverlayTrigger
      placement={placement}
      overlay={<BsTooltip id={`tooltip-${Math.random()}`}>{text}</BsTooltip>}
    >
      {children}
    </OverlayTrigger>
  );
}

// Popover com mais conteúdo
export function InfoPopover({ children, title, content, placement = 'top' }) {
  const popover = (
    <Popover id={`popover-${Math.random()}`}>
      {title && <Popover.Header as="h3">{title}</Popover.Header>}
      <Popover.Body>{content}</Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger trigger={['hover', 'focus']} placement={placement} overlay={popover}>
      {children}
    </OverlayTrigger>
  );
}

// Ícone de ajuda com tooltip
export function HelpTooltip({ text, iconClass = 'bi-question-circle' }) {
  return (
    <Tooltip text={text}>
      <i className={`bi ${iconClass} text-muted ms-1`} style={{ cursor: 'help' }}></i>
    </Tooltip>
  );
}

// Status badge com tooltip
export function StatusBadge({ status, statusConfig, showTooltip = true }) {
  const config = statusConfig[status] || { label: status, variant: 'secondary' };
  
  const badge = (
    <span className={`badge bg-${config.variant}`}>
      {config.icon && <i className={`bi bi-${config.icon} me-1`}></i>}
      {config.label}
    </span>
  );

  if (showTooltip && config.description) {
    return (
      <Tooltip text={config.description}>
        {badge}
      </Tooltip>
    );
  }

  return badge;
}

export default Tooltip;
