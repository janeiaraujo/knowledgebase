import React, { useState, useEffect, useRef } from 'react';
import { Form, ListGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { kbAPI } from '../services/api';

export default function QuickSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      if (query.length >= 2) {
        performSearch();
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);
    
    return () => clearTimeout(searchTimeout);
  }, [query]);
  
  const performSearch = async () => {
    setLoading(true);
    try {
      const { data } = await kbAPI.search({ q: query, limit: 5 });
      setResults(data.results || []);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelect = (recordId) => {
    navigate(`/kb/${recordId}`);
    setQuery('');
    setShowResults(false);
  };
  
  const getStatusBadge = (status) => {
    const badges = {
      captured: 'secondary',
      draft: 'warning',
      in_review: 'info',
      approved: 'success',
      published: 'primary',
      deprecated: 'danger'
    };
    return badges[status] || 'secondary';
  };
  
  return (
    <div className="quick-search" ref={searchRef} style={{ position: 'relative', width: '400px' }}>
      <Form.Control
        type="search"
        placeholder="Quick search KBs... (⌘K)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="me-2"
      />
      
      {showResults && (
        <div className="quick-search-results">
          {loading ? (
            <div className="text-center p-3">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Searching...</span>
              </div>
            </div>
          ) : results.length > 0 ? (
            <ListGroup variant="flush">
              {results.map((result) => (
                <ListGroup.Item
                  key={result._id}
                  action
                  onClick={() => handleSelect(result._id)}
                  className="quick-search-result"
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <h6 className="mb-1">{result.title}</h6>
                      <small className="text-muted">
                        {result.properties?.category || 'Uncategorized'}
                      </small>
                    </div>
                    <span className={`badge bg-${getStatusBadge(result.status)} status-badge`}>
                      {result.status}
                    </span>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <div className="p-3 text-center text-muted">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
