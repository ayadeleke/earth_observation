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
    <div className={`${fullHeight ? 'min-h-screen' : ''} flex flex-col bg-gray-50 ${className}`}>
      <Header user={user} onLogout={onLogout} />
      
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default PageWrapper;