/**
 * Usage Examples for the New Layout System
 * 
 * This file demonstrates how to use the new Header, Footer, Layout, and PageWrapper components
 * in different scenarios across the Earth Observation Platform.
 */

import React from 'react';
import { Layout, PageWrapper, Header, Footer } from '../components/layout';

// Example 1: Full Layout with Header and Footer
// Use this for most pages like Dashboard, Projects, etc.
const ExampleFullLayoutPage: React.FC = () => {
  const user = {
    name: 'John Doe',
    email: 'john.doe@example.com'
  };

  const handleLogout = () => {
    console.log('Logging out...');
  };

  return (
    <Layout user={user} onLogout={handleLogout}>
      <div className="container-fluid px-4 py-5">
        <h1 className="display-4 fw-bold text-dark mb-4">Dashboard</h1>
        <div className="card shadow">
          <div className="card-body">
            <p>Your page content goes here...</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// Example 2: Header Only (No Footer)
// Use this for analysis pages where you want more screen real estate
const ExampleAnalysisPage: React.FC = () => {
  const user = {
    name: 'Jane Smith',
    email: 'jane.smith@example.com'
  };

  const handleLogout = () => {
    console.log('Logging out...');
  };

  return (
    <PageWrapper user={user} onLogout={handleLogout} fullHeight>
      <div className="h-100 d-flex flex-column">
        <div className="flex-fill p-4">
          <h1 className="h2 fw-bold mb-4">NDVI Analysis</h1>
          <div className="bg-light rounded d-flex align-items-center justify-content-center" style={{ height: '400px' }}>
            <p>Analysis interface goes here...</p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

// Example 3: Layout without Footer
// Use Layout but disable footer for specific pages
const ExampleNoFooterPage: React.FC = () => {
  return (
    <Layout showFooter={false}>
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <h1 className="display-3 fw-bold text-dark mb-4">
            Page with Header Only
          </h1>
          <p className="text-muted">
            This page uses the Layout component but with footer disabled
          </p>
        </div>
      </div>
    </Layout>
  );
};

// Example 4: Standalone Header and Footer
// Use when you need more control over the layout structure
const ExampleCustomLayoutPage: React.FC = () => {
  return (
    <div className="min-vh-100 d-flex flex-column">
      <Header />
      
      <main className="flex-fill" style={{background: 'linear-gradient(135deg, #f8faff 0%, #e0e7ff 100%)'}}>
        <div className="container px-4 py-5">
          <div className="text-center">
            <h1 className="display-2 fw-bold text-dark mb-4">
              Custom Layout
            </h1>
            <p className="fs-4 text-muted mb-5">
              This page uses Header and Footer separately for maximum flexibility
            </p>
            <div className="bg-white rounded-3 shadow-lg p-5">
              <p className="text-muted">
                Custom content with independent header and footer components
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

// Example 5: Responsive Layout for Different User States
const ExampleResponsiveLayoutPage: React.FC = () => {
  const [user, setUser] = React.useState<{name: string; email: string} | undefined>();

  const handleLogin = () => {
    setUser({ name: 'Demo User', email: 'demo@example.com' });
  };

  const handleLogout = () => {
    setUser(undefined);
  };

  return (
    <Layout user={user} onLogout={handleLogout}>
      <div className="container-lg px-4 py-5">
        <div className="text-center">
          <h1 className="display-4 fw-bold text-dark mb-5">
            Responsive User Layout
          </h1>
          
          {user ? (
            <div className="alert alert-success border-success-subtle p-4 mb-5">
              <h2 className="fs-5 fw-semibold text-success-emphasis mb-2">
                Welcome back, {user.name}!
              </h2>
              <p className="text-success-emphasis">
                You are logged in as {user.email}
              </p>
              <button
                onClick={handleLogout}
                className="btn btn-danger mt-3"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="alert alert-primary border-primary-subtle p-4 mb-5">
              <h2 className="fs-5 fw-semibold text-primary-emphasis mb-2">
                Please log in
              </h2>
              <p className="text-primary-emphasis mb-3">
                Login to access all features
              </p>
              <button
                onClick={handleLogin}
                className="btn btn-primary"
              >
                Demo Login
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

/**
 * IMPLEMENTATION GUIDE:
 * 
 * 1. Update App.tsx to wrap routes with appropriate layout components
 * 2. For existing pages, wrap the content with Layout or PageWrapper
 * 3. For new pages, use the examples above as templates
 * 
 * Layout Component Props:
 * - user?: { name: string; email: string; avatar?: string }
 * - onLogout?: () => void
 * - showFooter?: boolean (default: true)
 * - className?: string
 * 
 * PageWrapper Component Props:
 * - user?: { name: string; email: string; avatar?: string }
 * - onLogout?: () => void
 * - className?: string
 * - fullHeight?: boolean (default: false)
 * 
 * Header Component Features:
 * - Responsive navigation menu
 * - User profile dropdown
 * - Active route highlighting
 * - Mobile hamburger menu
 * - Modern gradient design
 * 
 * Footer Component Features:
 * - Multi-column layout
 * - Social media links
 * - Contact information
 * - Legal links
 * - Responsive design
 * - Background patterns
 */

export {
  ExampleFullLayoutPage,
  ExampleAnalysisPage,
  ExampleNoFooterPage,
  ExampleCustomLayoutPage,
  ExampleResponsiveLayoutPage
};