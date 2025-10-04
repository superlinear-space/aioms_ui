import React, { useState } from 'react';
import { Layout, Button, Input, Tabs, Collapse, App } from 'antd';
import { 
  LogoutOutlined, 
  MenuFoldOutlined, 
  MenuUnfoldOutlined,
  DashboardOutlined,
  SettingOutlined,
  TeamOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import CheckRequestMatrix from './CheckRequestMatrix';
import ClusterConfigEditor from './ClusterConfigEditor';
import ClusterYmlEditor from './ClusterYmlEditor';
import type { Sections, YamlSections } from '../types/clusterTypes';

const { Header, Content, Sider } = Layout;

const Dashboard: React.FC = () => {
  const { message } = App.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('menu1');
  const [activeTab, setActiveTab] = useState('settings');
  const [fileName, setFileName] = useState('~/projects/superalarm/clusters/yiwu2-6/cluster_all.txt');

  const [sections, setSections] = useState<Sections>({
    'settings': '',
    'device_groups': {},
    'networks': {},
    'tenants': {},
    'system': { checks: {} },
    'available_checks': ''
  });

  const [yamlSections, setYamlSections] = useState<YamlSections>({
    devices: [],
    networks: [],
    tenants: [],
    system: { epilogue: [] },
    request_labels: [],
    set_labels: {}
  });
  const [yamlActiveTab, setYamlActiveTab] = useState('devices');

  // Mock user data
  const user = {
    first_name: 'Admin',
    last_name: 'User',
    username: 'admin',
    email: 'admin@example.com'
  };

  const handleLogout = () => {
    // Redirect to login page
    window.location.href = '/login';
  };

  const menuItems = [
    {
      key: 'menu1',
      icon: <DashboardOutlined />,
      label: 'Model Config',
    },
    {
      key: 'menu2',
      icon: <SettingOutlined />,
      label: 'Menu 2',
    },
    {
      key: 'menu3',
      icon: <TeamOutlined />,
      label: 'Menu 3',
    },
    {
      key: 'menu4',
      icon: <BarChartOutlined />,
      label: 'Menu 4',
    },
  ];

  const renderContent = () => {
    switch (selectedMenu) {
      case 'menu1':
        return (
          <ClusterYmlEditor
            yamlSections={yamlSections}
            setYamlSections={setYamlSections}
            yamlActiveTab={yamlActiveTab}
            setYamlActiveTab={setYamlActiveTab}
          />
        );
      case 'menu2':
        return (
          <ClusterConfigEditor
            sections={sections}
            setSections={setSections}
            fileName={fileName}
            setFileName={setFileName}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        );
      case 'menu3':
        return (
          <div style={{ padding: '24px' }}>
            <CheckRequestMatrix />
          </div>
        );
      case 'menu4':
        return (
          <div style={{ padding: '24px' }}>
            <h1>Menu 4 Content</h1>
            <p>This is the content for Menu 4.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)'
        }}
      >
        <div style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <h2 style={{ 
            margin: 0, 
            color: '#1890ff',
            fontSize: collapsed ? '16px' : '20px',
            fontWeight: 'bold'
          }}>
            {collapsed ? 'AI' : 'AIOMS'}
          </h2>
        </div>
        <div style={{ padding: '16px 0' }}>
          {menuItems.map(item => (
            <div
              key={item.key}
              onClick={() => setSelectedMenu(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 24px',
                cursor: 'pointer',
                backgroundColor: selectedMenu === item.key ? '#e6f7ff' : 'transparent',
                borderRight: selectedMenu === item.key ? '3px solid #1890ff' : '3px solid transparent',
                transition: 'all 0.3s ease'
              }}
            >
              <span style={{ 
                marginRight: collapsed ? 0 : '12px',
                fontSize: '16px',
                color: selectedMenu === item.key ? '#1890ff' : '#666'
              }}>
                {item.icon}
              </span>
              {!collapsed && (
                <span style={{ 
                  color: selectedMenu === item.key ? '#1890ff' : '#666',
                  fontWeight: selectedMenu === item.key ? '600' : '400'
                }}>
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#666' }}>
              Welcome, {user.first_name} {user.last_name}
            </span>
            <Button
              type="primary"
              danger
              icon={<LogoutOutlined />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </Header>
        <Content style={{ 
          margin: 0, 
          padding: 0, 
          background: '#f5f5f5',
          position: 'relative'
        }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;