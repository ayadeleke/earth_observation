import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  feedback: string[];
}

const ResetPasswordPage: React.FC = () => {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  useEffect(() => {
    if (!uid || !token) {
      setError('Invalid password reset link. Please request a new one.');
    }
  }, [uid, token]);

  useEffect(() => {
    if (newPassword) {
      const strength = calculatePasswordStrength(newPassword);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  }, [newPassword]);

  const calculatePasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score++;
    else feedback.push('At least 8 characters');

    if (password.length >= 12) score++;

    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
      score++;
    } else {
      feedback.push('Mix of uppercase and lowercase');
    }

    if (/\d/.test(password)) {
      score++;
    } else {
      feedback.push('Include numbers');
    }

    if (/[^A-Za-z0-9]/.test(password)) {
      score++;
    } else {
      feedback.push('Include special characters');
    }

    let label = '';
    let color = '';

    if (score <= 1) {
      label = 'Weak';
      color = 'red';
    } else if (score <= 3) {
      label = 'Fair';
      color = 'yellow';
    } else if (score <= 4) {
      label = 'Good';
      color = 'blue';
    } else {
      label = 'Strong';
      color = 'white';
    }

    return { score, label, color, feedback };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!uid || !token) {
      setError('Invalid password reset link');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/password-reset-confirm/`, {
        uid,
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (response.status === 200) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      
      if (err.response?.data?.token) {
        setError('This password reset link is invalid or has expired. Please request a new one.');
      } else if (err.response?.data?.new_password) {
        setError(err.response.data.new_password[0]);
      } else if (err.response?.data?.non_field_errors) {
        setError(err.response.data.non_field_errors[0]);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('An error occurred. Please try again or request a new reset link.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #073317 0%, #064e3b 100%)',
        minHeight: 'calc(100vh - 200px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-100"
          style={{ maxWidth: '500px' }}
        >
          <div className="bg-white rounded p-4 p-md-5 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <CheckCircle style={{ width: '80px', height: '80px' }} className="text-success mx-auto mb-4" />
            </motion.div>
            <h2 className="h3 fw-bold text-dark mb-3">Password Reset Successful!</h2>
            <p className="text-muted mb-4">
              Your password has been reset successfully. You can now login with your new password.
            </p>
            <div className="alert alert-info mb-4">
              <p className="mb-0 small">
                <svg className="me-1" style={{ width: '16px', height: '16px', display: 'inline-block' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Redirecting to login page in 3 seconds...
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-success w-100 d-flex align-items-center justify-content-center"
            >
              <svg className="me-2" style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Go to Login Now
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #1f2937 0%, #065f46 50%, #1e3a8a 100%)',
      minHeight: 'calc(100vh - 200px)'
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
                  <Lock style={{ width: '32px', height: '32px', color: 'white' }} />
                </div>
                <h2 className="h3 fw-bold text-white mb-2">Reset Password</h2>
                <p className="text-white-50">Enter your new password below</p>
              </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="alert alert-danger mb-3"
              >
                <AlertTriangle style={{ width: '20px', height: '20px' }} className="me-2" />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit}>
              {/* New Password */}
              <div className="mb-3">
                <label className="form-label text-white">New Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <Lock style={{ width: '20px', height: '20px' }} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="form-control"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="btn btn-outline-secondary bg-white"
                  >
                    {showPassword ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {passwordStrength && (
                  <div className="mt-2">
                    <div className="d-flex justify-content-between mb-1">
                      <small className="text-white-50">Password Strength:</small>
                      <small className={`fw-bold text-${passwordStrength.color === 'green' ? 'success' : passwordStrength.color === 'red' ? 'danger' : passwordStrength.color === 'yellow' ? 'warning' : 'info'}`}>
                        {passwordStrength.label}
                      </small>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className={`progress-bar bg-${passwordStrength.color === 'green' ? 'success' : passwordStrength.color === 'red' ? 'danger' : passwordStrength.color === 'yellow' ? 'warning' : 'info'}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      ></div>
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <small className="text-white-50 d-block mt-1">
                        Tip: {passwordStrength.feedback[0]}
                      </small>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="mb-3">
                <label className="form-label text-white">Confirm New Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <Lock style={{ width: '20px', height: '20px' }} />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="form-control"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="btn btn-outline-secondary bg-white"
                  >
                    {showConfirmPassword ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <small className="text-danger d-block mt-1">
                    <svg className="me-1" style={{ width: '12px', height: '12px', display: 'inline-block' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Passwords do not match
                  </small>
                )}
              </div>

              {/* Password Requirements */}
              <div className="alert alert-light mb-3">
                <h6 className="small fw-bold mb-2">Password Requirements:</h6>
                <ul className="list-unstyled mb-0 small">
                  <li className={newPassword.length >= 8 ? 'text-success' : 'text-muted'}>
                    <span className="me-1">{newPassword.length >= 8 ? '✓' : '○'}</span>
                    At least 8 characters long
                  </li>
                  <li className={/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'text-success' : 'text-muted'}>
                    <span className="me-1">{/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? '✓' : '○'}</span>
                    Mix of uppercase and lowercase letters
                  </li>
                  <li className={/\d/.test(newPassword) ? 'text-success' : 'text-muted'}>
                    <span className="me-1">{/\d/.test(newPassword) ? '✓' : '○'}</span>
                    At least one number
                  </li>
                  <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-success' : 'text-muted'}>
                    <span className="me-1">{/[^A-Za-z0-9]/.test(newPassword) ? '✓' : '○'}</span>
                    At least one special character
                  </li>
                </ul>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="btn btn-success w-100 d-flex align-items-center justify-content-center"
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <CheckCircle style={{ width: '20px', height: '20px' }} className="me-2" />
                    Reset Password
                  </>
                )}
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-4 pt-3 border-top border-white border-opacity-25">
              <p className="text-center text-white-50 mb-2">
                Link expired?{' '}
                <Link to="/forgot-password" className="text-white fw-bold text-decoration-none">
                  Request a new one
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

export default ResetPasswordPage;
