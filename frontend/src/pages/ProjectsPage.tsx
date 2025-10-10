import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';

interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

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
    } catch (error) {
      console.error('Error loading projects:', error);
      setError('Failed to connect to server');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId: number) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const api = authService.getAuthenticatedAPI();
      await api.delete(`/projects/${projectId}/`);

      setProjects(projects.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  };

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const openProject = (projectId: number) => {
    navigate(`/analysis?project=${projectId}`);
  };

  return (
    <div className="min-vh-100" style={{ backgroundColor: '#f8f9fa' }}>
      <div className="container py-5">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center flex-wrap">
              <div>
                <h1 className="display-4 fw-bold text-dark mb-2">My Projects</h1>
                <p className="lead text-muted">Manage and organize your Earth Observation analysis projects</p>
              </div>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => navigate('/dashboard')}
                style={{ borderRadius: '0.75rem' }}
              >
                <i className="fas fa-plus me-2"></i>
                New Project
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm" style={{ borderRadius: '1rem' }}>
              <div className="card-body">
                <div className="input-group">
                  <span className="input-group-text bg-light border-0">
                    <i className="fas fa-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-0 bg-light"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="row">
          <div className="col-12">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted mt-3">Loading your projects...</p>
              </div>
            ) : error ? (
              <div className="alert alert-danger" role="alert">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            ) : filteredProjects.length > 0 ? (
              <div className="row g-4">
                {filteredProjects.map((project) => (
                  <div key={project.id} className="col-md-6 col-lg-4">
                    <div className="card border-0 shadow-sm h-100 hover-card" style={{ borderRadius: '1rem' }}>
                      <div className="card-body p-4">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div className="flex-grow-1">
                            <h5 className="card-title fw-bold mb-2">{project.name}</h5>
                            {project.description && (
                              <p className="card-text text-muted mb-3">{project.description}</p>
                            )}
                          </div>
                          <div className="dropdown position-relative">
                            <button
                              className="btn btn-link text-muted p-0"
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
                                    deleteProject(project.id);
                                  }}
                                >
                                  <i className="fas fa-trash me-2"></i>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
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
                          onClick={() => openProject(project.id)}
                          style={{ borderRadius: '0.5rem' }}
                        >
                          <i className="fas fa-arrow-right me-2"></i>
                          Open Project
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5">
                <div className="card border-0 shadow-sm" style={{ borderRadius: '1rem' }}>
                  <div className="card-body py-5">
                    <i className="fas fa-folder-open fa-4x text-muted mb-4"></i>
                    <h3 className="text-muted mb-3">
                      {searchTerm ? 'No projects match your search' : 'No projects found'}
                    </h3>
                    <p className="text-muted mb-4">
                      {searchTerm 
                        ? 'Try adjusting your search terms or create a new project.'
                        : 'Start by creating your first Earth Observation analysis project.'
                      }
                    </p>
                    <div className="d-flex gap-3 justify-content-center flex-wrap">
                      {searchTerm && (
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => setSearchTerm('')}
                        >
                          <i className="fas fa-times me-2"></i>
                          Clear Search
                        </button>
                      )}
                      <button
                        className="btn btn-primary"
                        onClick={() => navigate('/dashboard')}
                      >
                        <i className="fas fa-plus me-2"></i>
                        Create Your First Project
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Project Statistics */}
        {projects.length > 0 && (
          <div className="row mt-5">
            <div className="col-12">
              <div className="card border-0 shadow-sm" style={{ borderRadius: '1rem' }}>
                <div className="card-body">
                  <h5 className="card-title fw-bold mb-4">
                    <i className="fas fa-chart-bar text-primary me-2"></i>
                    Project Statistics
                  </h5>
                  <div className="row text-center">
                    <div className="col-md-4">
                      <div className="p-3">
                        <h3 className="display-6 fw-bold text-primary mb-1">{projects.length}</h3>
                        <p className="text-muted mb-0">Total Projects</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="p-3">
                        <h3 className="display-6 fw-bold text-success mb-1">
                          {projects.filter(p => new Date(p.updated_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                        </h3>
                        <p className="text-muted mb-0">Active This Week</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="p-3">
                        <h3 className="display-6 fw-bold text-info mb-1">
                          {projects.filter(p => new Date(p.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
                        </h3>
                        <p className="text-muted mb-0">Created This Month</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .hover-card {
          transition: all 0.3s ease;
        }
        .hover-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
        }
      `}</style>
    </div>
  );
};

export default ProjectsPage;
export { ProjectsPage };