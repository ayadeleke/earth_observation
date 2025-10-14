import React, { useState } from 'react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<void>;
  isCreating?: boolean;
  error?: string;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isCreating = false,
  error = ''
}) => {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    
    await onSubmit(projectName.trim(), projectDescription.trim());
    
    // Reset form on successful submission (onSubmit should handle closing modal)
    setProjectName('');
    setProjectDescription('');
  };

  const handleClose = () => {
    setProjectName('');
    setProjectDescription('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal show d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '1rem' }}>
          <form onSubmit={handleSubmit}>
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title fw-bold">
                <i className="fas fa-plus-circle text-primary me-2"></i>
                Create New Project
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={handleClose}
                disabled={isCreating}
                aria-label="Close"
              ></button>
            </div>
            
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger" role="alert">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {error}
                </div>
              )}
              
              <div className="mb-3">
                <label htmlFor="projectName" className="form-label fw-semibold">
                  Project Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="projectName"
                  placeholder="Enter project name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  maxLength={100}
                  style={{ borderRadius: '0.5rem' }}
                  autoFocus
                  disabled={isCreating}
                  required
                />
                <div className="form-text">
                  {projectName.length}/100 characters
                </div>
              </div>
              
              <div className="mb-3">
                <label htmlFor="projectDescription" className="form-label fw-semibold">
                  Description (Optional)
                </label>
                <textarea
                  className="form-control"
                  id="projectDescription"
                  rows={3}
                  placeholder="Describe your project goals and objectives"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  maxLength={500}
                  style={{ borderRadius: '0.5rem' }}
                  disabled={isCreating}
                ></textarea>
                <div className="form-text">
                  {projectDescription.length}/500 characters
                </div>
              </div>
            </div>
            
            <div className="modal-footer border-0 pt-0">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleClose}
                disabled={isCreating}
                style={{ borderRadius: '0.5rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCreating || !projectName.trim()}
                style={{ borderRadius: '0.5rem' }}
              >
                {isCreating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus me-2"></i>
                    Create Project
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProjectModal;