import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import MagicLink from './pages/auth/MagicLink';
import Dashboard from './pages/Dashboard';
import KBList from './pages/kb/KBList';
import KBView from './pages/kb/KBView';
import KBCreate from './pages/kb/KBCreate';
import KBEdit from './pages/kb/KBEdit';
import KBVersionHistory from './pages/kb/KBVersionHistory';
import KBPermissions from './pages/kb/KBPermissions';
import QuickCapture from './pages/kb/QuickCapture';
import IncidentList from './pages/incidents/IncidentList';
import IncidentView from './pages/incidents/IncidentView';
import EventList from './pages/events/EventList';
import Settings from './pages/Settings';
import PropertyManager from './components/properties/PropertyManager';
import Admin from './pages/Admin';
import Notifications from './pages/Notifications';
import TagsCategoriesManager from './components/tags/TagsCategoriesManager';
import Favorites from './pages/Favorites';
import Search from './pages/Search';
import Templates from './pages/Templates';
import Analytics from './pages/Analytics';
import Import from './pages/Import';
import Reviews from './pages/Reviews';
import AuditLogs from './pages/AuditLogs';
import GPSFlowList from './pages/gps/GPSFlowList';
import GPSFlowEditor from './pages/gps/GPSFlowEditor';
import GPSPlayer from './pages/gps/GPSPlayer';

// Layout
import Layout from './components/Layout';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="spinner-overlay">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="spinner-overlay">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  
  return !isAuthenticated ? children : <Navigate to="/" />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <Register />
        </PublicRoute>
      } />
      <Route path="/auth/magic" element={
        <PublicRoute>
          <MagicLink />
        </PublicRoute>
      } />
      
      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="kb" element={<KBList />} />
        <Route path="kb/new" element={<KBCreate />} />
        <Route path="kb/:id" element={<KBView />} />
        <Route path="kb/:id/edit" element={<KBEdit />} />
        <Route path="kb/:id/history" element={<KBVersionHistory />} />
        <Route path="kb/:id/permissions" element={<KBPermissions />} />
        <Route path="quick-capture" element={<QuickCapture />} />
        <Route path="incidents" element={<IncidentList />} />
        <Route path="incidents/:id" element={<IncidentView />} />
        <Route path="events" element={<EventList />} />
        <Route path="properties" element={<PropertyManager />} />
        <Route path="admin" element={<Admin />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="tags" element={<TagsCategoriesManager />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="search" element={<Search />} />
        <Route path="templates" element={<Templates />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="import" element={<Import />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="gps" element={<GPSFlowList />} />
        <Route path="gps/flows/:flowId/edit" element={<GPSFlowEditor />} />
        <Route path="gps/play/:flowId" element={<GPSPlayer />} />
        <Route path="gps/session/:sessionId" element={<GPSPlayer />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
