import React, { useState } from 'react';
import { Modal, Button, Form, Spinner, Alert, ListGroup, Badge } from 'react-bootstrap';
import { exportAPI } from '../../services/api';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Icon components using Bootstrap Icons
const IconDownload = () => <i className="bi bi-download"></i>;
const IconFileAlt = () => <i className="bi bi-file-earmark-text"></i>;
const IconFile = () => <i className="bi bi-file-earmark"></i>;
const IconCheck = () => <i className="bi bi-check-lg"></i>;
const IconTimes = () => <i className="bi bi-x-lg"></i>;

export default function BatchExportModal({ show, onHide, selectedRecords }) {
  const [format, setFormat] = useState('markdown');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  
  const handleExport = async () => {
    if (selectedRecords.length === 0) return;
    
    setLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      if (format === 'markdown') {
        await exportAsMarkdown();
      } else if (format === 'html') {
        await exportAsHTML();
      } else if (format === 'json') {
        await exportAsJSON();
      }
      
      onHide();
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export files. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const exportAsMarkdown = async () => {
    const ids = selectedRecords.map(r => r._id);
    const { data } = await exportAPI.batchExport(ids);
    
    if (data.exports.length === 1) {
      // Single file download
      const blob = new Blob([data.exports[0].content], { type: 'text/markdown' });
      saveAs(blob, data.exports[0].filename);
    } else {
      // Multiple files - create ZIP
      const zip = new JSZip();
      data.exports.forEach((file, index) => {
        zip.file(file.filename, file.content);
        setProgress(Math.round(((index + 1) / data.exports.length) * 100));
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `kb-export-${new Date().toISOString().split('T')[0]}.zip`);
    }
  };
  
  const exportAsHTML = async () => {
    const zip = new JSZip();
    
    for (let i = 0; i < selectedRecords.length; i++) {
      const record = selectedRecords[i];
      try {
        const { data } = await exportAPI.toHTML(record._id);
        const filename = sanitizeFilename(record.title) + '.html';
        zip.file(filename, data.html);
      } catch (err) {
        console.error(`Failed to export ${record.title}:`, err);
      }
      setProgress(Math.round(((i + 1) / selectedRecords.length) * 100));
    }
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `kb-export-html-${new Date().toISOString().split('T')[0]}.zip`);
  };
  
  const exportAsJSON = async () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      count: selectedRecords.length,
      records: selectedRecords.map(r => ({
        id: r._id,
        title: r.title,
        content_md: r.content_md,
        status: r.status,
        properties: r.properties,
        custom_properties: r.custom_properties,
        created_at: r.created_at,
        updated_at: r.updated_at,
        ...(includeMetadata && {
          tags: r.tags,
          category_id: r.category_id,
          views: r.views,
          version: r.version
        })
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    saveAs(blob, `kb-export-${new Date().toISOString().split('T')[0]}.json`);
  };
  
  const sanitizeFilename = (name) => {
    return name
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  };
  
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <IconDownload className="me-2" />
          Export {selectedRecords.length} KB{selectedRecords.length !== 1 ? 's' : ''}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {/* Selected Items Preview */}
        <div className="mb-4">
          <h6 className="text-muted mb-2">Selected Items:</h6>
          <ListGroup 
            style={{ maxHeight: '150px', overflowY: 'auto' }}
            variant="flush"
          >
            {selectedRecords.slice(0, 5).map(record => (
              <ListGroup.Item key={record._id} className="py-2 px-0 d-flex align-items-center">
                <IconFileAlt className="text-muted me-2" />
                <span className="text-truncate">{record.title}</span>
                <Badge bg="secondary" className="ms-auto">{record.status}</Badge>
              </ListGroup.Item>
            ))}
            {selectedRecords.length > 5 && (
              <ListGroup.Item className="py-2 px-0 text-muted">
                ... and {selectedRecords.length - 5} more
              </ListGroup.Item>
            )}
          </ListGroup>
        </div>
        
        {/* Export Options */}
        <Form.Group className="mb-3">
          <Form.Label>Export Format</Form.Label>
          <Form.Select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="markdown">Markdown (.md)</option>
            <option value="html">HTML (.html)</option>
            <option value="json">JSON (data only)</option>
          </Form.Select>
          <Form.Text className="text-muted">
            {format === 'markdown' && 'Best for documentation and editing'}
            {format === 'html' && 'Best for viewing and printing'}
            {format === 'json' && 'Best for data backup and import'}
          </Form.Text>
        </Form.Group>
        
        {format === 'json' && (
          <Form.Check
            type="checkbox"
            label="Include metadata (tags, views, version)"
            checked={includeMetadata}
            onChange={(e) => setIncludeMetadata(e.target.checked)}
            className="mb-3"
          />
        )}
        
        {/* Progress */}
        {loading && (
          <div className="mt-3">
            <div className="d-flex justify-content-between mb-1">
              <small>Exporting...</small>
              <small>{progress}%</small>
            </div>
            <div className="progress">
              <div 
                className="progress-bar progress-bar-striped progress-bar-animated" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleExport}
          disabled={loading || selectedRecords.length === 0}
        >
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-1" />
              Exporting...
            </>
          ) : (
            <>
              <IconDownload className="me-1" />
              Export
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// Utility component for single KB export dropdown
export function ExportButton({ record, variant = 'outline-secondary', size = 'sm' }) {
  const [loading, setLoading] = useState(false);
  
  const handleExportMarkdown = async () => {
    setLoading(true);
    try {
      const { data } = await exportAPI.toMarkdown(record._id);
      const blob = new Blob([data], { type: 'text/markdown' });
      saveAs(blob, `${sanitizeFilename(record.title)}.md`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExportHTML = async () => {
    setLoading(true);
    try {
      const { data } = await exportAPI.toHTML(record._id);
      const blob = new Blob([data.html], { type: 'text/html' });
      saveAs(blob, `${sanitizeFilename(record.title)}.html`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export');
    } finally {
      setLoading(false);
    }
  };
  
  const sanitizeFilename = (name) => {
    return name
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  };
  
  return (
    <div className="btn-group">
      <Button 
        variant={variant} 
        size={size} 
        onClick={handleExportMarkdown}
        disabled={loading}
      >
        {loading ? <Spinner size="sm" animation="border" /> : <IconDownload />}
      </Button>
      <Button
        variant={variant}
        size={size}
        className="dropdown-toggle dropdown-toggle-split"
        data-bs-toggle="dropdown"
        disabled={loading}
      />
      <ul className="dropdown-menu dropdown-menu-end">
        <li>
          <button className="dropdown-item" onClick={handleExportMarkdown}>
            <IconFile className="me-2" />
            Export as Markdown
          </button>
        </li>
        <li>
          <button className="dropdown-item" onClick={handleExportHTML}>
            <IconFile className="me-2" />
            Export as HTML
          </button>
        </li>
      </ul>
    </div>
  );
}
