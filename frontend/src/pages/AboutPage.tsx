import React from 'react';
import { 
  Satellite, 
  Globe, 
  Users, 
  Target, 
  Award, 
  Zap,
  Shield,
  BarChart3,
  Leaf,
  Eye,
  TrendingUp,
  CheckCircle,
  User
} from 'lucide-react';

const AboutPage: React.FC = () => {
  const features = [
    {
      icon: Satellite,
      title: 'Multi-Satellite Data',
      description: 'Access to Landsat and Sentinel satellite imagery with comprehensive analysis capabilities.'
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'NDVI, LST, SAR backscatter analysis with time-series visualization and statistical insights.'
    },
    {
      icon: Shield,
      title: 'Cloud Processing',
      description: 'Advanced cloud masking and filtering for accurate optical satellite data analysis.'
    },
    {
      icon: Zap,
      title: 'Real-time Results',
      description: 'Fast processing with intelligent caching for immediate results and improved user experience.'
    },
    {
      icon: Globe,
      title: 'Global Coverage',
      description: 'Analyze any location on Earth with our comprehensive satellite data coverage.'
    },
    {
      icon: TrendingUp,
      title: 'Trend Analysis',
      description: 'Track environmental changes over time with multi-temporal analysis capabilities.'
    }
  ];

  const stats = [
    { number: '40+', label: 'Years of Satellite Data', icon: Satellite },
    { number: '100K+', label: 'Images Processed', icon: Eye },
    { number: '50+', label: 'Countries Covered', icon: Globe },
    { number: '99.9%', label: 'Uptime Reliability', icon: CheckCircle }
  ];

  return (
    <div className="min-vh-100">
      {/* Hero Section */}
      <div className="position-relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3730a3 100%)',
        minHeight: '60vh'
      }}>
        <div className="container py-5">
          <div className="row align-items-center min-vh-50">
            <div className="col-lg-8 mx-auto text-center">
              <div className="mb-4">
                <div className="bg-white bg-opacity-10 rounded-circle p-4 d-inline-flex">
                  <Satellite style={{ width: '64px', height: '64px', color: 'white' }} />
                </div>
              </div>
              <h1 className="display-3 fw-bold text-white mb-4">
                About Earth Observation Platform
              </h1>
              <p className="lead text-light opacity-90 mb-4 fs-5">
                Democratizing access to satellite data analysis with cutting-edge technology 
                and intuitive tools for environmental monitoring and research.
              </p>
              <div className="d-flex justify-content-center gap-3 flex-wrap">
                <span className="badge bg-light text-dark px-3 py-2 fs-6">
                  <Leaf className="me-2" style={{ width: '16px', height: '16px' }} />
                  Environmental Monitoring
                </span>
                <span className="badge bg-light text-dark px-3 py-2 fs-6">
                  <Globe className="me-2" style={{ width: '16px', height: '16px' }} />
                  Global Coverage
                </span>
                <span className="badge bg-light text-dark px-3 py-2 fs-6">
                  <Award className="me-2" style={{ width: '16px', height: '16px' }} />
                  Research Grade
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mission Section */}
      <div className="py-5 bg-light">
        <div className="container">
          <div className="row">
            <div className="col-lg-8 mx-auto">
              <div className="text-center mb-5">
                <Target className="text-primary mb-3" style={{ width: '48px', height: '48px' }} />
                <h2 className="display-5 fw-bold mb-4">Our Mission</h2>
                <p className="lead text-muted">
                  To make satellite-based Earth observation accessible to researchers, environmental scientists, 
                  and organizations worldwide, enabling data-driven decisions for a sustainable future.
                </p>
              </div>
              
              <div className="row g-4 mb-5">
                <div className="col-md-6">
                  <div className="card border-0 h-100 shadow-sm">
                    <div className="card-body p-4">
                      <Eye className="text-success mb-3" style={{ width: '32px', height: '32px' }} />
                      <h5 className="fw-bold mb-3">Our Vision</h5>
                      <p className="text-muted mb-0">
                        A world where environmental monitoring and climate research are powered by 
                        accessible, accurate, and real-time satellite data analysis.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card border-0 h-100 shadow-sm">
                    <div className="card-body p-4">
                      <Users className="text-warning mb-3" style={{ width: '32px', height: '32px' }} />
                      <h5 className="fw-bold mb-3">Our Values</h5>
                      <p className="text-muted mb-0">
                        Open science, data transparency, environmental stewardship, and 
                        collaborative research for the benefit of our planet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-5">
        <div className="container">
          <div className="row g-4 text-center">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={index} className="col-lg-3 col-md-6">
                  <div className="card border-0 h-100 shadow-sm">
                    <div className="card-body p-4">
                      <IconComponent className="text-primary mb-3" style={{ width: '40px', height: '40px' }} />
                      <h3 className="display-6 fw-bold text-primary mb-2">{stat.number}</h3>
                      <p className="text-muted mb-0">{stat.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-5 bg-light">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="display-5 fw-bold mb-4">Platform Capabilities</h2>
            <p className="lead text-muted">
              Comprehensive satellite data analysis tools designed for researchers and environmental professionals.
            </p>
          </div>
          
          <div className="row g-4">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div key={index} className="col-lg-4 col-md-6">
                  <div className="card border-0 h-100 shadow-sm">
                    <div className="card-body p-4">
                      <div className="bg-primary bg-opacity-10 rounded-3 p-3 d-inline-flex mb-3">
                        <IconComponent className="text-primary" style={{ width: '24px', height: '24px' }} />
                      </div>
                      <h5 className="fw-bold mb-3">{feature.title}</h5>
                      <p className="text-muted mb-0">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Technology Section */}
      <div className="py-5 bg-dark text-white">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <h2 className="display-5 fw-bold mb-4">Powered by Google Earth Engine</h2>
              <p className="lead opacity-90 mb-4">
                Our platform leverages Google Earth Engine's planetary-scale analysis capabilities, 
                providing access to petabytes of satellite imagery and geospatial datasets.
              </p>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <CheckCircle className="text-success me-3 mt-1" style={{ width: '20px', height: '20px' }} />
                    <div>
                      <h6 className="fw-bold mb-1">Landsat Archive</h6>
                      <small className="opacity-75">40+ years of data</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <CheckCircle className="text-success me-3 mt-1" style={{ width: '20px', height: '20px' }} />
                    <div>
                      <h6 className="fw-bold mb-1">Sentinel Data</h6>
                      <small className="opacity-75">High-resolution monitoring</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <CheckCircle className="text-success me-3 mt-1" style={{ width: '20px', height: '20px' }} />
                    <div>
                      <h6 className="fw-bold mb-1">Cloud Computing</h6>
                      <small className="opacity-75">Scalable processing</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex align-items-start">
                    <CheckCircle className="text-success me-3 mt-1" style={{ width: '20px', height: '20px' }} />
                    <div>
                      <h6 className="fw-bold mb-1">Real-time Analysis</h6>
                      <small className="opacity-75">Instant results</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="bg-white bg-opacity-10 rounded-4 p-5 text-center">
                <Globe style={{ width: '120px', height: '120px', color: 'white' }} className="mb-4 opacity-75" />
                <h4 className="fw-bold mb-3">Global Earth Monitoring</h4>
                <p className="opacity-75 mb-0">
                  Analyze vegetation health, land surface temperature, and environmental changes 
                  anywhere on Earth with scientific-grade accuracy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact CTA */}
      <div className="py-5 bg-primary">
        <div className="container">
          <div className="row">
            <div className="col-lg-8 mx-auto text-center">
              <h2 className="display-5 fw-bold text-white mb-4">
                Ready to Explore Earth from Space?
              </h2>
              <p className="lead text-light opacity-90 mb-4">
                Join researchers and organizations worldwide using our platform for environmental monitoring and analysis.
              </p>
              <div className="d-flex justify-content-center gap-3 flex-wrap">
                <a href="/register" className="btn btn-light btn-lg px-4 fw-semibold">
                  Get Started Free
                </a>
                <a href="/demo" className="btn btn-outline-light btn-lg px-4 fw-semibold">
                  Try Demo
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;