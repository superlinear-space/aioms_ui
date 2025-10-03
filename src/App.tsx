import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route 
        path="/login" 
        element={<Login />} 
      />
      <Route 
        path="/dashboard" 
        element={<Dashboard />} 
      />
      <Route 
        path="/" 
        element={<Navigate to="/dashboard" replace />} 
      />
    </Routes>
  );
};

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <Router>
          <AppRoutes />
        </Router>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
