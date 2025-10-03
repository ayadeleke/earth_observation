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
  Heart
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
    { href: '/contact', label: 'Contact' },
    { href: '/careers', label: 'Careers' },
    { href: '/blog', label: 'Blog' },
  ];

  const resourceLinks = [
    { href: '/docs', label: 'Documentation', icon: FileText },
    { href: '/api', label: 'API Reference' },
    { href: '/tutorials', label: 'Tutorials' },
    { href: '/support', label: 'Support' },
  ];

  const legalLinks = [
    { href: '/privacy', label: 'Privacy Policy', icon: Shield },
    { href: '/terms', label: 'Terms of Service' },
    { href: '/cookies', label: 'Cookie Policy' },
    { href: '/compliance', label: 'Compliance' },
  ];

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 text-white">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                <Satellite className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Earth Observation</h3>
                <p className="text-sm text-blue-200">Analysis Platform</p>
              </div>
            </div>
            
            <p className="text-gray-300 mb-6 max-w-md leading-relaxed">
              Advanced satellite data analysis platform powered by Google Earth Engine. 
              Monitor vegetation, temperature, and surface changes with precision and ease.
            </p>

            {/* Contact Info */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <MapPin className="h-4 w-4 text-blue-400" />
                <span>Global Coverage • Cloud-Based Analysis</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <Mail className="h-4 w-4 text-blue-400" />
                <a href="mailto:support@earthobservation.com" className="hover:text-white transition-colors">
                  support@earthobservation.com
                </a>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <Phone className="h-4 w-4 text-blue-400" />
                <span>24/7 Support Available</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex space-x-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Products & Services */}
          <div>
            <h4 className="text-lg font-semibold mb-6 text-white">Products</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors group"
                    >
                      {IconComponent && <IconComponent className="h-4 w-4 text-blue-400 group-hover:text-blue-300" />}
                      <span>{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-lg font-semibold mb-6 text-white">Resources</h4>
            <ul className="space-y-3">
              {resourceLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors group"
                    >
                      {IconComponent && <IconComponent className="h-4 w-4 text-blue-400 group-hover:text-blue-300" />}
                      <span>{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Company & Legal */}
          <div>
            <h4 className="text-lg font-semibold mb-6 text-white">Company</h4>
            <ul className="space-y-3 mb-8">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h4 className="text-lg font-semibold mb-4 text-white">Legal</h4>
            <ul className="space-y-3">
              {legalLinks.slice(0, 2).map((link) => {
                const IconComponent = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors group"
                    >
                      {IconComponent && <IconComponent className="h-4 w-4 text-blue-400 group-hover:text-blue-300" />}
                      <span>{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span>© {currentYear} Earth Observation Platform.</span>
              <span className="hidden md:inline">All rights reserved.</span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2 text-gray-400">
                <Globe className="h-4 w-4 text-blue-400" />
                <span>Powered by Google Earth Engine</span>
              </div>
              
              <div className="flex items-center space-x-1 text-gray-400">
                <span>Made with</span>
                <Heart className="h-4 w-4 text-red-400 fill-current" />
                <span>for Earth</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-transparent to-purple-500/20"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[length:24px_24px]"></div>
      </div>
    </footer>
  );
};

export default Footer;