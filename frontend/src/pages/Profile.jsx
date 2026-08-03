import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Form, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { userAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AvatarUploader from '../components/AvatarUploader';

const LANGUAGES = [
  { code: 'pt', labelKey: 'profile.languages.pt', flag: '🇧🇷' },
  { code: 'en', labelKey: 'profile.languages.en', flag: '🇺🇸' }
];

const THEMES = [
  { value: 'light', labelKey: 'profile.themes.light', icon: 'bi-sun-fill', iconClass: 'text-warning' },
  { value: 'dark', labelKey: 'profile.themes.dark', icon: 'bi-moon-fill', iconClass: 'text-primary' },
  { value: 'system', labelKey: 'profile.themes.system', icon: 'bi-display', iconClass: 'text-secondary' }
];

const ROLE_VARIANTS = {
  owner: 'danger',
  admin: 'warning',
  member: 'primary',
  viewer: 'secondary'
};

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const { theme, setThemeMode } = useTheme();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await userAPI.getMe();
      setProfile(data.user);
      setName(data.user.name || '');
    } catch (err) {
      console.error('Failed to load profile:', err);
      toast.error(t('profile.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // Mantem AuthContext/localStorage em sincronia com o perfil salvo, para que
  // a sidebar e o restante do app reflitam a mudanca sem precisar recarregar.
  const syncAuthUser = (updated) => {
    const merged = {
      ...user,
      name: updated.name,
      preferences: updated.preferences,
      avatar_url: updated.avatar_url
    };
    setUser?.(merged);
    try {
      localStorage.setItem('user', JSON.stringify(merged));
    } catch {
      // localStorage indisponivel (modo privado) - a UI ja esta atualizada
    }
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === profile?.name) return;
    setSavingName(true);
    try {
      const { data } = await userAPI.updateMe({ name: name.trim() });
      setProfile(data.user);
      syncAuthUser(data.user);
      toast.success(t('profile.saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('profile.saveError'));
    } finally {
      setSavingName(false);
    }
  };

  const handleLanguageChange = async (code) => {
    if (code === profile?.preferences?.language) return;
    // Aplica na hora; se o salvamento falhar, o idioma volta ao anterior.
    const previous = i18n.language;
    i18n.changeLanguage(code);
    try {
      const { data } = await userAPI.updateMe({ preferences: { language: code } });
      setProfile(data.user);
      syncAuthUser(data.user);
      toast.success(t('profile.saved'));
    } catch (err) {
      i18n.changeLanguage(previous);
      toast.error(err.response?.data?.error || t('profile.saveError'));
    }
  };

  const handleThemeChange = async (value) => {
    const previous = theme;
    setThemeMode(value);
    try {
      const { data } = await userAPI.updateMe({ preferences: { theme: value } });
      setProfile(data.user);
      syncAuthUser(data.user);
    } catch (err) {
      setThemeMode(previous);
      toast.error(err.response?.data?.error || t('profile.saveError'));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (passwords.next !== passwords.confirm) {
      setPasswordError(t('auth.passwordsDoNotMatch'));
      return;
    }
    if (passwords.next.length < 8) {
      setPasswordError(t('auth.passwordTooShort'));
      return;
    }

    setChangingPassword(true);
    try {
      await userAPI.changePassword(passwords.current, passwords.next);
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success(t('profile.passwordChanged'));
    } catch (err) {
      setPasswordError(err.response?.data?.error || t('profile.saveError'));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (!profile) {
    return <Alert variant="danger">{t('profile.loadError')}</Alert>;
  }

  const currentLanguage = profile.preferences?.language || 'pt';
  const dateLocale = i18n.language?.startsWith('en') ? enUS : ptBR;

  return (
    <>
      <h2 className="mb-4">
        <i className="bi bi-person-circle me-2"></i>
        {t('profile.title')}
      </h2>

      <Row className="g-4">
        <Col lg={4}>
          {/* Identity card */}
          <Card className="border-0 shadow-sm">
            <Card.Body className="text-center">
              <div className="mb-3">
                <AvatarUploader
                  avatarUrl={profile.avatar_url}
                  name={profile.name}
                  onChange={(updated) => {
                    setProfile(updated);
                    syncAuthUser(updated);
                  }}
                />
              </div>
              <h5 className="mb-1">{profile.name}</h5>
              <p className="text-muted small mb-2">{profile.email}</p>
              <Badge bg={ROLE_VARIANTS[profile.role] || 'secondary'} className="text-uppercase">
                <i className="bi bi-shield-check me-1"></i>
                {profile.role}
              </Badge>

              <hr />

              <div className="text-start small text-muted">
                <div className="d-flex justify-content-between mb-2">
                  <span>{t('profile.memberSince')}</span>
                  <span className="fw-medium">
                    {profile.created_at
                      ? format(new Date(profile.created_at), 'dd MMM yyyy', { locale: dateLocale })
                      : '—'}
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>{t('profile.lastLogin')}</span>
                  <span className="fw-medium">
                    {profile.last_login
                      ? format(new Date(profile.last_login), 'dd MMM yyyy HH:mm', { locale: dateLocale })
                      : '—'}
                  </span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          {/* Personal data */}
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-transparent">
              <h5 className="mb-0">
                <i className="bi bi-person me-2"></i>
                {t('profile.personalData')}
              </h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSaveName}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('auth.fullName')}</Form.Label>
                      <Form.Control
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('auth.email')}</Form.Label>
                      <Form.Control value={profile.email} disabled readOnly />
                      <Form.Text className="text-muted">{t('profile.emailReadOnly')}</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={savingName || !name.trim() || name.trim() === profile.name}
                >
                  {savingName ? <Spinner size="sm" animation="border" /> : (
                    <><i className="bi bi-check-lg me-1"></i>{t('profile.saveChanges')}</>
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>

          {/* Preferences */}
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-transparent">
              <h5 className="mb-0">
                <i className="bi bi-sliders me-2"></i>
                {t('profile.preferences')}
              </h5>
            </Card.Header>
            <Card.Body>
              <h6 className="mb-2">
                <i className="bi bi-translate me-2"></i>
                {t('profile.language')}
              </h6>
              <p className="text-muted small">{t('profile.languageHelp')}</p>
              <div className="d-flex gap-3 mb-4 flex-wrap">
                {LANGUAGES.map(lang => (
                  <Card
                    key={lang.code}
                    className={currentLanguage === lang.code ? 'border-primary border-2' : ''}
                    style={{ width: '150px', cursor: 'pointer' }}
                    onClick={() => handleLanguageChange(lang.code)}
                  >
                    <Card.Body className="text-center p-3">
                      <div style={{ fontSize: '1.75rem' }}>{lang.flag}</div>
                      <small className="fw-semibold d-block mt-1">{t(lang.labelKey)}</small>
                      {currentLanguage === lang.code && (
                        <i className="bi bi-check-circle-fill text-primary mt-1 d-block"></i>
                      )}
                    </Card.Body>
                  </Card>
                ))}
              </div>

              <hr />

              <h6 className="mb-2">
                <i className="bi bi-palette me-2"></i>
                {t('profile.theme')}
              </h6>
              <p className="text-muted small">{t('profile.themeHelp')}</p>
              <div className="d-flex gap-3 flex-wrap">
                {THEMES.map(item => (
                  <Card
                    key={item.value}
                    className={theme === item.value ? 'border-primary border-2' : ''}
                    style={{ width: '150px', cursor: 'pointer' }}
                    onClick={() => handleThemeChange(item.value)}
                  >
                    <Card.Body className="text-center p-3">
                      <i className={`bi ${item.icon} fs-3 ${item.iconClass}`}></i>
                      <small className="fw-semibold d-block mt-1">{t(item.labelKey)}</small>
                      {theme === item.value && (
                        <i className="bi bi-check-circle-fill text-primary mt-1 d-block"></i>
                      )}
                    </Card.Body>
                  </Card>
                ))}
              </div>
            </Card.Body>
          </Card>

          {/* Security */}
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-transparent">
              <h5 className="mb-0">
                <i className="bi bi-shield-lock me-2"></i>
                {t('profile.security')}
              </h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleChangePassword}>
                {passwordError && <Alert variant="danger">{passwordError}</Alert>}

                <Form.Group className="mb-3">
                  <Form.Label>{t('profile.currentPassword')}</Form.Label>
                  <Form.Control
                    type="password"
                    value={passwords.current}
                    onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                    required
                  />
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('profile.newPassword')}</Form.Label>
                      <Form.Control
                        type="password"
                        value={passwords.next}
                        onChange={(e) => setPasswords(prev => ({ ...prev, next: e.target.value }))}
                        required
                      />
                      <Form.Text className="text-muted">{t('auth.minCharacters')}</Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('auth.confirmPassword')}</Form.Label>
                      <Form.Control
                        type="password"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Button
                  type="submit"
                  variant="outline-primary"
                  disabled={changingPassword || !passwords.current || !passwords.next}
                >
                  {changingPassword ? <Spinner size="sm" animation="border" /> : (
                    <><i className="bi bi-key me-1"></i>{t('profile.changePassword')}</>
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
