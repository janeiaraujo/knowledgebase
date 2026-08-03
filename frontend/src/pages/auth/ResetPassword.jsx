import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../../services/api';

const MIN_LENGTH = 8;

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    if (password.length < MIN_LENGTH) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
      // Leva ao login já sinalizando o sucesso, em vez de deixar a pessoa
      // parada numa tela final sem próximo passo.
      setTimeout(() => navigate('/login?reset=success'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || t('auth.reset.failed'));
    } finally {
      setLoading(false);
    }
  };

  // Link sem token: não adianta mostrar o formulário
  if (!token) {
    return (
      <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <Card className="shadow" style={{ maxWidth: '420px', width: '100%' }}>
          <Card.Body className="p-5 text-center">
            <i className="bi bi-x-circle text-danger" style={{ fontSize: '3rem' }}></i>
            <h5 className="mt-3">{t('auth.reset.invalidLink')}</h5>
            <p className="text-muted">{t('auth.reset.invalidLinkHelp')}</p>
            <Link to="/forgot-password" className="btn btn-primary">
              {t('auth.forgot.submit')}
            </Link>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Row className="w-100">
        <Col md={6} lg={5} xl={4} className="mx-auto">
          <Card className="shadow">
            <Card.Body className="p-5">
              <div className="text-center mb-4">
                <h3 className="fw-bold">
                  <i className="bi bi-shield-lock me-2"></i>
                  {t('auth.reset.title')}
                </h3>
                <p className="text-muted">{t('auth.reset.subtitle')}</p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              {done ? (
                <Alert variant="success">
                  <i className="bi bi-check-circle me-2"></i>
                  {t('auth.reset.success')}
                </Alert>
              ) : (
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('profile.newPassword')}</Form.Label>
                    <Form.Control
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                    />
                    <Form.Text className="text-muted">{t('auth.minCharacters')}</Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label>{t('auth.confirmPassword')}</Form.Label>
                    <Form.Control
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <Button type="submit" variant="primary" className="w-100 mb-3" disabled={loading || !password}>
                    {loading ? (
                      <span className="spinner-border spinner-border-sm" role="status" />
                    ) : (
                      t('auth.reset.submit')
                    )}
                  </Button>

                  <div className="text-center">
                    <Link to="/login" className="text-decoration-none">
                      {t('auth.backToLogin')}
                    </Link>
                  </div>
                </Form>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
