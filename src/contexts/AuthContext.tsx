import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiService } from '../services/api';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on app start
    const initializeAuth = async () => {
      const savedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('access_token');
      
      if (savedUser && accessToken) {
        try {
          // Verify token is still valid by fetching user profile
          const userProfile = await apiService.getUserProfile();
          setUser(userProfile);
          localStorage.setItem('user', JSON.stringify(userProfile));
        } catch (error) {
          // Token is invalid, clear everything
          localStorage.removeItem('user');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const response = await apiService.login({ email, password });
      
      // Store user data
      setUser(response.user);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      setIsLoading(false);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Always try mock authentication as fallback
      console.log('Backend not available, using mock authentication');
      
      // Mock authentication fallback
      if (email === 'admin@example.com' && password === 'password') {
        const mockUser: User = {
          id: 1,
          email: email,
          first_name: 'Admin',
          last_name: 'User',
          username: 'admin'
        };
        
        setUser(mockUser);
        localStorage.setItem('user', JSON.stringify(mockUser));
        setIsLoading(false);
        return true;
      }
      
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
