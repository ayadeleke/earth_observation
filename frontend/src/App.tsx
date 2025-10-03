import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from './components/layout';
import LandingPage from './components/LandingPage';
import DemoPage from './pages/DemoPage';
import AnalysisPage from './pages/AnalysisPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import ImageSelector from './pages/ImageSelector';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/main.css';
import './index.css';
import { DashboardPage } from './pages/DashboardPage';
import { ResultsPage } from './pages/ResultsPage';
import { ProjectsPage } from './pages/ProjectsPage';

// Mock user for demonstration - replace with actual auth logic
const mockUser = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  avatar: undefined
};

const AppContent: React.FC = () => {
  const [user, setUser] = useState<typeof mockUser | undefined>(undefined);
  const location = useLocation();

  // Mock authentication - replace with real auth logic
  useEffect(() => {
    // Simulate checking authentication status
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (isAuthenticated) {
      setUser(mockUser);
    }
  }, []);

  const handleLogout = () => {
    setUser(undefined);
    localStorage.removeItem('isAuthenticated');
  };



  // Pages that don't need the full layout (like landing page)
  const noLayoutPaths = ['/'];
  const shouldUseLayout = !noLayoutPaths.includes(location.pathname);

  // Pages that don't need footer (like analysis pages)
  const noFooterPaths = ['/analysis', '/advanced-image-analysis'];
  const shouldShowFooter = !noFooterPaths.includes(location.pathname);

  if (!shouldUseLayout) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
      </Routes>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout} showFooter={shouldShowFooter}>
      <Routes>
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/project" element={<ProjectsPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/advanced-image-analysis" element={<ImageSelector />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
    return (
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
    );
};

export default App;