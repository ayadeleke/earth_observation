import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newProjectDescription, setNewProjectDescription] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Load projects on component mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/projects/');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
        // Set recent projects as the 3 most recent
        setRecentProjects(data.slice(0, 3));
      } else {
        console.error('Failed to load projects');
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setCreating(true);
      setError('');
      
      const response = await fetch('http://localhost:8000/projects/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDescription.trim()
        })
      });

      if (response.ok) {
        const newProject = await response.json();
        setProjects([newProject, ...projects]);
        setRecentProjects([newProject, ...recentProjects.slice(0, 2)]);
        setShowNewProjectModal(false);
        setNewProjectName('');
        setNewProjectDescription('');
        
        // Navigate to analysis page with the new project
        navigate(`/analysis?project=${newProject.id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project. Please try again.');
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9fa' }}>
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
                        className="p-3 border rounded-3 hover-shadow cursor-pointer"
                        style={{ 
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
                        }}
                        onClick={() => openProject(project.id)}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <h6 className="fw-bold mb-1">{project.name}</h6>
                            {project.description && (
                              <p className="text-muted small mb-2">{project.description}</p>
                            )}
                            <small className="text-muted">
                              <i className="fas fa-calendar-alt me-1"></i>
                              Created {formatDate(project.created_at)}
                            </small>
                          </div>
                          <i className="fas fa-arrow-right text-primary"></i>
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
                      <div className="fw-semibold">Django API</div>
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
