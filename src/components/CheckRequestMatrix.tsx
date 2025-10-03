import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Spin, Button, Space, Tooltip, Statistic, Row, Col, Select, Input } from 'antd';
import { ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import type { DomainMatrixData } from '../data/mockData';
import { STATUS_MAP } from '../data/mockData';
import { CheckRequestService } from '../services/checkRequestService';

const { Option } = Select;

interface CheckRequestMatrixProps {
  className?: string;
}

const CheckRequestMatrix: React.FC<CheckRequestMatrixProps> = ({ className }) => {
  const [matrixData, setMatrixData] = useState<DomainMatrixData[]>([]);
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
      const data = await CheckRequestService.getMatrixData();
      setMatrixData(data);
      if (data.length === 0) {
        setError('No data found. Please check the YAML configuration file.');
      }
    } catch (error) {
      console.error('Failed to load matrix data:', error);
      setError('Failed to load data. Please check the YAML file format.');
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

  // 过滤数据
  // 仅展示一个已选domain
  const filteredData = selectedDomainData ? [selectedDomainData] : [];

  // 简化的矩阵显示（纵轴：instances；横轴：check functions）
  const renderMatrix = () => {
    const displayInstances = allInstances.filter(instance =>
      !searchInstance || instance.toLowerCase().includes(searchInstance.toLowerCase())
    );
    const displayCheckFunctions = allCheckFunctions.filter(cf =>
      !searchCheckFunction || cf.toLowerCase().includes(searchCheckFunction.toLowerCase())
    );

    return (
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px', border: '1px solid #d9d9d9', backgroundColor: '#fafafa', position: 'sticky', left: 0, zIndex: 1, minWidth: '160px' }}>
                Instance
              </th>
              {displayCheckFunctions.map(cf => (
                <th key={cf} style={{ padding: '8px', border: '1px solid #d9d9d9', backgroundColor: '#fafafa', minWidth: '150px' }}>
                  {cf}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayInstances.map(instance => {
              const instanceData = selectedDomainData?.instances[instance] || {};
              return (
                <tr key={instance}>
                  <td style={{ padding: '8px', border: '1px solid #d9d9d9', backgroundColor: '#f8f9fa', position: 'sticky', left: 0, zIndex: 1 }}>
                    <Tag color="blue" style={{ fontWeight: 'bold', color: '#000' }}>{instance}</Tag>
                  </td>
                  {displayCheckFunctions.map(cf => {
                    const checkRequest = (instanceData as any)[cf];
                    if (!checkRequest) {
                      return (
                        <td key={`${instance}-${cf}`} style={{ padding: '4px', border: '1px solid #d9d9d9', textAlign: 'center', color: '#ccc', fontSize: '10px' }}>-</td>
                      );
                    }

                    const status = STATUS_MAP[checkRequest.value as keyof typeof STATUS_MAP];
                    return (
                      <td key={`${instance}-${cf}`} style={{ padding: '4px', border: '1px solid #d9d9d9', verticalAlign: 'middle' }}>
                        <Tooltip title={`${cf}: ${status.label}`} placement="top">
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              margin: '0 auto',
                              borderRadius: '4px',
                              backgroundColor: status.bgColor,
                              border: `2px solid ${status.color}`,
                            }}
                          />
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
    );
  };

  // 统计数据
  const getStatistics = () => {
    const allRequests = matrixData.flatMap(domain =>
      Object.values(domain.instances).flatMap(instance => Object.values(instance))
    );

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
  };

  const statistics = (() => {
    if (!selectedDomainData) {
      return { total: 0, healthy: 0, failed: 0, unknown: 0 };
    }
    const allRequests = Object.values(selectedDomainData.instances).flatMap(inst => Object.values(inst));
    const stats = (allRequests as any[]).reduce((acc, req: any) => {
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
      <Card
        title="Check Request Matrix"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        {/* 统计信息 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic
              title="Total"
              value={statistics.total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Healthy"
              value={statistics.healthy}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="failed"
              value={statistics.failed}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Unknown"
              value={statistics.unknown}
              valueStyle={{ color: '#d9d9d9' }}
            />
          </Col>
        </Row>

        {/* 过滤器 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Select
              placeholder="Select Domain"
              value={selectedDomain}
              onChange={setSelectedDomain}
              style={{ width: '100%' }}
            >
              {matrixData.map(domain => (
                <Option key={domain.domain} value={domain.domain}>
                  {domain.domain}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Input
              placeholder="Search Instance"
              value={searchInstance}
              onChange={(e) => setSearchInstance(e.target.value)}
              prefix={<FilterOutlined />}
            />
          </Col>
          <Col span={6}>
            <Input
              placeholder="Search Check Function"
              value={searchCheckFunction}
              onChange={(e) => setSearchCheckFunction(e.target.value)}
              prefix={<FilterOutlined />}
            />
          </Col>
        </Row>

        {/* 错误显示 */}
        {error && (
          <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '6px' }}>
            <div style={{ color: '#ff4d4f', fontWeight: 'bold', marginBottom: '8px' }}>
              ⚠️ Configuration Error
            </div>
            <div style={{ color: '#666', marginBottom: '8px' }}>{error}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              Please edit the <code>/public/check_requests.yaml</code> file with your Prometheus-style data.
            </div>
          </div>
        )}

        {/* 状态图例 */}
        <div style={{ marginBottom: 16, padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
          <strong>Status Legend: </strong>
          {Object.entries(STATUS_MAP).map(([value, status]) => (
            <Tag
              key={value}
              color={status.color}
              style={{
                margin: '0 4px',
                backgroundColor: status.bgColor,
                border: `1px solid ${status.color}`,
                color: '#000',
              }}
            >
              {status.label}
            </Tag>
          ))}
        </div>

        {/* YAML文件说明 */}
        {!error && matrixData.length > 0 && (
          <div style={{ marginBottom: 16, padding: '8px', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '6px', fontSize: '12px' }}>
            <strong>📝 Data Source:</strong> Loading from <code>/public/check_requests.yaml</code>. 
            Edit this file to update the matrix data. Each domain can have different instances and check functions.
          </div>
        )}

        {/* 矩阵表格 */}
        <Spin spinning={loading}>
          {renderMatrix()}
        </Spin>
      </Card>
    </div>
  );
};

export default CheckRequestMatrix;
