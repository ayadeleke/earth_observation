import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectModal, ProjectCard, useProjectManager, type Project } from '../components/projects';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  
  const {
    projects,
    loading,
    error,
    createProject,
    deleteProject,
    isCreating
  } = useProjectManager();

  // Computed values
  const recentProjects = projects.slice(0, 3);

  const openProject = (projectId: number) => {
    navigate(`/analysis?project=${projectId}`);
  };

  const handleCreateProject = async (name: string, description: string) => {
    const newProject = await createProject(name, description);
    if (newProject) {
      setShowNewProjectModal(false);
      // Navigate to analysis page with the new project
      navigate(`/analysis?project=${newProject.id}`);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    await deleteProject(projectId);
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
          <div className="col-lg-5">
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
                    {recentProjects.map((project: Project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onOpen={openProject}
                        onDelete={handleDeleteProject}
                      />
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
          <div className="col-lg-4">
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
      {/* New Project Modal */}
      <ProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onSubmit={handleCreateProject}
        isCreating={isCreating}
        error={error}
      />

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
