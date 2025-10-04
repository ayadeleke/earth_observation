import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    
    try {
      const response = await fetch('http://localhost:8000/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication tokens
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        localStorage.setItem('user_data', JSON.stringify(data.user));
        
        // Remember me functionality
        if (formData.rememberMe) {
          localStorage.setItem('remember_me', 'true');
        }
        
        console.log('Login successful:', data);
        alert('Login successful! Redirecting to dashboard...');
        navigate('/dashboard');
      } else {
        // Handle validation errors
        if (data.non_field_errors) {
          setErrors({ form: data.non_field_errors[0] });
        } else if (data.email) {
          setErrors({ email: Array.isArray(data.email) ? data.email[0] : data.email });
        } else if (data.password) {
          setErrors({ password: Array.isArray(data.password) ? data.password[0] : data.password });
        } else {
          setErrors({ form: 'Login failed. Please check your credentials.' });
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ form: 'Network error. Please check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // TODO: Implement Google OAuth
    console.log('Google login clicked');
    alert('Google OAuth login is not yet implemented. Please use email/password login or demo access.');
  };

  const handleDemoLogin = () => {
    // Set demo user data for limited access
    const demoUser = {
      id: 'demo',
      email: 'demo@earthobservation.com',
      username: 'demo_user',
      first_name: 'Demo',
      last_name: 'User'
    };
    
    localStorage.setItem('demo_mode', 'true');
    localStorage.setItem('user_data', JSON.stringify(demoUser));
    
    console.log('Demo login successful');
    alert('Demo login successful! You now have limited access to the platform.');
    navigate('/dashboard');
  };

  return (
    <div className="min-vh-100" style={{ 
      background: 'linear-gradient(135deg, #1f2937 0%, #065f46 50%, #1e3a8a 100%)' 
    }}>
      {/* Header */}
      <div className="bg-dark bg-opacity-20">
        <div className="container py-4">
          <div className="row align-items-center">
            <div className="col-4">
              <Link to="/" className="text-white text-decoration-none d-flex align-items-center">
                <ArrowLeft style={{ width: '20px', height: '20px' }} className="me-2" />
                Back to Home
              </Link>
            </div>
            <div className="col-4 text-center">
              <h1 className="h3 fw-bold text-white mb-0">Sign In</h1>
            </div>
            <div className="col-4"></div>
          </div>
        </div>
      </div>

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
                <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" 
                     style={{ width: '64px', height: '64px' }}>
                  <LogIn style={{ width: '32px', height: '32px', color: 'white' }} />
                </div>
                <h2 className="h3 fw-bold text-white mb-2">Welcome Back</h2>
                <p className="text-light opacity-75">Continue your Earth observation journey</p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit}>
                {/* Form-level errors */}
                {errors.form && (
                  <div className="alert alert-danger bg-danger bg-opacity-25 border-danger mb-3">
                    <p className="text-danger small mb-0">{errors.form}</p>
                  </div>
                )}

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
                  {errors.email && <div className="text-danger small mt-1">{errors.email}</div>}
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
                  {errors.password && <div className="text-danger small mt-1">{errors.password}</div>}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      id="rememberMe"
                    />
                    <label className="form-check-label text-light opacity-75 small" htmlFor="rememberMe">
                      Remember me
                    </label>
                  </div>
                  <Link to="/forgot-password" className="text-info text-decoration-none small">
                    Forgot password?
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn w-100 py-3 fw-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #16a34a 100%)',
                    border: 'none',
                    color: 'white'
                  }}
                >
                  {loading ? (
                    <div className="d-flex align-items-center justify-content-center">
                      <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      Signing In...
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="d-flex align-items-center my-4">
                <hr className="flex-grow-1 border-secondary" />
                <span className="px-3 text-light opacity-50 small">or</span>
                <hr className="flex-grow-1 border-secondary" />
              </div>

              {/* Alternative Login Options */}
              <div className="d-grid gap-2">
                {/* Google Login */}
                <button
                  onClick={handleGoogleLogin}
                  className="btn btn-outline-light py-3 fw-semibold d-flex align-items-center justify-content-center"
                >
                  <svg style={{ width: '20px', height: '20px' }} className="me-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Demo Login */}
                <button
                  onClick={handleDemoLogin}
                  className="btn btn-warning py-3 fw-semibold"
                >
                  🚀 Quick Demo Access
                </button>
              </div>

              {/* Register Link */}
              <div className="mt-4 text-center">
                <p className="text-light opacity-75">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-info text-decoration-none fw-semibold">
                    Create one here
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

export default LoginPage;