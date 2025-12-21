import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from 'react-bootstrap';

export default function IncidentView() {
  const { id } = useParams();
  
  return (
    <>
      <div className="mb-4">
        <Link to="/incidents" className="btn btn-link ps-0">
          <i className="bi bi-arrow-left me-2"></i>Back to Incidents
        </Link>
      </div>
      
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-5">
          <p className="text-muted">Incident details - ID: {id}</p>
        </Card.Body>
      </Card>
    </>
  );
}
