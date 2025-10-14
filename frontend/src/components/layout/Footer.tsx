import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Satellite, 
  Github, 
  Twitter, 
  Linkedin, 
  Mail, 
  MapPin,
  Phone,
  Globe,
  BarChart3,
  FileText,
  Shield,
  HelpCircle,
  BookOpen
} from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const productLinks = [
    { href: '/analysis', label: 'NDVI Analysis', icon: BarChart3 },
    { href: '/analysis', label: 'LST Analysis', icon: Globe },
    { href: '/analysis', label: 'SAR Analysis', icon: BarChart3 },
    { href: '/demo', label: 'Demo', icon: Globe },
  ];

  const companyLinks = [
    { href: '/about', label: 'About Us' },
    { href: '/#', label: 'Contact' },
    { href: '/#', label: 'Careers' },
    { href: '/#', label: 'Blog' },
  ];

  const resourceLinks = [
    { href: '/docs', label: 'Documentation', icon: FileText },
    { href: '/tutorials', label: 'Tutorials', icon: BookOpen },
    { href: '/support', label: 'Support', icon: HelpCircle },
  ];

  const legalLinks = [
    { href: '/privacy', label: 'Privacy Policy', icon: Shield },
    { href: '/terms', label: 'Terms of Service' },
    { href: '/cookies', label: 'Cookie Policy' },
    { href: '/compliance', label: 'Compliance' },
  ];

  return (
    <footer className="text-white" style={{
      background: 'linear-gradient(135deg, #212529 0%, #1e3a8a 50%, #3730a3 100%)'
    }}>
      {/* Main Footer Content */}
      <div className="container py-5">
        <div className="row g-4">
          {/* Brand Section */}
          <div className="col-lg-4 col-md-6">
            <div className="d-flex align-items-center mb-4">
              <div className="p-3 bg-white bg-opacity-10 rounded me-3" style={{ backdropFilter: 'blur(10px)' }}>
                <Satellite style={{ width: '32px', height: '32px', color: 'white' }} />
              </div>
              <div>
                <h3 className="h4 fw-bold mb-0">Earth Observation</h3>
                <p className="small text-info mb-0">Analysis Platform</p>
              </div>
            </div>
            
            <p className="text-light mb-4" style={{ maxWidth: '350px', lineHeight: '1.6' }}>
              Advanced satellite data analysis platform powered by Google Earth Engine. 
              Monitor vegetation, temperature, and surface changes with precision and ease.
            </p>

            {/* Contact Info */}
            <div className="mb-4">
              <div className="d-flex align-items-center mb-2 small text-light">
                <MapPin style={{ width: '16px', height: '16px' }} className="text-info me-2" />
                <span>Global Coverage • Cloud-Based Analysis</span>
              </div>
              <div className="d-flex align-items-center mb-2 small text-light">
                <Mail style={{ width: '16px', height: '16px' }} className="text-info me-2" />
                <a href="mailto:support@earthobservation.com" className="text-light text-decoration-none">
                  support@earthobservation.com
                </a>
              </div>
              <div className="d-flex align-items-center mb-2 small text-light">
                <Phone style={{ width: '16px', height: '16px' }} className="text-info me-2" />
                <span>24/7 Support Available</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="d-flex gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-light btn-sm d-flex align-items-center justify-content-center"
                style={{ width: '40px', height: '40px' }}
                aria-label="GitHub"
              >
                <Github style={{ width: '20px', height: '20px' }} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-light btn-sm d-flex align-items-center justify-content-center"
                style={{ width: '40px', height: '40px' }}
                aria-label="Twitter"
              >
                <Twitter style={{ width: '20px', height: '20px' }} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-light btn-sm d-flex align-items-center justify-content-center"
                style={{ width: '40px', height: '40px' }}
                aria-label="LinkedIn"
              >
                <Linkedin style={{ width: '20px', height: '20px' }} />
              </a>
            </div>
          </div>

          {/* Products & Services */}
          <div className="col-lg-2 col-md-6 col-sm-6">
            <h4 className="h5 fw-semibold mb-3 text-white">Products</h4>
            <ul className="list-unstyled">
              {productLinks.map((link, index) => {
                const IconComponent = link.icon;
                return (
                  <li key={`${link.href}-${link.label}-${index}`} className="mb-2">
                    <Link
                      to={link.href}
                      className="d-flex align-items-center text-light text-decoration-none opacity-75"
                    >
                      {IconComponent && <IconComponent style={{ width: '16px', height: '16px' }} className="text-info me-2" />}
                      <span className="small">{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Resources */}
          <div className="col-lg-2 col-md-6 col-sm-6">
            <h4 className="h5 fw-semibold mb-3 text-white">Resources</h4>
            <ul className="list-unstyled">
              {resourceLinks.map((link, index) => {
                const IconComponent = link.icon;
                return (
                  <li key={`${link.href}-${link.label}-${index}`} className="mb-2">
                    <Link
                      to={link.href}
                      className="d-flex align-items-center text-light text-decoration-none opacity-75"
                    >
                      {IconComponent && <IconComponent style={{ width: '16px', height: '16px' }} className="text-info me-2" />}
                      <span className="small">{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Company & Legal */}
          <div className="col-lg-4 col-md-6">
            <div className="row">
              <div className="col-6">
                <h4 className="h5 fw-semibold mb-3 text-white">Company</h4>
                <ul className="list-unstyled mb-4">
                  {companyLinks.map((link, index) => (
                    <li key={`${link.href}-${link.label}-${index}`} className="mb-2">
                      <Link
                        to={link.href}
                        className="text-light text-decoration-none opacity-75 small"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="col-6">
                <h4 className="h5 fw-semibold mb-3 text-white">Legal</h4>
                <ul className="list-unstyled">
                  {legalLinks.slice(0, 2).map((link, index) => {
                    const IconComponent = link.icon;
                    return (
                      <li key={`${link.href}-${link.label}-${index}`} className="mb-2">
                        <Link
                          to={link.href}
                          className="d-flex align-items-center text-light text-decoration-none opacity-75"
                        >
                          {IconComponent && <IconComponent style={{ width: '16px', height: '16px' }} className="text-info me-2" />}
                          <span className="small">{link.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-top border-light border-opacity-25">
        <div className="container py-4">
          <div className="row align-items-center">
            <div className="col-md-6 text-center text-md-start mb-3 mb-md-0">
              <div className="d-flex flex-column flex-sm-row align-items-center justify-content-center justify-content-md-start small text-light opacity-75">
                <span>© {currentYear} Earth Observation Platform.</span>
                <span className="d-none d-md-inline ms-2">All rights reserved.</span>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="d-flex flex-column flex-sm-row align-items-center justify-content-center justify-content-md-end gap-3 small">
                <div className="d-flex align-items-center text-light opacity-75">
                  <Globe style={{ width: '16px', height: '16px' }} className="text-info me-2" />
                  <span>Powered by Google Earth Engine</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;