import { useState, useEffect } from 'react';
import authService from '../services/authService';
import { Project } from '../components/projects/ProjectCard';

export interface UseProjectManagerReturn {
  projects: Project[];
  loading: boolean;
  error: string;
  isCreating: boolean;
  loadProjects: () => Promise<void>;
  createProject: (name: string, description: string) => Promise<Project | null>;
  deleteProject: (projectId: number) => Promise<void>;
  setError: (error: string) => void;
}

export const useProjectManager = (): UseProjectManagerReturn => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError('');
      const api = authService.getAuthenticatedAPI();
      const response = await api.get('/projects/');
      
      // Handle paginated response - projects are in response.data.results
      const projectsData = response.data.results ? 
        Array.isArray(response.data.results) ? response.data.results : [] : 
        [];
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
      setError('Failed to connect to server');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (name: string, description: string): Promise<Project | null> => {
    if (!name.trim()) {
      setError('Project name is required');
      return null;
    }

    try {
      setCreating(true);
      setError('');
      const api = authService.getAuthenticatedAPI();
      const response = await api.post('/projects/', {
        name: name.trim(),
        description: description.trim()
      });
      
      const newProject = response.data;
      setProjects([newProject, ...projects]); // Add to beginning of array
      return newProject;
    } catch (error: any) {
      console.error('Error creating project:', error);
      let errorMessage = 'Failed to create project. Please try again.';
      
      if (error.response?.data) {
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
      return null;
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (projectId: number) => {
    try {
      const api = authService.getAuthenticatedAPI();
      await api.delete(`/projects/${projectId}/`);
      
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
      setError('Failed to delete project');
      throw error;
    }
  };

  return {
    projects,
    loading,
    error,
    isCreating: creating,
    loadProjects,
    createProject,
    deleteProject,
    setError
  };
};

export default useProjectManager;