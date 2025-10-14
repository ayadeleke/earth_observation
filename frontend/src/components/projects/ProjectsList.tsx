import React from 'react';
import { ProjectCard, Project } from './ProjectCard';

interface ProjectsListProps {
  projects: Project[];
  loading: boolean;
  error: string;
  searchTerm: string;
  onProjectOpen: (projectId: number) => void;
  onProjectDelete: (projectId: number) => Promise<void>;
  onCreateProject: () => void;
  onClearSearch?: () => void;
  showCreateButton?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

export const ProjectsList: React.FC<ProjectsListProps> = ({
  projects,
  loading,
  error,
  searchTerm,
  onProjectOpen,
  onProjectDelete,
  onCreateProject,
  onClearSearch,
  showCreateButton = true,
  emptyStateTitle,
  emptyStateDescription
}) => {
  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="text-muted mt-3">Loading your projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <i className="fas fa-exclamation-triangle me-2"></i>
        {error}
      </div>
    );
  }

  if (filteredProjects.length > 0) {
    return (
      <div className="row g-4">
        {filteredProjects.map((project) => (
          <div key={project.id} className="col-md-6 col-lg-4">
            <ProjectCard
              project={project}
              onOpen={onProjectOpen}
              onDelete={onProjectDelete}
            />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  const defaultTitle = searchTerm ? 'No projects match your search' : 'No projects found';
  const defaultDescription = searchTerm 
    ? 'Try adjusting your search terms or create a new project.'
    : 'Start by creating your first Earth Observation analysis project.';

  return (
    <div className="text-center py-5">
      <div className="card border-0 shadow-sm" style={{ borderRadius: '1rem' }}>
        <div className="card-body py-5">
          <i className="fas fa-folder-open fa-4x text-muted mb-4"></i>
          <h3 className="text-muted mb-3">
            {emptyStateTitle || defaultTitle}
          </h3>
          <p className="text-muted mb-4">
            {emptyStateDescription || defaultDescription}
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            {searchTerm && onClearSearch && (
              <button
                className="btn btn-outline-secondary"
                onClick={onClearSearch}
              >
                <i className="fas fa-times me-2"></i>
                Clear Search
              </button>
            )}
            {showCreateButton && (
              <button
                className="btn btn-primary"
                onClick={onCreateProject}
              >
                <i className="fas fa-plus me-2"></i>
                {projects.length === 0 ? 'Create Your First Project' : 'Create New Project'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsList;