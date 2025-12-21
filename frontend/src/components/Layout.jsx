import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import QuickSearch from './QuickSearch';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const isActive = (path) => location.pathname.startsWith(path);
  
  return (
    <div className="d-flex">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="px-3 py-2 mb-3 border-bottom border-secondary">
          <h5 className="text-white mb-0">
            <i className="bi bi-database-fill me-2"></i>
            Incident KB
          </h5>
        </div>
        
        <Nav className="flex-column">
          <Link 
            to="/" 
            className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}
          >
            <i className="bi bi-speedometer2 me-2"></i>
            Dashboard
          </Link>
          
          <Link 
            to="/kb" 
            className={`nav-link ${isActive('/kb') ? 'active' : ''}`}
          >
            <i className="bi bi-book me-2"></i>
            Knowledge Base
          </Link>
          
          <Link 
            to="/incidents" 
            className={`nav-link ${isActive('/incidents') ? 'active' : ''}`}
          >
            <i className="bi bi-exclamation-triangle me-2"></i>
            Incidents
          </Link>
          
          <Link 
            to="/events" 
            className={`nav-link ${isActive('/events') ? 'active' : ''}`}
          >
            <i className="bi bi-calendar-event me-2"></i>
            Events
          </Link>
          
          <hr className="text-white-50 my-3" />
          
          <Link 
            to="/properties" 
            className={`nav-link ${isActive('/properties') ? 'active' : ''}`}
          >
            <i className="bi bi-sliders me-2"></i>
            Propriedades
          </Link>
          
          <Link 
            to="/settings" 
            className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
          >
            <i className="bi bi-gear me-2"></i>
            Settings
          </Link>
        </Nav>
        
        <div className="position-absolute bottom-0 w-100 p-3 border-top border-secondary">
          <div className="text-white-50 small">
            <div className="mb-1">{user?.name}</div>
            <div className="mb-2 text-capitalize">
              <i className="bi bi-shield-check me-1"></i>
              {user?.role}
            </div>
            <button 
              onClick={handleLogout}
              className="btn btn-sm btn-outline-light w-100"
            >
              <i className="bi bi-box-arrow-right me-1"></i>
              Logout
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content flex-grow-1">
        <Navbar bg="white" className="border-bottom mb-4">
          <Container fluid>
            <QuickSearch />
            
            <Nav className="ms-auto">
              <Link to="/kb/new" className="btn btn-primary btn-sm">
                <i className="bi bi-plus-circle me-1"></i>
                New KB
              </Link>
            </Nav>
          </Container>
        </Navbar>
        
        <Container fluid>
          <Outlet />
        </Container>
      </div>
    </div>
  );
}
