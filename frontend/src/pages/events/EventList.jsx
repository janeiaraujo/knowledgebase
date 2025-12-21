import React from 'react';
import { Card } from 'react-bootstrap';

export default function EventList() {
  return (
    <>
      <h2 className="mb-4">Events</h2>
      
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-5">
          <i className="bi bi-inbox fs-1 text-muted"></i>
          <p className="text-muted mt-3">No events yet</p>
          <p className="text-muted small">
            Events can be ingested via API using the endpoint:<br/>
            <code>POST /api/events/ingest</code>
          </p>
        </Card.Body>
      </Card>
    </>
  );
}
