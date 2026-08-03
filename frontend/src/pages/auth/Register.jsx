import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

export default function Register() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    if (formData.password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        organizationName: formData.organizationName
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('auth.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Row className="w-100">
        <Col md={8} lg={6} xl={5} className="mx-auto">
          <Card className="shadow">
            <Card.Body className="p-5">
              <div className="text-center mb-4">
                <h3 className="fw-bold">
                  <i className="bi bi-database-fill me-2"></i>
                  {t('auth.createAccount')}
                </h3>
                <p className="text-muted">{t('auth.registerSubtitle')}</p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>{t('auth.fullName')}</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t('auth.email')}</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t('auth.organizationName')}</Form.Label>
                  <Form.Control
                    type="text"
                    name="organizationName"
                    value={formData.organizationName}
                    onChange={handleChange}
                    placeholder={t('auth.optional')}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t('auth.password')}</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <Form.Text className="text-muted">
                    {t('auth.minCharacters')}
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>{t('auth.confirmPassword')}</Form.Label>
                  <Form.Control
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-100 mb-3"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      {t('auth.creatingAccount')}
                    </>
                  ) : (
                    t('auth.createAccount')
                  )}
                </Button>
              </Form>

              <hr />

              <div className="text-center">
                <span className="text-muted">{t('auth.alreadyHaveAccount')} </span>
                <Link to="/login">{t('auth.signIn')}</Link>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
