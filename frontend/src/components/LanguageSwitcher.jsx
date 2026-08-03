import React from 'react';
import { useTranslation } from 'react-i18next';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

// Alternador PT/EN da interface. Usa o proprio i18next como fonte de
// verdade (i18n.language) - o i18next-browser-languagedetector ja persiste
// a escolha em localStorage sozinho, sem precisar de um Context proprio.
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'pt';

  const toggle = () => {
    i18n.changeLanguage(current === 'pt' ? 'en' : 'pt');
  };

  return (
    <OverlayTrigger overlay={<Tooltip>{t('navbar.switchLanguage')}</Tooltip>}>
      <button
        onClick={toggle}
        className="btn btn-link nav-link p-2 border-0 fw-semibold"
        style={{ minWidth: '2.5rem' }}
        title={t('navbar.switchLanguage')}
      >
        {current === 'pt' ? 'PT' : 'EN'}
      </button>
    </OverlayTrigger>
  );
}
