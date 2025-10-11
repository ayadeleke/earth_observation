import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Layout } from './components/layout';
import LandingPage from './pages/LandingPage';
import DemoPage from './pages/DemoPage';
import AboutPage from './pages/AboutPage';
import AnalysisPage from './pages/AnalysisPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import ImageSelector from './pages/ImageSelector';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/main.css';
import './index.css';
import DashboardPage from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

const AppContent: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Pages that don't need the full layout (like landing page)
  const noLayoutPaths = ['/'];
  const shouldUseLayout = !noLayoutPaths.includes(location.pathname);

  // Pages that don't need footer - currently all pages show footer
  const noFooterPaths: string[] = [];
  const shouldShowFooter = !noFooterPaths.includes(location.pathname);

  if (!shouldUseLayout) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
      </Routes>
    );
  }

  const transformUser = (authUser: any) => {
    if (!authUser) return undefined;
    return {
      name: authUser.username || authUser.email || 'User',
      email: authUser.email,
      avatar: authUser.avatar
    };
  };

  return (
    <Layout user={transformUser(user)} onLogout={logout} showFooter={shouldShowFooter}>
      <Routes>
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/analysis" element={
          <ProtectedRoute>
            <AnalysisPage />
          </ProtectedRoute>
        } />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/projects" element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/advanced-image-analysis" element={
          <ProtectedRoute>
            <ImageSelector />
          </ProtectedRoute>
        } />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
    // Google OAuth Client ID - In production, this should be in environment variables
    const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "7503931462-u4vjc2r8te3lcsa2ccmge0j6g2sabru0.apps.googleusercontent.com";
    
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <AuthProvider>
                <Router
                    future={{
                        v7_startTransition: true,
                        v7_relativeSplatPath: true
                    }}
                >
                    <div className="App">
                        <AppContent />
                    </div>
                </Router>
            </AuthProvider>
        </GoogleOAuthProvider>
    );
};

export default App;