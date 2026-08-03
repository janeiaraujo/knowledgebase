import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { Card, Button, Badge, ListGroup, Modal, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { recordAPI } from '../../services/api';

// Simple diff implementation
function computeDiff(oldText, newText) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  
  const result = [];
  let i = 0, j = 0;
  
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      // Remaining new lines are additions
      result.push({ type: 'added', line: newLines[j], lineNum: j + 1 });
      j++;
    } else if (j >= newLines.length) {
      // Remaining old lines are deletions
      result.push({ type: 'removed', line: oldLines[i], lineNum: i + 1 });
      i++;
    } else if (oldLines[i] === newLines[j]) {
      // Lines are equal
      result.push({ type: 'unchanged', line: oldLines[i], lineNum: j + 1 });
      i++;
      j++;
    } else {
      // Lines differ - check if it's a modification or add/remove
      const oldLineInNew = newLines.indexOf(oldLines[i], j);
      const newLineInOld = oldLines.indexOf(newLines[j], i);
      
      if (oldLineInNew === -1 && newLineInOld === -1) {
        // Line was modified
        result.push({ type: 'removed', line: oldLines[i], lineNum: i + 1 });
        result.push({ type: 'added', line: newLines[j], lineNum: j + 1 });
        i++;
        j++;
      } else if (oldLineInNew === -1 || (newLineInOld !== -1 && newLineInOld < oldLineInNew)) {
        // Old line was removed
        result.push({ type: 'removed', line: oldLines[i], lineNum: i + 1 });
        i++;
      } else {
        // New line was added
        result.push({ type: 'added', line: newLines[j], lineNum: j + 1 });
        j++;
      }
    }
  }
  
  return result;
}

