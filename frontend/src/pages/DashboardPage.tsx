import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectDescription, setNewProjectDescription] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  // Load projects on component mount
  useEffect(() => {
    console.log('DashboardPage mounted. Authenticated:', isAuthenticated, 'User:', user);
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated, user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdown(null);
    };
    
    if (activeDropdown !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [activeDropdown]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const api = authService.getAuthenticatedAPI();
      const response = await api.get('/projects/');
      // Handle paginated response - projects are in response.data.results
      const projectsData = response.data.results ? Array.isArray(response.data.results) ? response.data.results : [] : [];
      setProjects(projectsData);
      // Set recent projects as the 3 most recent
      setRecentProjects(projectsData.slice(0, 3));
    } catch (error: any) {
      console.error('Error loading projects:', error);
      // Ensure projects is always an array even on error
      setProjects([]);
      setRecentProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    // Check for duplicate project names
    const trimmedName = newProjectName.trim();
    const existingProject = projects.find(project => 
      project.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (existingProject) {
      setError(`A project with the name "${trimmedName}" already exists. Please choose a different name.`);
      return;
    }

    try {
      setCreating(true);
      setError('');
      
      const api = authService.getAuthenticatedAPI();
      const response = await api.post('/projects/', {
        name: trimmedName,
        description: newProjectDescription.trim()
      });

      const newProject = response.data;
      setProjects(prevProjects => [newProject, ...(Array.isArray(prevProjects) ? prevProjects : [])]);
      setRecentProjects(prevRecent => [newProject, ...(Array.isArray(prevRecent) ? prevRecent.slice(0, 2) : [])]);
      setShowNewProjectModal(false);
      setNewProjectName('');
      setNewProjectDescription('');
      
      // Navigate to analysis page with the new project
      navigate(`/analysis?project=${newProject.id}`);
    } catch (error: any) {
      console.error('Error creating project:', error);
      
      // Handle different types of errors
      let errorMessage = 'Failed to create project. Please try again.';
      
      if (error.response?.data) {
        // Check for field-specific validation errors
        if (error.response.data.name) {
          errorMessage = Array.isArray(error.response.data.name) 
            ? error.response.data.name[0] 
            : error.response.data.name;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.non_field_errors) {
          errorMessage = Array.isArray(error.response.data.non_field_errors)
            ? error.response.data.non_field_errors[0]
            : error.response.data.non_field_errors;
        }
      }
      
      setError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const openProject = (projectId: number) => {
    navigate(`/analysis?project=${projectId}`);
  };

  const deleteProject = async (projectId: number, projectName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const api = authService.getAuthenticatedAPI();
      await api.delete(`/projects/${projectId}/`);

      // Update both projects and recent projects lists
      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
      setRecentProjects(prevRecent => prevRecent.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  return (
    <div className="min-vh-100" style={{ backgroundColor: '#f8f9fa' }}>
      <div className="container py-5">
        {/* Header */}
        <div className="row mb-5">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center flex-wrap">
              <div>
                <h1 className="display-4 fw-bold text-dark mb-2">Dashboard</h1>
                <p className="lead text-muted">Manage your Earth Observation analysis projects</p>
              </div>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setShowNewProjectModal(true)}
                style={{ borderRadius: '0.75rem' }}
              >
                <i className="fas fa-plus me-2"></i>
                New Project
              </button>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Recent Projects */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '1rem' }}>
              <div className="card-header bg-white border-0" style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
                <div className="d-flex justify-content-between align-items-center">
                  <h3 className="card-title mb-0 fw-bold">
                    <i className="fas fa-clock text-primary me-2"></i>
                    Recent Projects
                  </h3>
                  {projects.length > 3 && (
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => navigate('/projects')}
                    >
                      View All
                    </button>
                  )}
                </div>
              </div>
              <div className="card-body">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : recentProjects.length > 0 ? (
                  <div className="d-grid gap-3">
                    {recentProjects.map((project) => (
                      <div
                        key={project.id}
                        className="p-3 border rounded-3 hover-shadow"
                        style={{ 
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div 
                            className="flex-grow-1 cursor-pointer"
                            onClick={() => openProject(project.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <h6 className="fw-bold mb-1">{project.name}</h6>
                            {project.description && (
                              <p className="text-muted small mb-2">{project.description}</p>
                            )}
                            <small className="text-muted">
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
                            </small>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <div className="dropdown position-relative">
                              <button
                                className="btn btn-link text-muted p-1"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown(activeDropdown === project.id ? null : project.id);
                                }}
                              >
                                <i className="fas fa-ellipsis-v"></i>
                              </button>
                              {activeDropdown === project.id && (
                                <div className="dropdown-menu dropdown-menu-end show position-absolute" style={{ 
                                  right: 0, 
                                  top: '100%',
                                  zIndex: 1050
                                }}>
                                  <button
                                    className="dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdown(null);
                                      openProject(project.id);
                                    }}
                                  >
                                    <i className="fas fa-play me-2"></i>
                                    Open Project
                                  </button>
                                  <hr className="dropdown-divider" />
                                  <button
                                    className="dropdown-item text-danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdown(null);
                                      deleteProject(project.id, project.name);
                                    }}
                                  >
                                    <i className="fas fa-trash me-2"></i>
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                            <i className="fas fa-arrow-right text-primary"></i>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <i className="fas fa-folder-open fa-3x text-muted mb-3"></i>
                    <h5 className="text-muted mb-2">No projects yet</h5>
                    <p className="text-muted mb-3">Start by creating your first analysis project</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowNewProjectModal(true)}
                    >
                      <i className="fas fa-plus me-2"></i>
                      Create Project
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="col-lg-3">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '1rem' }}>
              <div className="card-header bg-white border-0" style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
                <h3 className="card-title mb-0 fw-bold">
                  <i className="fas fa-bolt text-warning me-2"></i>
                  Quick Actions
                </h3>
              </div>
              <div className="card-body">
                <div className="d-grid gap-3">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => setShowNewProjectModal(true)}
                    style={{ borderRadius: '0.75rem' }}
                  >
                    <i className="fas fa-plus me-2"></i>
                    New Project
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-lg"
                    onClick={() => navigate('/projects')}
                    style={{ borderRadius: '0.75rem' }}
                  >
                    <i className="fas fa-folder me-2"></i>
                    View Projects
                  </button>
                  <button
                    className="btn btn-outline-info btn-lg"
                    onClick={() => navigate('/analysis')}
                    style={{ borderRadius: '0.75rem' }}
                  >
                    <i className="fas fa-satellite me-2"></i>
                    Quick Analysis
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="col-lg-3">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '1rem' }}>
              <div className="card-header bg-white border-0" style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
                <h3 className="card-title mb-0 fw-bold">
                  <i className="fas fa-server text-success me-2"></i>
                  System Status
                </h3>
              </div>
              <div className="card-body">
                <div className="d-grid gap-3">
                  <div className="d-flex align-items-center p-3 border rounded-3">
                    <div className="bg-success rounded-circle me-3" style={{ width: '12px', height: '12px' }}></div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold">Server</div>
                      <small className="text-success">Running</small>
                    </div>
                  </div>
                  <div className="d-flex align-items-center p-3 border rounded-3">
                    <div className="bg-success rounded-circle me-3" style={{ width: '12px', height: '12px' }}></div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold">Earth Engine</div>
                      <small className="text-success">Connected</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '1rem' }}>
              <div className="modal-header border-0">
                <h5 className="modal-title fw-bold">
                  <i className="fas fa-plus-circle text-primary me-2"></i>
                  Create New Project
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setNewProjectName('');
                    setNewProjectDescription('');
                    setError('');
                  }}
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
                    Project Name *
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    id="projectName"
                    placeholder="Enter project name..."
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    style={{ borderRadius: '0.5rem' }}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="projectDescription" className="form-label fw-semibold">
                    Description (Optional)
                  </label>
                  <textarea
                    className="form-control"
                    id="projectDescription"
                    rows={3}
                    placeholder="Describe your project..."
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    style={{ borderRadius: '0.5rem' }}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setNewProjectName('');
                    setNewProjectDescription('');
                    setError('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={createProject}
                  disabled={creating || !newProjectName.trim()}
                >
                  {creating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </span>
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
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-shadow:hover {
          box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
          transform: translateY(-1px);
        }
        .cursor-pointer {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
