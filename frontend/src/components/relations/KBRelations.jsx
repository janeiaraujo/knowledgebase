import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Badge, Modal, Form, ListGroup, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { relationAPI } from '../../services/api';

const RELATION_TYPE_INFO = {
  related: { label: 'Relacionado', icon: 'bi-link-45deg', color: 'secondary' },
  references: { label: 'Referencia', icon: 'bi-arrow-right', color: 'info' },
  parent_of: { label: 'Pai de', icon: 'bi-diagram-2', color: 'primary' },
  child_of: { label: 'Filho de', icon: 'bi-diagram-3', color: 'primary' },
  supersedes: { label: 'Substitui', icon: 'bi-arrow-up-circle', color: 'warning' },
  superseded_by: { label: 'Substituído por', icon: 'bi-arrow-down-circle', color: 'danger' }
};

export default function KBRelations({ recordId }) {
  const { t } = useTranslation();
  const [relations, setRelations] = useState({ outgoing: [], incoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  useEffect(() => {
    fetchRelations();
  }, [recordId]);
  
  const fetchRelations = async () => {
    setLoading(true);
    try {
      const { data } = await relationAPI.list(recordId);
      setRelations({
        outgoing: data.outgoing || [],
        incoming: data.incoming || []
      });
    } catch (error) {
      setError('Falha ao carregar relações');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteRelation = async (relationId) => {
    if (!window.confirm(t('kbRelations.removerEstaRelacao'))) return;
    
    try {
      await relationAPI.delete(relationId);
      fetchRelations();
    } catch (error) {
      setError('Falha ao remover relação');
    }
  };
  
  const getTypeInfo = (type) => {
    return RELATION_TYPE_INFO[type] || { label: type, icon: 'bi-link', color: 'secondary' };
  };
  
  const totalRelations = relations.outgoing.length + relations.incoming.length;
  
  if (loading) {
    return (
      <div className="text-center py-3">
        <Spinner size="sm" />
      </div>
    );
  }
  
  return (
    <div className="kb-relations">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">
          <i className="bi bi-link-45deg me-2"></i>
          Relações ({totalRelations})
        </h5>
        <Button 
          variant="outline-primary" 
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          <i className="bi bi-plus-lg me-1"></i>
          {t('common.add')}
        </Button>
      </div>
      
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {totalRelations === 0 ? (
        <div className="text-center py-4 text-muted">
          <i className="bi bi-link-45deg fs-1 d-block mb-2"></i>
          <p className="mb-0">{t('kbRelations.nenhumaRelacaoDefinida')}</p>
          <small>{t('kbRelations.relacioneEsteKbComOutrosPara')}</small>
        </div>
      ) : (
        <>
          {/* Outgoing Relations */}
          {relations.outgoing.length > 0 && (
            <div className="mb-3">
              <small className="text-muted d-block mb-2">
                <i className="bi bi-box-arrow-up-right me-1"></i>
                {t('kbRelations.esteKb')}
              </small>
              <ListGroup variant="flush">
                {relations.outgoing.map(rel => {
                  const typeInfo = getTypeInfo(rel.type);
                  return (
                    <ListGroup.Item 
                      key={rel._id}
                      className="d-flex justify-content-between align-items-center px-0 py-2"
                    >
                      <div className="d-flex align-items-center gap-2">
                        <Badge bg={typeInfo.color} className="text-capitalize">
                          <i className={`${typeInfo.icon} me-1`}></i>
                          {typeInfo.label}
                        </Badge>
                        <Link to={`/kb/${rel.record._id}`} className="text-decoration-none">
                          {rel.record.title}
                        </Link>
                        <Badge bg="secondary" className="text-capitalize" style={{ fontSize: '0.7rem' }}>
                          {rel.record.status}
                        </Badge>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger p-0"
                        onClick={() => handleDeleteRelation(rel._id)}
                        title={t('kbRelations.removerRelacao')}
                      >
                        <i className="bi bi-x-lg"></i>
                      </Button>
                    </ListGroup.Item>
                  );
                })}
              </ListGroup>
            </div>
          )}
          
          {/* Incoming Relations */}
          {relations.incoming.length > 0 && (
            <div>
              <small className="text-muted d-block mb-2">
                <i className="bi bi-box-arrow-in-down-left me-1"></i>
                {t('kbRelations.outrosKbs')}
              </small>
              <ListGroup variant="flush">
                {relations.incoming.map(rel => {
                  const typeInfo = getTypeInfo(rel.type);
                  return (
                    <ListGroup.Item 
                      key={rel._id}
                      className="d-flex justify-content-between align-items-center px-0 py-2"
                    >
                      <div className="d-flex align-items-center gap-2">
                        <Link to={`/kb/${rel.record._id}`} className="text-decoration-none">
                          {rel.record.title}
                        </Link>
                        <Badge bg={typeInfo.color} className="text-capitalize">
                          <i className={`${typeInfo.icon} me-1`}></i>
                          {typeInfo.label}
                        </Badge>
                        <span className="text-muted">{t('kbRelations.thisKbLower')}</span>
                      </div>
                    </ListGroup.Item>
                  );
                })}
              </ListGroup>
            </div>
          )}
        </>
      )}
      
      {/* Add Relation Modal */}
      <AddRelationModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        recordId={recordId}
        onRelationAdded={fetchRelations}
      />
    </div>
  );
}

function AddRelationModal({ show, onHide, recordId, onRelationAdded }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [relationType, setRelationType] = useState('related');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const searchTimeout = useRef(null);
  
  useEffect(() => {
    if (!show) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedRecord(null);
      setRelationType('related');
      setError(null);
    }
  }, [show]);
  
  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await relationAPI.search(recordId, query);
        setSearchResults(data.records || []);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setSearching(false);
      }
    }, 300);
  };
  
  const handleSubmit = async () => {
    if (!selectedRecord) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      await relationAPI.create(recordId, {
        targetId: selectedRecord._id,
        type: relationType
      });
      onRelationAdded();
      onHide();
    } catch (error) {
      setError(error.response?.data?.error || 'Falha ao criar relação');
    } finally {
      setSubmitting(false);
    }
  };
  
  const relationTypes = Object.entries(RELATION_TYPE_INFO).map(([value, info]) => ({
    value,
    ...info
  }));
  
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>{t('kbRelations.adicionarRelacao')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {!selectedRecord ? (
          <>
            <Form.Group className="mb-3">
              <Form.Label>{t('kbRelations.buscarKb')}</Form.Label>
              <Form.Control
                type="text"
                placeholder={t('kbRelations.digiteParaBuscar')}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
            </Form.Group>
            
            {searching && (
              <div className="text-center py-3">
                <Spinner size="sm" />
              </div>
            )}
            
            {!searching && searchResults.length > 0 && (
              <ListGroup>
                {searchResults.map(record => (
                  <ListGroup.Item
                    key={record._id}
                    action
                    onClick={() => setSelectedRecord(record)}
                    className="d-flex justify-content-between align-items-center"
                  >
                    <span>{record.title}</span>
                    <Badge bg="secondary" className="text-capitalize">
                      {record.status}
                    </Badge>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
            
            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="text-center py-3 text-muted">
                {t('kbRelations.nenhumKbEncontrado')}
              </div>
            )}
          </>
        ) : (
          <>
            <Alert variant="info" className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{t('kbRelations.kbSelecionado')}</strong> {selectedRecord.title}
              </div>
              <Button
                variant="link"
                size="sm"
                className="p-0"
                onClick={() => setSelectedRecord(null)}
              >
                {t('kbRelations.alterar')}
              </Button>
            </Alert>
            
            <Form.Group>
              <Form.Label>{t('kbRelations.tipoDeRelacao')}</Form.Label>
              <Form.Select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
              >
                {relationTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {t('kbRelations.esteKb2')} <strong>{RELATION_TYPE_INFO[relationType].label.toLowerCase()}</strong> "{selectedRecord.title}"
              </Form.Text>
            </Form.Group>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          {t('common.cancel')}
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSubmit}
          disabled={!selectedRecord || submitting}
        >
          {submitting ? <Spinner size="sm" /> : 'Criar Relação'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
