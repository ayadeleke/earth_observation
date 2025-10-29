import React, { useState } from 'react';
import { ConfirmDialog } from '../common/ConfirmDialog';

export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface ProjectCardProps {
  project: Project;
  onOpen: (projectId: number) => void;
  onDelete: (projectId: number) => Promise<void>;
  showActions?: boolean;
  className?: string;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onDelete,
  showActions = true,
  className = ''
}) => {
  const [activeDropdown, setActiveDropdown] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmDialog(true);
    setActiveDropdown(false);
  };

  const handleConfirmDelete = async () => {
    setShowConfirmDialog(false);
    
    try {
      setIsDeleting(true);
      await onDelete(project.id);
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDropdown(!activeDropdown);
  };

  const handleOpenProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDropdown(false);
    onOpen(project.id);
  };

  return (
    <>
      <div className={`card border-0 shadow-sm h-100 hover-card ${className}`} style={{ borderRadius: '1rem' }}>
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div className="flex-grow-1">
              <h5 className="card-title fw-bold mb-2">{project.name}</h5>
              {project.description && (
                <p className="card-text text-muted mb-3">{project.description}</p>
              )}
            </div>
            
            {showActions && (
              <div className="dropdown position-relative">
                <button
                  className="btn btn-link text-muted p-0"
                  type="button"
                  onClick={handleDropdownToggle}
                  disabled={isDeleting}
                >
                  <i className="fas fa-ellipsis-v"></i>
                </button>
                
                {activeDropdown && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div 
                      className="position-fixed top-0 start-0 w-100 h-100"
                      style={{ zIndex: 1040 }}
                      onClick={() => setActiveDropdown(false)}
                    ></div>
                    
                    <div className="dropdown-menu dropdown-menu-end show position-absolute" style={{ 
                      right: 0, 
                      top: '100%',
                      zIndex: 1050
                    }}>
                      <button
                        className="dropdown-item"
                        onClick={handleOpenProject}
                        disabled={isDeleting}
                      >
                        <i className="fas fa-play me-2"></i>
                        Open Project
                      </button>
                      <hr className="dropdown-divider" />
                      <button
                        className="dropdown-item text-danger"
                        onClick={handleDeleteClick}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" style={{ width: '12px', height: '12px' }}></span>
                            Deleting...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-trash me-2"></i>
                            Delete
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="text-muted small mb-3">
            {project.updated_at !== project.created_at ? (
              <>
                <i className="fas fa-edit me-1"></i>
                Last updated {formatDate(project.updated_at)}
              </>
            ) : (
              <>
                <i className="fas fa-calendar-plus me-1"></i>
                Created {formatDate(project.created_at)}
              </>
            )}
          </div>
          
          <button
            className="btn btn-primary w-100"
            onClick={() => onOpen(project.id)}
            style={{ borderRadius: '0.5rem' }}
            disabled={isDeleting}
          >
            <i className="fas fa-arrow-right me-2"></i>
            Open Project
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        show={showConfirmDialog}
        title="Confirm Delete"
        message={`Are you sure you want to delete the project "${project.name}"? This action cannot be undone.`}
        confirmText="OK"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        variant="success"
      />
    </>
  );
};

export default ProjectCard;