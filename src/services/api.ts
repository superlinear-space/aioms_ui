import axios from 'axios';
import { API_CONFIG, getApiUrl } from '../config/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.DEFAULT_HEADERS,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(getApiUrl(API_CONFIG.ENDPOINTS.REFRESH), {
            refresh: refreshToken
          });
          
          const { access } = response.data;
          localStorage.setItem('access_token', access);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API Service Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    username: string;
  };
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
}

export interface ApiError {
  message: string;
  details?: any;
}

// API Service Functions
export const apiService = {
  // Authentication
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<LoginResponse>(
        API_CONFIG.ENDPOINTS.LOGIN,
        credentials
      );
      
      // Store tokens
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'Login failed'
      );
    }
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.LOGOUT);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens regardless of API response
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  },

  async getUserProfile(): Promise<User> {
    try {
      const response = await apiClient.get<User>(
        API_CONFIG.ENDPOINTS.USER_PROFILE
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'Failed to fetch user profile'
      );
    }
  },

  async refreshToken(): Promise<{ access: string }> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post<{ access: string }>(
        API_CONFIG.ENDPOINTS.REFRESH,
        { refresh: refreshToken }
      );
      
      localStorage.setItem('access_token', response.data.access);
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'Token refresh failed'
      );
    }
  }
};

export default apiClient;
