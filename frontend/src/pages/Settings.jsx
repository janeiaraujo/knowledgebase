import React from 'react';
import { Card, Tabs, Tab } from 'react-bootstrap';

export default function Settings() {
  return (
    <>
      <h2 className="mb-4">Settings</h2>
      
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Tabs defaultActiveKey="general" className="mb-3">
            <Tab eventKey="general" title="General">
              <p className="text-muted">General settings</p>
            </Tab>
            <Tab eventKey="team" title="Team">
              <p className="text-muted">Team management</p>
            </Tab>
            <Tab eventKey="billing" title="Billing">
              <p className="text-muted">Billing and subscription</p>
            </Tab>
            <Tab eventKey="api" title="API">
              <p className="text-muted">API tokens and integration</p>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </>
  );
}
