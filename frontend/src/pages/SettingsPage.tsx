import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Settings, Save, Lock, Bell, Shield, Trash2, AlertTriangle } from 'lucide-react';

interface UserSettings {
  email: string;
  username: string;
}

interface AppPreferences {
  defaultSatellite: string;
  mapStyle: string;
  notifications: boolean;
  autoSave: boolean;
  analysisTimeout: number;
}

export const SettingsPage: React.FC = () => {
  const { user, updateProfile, changePassword, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // User profile settings
  const [userSettings, setUserSettings] = useState<UserSettings>({
    email: '',
    username: ''
  });

  // Application preferences
  const [preferences, setPreferences] = useState<AppPreferences>({
    defaultSatellite: 'sentinel2',
    mapStyle: 'satellite',
    notifications: true,
    autoSave: true,
    analysisTimeout: 300
  });

  // Password change
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Account deletion
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    loadUserSettings();
    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Use the user data from auth context instead of making an API call
      setUserSettings({
        email: user.email || '',
        username: user.username || ''
      });
    } catch (error) {
      console.error('Error loading user settings:', error);
      setMessage({ type: 'error', text: 'Failed to load user settings' });
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = () => {
    // Load from localStorage or use defaults
    const savedPreferences = localStorage.getItem('userPreferences');
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences);
        setPreferences(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error parsing saved preferences:', error);
      }
    }
  };

  const saveUserSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);
      
      await updateProfile({
        email: userSettings.email,
        username: userSettings.username
      });
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      console.error('Error saving user settings:', error);
      let errorMessage = 'Failed to update profile';
      
      if (error.response?.data) {
        if (error.response.data.email) {
          errorMessage = `Email: ${error.response.data.email[0]}`;
        } else if (error.response.data.username) {
          errorMessage = `Username: ${error.response.data.username[0]}`;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        }
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = () => {
    try {
      localStorage.setItem('userPreferences', JSON.stringify(preferences));
      setMessage({ type: 'success', text: 'Preferences saved successfully!' });
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
      setMessage({ type: 'success', text: 'Password changed successfully!' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      let errorMessage = 'Current password is incorrect';
      
      if (error.response?.data) {
        if (error.response.data.old_password) {
          errorMessage = 'Current password is incorrect';
        } else if (error.response.data.new_password) {
          errorMessage = `New password: ${error.response.data.new_password[0]}`;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        }
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') {
      setMessage({ type: 'error', text: 'Please type "DELETE" to confirm account deletion' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      
      // Use the deleteAccount method from auth context
      await deleteAccount();
      
      // Navigate to landing page
      navigate('/');
      setMessage({ type: 'success', text: 'Account deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      let errorMessage = 'Failed to delete account';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light py-5">
        <div className="container">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12">
            <h1 className="display-5 fw-bold text-dark mb-2">
              <Settings className="me-3" size={48} />
              Settings
            </h1>
            <p className="lead text-muted">Manage your account and application preferences</p>
          </div>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`} role="alert">
            {message.text}
            <button type="button" className="btn-close" onClick={() => setMessage(null)}></button>
          </div>
        )}

        <div className="row g-4">
          {/* User Profile Settings */}
          <div className="col-lg-6">
            <div className="card shadow border-0 rounded h-100">
              <div className="card-header bg-white border-0 py-3">
                <h3 className="card-title fw-bold mb-0">
                  <User className="me-2" size={20} />
                  Profile Settings
                </h3>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    value={userSettings.email}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="form-label fw-semibold">Username</label>
                  <input
                    type="text"
                    className="form-control"
                    value={userSettings.username}
                    onChange={(e) => setUserSettings(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter your username"
                  />
                </div>

                <button
                  className="btn btn-primary"
                  onClick={saveUserSettings}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="me-2" />
                      Save Profile
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Account Management */}
          <div className="col-lg-6">
            <div className="card shadow border-0 rounded h-100">
              <div className="card-header bg-white border-0 py-3">
                <h3 className="card-title fw-bold mb-0">
                  <Shield className="me-2" size={20} />
                  Account Management
                </h3>
              </div>
              <div className="card-body">
                <div className="mb-4">
                  <h6 className="fw-bold text-danger mb-3">
                    <AlertTriangle size={20} className="me-2" />
                    Danger Zone
                  </h6>
                  <p className="text-muted mb-3">
                    Once you delete your account, there is no going back. Please be certain.
                    All your projects and analysis data will be permanently deleted.
                  </p>
                  
                  {!showDeleteConfirmation ? (
                    <button
                      className="btn btn-outline-danger"
                      onClick={() => setShowDeleteConfirmation(true)}
                    >
                      <Trash2 size={16} className="me-2" />
                      Delete Account
                    </button>
                  ) : (
                    <div className="border border-danger rounded p-3">
                      <h6 className="text-danger fw-bold mb-3">Confirm Account Deletion</h6>
                      <p className="text-muted mb-3">
                        This action cannot be undone. This will permanently delete your account and all associated data.
                      </p>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">
                          Type <code>DELETE</code> to confirm:
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={deleteConfirmationText}
                          onChange={(e) => setDeleteConfirmationText(e.target.value)}
                          placeholder="Type DELETE to confirm"
                        />
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-danger"
                          onClick={handleDeleteAccount}
                          disabled={saving || deleteConfirmationText !== 'DELETE'}
                        >
                          {saving ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 size={16} className="me-2" />
                              Delete Account
                            </>
                          )}
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => {
                            setShowDeleteConfirmation(false);
                            setDeleteConfirmationText('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Application Preferences */}
          <div className="col-12">
            <div className="card shadow border-0 rounded">
              <div className="card-header bg-white border-0 py-3">
                <h3 className="card-title fw-bold mb-0">
                  <Settings className="me-2" size={20} />
                  Application Preferences
                </h3>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Default Satellite</label>
                    <select 
                      className="form-select"
                      value={preferences.defaultSatellite}
                      onChange={(e) => setPreferences(prev => ({ ...prev, defaultSatellite: e.target.value }))}
                    >
                      <option value="sentinel2">Sentinel-2</option>
                      <option value="landsat8">Landsat 8</option>
                      <option value="landsat9">Landsat 9</option>
                      <option value="sentinel1">Sentinel-1</option>
                    </select>
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Map Style</label>
                    <select 
                      className="form-select"
                      value={preferences.mapStyle}
                      onChange={(e) => setPreferences(prev => ({ ...prev, mapStyle: e.target.value }))}
                    >
                      <option value="satellite">Satellite</option>
                      <option value="terrain">Terrain</option>
                      <option value="roadmap">Roadmap</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>

                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Analysis Timeout (seconds)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={preferences.analysisTimeout}
                      onChange={(e) => setPreferences(prev => ({ ...prev, analysisTimeout: parseInt(e.target.value) || 300 }))}
                      min="60"
                      max="1800"
                    />
                    <div className="form-text">60-1800 seconds</div>
                  </div>

                  <div className="col-md-3 d-flex flex-column justify-content-center">
                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={preferences.notifications}
                        onChange={(e) => setPreferences(prev => ({ ...prev, notifications: e.target.checked }))}
                        id="notifications"
                      />
                      <label className="form-check-label fw-semibold" htmlFor="notifications">
                        <Bell size={16} className="me-2" />
                        Enable Notifications
                      </label>
                    </div>

                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={preferences.autoSave}
                        onChange={(e) => setPreferences(prev => ({ ...prev, autoSave: e.target.checked }))}
                        id="autoSave"
                      />
                      <label className="form-check-label fw-semibold" htmlFor="autoSave">
                        <Save size={16} className="me-2" />
                        Auto-save Results
                      </label>
                    </div>
                  </div>

                  <div className="col-12 mt-4">
                    <button
                      className="btn btn-primary"
                      onClick={savePreferences}
                    >
                      <Save size={16} className="me-2" />
                      Save Preferences
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="col-12">
            <div className="card shadow border-0 rounded">
              <div className="card-header bg-white border-0 py-3">
                <h3 className="card-title fw-bold mb-0">
                  <Shield className="me-2" size={20} />
                  Security Settings
                </h3>
              </div>
              <div className="card-body">
                {!showPasswordSection ? (
                  <div className="text-center py-3">
                    <p className="text-muted mb-3">Change your account password</p>
                    <button
                      className="btn btn-outline-primary"
                      onClick={() => setShowPasswordSection(true)}
                    >
                      <Lock size={16} className="me-2" />
                      Change Password
                    </button>
                  </div>
                ) : (
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Current Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">New Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Confirm New Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="col-12">
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-primary"
                          onClick={handleChangePassword}
                          disabled={saving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                        >
                          {saving ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                              Changing...
                            </>
                          ) : (
                            <>
                              <Lock size={16} className="me-2" />
                              Change Password
                            </>
                          )}
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => {
                            setShowPasswordSection(false);
                            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
