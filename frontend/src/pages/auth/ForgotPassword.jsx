import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../../services/api';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.forgotPassword(email);
      // O backend responde igual exista ou nao a conta; a tela segue o
      // mesmo principio e nao confirma se o e-mail esta cadastrado.
      setSent(true);
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'SMTP_NOT_CONFIGURED') {
        setError(t('auth.forgot.smtpNotConfigured'));
      } else if (code === 'SMTP_CONNECTION_ERROR') {
        setError(t('auth.smtpConnectionError'));
      } else {
        setError(err.response?.data?.error || t('auth.forgot.failed'));
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
                  <i className="bi bi-key me-2"></i>
                  {t('auth.forgot.title')}
                </h3>
                <p className="text-muted">{t('auth.forgot.subtitle')}</p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              {sent ? (
                <>
                  <Alert variant="success">
                    <i className="bi bi-envelope-check me-2"></i>
                    {t('auth.forgot.sent')}
                  </Alert>
                  <p className="text-muted small">{t('auth.forgot.sentHelp')}</p>
                  <Link to="/login" className="btn btn-outline-secondary w-100">
                    {t('auth.backToLogin')}
                  </Link>
                </>
              ) : (
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('auth.email')}</Form.Label>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      placeholder={t('auth.emailPlaceholder')}
                    />
                  </Form.Group>

                  <Button type="submit" variant="primary" className="w-100 mb-3" disabled={loading || !email}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" />
                        {t('auth.sending')}
                      </>
                    ) : (
                      t('auth.forgot.submit')
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
