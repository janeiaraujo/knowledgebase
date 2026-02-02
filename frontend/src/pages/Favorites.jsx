import React, { useState, useEffect } from 'react';
import { Card, Table, Badge, Spinner, Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { favoriteAPI } from '../services/api';
import { FavoriteIcon } from '../components/favorites/FavoriteButton';

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  
  useEffect(() => {
    fetchFavorites();
  }, [page]);
  
  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const { data } = await favoriteAPI.list({ page, limit: 20 });
      setFavorites(data.favorites || []);
      setPagination(data.pagination);
    } catch (error) {
      setError('Falha ao carregar favoritos');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRemoveFavorite = (recordId) => {
    setFavorites(favorites.filter(f => f.record?._id !== recordId));
  };
  
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  const getStatusBadge = (status) => {
    const badges = {
      draft: 'warning',
      in_review: 'info',
      approved: 'success',
      published: 'primary',
      rejected: 'danger'
    };
    return badges[status] || 'secondary';
  };
  
  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Rascunho',
      in_review: 'Em Revisão',
      approved: 'Aprovado',
      published: 'Publicado',
      rejected: 'Rejeitado'
    };
    return labels[status] || status;
  };
  
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-star-fill text-warning me-2"></i>
            Meus Favoritos
          </h2>
          <p className="text-muted mb-0">
            KBs que você marcou como favorito para acesso rápido
          </p>
        </div>
      </div>
      
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : favorites.length > 0 ? (
            <>
              <Table responsive className="mb-0">
                <thead>
                  <tr>
                    <th width="40"></th>
                    <th>Título</th>
                    <th>Status</th>
                    <th>Autor</th>
                    <th>Favoritado em</th>
                  </tr>
                </thead>
                <tbody>
                  {favorites.map(fav => (
                    <tr key={fav._id}>
                      <td className="text-center">
                        <FavoriteIcon 
                          recordId={fav.record?._id}
                          initialState={true}
                          onToggle={(isFav) => {
                            if (!isFav) handleRemoveFavorite(fav.record?._id);
                          }}
                        />
                      </td>
                      <td>
                        <Link 
                          to={`/kb/${fav.record?._id}`}
                          className="text-decoration-none fw-medium"
                        >
                          {fav.record?.title || 'Título indisponível'}
                        </Link>
                      </td>
                      <td>
                        <Badge bg={getStatusBadge(fav.record?.status)}>
                          {getStatusLabel(fav.record?.status)}
                        </Badge>
                      </td>
                      <td className="text-muted">
                        {fav.author?.name || '-'}
                      </td>
                      <td className="text-muted">
                        {formatDate(fav.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              
              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="d-flex justify-content-between align-items-center p-3 border-top">
                  <small className="text-muted">
                    Mostrando {favorites.length} de {pagination.total} favoritos
                  </small>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setPage(p => p - 1)}
                      disabled={page <= 1}
                    >
                      <i className="bi bi-chevron-left"></i>
                    </Button>
                    <span className="d-flex align-items-center px-2">
                      Página {page} de {pagination.pages}
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= pagination.pages}
                    >
                      <i className="bi bi-chevron-right"></i>
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-star fs-1 d-block mb-3"></i>
              <h5>Nenhum favorito ainda</h5>
              <p className="mb-3">
                Clique no ícone de estrela em qualquer KB para adicioná-lo aos favoritos.
              </p>
              <Link to="/kb" className="btn btn-primary">
                <i className="bi bi-book me-2"></i>
                Explorar Knowledge Base
              </Link>
            </div>
          )}
        </Card.Body>
      </Card>
    </>
  );
}
