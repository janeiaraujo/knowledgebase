import React, { useEffect, useState } from 'react';
import { Container, Card, Alert, Spinner } from 'react-bootstrap';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function MagicLink() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { loginWithMagicLink } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setError('Invalid magic link');
      setLoading(false);
      return;
    }
    
    verifyToken(token);
  }, [searchParams]);
  
  const verifyToken = async (token) => {
    try {
      await loginWithMagicLink(token);
      navigate('/');
    } catch (err) {
      setError('Magic link is invalid or expired');
      setLoading(false);
    }
  };
  
  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Card className="shadow" style={{ maxWidth: '400px', width: '100%' }}>
        <Card.Body className="p-5 text-center">
          {loading ? (
            <>
              <Spinner animation="border" variant="primary" className="mb-3" />
              <h5>Verifying your magic link...</h5>
              <p className="text-muted">Please wait</p>
            </>
          ) : error ? (
            <>
              <i className="bi bi-x-circle text-danger" style={{ fontSize: '3rem' }}></i>
              <h5 className="mt-3">Verification Failed</h5>
              <Alert variant="danger" className="mt-3">{error}</Alert>
              <a href="/login" className="btn btn-primary">Back to Login</a>
            </>
          ) : null}
        </Card.Body>
      </Card>
    </Container>
  );
}
