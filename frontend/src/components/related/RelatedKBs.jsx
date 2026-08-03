import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Spinner, Alert, Row, Col, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const RelatedKBs = ({ recordId, limit = 6 }) => {
  const { t } = useTranslation();
  const [related, setRelated] = useState([]);
  const [breakdown, setBreakdown] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (recordId) {
      fetchRelatedKBs();
    }
  }, [recordId]);

  const fetchRelatedKBs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/kb/${recordId}/related`, {
        params: { limit, include_semantic: 'true' }
      });
      setRelated(data.related || []);
      setBreakdown(data.breakdown || {});
    } catch (err) {
      console.error('Error fetching related KBs:', err);
      setError('Não foi possível carregar KBs relacionados');
    } finally {
      setLoading(false);
    }
  };

  const getRelationIcon = (type) => {
    switch (type) {
      case 'semantic':
        return { icon: 'bi-cpu', color: 'primary', label: 'Similaridade Semântica' };
      case 'tags':
        return { icon: 'bi-tags', color: 'success', label: 'Tags em Comum' };
      case 'category':
        return { icon: 'bi-folder', color: 'info', label: 'Mesma Categoria' };
      default:
        return { icon: 'bi-link-45deg', color: 'secondary', label: 'Relacionado' };
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      approved: { variant: 'success', label: 'Aprovado' },
      published: { variant: 'primary', label: 'Publicado' }
    };
    return badges[status] || { variant: 'secondary', label: status };
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" className="me-2" />
        <span className="text-muted">{t('relatedKBs.buscandoKbsRelacionados')}</span>
      </div>
    );
  }

  if (error) {
    return <Alert variant="warning" className="mb-0">{error}</Alert>;
  }

  if (related.length === 0) {
    return (
      <Alert variant="light" className="mb-0 text-center">
        <i className="bi bi-info-circle me-2"></i>
        {t('relatedKBs.nenhumKbRelacionadoEncontrado')}
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-diagram-3 me-2"></i>
          {t('relatedKBs.kbsRelacionados')}
        </h5>
        <div className="d-flex gap-2">
          {breakdown.by_semantic > 0 && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>{t('relatedKBs.porSimilaridadeSemanticaIa')}</Tooltip>}
            >
              <Badge bg="primary" pill>
                <i className="bi bi-cpu me-1"></i>{breakdown.by_semantic}
              </Badge>
            </OverlayTrigger>
          )}
          {breakdown.by_tags > 0 && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>{t('relatedKBs.porTagsEmComum')}</Tooltip>}
            >
              <Badge bg="success" pill>
                <i className="bi bi-tags me-1"></i>{breakdown.by_tags}
              </Badge>
            </OverlayTrigger>
          )}
          {breakdown.by_category > 0 && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>{t('relatedKBs.pelaMesmaCategoria')}</Tooltip>}
            >
              <Badge bg="info" pill>
                <i className="bi bi-folder me-1"></i>{breakdown.by_category}
              </Badge>
            </OverlayTrigger>
          )}
        </div>
      </div>

      <Row xs={1} md={2} lg={3} className="g-3">
        {related.map((kb) => {
          const relation = getRelationIcon(kb.relation_type);
          const status = getStatusBadge(kb.status);

          return (
            <Col key={kb._id}>
              <Card 
                className="h-100 border-0 shadow-sm hover-shadow transition-all"
                style={{ cursor: 'pointer' }}
              >
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>{relation.label}</Tooltip>}
                    >
                      <Badge bg={relation.color} className="opacity-75">
                        <i className={`bi ${relation.icon}`}></i>
                      </Badge>
                    </OverlayTrigger>
                    <Badge bg={status.variant} className="opacity-75" style={{ fontSize: '0.7rem' }}>
                      {status.label}
                    </Badge>
                  </div>

                  <Link 
                    to={`/kb/view/${kb._id}`}
                    className="text-decoration-none"
                  >
                    <h6 className="mb-2 text-dark fw-semibold" style={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: '1.3'
                    }}>
                      {kb.title}
                    </h6>
                  </Link>

                  {kb.category_info && (
                    <div className="mb-2">
                      <small className="text-muted">
                        <i className="bi bi-folder2 me-1"></i>
                        {kb.category_info.name}
                      </small>
                    </div>
                  )}

                  {kb.tags_info && kb.tags_info.length > 0 && (
                    <div className="mb-2">
                      {kb.tags_info.slice(0, 3).map(tag => (
                        <Badge 
                          key={tag._id} 
                          bg="light" 
                          text="dark" 
                          className="me-1 mb-1"
                          style={{ fontSize: '0.65rem' }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                      {kb.tags_info.length > 3 && (
                        <Badge bg="light" text="muted" style={{ fontSize: '0.65rem' }}>
                          +{kb.tags_info.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                    <small className="text-muted">
                      <i className="bi bi-eye me-1"></i>
                      {kb.views || 0} views
                    </small>
                    {kb.similarity_score && (
                      <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>{t('relatedKBs.scoreDeSimilaridade')}</Tooltip>}
                      >
                        <small className="text-primary">
                          <i className="bi bi-graph-up me-1"></i>
                          {Math.round(kb.similarity_score * 100)}%
                        </small>
                      </OverlayTrigger>
                    )}
                    {kb.matching_tags_count && (
                      <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>{t('relatedKBs.tagsEmComum')}</Tooltip>}
                      >
                        <small className="text-success">
                          <i className="bi bi-tags me-1"></i>
                          {kb.matching_tags_count}
                        </small>
                      </OverlayTrigger>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      <style jsx="true">{`
        .hover-shadow:hover {
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
          transform: translateY(-2px);
        }
        .transition-all {
          transition: all 0.2s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default RelatedKBs;
