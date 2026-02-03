import React from 'react';
import { Spinner } from 'react-bootstrap';

export default function Loading({ 
  message = 'Carregando...', 
  size = 'md',
  variant = 'primary',
  fullPage = false,
  inline = false 
}) {
  const spinnerSize = {
    sm: { width: '1rem', height: '1rem' },
    md: {},
    lg: { width: '3rem', height: '3rem' }
  };

  if (inline) {
    return (
      <span className="d-inline-flex align-items-center">
        <Spinner 
          animation="border" 
          variant={variant}
          size={size === 'sm' ? 'sm' : undefined}
          style={size === 'lg' ? spinnerSize.lg : undefined}
          className="me-2"
        />
        {message && <span className="text-muted">{message}</span>}
      </span>
    );
  }

  if (fullPage) {
    return (
      <div className="spinner-overlay">
        <div className="text-center">
          <Spinner 
            animation="border" 
            variant={variant}
            style={size === 'lg' ? spinnerSize.lg : undefined}
          />
          {message && <p className="mt-3 text-muted">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-5">
      <Spinner 
        animation="border" 
        variant={variant}
        style={size === 'lg' ? spinnerSize.lg : undefined}
      />
      {message && <p className="mt-3 text-muted">{message}</p>}
    </div>
  );
}

// Skeleton loading para cards
export function CardSkeleton({ count = 1 }) {
  return (
    <>
      {[...Array(count)].map((_, idx) => (
        <div key={idx} className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="placeholder-glow">
              <span className="placeholder col-6 mb-2"></span>
              <span className="placeholder col-12"></span>
              <span className="placeholder col-8"></span>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// Skeleton loading para tabelas
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <table className="table">
      <thead>
        <tr>
          {[...Array(cols)].map((_, idx) => (
            <th key={idx}>
              <span className="placeholder col-6"></span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(rows)].map((_, rowIdx) => (
          <tr key={rowIdx}>
            {[...Array(cols)].map((_, colIdx) => (
              <td key={colIdx}>
                <span className="placeholder col-8 placeholder-glow"></span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Skeleton para texto/conteúdo
export function ContentSkeleton({ lines = 4 }) {
  return (
    <div className="placeholder-glow">
      {[...Array(lines)].map((_, idx) => (
        <span 
          key={idx} 
          className={`placeholder col-${Math.floor(Math.random() * 4) + 8} d-block mb-2`}
        ></span>
      ))}
    </div>
  );
}
