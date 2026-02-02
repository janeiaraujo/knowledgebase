import React, { useState } from 'react';
import { Card, Nav, Row, Col, Form, Button, Alert } from 'react-bootstrap';
import TagsSettings from './settings/TagsSettings';
import CategoriesSettings from './settings/CategoriesSettings';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('tags');
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'Knowledge Base',
    defaultLanguage: 'pt-BR',
    allowPublicAccess: false,
    enableComments: true,
    enableRatings: true,
    requireApproval: true
  });

  const renderContent = () => {
    switch (activeTab) {
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
                Configurações Gerais
              </h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Nome do Site</Form.Label>
                      <Form.Control
                        type="text"
                        value={generalSettings.siteName}
                        onChange={(e) => setGeneralSettings({...generalSettings, siteName: e.target.value})}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Idioma Padrão</Form.Label>
                      <Form.Select
                        value={generalSettings.defaultLanguage}
                        onChange={(e) => setGeneralSettings({...generalSettings, defaultLanguage: e.target.value})}
                      >
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en-US">English (US)</option>
                        <option value="es">Español</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <hr className="my-4" />
                <h6 className="mb-3">Permissões</h6>

                <Form.Check
                  type="switch"
                  id="allowPublicAccess"
                  label="Permitir acesso público (sem login)"
                  checked={generalSettings.allowPublicAccess}
                  onChange={(e) => setGeneralSettings({...generalSettings, allowPublicAccess: e.target.checked})}
                  className="mb-2"
                />
                <Form.Check
                  type="switch"
                  id="enableComments"
                  label="Habilitar comentários em KBs"
                  checked={generalSettings.enableComments}
                  onChange={(e) => setGeneralSettings({...generalSettings, enableComments: e.target.checked})}
                  className="mb-2"
                />
                <Form.Check
                  type="switch"
                  id="enableRatings"
                  label="Habilitar avaliações de KBs"
                  checked={generalSettings.enableRatings}
                  onChange={(e) => setGeneralSettings({...generalSettings, enableRatings: e.target.checked})}
                  className="mb-2"
                />
                <Form.Check
                  type="switch"
                  id="requireApproval"
                  label="Exigir aprovação para publicação"
                  checked={generalSettings.requireApproval}
                  onChange={(e) => setGeneralSettings({...generalSettings, requireApproval: e.target.checked})}
                  className="mb-2"
                />

                <div className="mt-4">
                  <Button variant="primary">
                    <i className="bi bi-check-lg me-1"></i>
                    Salvar Configurações
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        );
      case 'team':
        return (
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">
                <i className="bi bi-people me-2"></i>
                Equipe
              </h5>
            </Card.Header>
            <Card.Body>
              <Alert variant="info">
                <i className="bi bi-info-circle me-2"></i>
                Gerencie os membros da equipe na página de <a href="/users">Usuários</a>.
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
        Configurações
      </h2>
      
      <Row>
        <Col md={3}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body className="p-0">
              <Nav className="flex-column" variant="pills">
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'tags'}
                    onClick={() => setActiveTab('tags')}
                    className="rounded-0 border-bottom"
                  >
                    <i className="bi bi-tags me-2"></i>
                    Tags
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'categories'}
                    onClick={() => setActiveTab('categories')}
                    className="rounded-0 border-bottom"
                  >
                    <i className="bi bi-folder me-2"></i>
                    Categorias
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'general'}
                    onClick={() => setActiveTab('general')}
                    className="rounded-0 border-bottom"
                  >
                    <i className="bi bi-gear me-2"></i>
                    Geral
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link 
                    active={activeTab === 'team'}
                    onClick={() => setActiveTab('team')}
                    className="rounded-0"
                  >
                    <i className="bi bi-people me-2"></i>
                    Equipe
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
