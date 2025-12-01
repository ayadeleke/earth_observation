import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-vh-100 bg-light">
      {/* Header */}
      <div className="bg- text-white py-4" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #073317 50%, #064e3b 100%)' }}>
        <div className="container">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3 mb-0">Privacy Policy</h1>
            <button 
              className="btn btn-outline-light btn-sm"
              onClick={() => navigate('/')}
            >
              <i className="fas fa-arrow-left me-2"></i>
              Back to Home
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="card shadow-sm">
            <div className="card-body p-4 p-md-5">
              {/* Last Updated */}
              <p className="text-muted mb-4">
                <small><strong>Last Updated:</strong> October 20, 2025</small>
              </p>

              {/* Introduction */}
              <section className="mb-5">
                <h2 className="h4 text-primary mb-3">Our Commitment to Your Privacy</h2>
                <p className="text-muted">
                  This forest monitoring application is built on principles of transparency, data protection, 
                  and ethical responsibility. We are committed to safeguarding your privacy while providing 
                  powerful geospatial analysis tools for environmental research and conservation.
                </p>
              </section>

              {/* Data We Collect */}
              <section className="mb-5">
                <h2 className="h4 text-primary mb-3">
                  <i className="fas fa-database me-2"></i>
                  Data We Collect
                </h2>
                <div className="bg-light p-4 rounded">
                  <h3 className="h6 fw-bold mb-3">Minimal Personal Information</h3>
                  <ul className="mb-0">
                    <li className="mb-2">
                      <strong>Email Address:</strong> Used for account creation and login
                    </li>
                    <li className="mb-2">
                      <strong>Password:</strong> Securely hashed using Django's authentication system before storage
                    </li>
                    <li className="mb-0">
                      <strong>Analysis History:</strong> Your saved projects and results to enable continuity
                    </li>
                  </ul>
                  <div className="alert alert-info mt-3 mb-0">
                    <i className="fas fa-info-circle me-2"></i>
                    <strong>Note:</strong> We do NOT collect any other personal information. All satellite data 
                    used is open-source from Google Earth Engine (Landsat and Sentinel).
                  </div>
                </div>
              </section>

              {/* How We Protect Your Data */}
              <section className="mb-5">
                <h2 className="h4 text-primary mb-3">
                  <i className="fas fa-shield-alt me-2"></i>
                  How We Protect Your Data
                </h2>
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="card h-100 border-success">
                      <div className="card-body">
                        <h3 className="h6 text-success">
                          <i className="fas fa-lock me-2"></i>
                          Encryption
                        </h3>
                        <p className="small mb-0">
                          All data is encrypted and stored securely on Microsoft Azure cloud platform 
                          using industry-standard encryption protocols.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card h-100 border-success">
                      <div className="card-body">
                        <h3 className="h6 text-success">
                          <i className="fas fa-key me-2"></i>
                          Password Security
                        </h3>
                        <p className="small mb-0">
                          Passwords are hashed using Django's secure hashing algorithms and never 
                          stored in plain text.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card h-100 border-success">
                      <div className="card-body">
                        <h3 className="h6 text-success">
                          <i className="fas fa-network-wired me-2"></i>
                          Secure Transmission
                        </h3>
                        <p className="small mb-0">
                          All data transmission is protected using TLS/SSL protocols, ensuring 
                          end-to-end encryption.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card h-100 border-success">
                      <div className="card-body">
                        <h3 className="h6 text-success">
                          <i className="fas fa-save me-2"></i>
                          Automated Backups
                        </h3>
                        <p className="small mb-0">
                          Regular automated backups prevent data loss while maintaining security 
                          and integrity.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Your Rights */}
              <section className="mb-5">
                <h2 className="h4 text-primary mb-3">
                  <i className="fas fa-user-check me-2"></i>
                  Your Rights & Control
                </h2>
                <div className="bg-warning bg-opacity-10 p-4 rounded border border-warning">
                  <h3 className="h6 fw-bold mb-3">You Own Your Data</h3>
                  <p className="mb-3">
                    In compliance with the Nigerian Data Protection Regulation (NDPR, 2019) and European 
                    Data Protection Board (EDPB) principles, you have complete control over your data:
                  </p>
                  <ul className="mb-0">
                    <li className="mb-2">
                      <strong>Access:</strong> View all your stored data and analysis history anytime
                    </li>
                    <li className="mb-2">
                      <strong>Export:</strong> Download your projects and results in CSV or JSON format
                    </li>
                    <li className="mb-2">
                      <strong>Delete:</strong> Remove your account and all associated data permanently from your 
                      settings page—no approval needed
                    </li>
                    <li className="mb-0">
                      <strong>Withdraw Consent:</strong> Stop using the service at any time without penalties
                    </li>
                  </ul>
                </div>
              </section>

              {/* Data Usage */}
              <section className="mb-5">
                <h2 className="h4 text-primary mb-3">
                  <i className="fas fa-chart-line me-2"></i>
                  How We Use Your Data
                </h2>
                <div className="list-group">
                  <div className="list-group-item">
                    <i className="fas fa-check-circle text-success me-2"></i>
                    <strong>Account Management:</strong> Authenticate your login and maintain your session
                  </div>
                  <div className="list-group-item">
                    <i className="fas fa-check-circle text-success me-2"></i>
                    <strong>Project Continuity:</strong> Save your analysis results so you can return anytime
                  </div>
                  <div className="list-group-item">
                    <i className="fas fa-check-circle text-success me-2"></i>
                    <strong>Service Improvement:</strong> Understand usage patterns to enhance functionality
                  </div>
                  <div className="list-group-item bg-light">
                    <i className="fas fa-times-circle text-danger me-2"></i>
                    <strong>NOT Used For:</strong> Marketing, selling to third parties, or any commercial purposes
                  </div>
                </div>
              </section>

              {/* Open Source & Transparency */}
              <section className="mb-5">
                <h2 className="h4 text-primary mb-3">
                  <i className="fas fa-code me-2"></i>
                  Open Source & Transparency
                </h2>
                <p className="text-muted mb-3">
                  This application is built on open-source principles and uses publicly available algorithms:
                </p>
                <ul className="text-muted">
                  <li className="mb-2">
                    <strong>Google Earth Engine (GEE):</strong> All satellite data and analysis algorithms are 
                    properly credited to GEE and its scientific publications
                  </li>
                  <li className="mb-2">
                    <strong>Open-Source Libraries:</strong> NumPy, GeoPandas, Django, and React are used in 
                    accordance with their respective licenses (MIT, BSD, Apache 2.0)
                  </li>
                </ul>
              </section>

              {/* Data Accuracy */}
              <section className="mb-5">
                <h2 className="h4 text-primary mb-3">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  Data Accuracy & Limitations
                </h2>
                <div className="alert alert-warning">
                  <h3 className="h6 fw-bold mb-2">Important Notice</h3>
                  <p className="small mb-2">
                    This application uses satellite imagery and automated analysis. While we strive for accuracy:
                  </p>
                  <ul className="small mb-2">
                    <li className="mb-1">
                      Results should be validated against ground-truth data when possible
                    </li>
                    <li className="mb-1">
                      Cloud cover, sensor limitations, and atmospheric conditions may affect data quality
                    </li>
                    <li className="mb-0">
                      Users should not draw conclusions beyond what the application can reliably support
                    </li>
                  </ul>
                  <p className="small mb-0">
                    <strong>If anomalies are discovered:</strong> Please kindly document and reach out to us via the contact page.
                  </p>
                </div>
              </section>

              {/* Compliance */}
              <section className="mb-5">
                <h2 className="h4 text-primary mb-3">
                  <i className="fas fa-balance-scale me-2"></i>
                  Legal Compliance
                </h2>
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="text-center p-3 border rounded">
                      <i className="fas fa-flag text-success fs-3 mb-2"></i>
                      <h3 className="h6 fw-bold">NDPR</h3>
                      <p className="small text-muted mb-0">
                        Nigerian Data Protection Regulation
                      </p>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="text-center p-3 border rounded">
                      <i className="fas fa-globe-europe text-primary fs-3 mb-2"></i>
                      <h3 className="h6 fw-bold">EDPB</h3>
                      <p className="small text-muted mb-0">
                        European Data Protection Board Principles
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Contact */}
              <section className="mb-4">
                <h2 className="h4 text-primary mb-3">
                  <i className="fas fa-envelope me-2"></i>
                  Questions or Concerns?
                </h2>
                <p className="text-muted mb-3">
                  We are committed to transparency and accountability. If you have questions about this 
                  privacy policy or how your data is handled:
                </p>
                <div className="d-flex gap-3 flex-wrap">
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/contact')}
                  >
                    <i className="fas fa-paper-plane me-2"></i>
                    Contact Us
                  </button>
                  <button 
                    className="btn btn-outline-secondary"
                    onClick={() => navigate('/settings')}
                  >
                    <i className="fas fa-cog me-2"></i>
                    Manage Your Data
                  </button>
                </div>
              </section>

              {/* Footer */}
              <hr className="my-4" />
              <div className="text-center text-muted">
                <p className="small mb-2">
                  Built with transparency, integrity, and respect for your privacy
                </p>
                <p className="small mb-0">
                  © 2025 Earth Observation Forest Monitoring Application. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
