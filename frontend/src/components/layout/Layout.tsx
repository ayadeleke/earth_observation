import React from 'react';
import Header from './Header';
import Footer from './Footer';
import AIAssistant from '../ai/AIAssistant';
import { useAuth } from '../../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  onLogout?: () => void;
  showFooter?: boolean;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  user, 
  onLogout, 
  showFooter = true,
  className = "" 
}) => {
  const { isAuthenticated } = useAuth();

  return (
    <div className={`min-vh-100 d-flex flex-column bg-light ${className}`}>
      <Header user={user} onLogout={onLogout} />
      
      <main className="flex-1">
        {children}
      </main>
      
      {showFooter && <Footer />}
      
      {/* Global AI Assistant - only show for authenticated users */}
      {isAuthenticated && (
        <AIAssistant 
          analysisData={null} 
          className="global-ai-assistant"
        />
      )}
    </div>
  );
};

export default Layout;