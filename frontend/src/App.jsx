import React, { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Telas de entrada: estaticas de proposito. Sao o primeiro contato de
// quem chega sem sessao, e adiar o carregamento delas trocaria um bundle
// grande por um flash de spinner logo na abertura.
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// O resto entra por rota. Antes tudo vinha num chunk unico de 2 MB, que
// todo visitante baixava inteiro para ver a tela de login.
const MagicLink = lazy(() => import('./pages/auth/MagicLink'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const KBList = lazy(() => import('./pages/kb/KBList'));
const KBView = lazy(() => import('./pages/kb/KBView'));
const KBCreate = lazy(() => import('./pages/kb/KBCreate'));
const KBEdit = lazy(() => import('./pages/kb/KBEdit'));
const KBVersionHistory = lazy(() => import('./pages/kb/KBVersionHistory'));
const KBPermissions = lazy(() => import('./pages/kb/KBPermissions'));
const QuickCapture = lazy(() => import('./pages/kb/QuickCapture'));
const IncidentList = lazy(() => import('./pages/incidents/IncidentList'));
const IncidentView = lazy(() => import('./pages/incidents/IncidentView'));
const EventList = lazy(() => import('./pages/events/EventList'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const PropertyManager = lazy(() => import('./components/properties/PropertyManager'));
const Admin = lazy(() => import('./pages/Admin'));
const Notifications = lazy(() => import('./pages/Notifications'));
const TagsCategoriesManager = lazy(() => import('./components/tags/TagsCategoriesManager'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Search = lazy(() => import('./pages/Search'));
const Templates = lazy(() => import('./pages/Templates'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Import = lazy(() => import('./pages/Import'));
const Reviews = lazy(() => import('./pages/Reviews'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const GPSFlowList = lazy(() => import('./pages/gps/GPSFlowList'));
const GPSFlowEditor = lazy(() => import('./pages/gps/GPSFlowEditor'));
const GPSPlayer = lazy(() => import('./pages/gps/GPSPlayer'));
const GPSSessions = lazy(() => import('./pages/gps/GPSSessions'));
const Webhooks = lazy(() => import('./pages/Webhooks'));
const UserActivity = lazy(() => import('./pages/UserActivity'));
const SmartSearch = lazy(() => import('./pages/SmartSearch'));
const KBRequests = lazy(() => import('./pages/KBRequests'));
const PostMortemList = lazy(() => import('./pages/postmortem/PostMortemList'));
const PostMortemEditor = lazy(() => import('./pages/postmortem/PostMortemEditor'));
const Reports = lazy(() => import('./pages/Reports'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Gamification = lazy(() => import('./pages/Gamification'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));

// Layout
import Layout from './components/Layout';

// Enquanto o chunk da rota chega. Usa o mesmo spinner das rotas
// protegidas, para a tela nao mudar de aparencia conforme o chunk ja
// esteja em cache ou nao.
function CarregandoRota() {
  const { t } = useTranslation();
  return (
    <div className="spinner-overlay">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">{t('common.loading')}</span>
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children }) => {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="spinner-overlay">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t('common.loading')}</span>
        </div>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="spinner-overlay">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t('common.loading')}</span>
        </div>
      </div>
    );
  }
  
  return !isAuthenticated ? children : <Navigate to="/" />;
};

function AppRoutes() {
  return (
    <Suspense fallback={<CarregandoRota />}>
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
        <Route path="/forgot-password" element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        } />
        <Route path="/reset-password" element={
          <PublicRoute>
            <ResetPassword />
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
          <Route path="gps/flows" element={<GPSFlowList />} />
          <Route path="gps/sessions" element={<GPSSessions />} />
          <Route path="gps/flows/:flowId/edit" element={<GPSFlowEditor />} />
          <Route path="gps/play/:flowId" element={<GPSPlayer />} />
          <Route path="gps/player/:sessionId" element={<GPSPlayer />} />
          <Route path="gps/session/:sessionId" element={<GPSPlayer />} />
          <Route path="webhooks" element={<Webhooks />} />
          <Route path="user-activity" element={<UserActivity />} />
          <Route path="smart-search" element={<SmartSearch />} />
          <Route path="kb-requests" element={<KBRequests />} />
          <Route path="postmortem" element={<PostMortemList />} />
          <Route path="postmortem/:id" element={<PostMortemEditor />} />
          <Route path="reports" element={<Reports />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="gamification" element={<Gamification />} />
          <Route path="help" element={<HelpCenter />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer position="top-right" autoClose={4000} newestOnTop theme="colored" />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
