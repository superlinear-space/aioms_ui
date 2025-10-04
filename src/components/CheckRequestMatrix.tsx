import React, { useState, useEffect } from 'react';
import { Spin, Button, Tooltip, Row, Col, Select, Input } from 'antd';
import { ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import { PrometheusService, type MatrixData } from '../services/prometheusService';

// 状态映射
const STATUS_MAP = {
  0: { label: 'Healthy', color: '#52c41a', bgColor: '#f6ffed' },
  1: { label: 'Failed', color: '#ff4d4f', bgColor: '#fff2f0' },
  2: { label: 'Unknown', color: '#fadb14', bgColor: '#fffbe6' }
};

const { Option } = Select;

interface CheckRequestMatrixProps {
  className?: string;
}

const CheckRequestMatrix: React.FC<CheckRequestMatrixProps> = ({ className }) => {
  const [matrixData, setMatrixData] = useState<MatrixData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [searchInstance, setSearchInstance] = useState<string>('');
  const [searchCheckFunction, setSearchCheckFunction] = useState<string>('');
  const [error, setError] = useState<string>('');

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await PrometheusService.buildMatrixData();
      setMatrixData(data);
      if (data.length === 0) {
        setError('No data found. Please check the cluster configuration and Prometheus connection.');
      }
    } catch (error) {
      console.error('Failed to load matrix data:', error);
      setError('Failed to load data. Please check the cluster configuration and Prometheus connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 当加载到数据后，若未选择domain，则默认选择第一个domain
  useEffect(() => {
    if (!selectedDomain && matrixData.length > 0) {
      setSelectedDomain(matrixData[0].domain);
    }
  }, [matrixData, selectedDomain]);

  // 根据选中domain动态计算行(Instances)与列(Check Functions)
  const selectedDomainData = matrixData.find(d => d.domain === selectedDomain);
  const allInstances = selectedDomainData
    ? Object.keys(selectedDomainData.instances).sort()
    : [];
  const allCheckFunctions = selectedDomainData
    ? Array.from(
        new Set(
          Object.values(selectedDomainData.instances)
            .flatMap(inst => Object.keys(inst))
        )
      ).sort()
    : [];


  // 简化的矩阵显示（纵轴：instances；横轴：check functions）
  const renderMatrix = () => {
    const displayInstances = allInstances.filter(instance =>
      !searchInstance || instance.toLowerCase().includes(searchInstance.toLowerCase())
    );
    const displayCheckFunctions = allCheckFunctions.filter(cf =>
      !searchCheckFunction || cf.toLowerCase().includes(searchCheckFunction.toLowerCase())
    );

    return (
      <div style={{ 
        overflow: 'auto', 
        borderRadius: '8px',
        maxHeight: '600px', // 限制垂直高度
        maxWidth: '100%',   // 限制水平宽度
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        // 自定义滚动条样式
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 #f1f5f9'
      }}>
        <style>
          {`
            .matrix-scroll::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            .matrix-scroll::-webkit-scrollbar-track {
              background: #f1f5f9;
              border-radius: 4px;
            }
            .matrix-scroll::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 4px;
            }
            .matrix-scroll::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `}
        </style>
        <div className="matrix-scroll" style={{ 
          overflow: 'auto',
          maxHeight: '600px',
          maxWidth: '100%'
        }}>
          <table style={{ 
            width: 'max-content', // 让表格根据内容自适应宽度
            minWidth: '100%',     // 确保至少占满容器宽度
            borderCollapse: 'collapse', 
            fontSize: '14px',
            background: 'white',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
          <thead>
            <tr>
              <th style={{ 
                padding: '16px 12px', 
                border: 'none', 
                backgroundColor: '#f8fafc', 
                position: 'sticky', 
                left: 0, 
                top: 0,
                zIndex: 2, 
                minWidth: '180px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                textAlign: 'left',
                borderBottom: '2px solid #e2e8f0',
                boxShadow: '2px 0 4px rgba(0, 0, 0, 0.1)'
              }}>
                Instance
              </th>
              {displayCheckFunctions.map(cf => (
                <th key={cf} style={{ 
                  padding: '16px 12px', 
                  border: 'none', 
                  backgroundColor: '#f8fafc', 
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  minWidth: '160px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  textAlign: 'center',
                  borderBottom: '2px solid #e2e8f0',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  {cf}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayInstances.map((instance, index) => {
              const instanceData = selectedDomainData?.instances[instance] || {};
              return (
                <tr key={instance} style={{
                  backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                  transition: 'background-color 0.2s ease'
                }}>
                  <td style={{ 
                    padding: '12px', 
                    border: 'none', 
                    backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb', 
                    position: 'sticky', 
                    left: 0, 
                    zIndex: 1,
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#3b82f6'
                      }} />
                      <span style={{ 
                        fontWeight: '600', 
                        color: '#1e293b',
                        fontSize: '14px'
                      }}>
                        {instance}
                      </span>
                    </div>
                  </td>
                  {displayCheckFunctions.map(cf => {
                    const checkRequest = (instanceData as any)[cf];
                    if (!checkRequest) {
                      return (
                        <td key={`${instance}-${cf}`} style={{ 
                          padding: '12px', 
                          border: 'none', 
                          textAlign: 'center', 
                          color: '#9ca3af', 
                          fontSize: '12px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            margin: '0 auto',
                            borderRadius: '6px',
                            backgroundColor: '#f3f4f6',
                            border: '2px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: '600',
                            color: '#9ca3af'
                          }}>
                            -
                          </div>
                        </td>
                      );
                    }

                    const status = STATUS_MAP[checkRequest.value as keyof typeof STATUS_MAP];
                    return (
                      <td key={`${instance}-${cf}`} style={{ 
                        padding: '12px', 
                        border: 'none', 
                        verticalAlign: 'middle',
                        textAlign: 'center',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <Tooltip title={`${cf}: ${status.label}`} placement="top">
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              margin: '0 auto',
                              borderRadius: '6px',
                              backgroundColor: status.bgColor,
                              border: `2px solid ${status.color}`,
                              cursor: 'pointer',
                              transition: 'transform 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: '600',
                              color: status.color
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            {checkRequest.value === 0 ? '✓' : checkRequest.value === 1 ? '✗' : checkRequest.value === 2 ? '?' : ''}
                          </div>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
    );
  };

  // 统计数据
  const statistics = (() => {
    if (!selectedDomainData) {
      return { total: 0, healthy: 0, failed: 0, unknown: 0 };
    }
    const allRequests = Object.values(selectedDomainData.instances).flatMap(inst => Object.values(inst));
    const stats = allRequests.reduce((acc, req) => {
      acc[req.value] = (acc[req.value] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    return {
      total: allRequests.length,
      healthy: stats[0] || 0,
      failed: stats[1] || 0,
      unknown: stats[2] || 0,
    };
  })();

  return (
    <div className={className}>
      <div style={{ 
        background: '#ffffff',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #e2e8f0',
        marginBottom: '32px'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              marginBottom: '8px', 
              color: '#1e293b',
              fontSize: '24px',
              fontWeight: '700',
              letterSpacing: '-0.025em'
            }}>
              Check Request Matrix
            </h2>
            <p style={{ 
              margin: 0, 
              color: '#64748b', 
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              Monitor and analyze check request status across your infrastructure
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
              style={{ 
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                border: 'none',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                padding: '0 20px',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
              }}
            >
              🔄 Refresh
            </Button>
          </div>
        </div>
        {/* 统计信息 */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              color: 'white',
              boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
            }}>
              <div style={{ fontSize: '64px', fontWeight: '700', marginBottom: '8px' }}>
                {statistics.total}
              </div>
              <div style={{ fontSize: '28px', fontWeight: '600', opacity: 0.9 }}>
                Total
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              color: 'white',
              boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'
            }}>
              <div style={{ fontSize: '64px', fontWeight: '700', marginBottom: '8px' }}>
                {statistics.healthy}
              </div>
              <div style={{ fontSize: '28px', fontWeight: '600', opacity: 0.9 }}>
                Healthy
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              color: 'white',
              boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.3)'
            }}>
              <div style={{ fontSize: '64px', fontWeight: '700', marginBottom: '8px' }}>
                {statistics.failed}
              </div>
              <div style={{ fontSize: '28px', fontWeight: '600', opacity: 0.9 }}>
                Failed
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div
              style={{
                background: 'linear-gradient(135deg, #fadb14, #faad14)', // 浅黄到亮黄渐变
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                color: 'white', // 深棕色文字，避免黄底上不清晰
                boxShadow: '0 4px 6px -1px rgba(250, 173, 20, 0.3)'
              }}
            >
              <div
                style={{
                  fontSize: '64px',
                  fontWeight: '700',
                  marginBottom: '8px'
                }}
              >
                {statistics.unknown}
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: '600',
                  opacity: 0.9
                }}
              >
                Unknown
              </div>
            </div>
          </Col>
        </Row>

        {/* 过滤器 */}
        <div style={{ 
          background: '#f8fafc',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0'
        }}>
          <h4 style={{ 
            margin: '0 0 16px 0', 
            color: '#1e293b',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            🔍 Filters
          </h4>
          <Row gutter={16}>
            <Col span={8}>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151',
                  marginBottom: '8px' 
                }}>
                  Domain
                </label>
                <Select
                  placeholder="Select Domain"
                  value={selectedDomain}
                  onChange={setSelectedDomain}
                  style={{ width: '100%' }}
                  size="large"
                >
                  {matrixData.map(domain => (
                    <Option key={domain.domain} value={domain.domain}>
                      {domain.domain}
                    </Option>
                  ))}
                </Select>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151',
                  marginBottom: '8px' 
                }}>
                  Instance
                </label>
                <Input
                  placeholder="Search Instance"
                  value={searchInstance}
                  onChange={(e) => setSearchInstance(e.target.value)}
                  prefix={<FilterOutlined />}
                  size="large"
                  style={{ 
                    borderRadius: '8px',
                    border: '2px solid #d1d5db'
                  }}
                />
              </div>
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: '8px' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151',
                  marginBottom: '8px' 
                }}>
                  Check Function
                </label>
                <Input
                  placeholder="Search Check Function"
                  value={searchCheckFunction}
                  onChange={(e) => setSearchCheckFunction(e.target.value)}
                  prefix={<FilterOutlined />}
                  size="large"
                  style={{ 
                    borderRadius: '8px',
                    border: '2px solid #d1d5db'
                  }}
                />
              </div>
            </Col>
          </Row>
        </div>

        {/* 错误显示 */}
        {error && (
          <div style={{ 
            marginBottom: '24px', 
            padding: '20px', 
            backgroundColor: '#fef2f2', 
            border: '2px solid #fecaca', 
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                ⚠️
              </div>
              <div style={{ 
                color: '#dc2626', 
                fontWeight: '700', 
                fontSize: '16px'
              }}>
                Configuration Error
              </div>
            </div>
            <div style={{ 
              color: '#374151', 
              marginBottom: '12px',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {error}
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#6b7280',
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <strong>💡 Solution:</strong> Please check:
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Prometheus server is running on <code style={{ 
                  background: '#f3f4f6',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>http://localhost:9090</code></li>
                <li>Cluster configuration files are properly set up</li>
                <li>Device model YAML files contain valid check functions</li>
              </ul>
            </div>
          </div>
        )}

        {/* 状态图例 */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '20px', 
          backgroundColor: '#f8fafc', 
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <h4 style={{ 
            margin: '0 0 16px 0', 
            color: '#1e293b',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            📊 Status Legend
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.entries(STATUS_MAP).map(([value, status]) => (
              <div
                key={value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: `2px solid ${status.color}`,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    backgroundColor: status.bgColor,
                    border: `2px solid ${status.color}`,
                  }}
                />
                <span style={{ 
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  {status.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* YAML文件说明 */}
        {!error && matrixData.length > 0 && (
          <div style={{ 
            marginBottom: '24px', 
            padding: '16px', 
            backgroundColor: '#eff6ff', 
            border: '2px solid #bfdbfe', 
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                📝
              </div>
              <div style={{ 
                color: '#1e40af', 
                fontWeight: '700', 
                fontSize: '14px'
              }}>
                Data Source
              </div>
            </div>
            <div style={{ 
              color: '#374151', 
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              Data loaded from <code style={{ 
                background: '#dbeafe',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#1e40af',
                fontWeight: '600'
              }}>/cluster.yml</code> and <code style={{ 
                background: '#dbeafe',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#1e40af',
                fontWeight: '600'
              }}>/device_models/</code> via <code style={{ 
                background: '#dbeafe',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#1e40af',
                fontWeight: '600'
              }}>Prometheus API</code>. 
              Real-time monitoring data is fetched from your Prometheus server.
            </div>
          </div>
        )}

        {/* 矩阵表格 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h4 style={{ 
              margin: 0, 
              color: '#1e293b',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              📋 Matrix View
            </h4>
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>💡</span>
              <span>Scroll horizontally and vertically to view all data</span>
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            <Spin spinning={loading}>
              {renderMatrix()}
            </Spin>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckRequestMatrix;
