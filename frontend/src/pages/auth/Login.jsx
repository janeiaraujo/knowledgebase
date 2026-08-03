import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Detecta se veio de sessão expirada ou de uma redefinição de senha
  useEffect(() => {
    if (searchParams.get('session') === 'expired') {
      setError(t('auth.sessionExpired'));
    }
    if (searchParams.get('reset') === 'success') {
      setSuccess(t('auth.reset.success'));
    }
  }, [searchParams, t]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      const errorMessage = err.response?.data?.error || t('auth.loginFailed');
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
      setSuccess(t('auth.magicLinkSent'));
    } catch (err) {
      const errorCode = err.response?.data?.code;
      const errorMessage = err.response?.data?.error;

      if (errorCode === 'SMTP_NOT_CONFIGURED') {
        setError(t('auth.smtpNotConfigured'));
      } else if (errorCode === 'SMTP_CONNECTION_ERROR') {
        setError(t('auth.smtpConnectionError'));
      } else {
        setError(errorMessage || t('auth.magicLinkFailed'));
      }
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
                <p className="text-muted">{t('auth.signInSubtitle')}</p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}

              <Form onSubmit={useMagicLink ? handleMagicLink : handleLogin}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('auth.email')}</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t('auth.emailPlaceholder')}
                  />
                </Form.Group>

                {!useMagicLink && (
                  <Form.Group className="mb-3">
                    <Form.Label>{t('auth.password')}</Form.Label>
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
                      {useMagicLink ? t('auth.sending') : t('auth.signingIn')}
                    </>
                  ) : (
                    useMagicLink ? t('auth.sendMagicLink') : t('auth.signIn')
                  )}
                </Button>

                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setUseMagicLink(!useMagicLink)}
                    className="text-decoration-none"
                  >
                    {useMagicLink ? t('auth.usePasswordInstead') : t('auth.useMagicLinkInstead')}
                  </Button>
                </div>

                {!useMagicLink && (
                  <div className="text-center">
                    <Link to="/forgot-password" className="text-decoration-none small text-muted">
                      {t('auth.forgot.link')}
                    </Link>
                  </div>
                )}
              </Form>

              <hr />

              <div className="text-center">
                <span className="text-muted">{t('auth.noAccount')} </span>
                <Link to="/register">{t('auth.signUp')}</Link>
              </div>

              <div className="mt-4 p-3 bg-light rounded">
                <small className="text-muted">
                  <strong>{t('auth.demoCredentials')}</strong><br />
                  Email: demo@incidentkb.com<br />
                  {t('auth.password')}: demo123
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
