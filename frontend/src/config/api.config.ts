/**
 * Backend URL configuration
 *
 * REACT_APP_API_URL is the versioned API root (e.g. https://your-api.onrender.com/api/v1).
 * REACT_APP_BACKEND_URL is the server root, used for non-API paths such as /static/ map files
 * and root-level auth routes; when unset it is derived from REACT_APP_API_URL.
 * Both are inlined at build time, so set them in Vercel before building.
 */

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

export const API_BASE_URL = stripTrailingSlash(
  process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1'
);

export const BACKEND_URL = stripTrailingSlash(
  process.env.REACT_APP_BACKEND_URL || API_BASE_URL.replace(/\/api\/v\d+$/, '')
);

/**
 * Resolve a URL returned by the backend (e.g. "/static/map.html") against BACKEND_URL.
 * Absolute URLs are returned unchanged.
 */
export const resolveBackendUrl = (path: string): string => {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
};
