import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectModal, ProjectsList, useProjectManager, type Project } from '../components/projects';

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const {
    projects,
    loading,
    error,
    createProject,
    deleteProject,
    isCreating
  } = useProjectManager();

  const filteredProjects = projects.filter((project: Project) => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openProject = (projectId: number) => {
    navigate(`/analysis?project=${projectId}`);
  };

  const handleCreateProject = async (name: string, description: string) => {
    const newProject = await createProject(name, description);
    if (newProject) {
      setShowNewProjectModal(false);
    }
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
                onClick={() => setShowNewProjectModal(true)}
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
        <ProjectsList
          projects={filteredProjects}
          loading={loading}
          error={error}
          searchTerm={searchTerm}
          onClearSearch={() => setSearchTerm('')}
          onProjectOpen={openProject}
          onProjectDelete={deleteProject}
          onCreateProject={() => setShowNewProjectModal(true)}
        />

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
                          {projects.filter((p: Project) => new Date(p.updated_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                        </h3>
                        <p className="text-muted mb-0">Active This Week</p>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="p-3">
                        <h3 className="display-6 fw-bold text-info mb-1">
                          {projects.filter((p: Project) => new Date(p.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
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

      {/* New Project Modal */}
      <ProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onSubmit={handleCreateProject}
        isCreating={isCreating}
        error={error}
      />
    </div>
  );
};

export default ProjectsPage;
export { ProjectsPage };