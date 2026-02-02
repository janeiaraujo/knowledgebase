import React, { useState, useEffect } from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { favoriteAPI } from '../../services/api';

export default function FavoriteButton({ recordId, size = 'sm', showText = false }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    checkFavorite();
  }, [recordId]);
  
  const checkFavorite = async () => {
    try {
      const { data } = await favoriteAPI.check(recordId);
      setIsFavorite(data.isFavorite);
    } catch (error) {
      console.error('Failed to check favorite status:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setLoading(true);
    try {
      const { data } = await favoriteAPI.toggle(recordId);
      setIsFavorite(data.isFavorite);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const tooltip = (
    <Tooltip>
      {isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    </Tooltip>
  );
  
  return (
    <OverlayTrigger placement="top" overlay={tooltip}>
      <Button
        variant={isFavorite ? 'warning' : 'outline-secondary'}
        size={size}
        onClick={handleToggle}
        disabled={loading}
        className="favorite-btn"
      >
        <i className={`bi ${isFavorite ? 'bi-star-fill' : 'bi-star'}`}></i>
        {showText && (
          <span className="ms-1">
            {isFavorite ? 'Favoritado' : 'Favoritar'}
          </span>
        )}
      </Button>
    </OverlayTrigger>
  );
}

// For use in lists - more compact
export function FavoriteIcon({ recordId, initialState = false, onToggle }) {
  const [isFavorite, setIsFavorite] = useState(initialState);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setIsFavorite(initialState);
  }, [initialState]);
  
  const handleToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setLoading(true);
    try {
      const { data } = await favoriteAPI.toggle(recordId);
      setIsFavorite(data.isFavorite);
      if (onToggle) onToggle(data.isFavorite);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <span 
      onClick={handleToggle}
      style={{ cursor: loading ? 'wait' : 'pointer' }}
      className={`favorite-icon ${isFavorite ? 'text-warning' : 'text-muted'}`}
      title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    >
      <i className={`bi ${isFavorite ? 'bi-star-fill' : 'bi-star'}`}></i>
    </span>
  );
}
