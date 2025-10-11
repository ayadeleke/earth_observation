import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Satellite, 
  Menu, 
  X, 
  Home, 
  BarChart3, 
  Globe, 
  Settings, 
  User,
  LogOut,
  LogIn,
  UserPlus,
  Layout as LayoutIcon,
  FolderOpen,
  Info
} from 'lucide-react';

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Navigation items that are always visible
  const publicNavigationItems = [
    { path: '/', label: 'Home', icon: Home },
    // Only show demo for non-authenticated users
    ...(user ? [] : [{ path: '/demo', label: 'Demo', icon: Globe }]),
  ];

  // Navigation items only visible to authenticated users
  const authenticatedNavigationItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutIcon },
    { path: '/analysis', label: 'Analysis', icon: BarChart3 },
    { path: '/projects', label: 'Projects', icon: FolderOpen },
    { path: '/about', label: 'About', icon: Info },
  ];

  // Combine navigation items based on authentication status
  const navigationItems = user
    ? [...publicNavigationItems, ...authenticatedNavigationItems]
    : [...publicNavigationItems, { path: '/about', label: 'About', icon: Info }];

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    navigate('/login');
  };

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="navbar navbar-expand-lg navbar-dark position-sticky top-0" style={{ 
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3730a3 100%)',
      zIndex: 1050
    }}>
      <div className="container-fluid">
        {/* Logo and Brand */}
        <Link to="/" className="navbar-brand d-flex align-items-center text-decoration-none">
          <div className="p-2 bg-white bg-opacity-10 rounded me-3 d-flex align-items-center justify-content-center">
            <Satellite style={{ width: '32px', height: '32px', color: 'white' }} />
          </div>
          <div>
            <h1 className="h5 fw-bold text-white mb-0">Earth Observation</h1>
            <small className="text-light opacity-75">Analysis Platform</small>
          </div>
        </Link>

        {/* Mobile Menu Button */}
        <button
          className="navbar-toggler border-0"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? (
            <X style={{ width: '24px', height: '24px', color: 'white' }} />
          ) : (
            <Menu style={{ width: '24px', height: '24px', color: 'white' }} />
          )}
        </button>

        {/* Navigation */}
        <div className={`collapse navbar-collapse ${isMenuOpen ? 'show' : ''}`} id="navbarNav">
          {/* Desktop Navigation */}
          <nav className="navbar-nav mx-auto">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = isActivePath(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link d-flex align-items-center px-3 py-2 me-1 ${
                    isActive
                      ? 'text-white fw-semibold'
                      : 'text-light opacity-75'
                  }`}
                  style={isActive ? { borderBottom: `2px solid #789af7` } : {}}
                >
                  <IconComponent style={{ width: '16px', height: '16px' }} className="me-2" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="navbar-nav">
            {user ? (
              <div className="nav-item dropdown">
                <button
                  className="nav-link dropdown-toggle d-flex align-items-center border-0 bg-transparent"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <div className="rounded-circle d-flex align-items-center justify-content-center me-2" 
                        style={{ 
                          width: '32px', 
                          height: '32px', 
                          background: 'linear-gradient(135deg, #60a5fa 0%, #a855f7 100%)' 
                        }}>
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="rounded-circle" style={{ width: '32px', height: '32px' }} />
                    ) : (
                      <User style={{ width: '16px', height: '16px', color: 'white' }} />
                    )}
                  </div>
                  <div className="d-none d-md-block text-start">
                    <div className="small fw-semibold text-white">{user.name}</div>
                    <div className="small text-light opacity-75">{user.email}</div>
                  </div>
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="dropdown-menu dropdown-menu-end show position-absolute bg-white border shadow-lg rounded" style={{ top: '100%', right: '0', minWidth: '200px' }}>
                    <div className="px-3 py-2 border-bottom">
                      <div className="small fw-semibold text-dark">{user.name}</div>
                      <div className="small text-muted">{user.email}</div>
                    </div>
                    <Link to="/dashboard" className="dropdown-item d-flex align-items-center">
                      <LayoutIcon style={{ width: '16px', height: '16px' }} className="me-2" />
                      Dashboard
                    </Link>
                    <Link to="/settings" className="dropdown-item d-flex align-items-center">
                      <Settings style={{ width: '16px', height: '16px' }} className="me-2" />
                      Settings
                    </Link>
                    <div className="dropdown-divider"></div>
                    <button onClick={handleLogout} className="dropdown-item d-flex align-items-center text-danger">
                      <LogOut style={{ width: '16px', height: '16px' }} className="me-2" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="nav-item dropdown">
                <button
                  className="nav-link dropdown-toggle d-flex align-items-center border-0 bg-transparent text-light"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <User style={{ width: '16px', height: '16px' }} className="me-2" />
                  Account
                </button>

                {/* Account Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="dropdown-menu dropdown-menu-end show position-absolute bg-white border shadow-lg rounded" style={{ top: '100%', right: '0', minWidth: '160px' }}>
                    <Link to="/login" className="dropdown-item d-flex align-items-center">
                      <LogIn style={{ width: '16px', height: '16px' }} className="me-2" />
                      Sign In
                    </Link>
                    <Link to="/register" className="dropdown-item d-flex align-items-center">
                      <UserPlus style={{ width: '16px', height: '16px' }} className="me-2" />
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;