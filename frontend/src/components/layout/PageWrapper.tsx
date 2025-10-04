import React from 'react';
import Header from './Header';

interface PageWrapperProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  onLogout?: () => void;
  className?: string;
  fullHeight?: boolean;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ 
  children, 
  user, 
  onLogout, 
  className = "",
  fullHeight = false
}) => {
  return (
    <div className={`${fullHeight ? 'min-vh-100' : ''} d-flex flex-column bg-light ${className}`}>
      <Header user={user} onLogout={onLogout} />
      
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default PageWrapper;