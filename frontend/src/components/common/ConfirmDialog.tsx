import React from 'react';

interface ConfirmDialogProps {
  show: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'success' | 'danger' | 'warning';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  show,
  title = 'Confirm Action',
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'success'
}) => {
  if (!show) return null;

  const getButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'btn-danger';
      case 'warning':
        return 'btn-warning';
      case 'success':
      default:
        return 'btn-success';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1050 }}
        onClick={onCancel}
      ></div>

      {/* Modal */}
      <div 
        className="modal fade show d-block" 
        tabIndex={-1} 
        style={{ zIndex: 1055 }}
        onClick={onCancel}
      >
        <div 
          className="modal-dialog modal-dialog-centered"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content shadow-lg" style={{ borderRadius: '1rem' }}>
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title fw-bold">{title}</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onCancel}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p className="mb-0">{message}</p>
            </div>
            <div className="modal-footer border-0 pt-0">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onCancel}
                style={{ borderRadius: '0.5rem' }}
              >
                {cancelText}
              </button>
              <button 
                type="button" 
                className={`btn ${getButtonClass()}`}
                onClick={onConfirm}
                style={{ borderRadius: '0.5rem' }}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmDialog;