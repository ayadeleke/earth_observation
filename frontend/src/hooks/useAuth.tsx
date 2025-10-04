// Placeholder auth hook
export const useAuth = () => ({
  user: null,
  loading: false,
  isAuthenticated: false,
});

// Placeholder auth provider
export const AuthProvider = ({ children }: { children: any }) => children;
