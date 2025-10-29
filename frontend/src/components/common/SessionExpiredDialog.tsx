import React from 'react';

interface SessionExpiredDialogProps {
  show: boolean;
  onLogin: () => void;
}

export const SessionExpiredDialog: React.FC<SessionExpiredDialogProps> = ({
  show,
  onLogin
}) => {
  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1060 }}
      ></div>

      {/* Modal */}
      <div 
        className="modal fade show d-block" 
        tabIndex={-1} 
        style={{ zIndex: 1065 }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content shadow-lg" style={{ borderRadius: '1rem' }}>
            <div className="modal-header border-0 pb-0 bg-warning bg-opacity-10">
              <h5 className="modal-title fw-bold text-warning">
                <i className="fas fa-clock me-2"></i>
                Session Expired
              </h5>
            </div>
            <div className="modal-body py-4">
              <p className="mb-3">
                <strong>Your session has expired due to inactivity.</strong>
              </p>
              <p className="mb-0 text-muted">
                For your security, please log in again to continue using the application.
              </p>
            </div>
            <div className="modal-footer border-0 pt-0">
              <button 
                type="button" 
                className="btn btn-primary w-100"
                onClick={onLogin}
                style={{ borderRadius: '0.5rem' }}
              >
                <i className="fas fa-sign-in-alt me-2"></i>
                Log In Again
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SessionExpiredDialog;
