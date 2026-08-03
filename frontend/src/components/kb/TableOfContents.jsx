import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Nav, Card } from 'react-bootstrap';

const TableOfContents = ({ content, onNavigate }) => {
  const { t } = useTranslation();
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (content) {
      extractHeadings(content);
    }
  }, [content]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -80% 0px' }
    );

    // Observe all heading elements
    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  const extractHeadings = (markdown) => {
    const lines = markdown.split('\n');
    const extracted = [];
    let index = 0;

    lines.forEach((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].replace(/[*_`]/g, ''); // Remove markdown formatting
        const id = `heading-${index++}`;
        extracted.push({ id, text, level });
      }
    });

    setHeadings(extracted);
  };

  const handleClick = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
      if (onNavigate) onNavigate(id);
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm sticky-top" style={{ top: '1rem' }}>
      <Card.Header className="bg-light border-0">
        <small className="fw-bold text-uppercase text-muted">
          <i className="bi bi-list-ul me-2"></i>
          {t('tableOfContents.indice')}
        </small>
      </Card.Header>
      <Card.Body className="py-2 px-0" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <Nav className="flex-column">
          {headings.map((heading) => (
            <Nav.Link
              key={heading.id}
              onClick={() => handleClick(heading.id)}
              className={`py-1 px-3 ${activeId === heading.id ? 'active fw-semibold' : 'text-muted'}`}
              style={{
                paddingLeft: `${(heading.level - 1) * 0.75 + 0.75}rem`,
                fontSize: heading.level === 1 ? '0.9rem' : '0.8rem',
                borderLeft: activeId === heading.id ? '3px solid #0d6efd' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {heading.level > 2 && (
                <i className="bi bi-dash me-1" style={{ opacity: 0.5 }}></i>
              )}
              {heading.text}
            </Nav.Link>
          ))}
        </Nav>
      </Card.Body>
    </Card>
  );
};

export default TableOfContents;
