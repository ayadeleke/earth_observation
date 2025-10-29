import React, { useState, useEffect } from 'react';
import { SESSION_CONFIG } from '../../config/session.config';

interface SessionWarningProps {
  timeUntilExpiry: number | null; // milliseconds
  onExtendSession?: () => void;
  onDismiss?: () => void;
}

export const SessionWarning: React.FC<SessionWarningProps> = ({
  timeUntilExpiry,
  onExtendSession,
  onDismiss
}) => {
  const [show, setShow] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (timeUntilExpiry === null || timeUntilExpiry <= 0) {
      setShow(false);
      return;
    }

    // Show warning if less than configured threshold
    const shouldShow = timeUntilExpiry <= SESSION_CONFIG.WARNING_THRESHOLD;
    setShow(shouldShow);

    if (shouldShow) {
      const minutes = Math.floor(timeUntilExpiry / 60000);
      const seconds = Math.floor((timeUntilExpiry % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }
  }, [timeUntilExpiry]);

  const handleDismiss = () => {
    setShow(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!show) return null;

  return (
    <div 
      className="position-fixed bottom-0 end-0 m-3 session-warning" 
      style={{ zIndex: 1050, maxWidth: '400px' }}
    >
      <div className="alert alert-warning alert-dismissible fade show shadow-lg mb-0" role="alert">
            <div className="d-flex align-items-start">
          <i className="fas fa-exclamation-triangle fa-2x me-3 mt-1"></i>
          <div className="flex-grow-1">
            <h6 className="alert-heading mb-1">
              <strong>Session Expiring Due to Inactivity</strong>
            </h6>
            <p className="mb-2 small">
              Your session will expire in <strong className="text-danger">{timeLeft}</strong> due to inactivity.
            </p>
            <p className="mb-2 small text-muted">
              Any activity will keep your session active.
            </p>
            {onExtendSession && (
              <button 
                className="btn btn-warning btn-sm"
                onClick={onExtendSession}
              >
                <i className="fas fa-hand-pointer me-1"></i>
                I'm Still Here
              </button>
            )}
          </div>
          <button 
            type="button" 
            className="btn-close" 
            onClick={handleDismiss}
            aria-label="Close"
          ></button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarning;
