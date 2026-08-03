import React from 'react';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col } from 'react-bootstrap';
import { TemplateManager } from '../components/templates/TemplateSelector';

export default function Templates() {
  const { t } = useTranslation();
  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="mb-1">{t('templates.templateManager')}</h2>
          <p className="text-muted">
            {t('templates.createAndManageKbTemplatesTo')}
          </p>
        </Col>
      </Row>
      
      <TemplateManager />
    </Container>
  );
}
