import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { TemplateManager } from '../components/templates/TemplateSelector';

export default function Templates() {
  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="mb-1">Template Manager</h2>
          <p className="text-muted">
            Create and manage KB templates to streamline documentation
          </p>
        </Col>
      </Row>
      
      <TemplateManager />
    </Container>
  );
}
