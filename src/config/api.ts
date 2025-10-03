// API Configuration for Django Backend
export const API_CONFIG = {
  // Base URL for your Django backend
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  
  // API endpoints
  ENDPOINTS: {
    LOGIN: '/api/auth/login/',
    LOGOUT: '/api/auth/logout/',
    REFRESH: '/api/auth/refresh/',
    USER_PROFILE: '/api/auth/user/',
    REGISTER: '/api/auth/register/',
  },
  
  // Request timeout (in milliseconds)
  TIMEOUT: 10000,
  
  // Default headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
};

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get auth headers
export const getAuthHeaders = (token?: string) => {
  const headers: Record<string, string> = { ...API_CONFIG.DEFAULT_HEADERS };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};
