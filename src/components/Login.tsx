import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Row, Col, Space, App } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

interface LoginFormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [form] = Form.useForm();
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { message } = App.useApp();

  const onFinish = async (values: LoginFormData) => {
    setIsSubmitting(true);
    
    try {
      const success = await login(values.email, values.password);
      
      if (success) {
        message.success('Login successful!');
        navigate('/dashboard');
      } else {
        message.error('Invalid email or password');
      }
    } catch (error) {
      message.error('Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.95) 100%),
        url('/images/login-bg.png') center/cover no-repeat
      `,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Row 
        gutter={[48, 48]} 
        style={{ 
          width: '100%', 
          maxWidth: 1200,
          alignItems: 'center'
        }}
      >
        {/* Left Side - Hero Section */}
        <Col xs={24} lg={12}>
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            textAlign: 'center',
            color: '#1a365d',
            padding: '40px 20px'
          }}>
            {/* Company Logo */}
            <div style={{ marginBottom: '32px' }}>
              <img 
                src="/images/company-logo.png" 
                alt="AIOMS Logo" 
                style={{ 
                  height: '60px'
                }}
                onError={(e) => {
                  // Fallback to text logo if image not found
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling!.style.display = 'block';
                }}
              />
              <div style={{ 
                display: 'none',
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#1a365d'
              }}>
                AIOMS
              </div>
            </div>

            {/* Hero Image */}
            <div style={{ marginBottom: '32px' }}>
              <img 
                src="/images/login-hero.png" 
                alt="AI Operations Management" 
                style={{ 
                  maxWidth: '100%',
                  height: 'auto',
                  maxHeight: '300px',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                }}
                onError={(e) => {
                  // Fallback to icon if image not found
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling!.style.display = 'flex';
                }}
              />
              <div style={{ 
                display: 'none',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <SafetyOutlined style={{ fontSize: '64px', color: '#1a365d' }} />
              </div>
            </div>

            <Title level={1} style={{ 
              color: '#1a365d', 
              marginBottom: '16px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: '600'
            }}>
              AIOMS
            </Title>
            <Paragraph style={{ 
              color: '#2d3748',
              fontSize: '16px',
              lineHeight: '1.5',
              marginBottom: '24px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}>
              Streamline your AI operations with our comprehensive management platform. 
              Monitor, analyze, and optimize your AI infrastructure with ease.
            </Paragraph>
            
            <Space size="large" wrap>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a365d' }}>99.9%</div>
                <div style={{ color: '#4a5568' }}>Uptime</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a365d' }}>24/7</div>
                <div style={{ color: '#4a5568' }}>Monitoring</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a365d' }}>AI-Powered</div>
                <div style={{ color: '#4a5568' }}>Analytics</div>
              </div>
            </Space>
          </div>
        </Col>

        {/* Right Side - Login Form */}
        <Col xs={24} lg={12}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '20px'
          }}>
            <Card
            style={{
              maxWidth: 450,
              margin: '0 auto',
              boxShadow: '0 20px 40px rgba(26, 54, 93, 0.2)',
              borderRadius: '16px',
              border: '1px solid rgba(26, 54, 93, 0.1)',
              backgroundColor: 'rgba(26, 54, 93, 0.05)',
              backdropFilter: 'blur(10px)'
            }}
            styles={{ body: { padding: '48px' } }}
          >
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <Title level={2} style={{ margin: 0, color: '#1a365d', marginBottom: '8px' }}>
                Welcome Back
              </Title>
              <Text style={{ fontSize: '16px', color: '#2d3748' }}>
                Sign in to access your dashboard
              </Text>
            </div>

            <Form
              form={form}
              name="login"
              onFinish={onFinish}
              onFinishFailed={onFinishFailed}
              autoComplete="off"
              layout="vertical"
              size="large"
            >
              <Form.Item
                label="Email Address"
                name="email"
                rules={[
                  { required: true, message: 'Please input your email!' },
                  { type: 'email', message: 'Please enter a valid email!' }
                ]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#1a365d' }} />}
                  placeholder="Enter your email address"
                  disabled={isSubmitting}
                  style={{ 
                    height: '48px',
                    borderColor: '#1a365d',
                    backgroundColor: 'rgba(26, 54, 93, 0.02)'
                  }}
                />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[
                  { required: true, message: 'Please input your password!' },
                  { min: 6, message: 'Password must be at least 6 characters!' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#1a365d' }} />}
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  style={{ 
                    height: '48px',
                    borderColor: '#1a365d',
                    backgroundColor: 'rgba(26, 54, 93, 0.02)'
                  }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: '24px', marginTop: '32px' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={isSubmitting}
                  style={{
                    height: '52px',
                    fontSize: '16px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #1a365d 0%, #2d3748 100%)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(26, 54, 93, 0.3)'
                  }}
                >
                  {isSubmitting ? 'Signing In...' : 'Sign In to Dashboard'}
                </Button>
              </Form.Item>
            </Form>

            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default Login;
