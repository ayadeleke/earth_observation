import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organization: '',
    researchArea: ''
  });
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const researchAreas = [
    'Climate Change',
    'Forest Conservation',
    'Water Resources',
    'Agriculture',
    'Urban Planning',
    'Disaster Management',
    'Biodiversity',
    'Other'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.organization.trim()) newErrors.organization = 'Organization is required';
    if (!formData.researchArea) newErrors.researchArea = 'Research area is required';
    if (!acceptedPrivacyPolicy) newErrors.privacyPolicy = 'You must accept the privacy policy to continue';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      // Prepare data for registration
      const registrationData = {
        email: formData.email,
        // username will be auto-generated from email by backend
        password: formData.password,
        password_confirm: formData.confirmPassword,
        earth_engine_project_id: '' // Optional field, can be left empty
      };

      await register(registrationData);
      alert('Registration successful! You can now log in.');
      navigate('/login');
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Handle different types of errors
      if (error.response?.data) {
        const data = error.response.data;
        if (data.email) {
          setErrors(prev => ({ ...prev, email: Array.isArray(data.email) ? data.email[0] : data.email }));
        }
        if (data.username) {
          setErrors(prev => ({ ...prev, email: Array.isArray(data.username) ? data.username[0] : data.username }));
        }
        if (data.password) {
          setErrors(prev => ({ ...prev, password: Array.isArray(data.password) ? data.password[0] : data.password }));
        }
        if (data.password_confirm) {
          setErrors(prev => ({ ...prev, confirmPassword: Array.isArray(data.password_confirm) ? data.password_confirm[0] : data.password_confirm }));
        }
        if (data.non_field_errors) {
          alert('Registration failed: ' + (Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors));
        }
      } else {
        alert('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100" style={{ 
      background: 'linear-gradient(135deg, #1f2937 0%, #065f46 50%, #1e3a8a 100%)' 
    }}>
      {/* Add styles for better placeholder and error visibility */}
      <style>{`
        .form-control::placeholder {
          color: rgba(255, 255, 255, 0.5) !important;
          opacity: 1 !important;
        }
        .form-control::-webkit-input-placeholder {
          color: rgba(255, 255, 255, 0.5) !important;
        }
        .form-control::-moz-placeholder {
          color: rgba(255, 255, 255, 0.5) !important;
        }
        .form-control:-ms-input-placeholder {
          color: rgba(255, 255, 255, 0.5) !important;
        }
        .error-message {
          color: #ff6b6b !important;
          background-color: rgba(255, 107, 107, 0.1);
          padding: 0.375rem 0.5rem;
          border-radius: 0.25rem;
          font-weight: 500;
          margin-top: 0.25rem;
          display: inline-block;
        }
      `}</style>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5 px-4 py-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white bg-opacity-10 rounded p-4 p-md-5"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              {/* Welcome Message */}
              <div className="text-center mb-4">
                <div className="bg-success rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" 
                     style={{ width: '64px', height: '64px' }}>
                  <User style={{ width: '32px', height: '32px', color: 'white' }} />
                </div>
                <h2 className="h3 fw-bold text-white mb-2">Join Earth Observation</h2>
                <p className="text-light opacity-75">Start monitoring our planet with cutting-edge technology</p>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleSubmit}>
                {/* Name Fields */}
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label text-white fw-semibold">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`form-control bg-dark bg-opacity-75 border text-white ${
                        errors.firstName ? 'border-danger' : 'border-secondary'
                      }`}
                      placeholder="John"
                      style={{ 
                        backgroundColor: 'rgba(33, 37, 41, 0.9)',
                        color: 'white'
                      }}
                    />
                    {errors.firstName && <div className="error-message small">{errors.firstName}</div>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label text-white fw-semibold">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`form-control bg-dark bg-opacity-75 border text-white ${
                        errors.lastName ? 'border-danger' : 'border-secondary'
                      }`}
                      placeholder="Doe"
                      style={{ 
                        backgroundColor: 'rgba(33, 37, 41, 0.9)',
                        color: 'white'
                      }}
                    />
                    {errors.lastName && <div className="error-message small">{errors.lastName}</div>}
                  </div>
                </div>

                {/* Email */}
                <div className="mb-3">
                  <label className="form-label text-white fw-semibold">
                    Email Address
                  </label>
                  <div className="position-relative">
                    <Mail className="position-absolute text-light opacity-50" 
                          style={{ left: '12px', top: '12px', width: '20px', height: '20px' }} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`form-control bg-dark bg-opacity-75 border text-white ${
                        errors.email ? 'border-danger' : 'border-secondary'
                      }`}
                      placeholder="john.doe@example.com"
                      style={{ 
                        paddingLeft: '45px',
                        backgroundColor: 'rgba(33, 37, 41, 0.9)',
                        color: 'white'
                      }}
                    />
                  </div>
                  {errors.email && <div className="error-message small">{errors.email}</div>}
                </div>

                {/* Password */}
                <div className="mb-3">
                  <label className="form-label text-white fw-semibold">
                    Password
                  </label>
                  <div className="position-relative">
                    <Lock className="position-absolute text-light opacity-50" 
                          style={{ left: '12px', top: '12px', width: '20px', height: '20px' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`form-control bg-dark bg-opacity-75 border text-white ${
                        errors.password ? 'border-danger' : 'border-secondary'
                      }`}
                      placeholder="Enter password"
                      style={{ 
                        paddingLeft: '45px',
                        paddingRight: '45px',
                        backgroundColor: 'rgba(33, 37, 41, 0.9)',
                        color: 'white'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="btn position-absolute text-light opacity-50"
                      style={{ right: '8px', top: '6px', border: 'none', background: 'none' }}
                    >
                      {showPassword ? 
                        <EyeOff style={{ width: '20px', height: '20px' }} /> : 
                        <Eye style={{ width: '20px', height: '20px' }} />
                      }
                    </button>
                  </div>
                  {errors.password && <div className="error-message small">{errors.password}</div>}
                </div>

                {/* Confirm Password */}
                <div className="mb-3">
                  <label className="form-label text-white fw-semibold">
                    Confirm Password
                  </label>
                  <div className="position-relative">
                    <Lock className="position-absolute text-light opacity-50" 
                          style={{ left: '12px', top: '12px', width: '20px', height: '20px' }} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`form-control bg-dark bg-opacity-75 border text-white ${
                        errors.confirmPassword ? 'border-danger' : 'border-secondary'
                      }`}
                      placeholder="Confirm password"
                      style={{ 
                        paddingLeft: '45px',
                        paddingRight: '45px',
                        backgroundColor: 'rgba(33, 37, 41, 0.9)',
                        color: 'white'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="btn position-absolute text-light opacity-50"
                      style={{ right: '8px', top: '6px', border: 'none', background: 'none' }}
                    >
                      {showConfirmPassword ? 
                        <EyeOff style={{ width: '20px', height: '20px' }} /> : 
                        <Eye style={{ width: '20px', height: '20px' }} />
                      }
                    </button>
                  </div>
                  {errors.confirmPassword && <div className="error-message small">{errors.confirmPassword}</div>}
                </div>

                {/* Organization */}
                <div className="mb-3">
                  <label className="form-label text-white fw-semibold">
                    Organization
                  </label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    className={`form-control bg-dark bg-opacity-75 border text-white ${
                      errors.organization ? 'border-danger' : 'border-secondary'
                    }`}
                    placeholder="University, Company, or Institution"
                    style={{ 
                      backgroundColor: 'rgba(33, 37, 41, 0.9)',
                      color: 'white'
                    }}
                  />
                  {errors.organization && <div className="error-message small">{errors.organization}</div>}
                </div>

                {/* Research Area */}
                <div className="mb-4">
                  <label className="form-label text-white fw-semibold">
                    Primary Research Area
                  </label>
                  <select
                    name="researchArea"
                    value={formData.researchArea}
                    onChange={handleChange}
                    className={`form-select bg-dark bg-opacity-75 border text-white ${
                      errors.researchArea ? 'border-danger' : 'border-secondary'
                    }`}
                    style={{ 
                      backgroundColor: 'rgba(33, 37, 41, 0.9)',
                      color: 'white'
                    }}
                  >
                    <option value="">Select research area</option>
                    {researchAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                  {errors.researchArea && <div className="error-message small">{errors.researchArea}</div>}
                </div>

                {/* Privacy Policy Checkbox */}
                <div className="mb-3">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="privacyPolicy"
                      checked={acceptedPrivacyPolicy}
                      onChange={(e) => {
                        setAcceptedPrivacyPolicy(e.target.checked);
                        if (errors.privacyPolicy) {
                          setErrors(prev => ({ ...prev, privacyPolicy: '' }));
                        }
                      }}
                    />
                    <label className="form-check-label text-white small" htmlFor="privacyPolicy">
                      I have read and agree to the{' '}
                      <a 
                        href="/privacy-policy" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-info text-decoration-underline"
                      >
                        Privacy Policy
                      </a>
                    </label>
                  </div>
                  {errors.privacyPolicy && <div className="error-message small">{errors.privacyPolicy}</div>}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !acceptedPrivacyPolicy}
                  className="btn btn-primary w-100 py-3 fw-semibold"
                >
                  {loading ? (
                    <div className="d-flex align-items-center justify-content-center">
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      Creating Account...
                    </div>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              {/* Login Link */}
              <div className="mt-4 text-center">
                <p className="text-light opacity-75">
                  Already have an account?{' '}
                  <Link to="/login" className="text-info text-decoration-underline fw-semibold">
                    Login here
                  </Link>
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;