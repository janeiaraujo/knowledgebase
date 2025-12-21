import React from 'react';
import { Card, Button } from 'react-bootstrap';

export default function IncidentList() {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Incidents</h2>
        <Button variant="primary">
          <i className="bi bi-plus-circle me-2"></i>New Incident
        </Button>
      </div>
      
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-5">
          <i className="bi bi-inbox fs-1 text-muted"></i>
          <p className="text-muted mt-3">No incidents yet</p>
        </Card.Body>
      </Card>
    </>
  );
}
