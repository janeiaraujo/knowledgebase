import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Detecta se veio de sessão expirada
  useEffect(() => {
    if (searchParams.get('session') === 'expired') {
      setError('Sua sessão expirou. Por favor, faça login novamente.');
    }
  }, [searchParams]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Falha no login. Verifique suas credenciais.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      await authAPI.requestMagicLink({ email });
      setSuccess('Magic link enviado! Verifique seu email.');
    } catch (err) {
      setError('Falha ao enviar magic link');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Row className="w-100">
        <Col md={6} lg={5} xl={4} className="mx-auto">
          <Card className="shadow">
            <Card.Body className="p-5">
              <div className="text-center mb-4">
                <h3 className="fw-bold">
                  <i className="bi bi-database-fill me-2"></i>
                  Incident KB
                </h3>
                <p className="text-muted">Sign in to your account</p>
              </div>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}
              
              <Form onSubmit={useMagicLink ? handleMagicLink : handleLogin}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                  />
                </Form.Group>
                
                {!useMagicLink && (
                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                    />
                  </Form.Group>
                )}
                
                <Button
                  type="submit"
                  variant="primary"
                  className="w-100 mb-3"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      {useMagicLink ? 'Sending...' : 'Signing in...'}
                    </>
                  ) : (
                    useMagicLink ? 'Send Magic Link' : 'Sign In'
                  )}
                </Button>
                
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setUseMagicLink(!useMagicLink)}
                    className="text-decoration-none"
                  >
                    {useMagicLink ? 'Use password instead' : 'Use magic link instead'}
                  </Button>
                </div>
              </Form>
              
              <hr />
              
              <div className="text-center">
                <span className="text-muted">Don't have an account? </span>
                <Link to="/register">Sign up</Link>
              </div>
              
              <div className="mt-4 p-3 bg-light rounded">
                <small className="text-muted">
                  <strong>Demo credentials:</strong><br />
                  Email: demo@incidentkb.com<br />
                  Password: demo123
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
