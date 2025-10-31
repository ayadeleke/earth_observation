import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Send, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://earthobservationapi.azurewebsites.net/api/v1';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate email
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/password-reset/`, {
        email: email.toLowerCase(),
      });

      if (response.status === 200) {
        setSuccess(true);
        setEmail('');
      }
    } catch (err: any) {
      console.error('Password reset request error:', err);
      
      if (err.response?.data?.email) {
        setError(err.response.data.email[0]);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('An error occurred. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-50" style={{ 
      background: 'linear-gradient(135deg, #1f2937 0%, #065f46 50%, #1e3a8a 100%)' 
    }}>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5 px-4 py-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white bg-opacity-10 rounded p-4 p-md-5"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              {/* Header */}
              <div className="text-center mb-4">
                <div className="bg-success rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" 
                     style={{ width: '64px', height: '64px' }}>
                  <Mail style={{ width: '32px', height: '32px', color: 'white' }} />
                </div>
                <h2 className="h3 fw-bold text-white mb-2">Forgot Password?</h2>
                <p className="text-white-50">
                  No worries! Enter your email and we'll send you reset instructions.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="alert alert-danger mb-3"
                >
                  {error}
                </motion.div>
              )}

              {/* Success State */}
              {success ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="alert alert-success mb-3">
                    <div className="d-flex align-items-start">
                      <CheckCircle style={{ width: '24px', height: '24px' }} className="me-2 flex-shrink-0 mt-1" />
                      <div>
                        <h6 className="fw-bold mb-1">Email Sent!</h6>
                        <p className="mb-0 small">
                          If an account with that email exists, a password reset link has been sent. 
                          Please check your inbox and spam folder.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-info mb-3">
                    <h6 className="fw-bold mb-2">Didn't receive the email?</h6>
                    <ul className="mb-0 small">
                      <li>Check your spam or junk folder</li>
                      <li>Make sure you entered the correct email</li>
                      <li>Wait a few minutes and check again</li>
                      <li>Try requesting another reset link</li>
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setSuccess(false);
                      setEmail('');
                    }}
                    className="btn btn-outline-light w-100 d-flex align-items-center justify-content-center"
                  >
                    <Mail style={{ width: '20px', height: '20px' }} className="me-2" />
                    Send Another Reset Link
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label text-white">Email Address</label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <Mail style={{ width: '20px', height: '20px' }} />
                      </span>
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        required
                        className="form-control"
                      />
                    </div>
                    <small className="form-text text-white-50">
                      We'll never share your email with anyone else.
                    </small>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="btn btn-success w-100 d-flex align-items-center justify-content-center"
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Sending Reset Link...
                      </>
                    ) : (
                      <>
                        <Send style={{ width: '20px', height: '20px' }} className="me-2" />
                        Send Reset Link
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Footer Links */}
              <div className="mt-4 pt-3 border-top border-white border-opacity-25">
                <p className="text-center text-white-50 mb-0">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-white fw-bold text-decoration-none">
                    Sign up
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

export default ForgotPasswordPage;
