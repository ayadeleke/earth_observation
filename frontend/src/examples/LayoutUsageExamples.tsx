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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p>Your page content goes here...</p>
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
      <div className="h-full flex flex-col">
        <div className="flex-1 p-4">
          <h1 className="text-2xl font-bold mb-4">NDVI Analysis</h1>
          <div className="h-96 bg-gray-200 rounded-lg flex items-center justify-center">
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Page with Header Only
          </h1>
          <p className="text-gray-600">
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
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Custom Layout
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              This page uses Header and Footer separately for maximum flexibility
            </p>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <p className="text-gray-700">
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
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Responsive User Layout
          </h1>
          
          {user ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-green-800 mb-2">
                Welcome back, {user.name}!
              </h2>
              <p className="text-green-600">
                You are logged in as {user.email}
              </p>
              <button
                onClick={handleLogout}
                className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-blue-800 mb-2">
                Please log in
              </h2>
              <p className="text-blue-600 mb-4">
                Login to access all features
              </p>
              <button
                onClick={handleLogin}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
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