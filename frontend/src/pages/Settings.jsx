import React, { useState, useEffect } from 'react';
import { Card, Nav, Row, Col, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { organizationAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import TagsSettings from './settings/TagsSettings';
import CategoriesSettings from './settings/CategoriesSettings';

export default function Settings() {
  const { t } = useTranslation();
  const { theme, setThemeMode, isDark } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('appearance');

  const canEditOrg = ['owner', 'admin'].includes(user?.role);

  const [org, setOrg] = useState({ name: '', default_language: 'pt' });
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgError, setOrgError] = useState('');

  useEffect(() => {
    let active = true;
    organizationAPI.get()
      .then(({ data }) => {
        if (!active) return;
        setOrg({
          name: data.organization?.name || '',
          default_language: data.organization?.settings?.default_language || 'pt'
        });
      })
      .catch(() => active && setOrgError(t('settings.loadOrgError')))
      .finally(() => active && setLoadingOrg(false));
    return () => { active = false; };
  }, [t]);

  const handleSaveOrg = async (e) => {
    e.preventDefault();
    setSavingOrg(true);
    setOrgError('');
    try {
      const { data } = await organizationAPI.update({
        name: org.name,
        settings: { default_language: org.default_language }
      });
      setOrg({
        name: data.organization?.name || org.name,
        default_language: data.organization?.settings?.default_language || org.default_language
      });
      toast.success(t('settings.saved'));
    } catch (err) {
      setOrgError(err.response?.data?.error || t('settings.saveError'));
    } finally {
      setSavingOrg(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'appearance':
        return (
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">
                <i className="bi bi-palette me-2"></i>
                {t('settings.appearance')}
              </h5>
            </Card.Header>
            <Card.Body>
              <h6 className="mb-3">{t('settings.uiTheme')}</h6>
              <div className="d-flex gap-3 mb-4">
                <Card 
                  className={`cursor-pointer ${theme === 'light' ? 'border-primary border-2' : ''}`}
                  style={{ width: '140px', cursor: 'pointer' }}
                  onClick={() => setThemeMode('light')}
                >
                  <Card.Body className="text-center p-3">
                    <div className="bg-light border rounded p-3 mb-2">
                      <i className="bi bi-sun-fill fs-3 text-warning"></i>
                    </div>
                    <small className="fw-semibold">{t('settings.themeLight')}</small>
                    {theme === 'light' && (
                      <i className="bi bi-check-circle-fill text-primary ms-2"></i>
                    )}
                  </Card.Body>
                </Card>
                <Card 
                  className={`cursor-pointer ${theme === 'dark' ? 'border-primary border-2' : ''}`}
                  style={{ width: '140px', cursor: 'pointer' }}
                  onClick={() => setThemeMode('dark')}
                >
                  <Card.Body className="text-center p-3">
                    <div className="bg-dark border rounded p-3 mb-2">
                      <i className="bi bi-moon-fill fs-3 text-light"></i>
                    </div>
                    <small className="fw-semibold">{t('settings.themeDark')}</small>
                    {theme === 'dark' && (
                      <i className="bi bi-check-circle-fill text-primary ms-2"></i>
                    )}
                  </Card.Body>
                </Card>
                <Card 
                  className={`cursor-pointer ${theme === 'system' ? 'border-primary border-2' : ''}`}
                  style={{ width: '140px', cursor: 'pointer' }}
                  onClick={() => setThemeMode('system')}
                >
                  <Card.Body className="text-center p-3">
                    <div className="bg-secondary border rounded p-3 mb-2">
                      <i className="bi bi-display fs-3 text-light"></i>
                    </div>
                    <small className="fw-semibold">{t('settings.themeSystem')}</small>
                    {theme === 'system' && (
                      <i className="bi bi-check-circle-fill text-primary ms-2"></i>
                    )}
                  </Card.Body>
                </Card>
              </div>
              <Alert variant="info">
                <i className="bi bi-info-circle me-2"></i>
                <strong>{t('settings.currentTheme')}</strong>{' '}
                {isDark ? t('settings.themeDark') : t('settings.themeLight')}
                {theme === 'system' && ` (${t('settings.followingSystem')})`}
              </Alert>
            </Card.Body>
          </Card>
        );
      case 'tags':
        return <TagsSettings />;
      case 'categories':
        return <CategoriesSettings />;
      case 'general':
        return (
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">
                <i className="bi bi-gear me-2"></i>
                {t('settings.general')}
              </h5>
            </Card.Header>
            <Card.Body>
              {loadingOrg ? (
                <div className="text-center py-4"><Spinner animation="border" variant="primary" /></div>
              ) : (
                <Form onSubmit={handleSaveOrg}>
                  {orgError && <Alert variant="danger">{orgError}</Alert>}
                  {!canEditOrg && (
                    <Alert variant="secondary">
                      <i className="bi bi-info-circle me-2"></i>
                      {t('settings.adminOnly')}
                    </Alert>
                  )}

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>{t('settings.orgName')}</Form.Label>
                        <Form.Control
                          type="text"
                          value={org.name}
                          disabled={!canEditOrg}
                          onChange={(e) => setOrg({ ...org, name: e.target.value })}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>{t('settings.defaultLanguage')}</Form.Label>
                        <Form.Select
                          value={org.default_language}
                          disabled={!canEditOrg}
                          onChange={(e) => setOrg({ ...org, default_language: e.target.value })}
                        >
                          <option value="pt">Português</option>
                          <option value="en">English</option>
                        </Form.Select>
                        <Form.Text className="text-muted">
                          <Trans i18nKey="settings.defaultLanguageHelp">
                            Aplicado a novos usuários da organização. Cada pessoa pode trocar
                            o próprio idioma em <a href="/profile">Meu Perfil</a>.
                          </Trans>
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>

                  {canEditOrg && (
                    <div className="mt-3">
                      <Button variant="primary" type="submit" disabled={savingOrg || !org.name.trim()}>
                        {savingOrg ? <Spinner size="sm" animation="border" /> : (
                          <><i className="bi bi-check-lg me-1"></i>{t('settings.save')}</>
                        )}
                      </Button>
                    </div>
                  )}
                </Form>
              )}
            </Card.Body>
          </Card>
        );

      case 'team':
        return (
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">
                <i className="bi bi-people me-2"></i>
                {t('settings.team')}
              </h5>
            </Card.Header>
            <Card.Body>
              <Alert variant="info">
                <i className="bi bi-info-circle me-2"></i>
                <Trans i18nKey="settings.teamHelp">
                  Gerencie os membros da equipe na página de <a href="/users">Usuários</a>.
                </Trans>
              </Alert>
            </Card.Body>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <h2 className="mb-4">
        <i className="bi bi-sliders me-2"></i>
        {t('settings.title')}
      </h2>
      
      <Row>
        <Col md={3}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body className="p-0">
              <Nav className="flex-column" variant="pills">
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'appearance'}
                    onClick={() => setActiveTab('appearance')}
                    className="rounded-0 border-bottom"
                  >
                    <i className="bi bi-palette me-2"></i>
                    {t('settings.appearance')}
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'tags'}
                    onClick={() => setActiveTab('tags')}
                    className="rounded-0 border-bottom"
                  >
                    <i className="bi bi-tags me-2"></i>
                    {t('settings.tabTags')}
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'categories'}
                    onClick={() => setActiveTab('categories')}
                    className="rounded-0 border-bottom"
                  >
                    <i className="bi bi-folder me-2"></i>
                    {t('settings.tabCategories')}
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'general'}
                    onClick={() => setActiveTab('general')}
                    className="rounded-0 border-bottom"
                  >
                    <i className="bi bi-gear me-2"></i>
                    {t('settings.tabGeneral')}
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'team'}
                    onClick={() => setActiveTab('team')}
                    className="rounded-0"
                  >
                    <i className="bi bi-people me-2"></i>
                    {t('settings.team')}
                  </Nav.Link>
                </Nav.Item>
              </Nav>
            </Card.Body>
          </Card>
        </Col>
        <Col md={9}>
          {renderContent()}
        </Col>
      </Row>
    </>
  );
}