export default function KBVersionHistory() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompare, setShowCompare] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState({ from: null, to: null });
  const [compareData, setCompareData] = useState(null);
  const [restoreVersion, setRestoreVersion] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [record, setRecord] = useState(null);
  
  useEffect(() => {
    fetchData();
  }, [id]);
  
  const fetchData = async () => {
    try {
      const [recordRes, versionsRes] = await Promise.all([
        recordAPI.get(id),
        recordAPI.getVersions(id)
      ]);
      setRecord(recordRes.data.record);
      setVersions(versionsRes.data.versions || []);
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCompare = async () => {
    if (!selectedVersions.from || !selectedVersions.to) {
      alert(t('kbVersionHistory.selecioneDuasVersoesParaComparar'));
      return;
    }
    
    setActionLoading(true);
    try {
      const { data } = await recordAPI.compareVersions(id, selectedVersions.from, selectedVersions.to);
      setCompareData(data);
      setShowCompare(true);
    } catch (error) {
      alert(t('kbVersionHistory.falhaAoCompararVersoes'));
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleRestore = async () => {
    setActionLoading(true);
    try {
      await recordAPI.restoreVersion(id, restoreVersion.version);
      setShowRestore(false);
      fetchData();
      alert(t('kbVersionHistory.versaoRestauradaComSucesso'));
    } catch (error) {
      alert(t('kbVersionHistory.falhaAoRestaurarVersao') + (error.response?.data?.error || 'Erro desconhecido'));
    } finally {
      setActionLoading(false);
    }
  };
  
  const toggleVersionSelection = (version) => {
    if (selectedVersions.from === version) {
      setSelectedVersions({ ...selectedVersions, from: null });
    } else if (selectedVersions.to === version) {
      setSelectedVersions({ ...selectedVersions, to: null });
    } else if (!selectedVersions.from) {
      setSelectedVersions({ ...selectedVersions, from: version });
    } else if (!selectedVersions.to) {
      setSelectedVersions({ ...selectedVersions, to: version });
    } else {
      // Replace "to" with new selection
      setSelectedVersions({ ...selectedVersions, to: version });
    }
  };
  
  const formatDate = (date) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }
  
  const diff = compareData ? computeDiff(compareData.from.content_md, compareData.to.content_md) : [];
  
  return (
    <>
      <div className="mb-4">
        <Link to={`/kb/${id}`} className="btn btn-link ps-0">
          <i className="bi bi-arrow-left me-2"></i>{t('kbVersionHistory.voltarParaKb')}
        </Link>
      </div>
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">{t('kbVersionHistory.historicoDeVersoes')}</h2>
          <p className="text-muted mb-0">{record?.title}</p>
        </div>
        
        <Button 
          variant="primary" 
          onClick={handleCompare}
          disabled={!selectedVersions.from || !selectedVersions.to || actionLoading}
        >
          <i className="bi bi-arrow-left-right me-2"></i>
          {t('kbVersionHistory.compararSelecionadas')}
        </Button>
      </div>
      
      {selectedVersions.from || selectedVersions.to ? (
        <Alert variant="info" className="mb-3">
          <i className="bi bi-info-circle me-2"></i>
          Comparando: {selectedVersions.from ? `v${selectedVersions.from}` : '?'} → {selectedVersions.to ? `v${selectedVersions.to}` : '?'}
          <Button 
            variant="link" 
            size="sm" 
            className="p-0 ms-2"
            onClick={() => setSelectedVersions({ from: null, to: null })}
          >
            {t('kbVersionHistory.limpar')}
          </Button>
        </Alert>
      ) : (
        <Alert variant="secondary" className="mb-3">
          <i className="bi bi-hand-index me-2"></i>
          {t('kbVersionHistory.cliqueEmDuasVersoesParaSelecionar')}
        </Alert>
      )}
      
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {versions.length > 0 ? (
            <ListGroup variant="flush">
              {versions.map((version, index) => (
                <ListGroup.Item 
                  key={version.version}
                  className={`d-flex justify-content-between align-items-center py-3 ${
                    selectedVersions.from === version.version || selectedVersions.to === version.version
                      ? 'bg-primary bg-opacity-10 border-primary'
                      : ''
                  }`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleVersionSelection(version.version)}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedVersions.from === version.version || selectedVersions.to === version.version}
                        onChange={() => {}}
                      />
                    </div>
                    
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <Badge bg={index === 0 ? 'success' : 'secondary'}>
                          v{version.version}
                        </Badge>
                        {index === 0 && (
                          <Badge bg="info">{t('kbVersionHistory.atual')}</Badge>
                        )}
                        {version.restored_from && (
                          <Badge bg="warning" text="dark">
                            Restaurada de v{version.restored_from}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted small">
                        <i className="bi bi-person me-1"></i>
                        {version.created_by_name}
                        <span className="mx-2">•</span>
                        <i className="bi bi-clock me-1"></i>
                        {formatDate(version.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="d-flex gap-2" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedVersions({ from: version.version, to: versions[0].version });
                        handleCompare();
                      }}
                      disabled={index === 0}
                      title={t('kbVersionHistory.compararComVersaoAtual')}
                    >
                      <i className="bi bi-arrow-left-right"></i>
                    </Button>
                    
                    {index > 0 && !['approved', 'published'].includes(record?.status) && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => {
                          setRestoreVersion(version);
                          setShowRestore(true);
                        }}
                        title={t('kbVersionHistory.restaurarEstaVersao')}
                      >
                        <i className="bi bi-arrow-counterclockwise"></i>
                      </Button>
                    )}
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-clock-history fs-1 d-block mb-3"></i>
              <p className="mb-0">{t('kbVersionHistory.nenhumaVersaoAnteriorEncontrada')}</p>
            </div>
          )}
        </Card.Body>
      </Card>
      
      {/* Compare Modal */}
      <Modal show={showCompare} onHide={() => setShowCompare(false)} size="xl" fullscreen="lg-down">
        <Modal.Header closeButton>
          <Modal.Title>
            Comparação: v{compareData?.from.version} → v{compareData?.to.version}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {compareData && (
            <>
              {/* Title comparison */}
              {compareData.from.title !== compareData.to.title && (
                <Alert variant="warning" className="m-3 mb-0">
                  <strong>{t('kbVersionHistory.tituloAlterado')}</strong><br />
                  <del className="text-danger">{compareData.from.title}</del>
                  <span className="mx-2">→</span>
                  <ins className="text-success">{compareData.to.title}</ins>
                </Alert>
              )}
              
              {/* Content diff */}
              <div className="diff-container p-3" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <pre className="mb-0" style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {diff.map((item, idx) => (
                    <div 
                      key={idx}
                      className={`px-2 ${
                        item.type === 'added' ? 'bg-success bg-opacity-25 text-success-emphasis' :
                        item.type === 'removed' ? 'bg-danger bg-opacity-25 text-danger-emphasis' :
                        ''
                      }`}
                      style={{ borderLeft: item.type !== 'unchanged' ? `3px solid ${item.type === 'added' ? '#198754' : '#dc3545'}` : 'none' }}
                    >
                      <span className="text-muted me-2" style={{ minWidth: '30px', display: 'inline-block' }}>
                        {item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' '}
                      </span>
                      {item.line || ' '}
                    </div>
                  ))}
                </pre>
              </div>
              
              {/* Stats */}
              <div className="border-top p-3 bg-light">
                <Row>
                  <Col>
                    <small className="text-success">
                      <i className="bi bi-plus-circle me-1"></i>
                      {diff.filter(d => d.type === 'added').length} linhas adicionadas
                    </small>
                  </Col>
                  <Col>
                    <small className="text-danger">
                      <i className="bi bi-dash-circle me-1"></i>
                      {diff.filter(d => d.type === 'removed').length} linhas removidas
                    </small>
                  </Col>
                </Row>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCompare(false)}>
            {t('postmortem.close')}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Restore Modal */}
      <Modal show={showRestore} onHide={() => setShowRestore(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('kbVersionHistory.restaurarVersao')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {t('kbVersionHistory.temCertezaQueDesejaRestaurarA')} <strong>versão {restoreVersion?.version}</strong>?
          </p>
          <Alert variant="info">
            <i className="bi bi-info-circle me-2"></i>
            Uma nova versão será criada com o conteúdo da versão selecionada.
            O histórico anterior será preservado.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRestore(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            variant="primary" 
            onClick={handleRestore}
            disabled={actionLoading}
          >
            {actionLoading ? <Spinner size="sm" /> : 'Restaurar'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
