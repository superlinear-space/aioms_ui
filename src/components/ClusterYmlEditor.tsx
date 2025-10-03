import React, { useState } from 'react';
import { Button, Input, Tabs, App } from 'antd';
import type { YamlSections } from '../types/clusterTypes';

interface ClusterYmlEditorProps {
  yamlSections: YamlSections;
  setYamlSections: React.Dispatch<React.SetStateAction<YamlSections>>;
  yamlActiveTab: string;
  setYamlActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

const ClusterYmlEditor: React.FC<ClusterYmlEditorProps> = ({
  yamlSections,
  setYamlSections,
  yamlActiveTab,
  setYamlActiveTab
}) => {
  const { message } = App.useApp();

  // YAML Parser
  const parseYamlContent = (content: string) => {
    const lines = content.split('\n');
    const sections = {
      devices: [] as Array<{device_model: string, instances: string}>,
      networks: [] as Array<{network: string, nodes: string, links: string}>,
      tenants: [] as Array<{tenant: string, instances: string}>,
      system: { epilogue: [] as string[] },
      request_labels: [] as string[],
      set_labels: {} as Record<string, string>
    };
    
    let currentSection = '';
    let currentDevice: any = null;
    let currentNetwork: any = null;
    let currentTenant: any = null;
    let inEpilogue = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('devices:')) {
        currentSection = 'devices';
      } else if (line.startsWith('networks:')) {
        currentSection = 'networks';
      } else if (line.startsWith('tenants:')) {
        currentSection = 'tenants';
      } else if (line.startsWith('system:')) {
        currentSection = 'system';
      } else if (line.startsWith('request_labels:')) {
        currentSection = 'request_labels';
      } else if (line.startsWith('set_labels:')) {
        currentSection = 'set_labels';
      } else if (line.startsWith('epilogue:')) {
        inEpilogue = true;
      } else if (line.startsWith('- device_model:')) {
        currentDevice = { device_model: '', instances: '' };
        sections.devices.push(currentDevice);
      } else if (line.startsWith('  instances:')) {
        if (currentDevice) {
          currentDevice.instances = line.replace('  instances:', '').trim();
        }
      } else if (line.startsWith('- network:')) {
        currentNetwork = { network: '', nodes: '', links: '' };
        sections.networks.push(currentNetwork);
      } else if (line.startsWith('  nodes:')) {
        if (currentNetwork) {
          currentNetwork.nodes = line.replace('  nodes:', '').trim();
        }
      } else if (line.startsWith('  links:')) {
        if (currentNetwork) {
          currentNetwork.links = line.replace('  links:', '').trim();
        }
      } else if (line.startsWith('- tenant:')) {
        currentTenant = { tenant: '', instances: '' };
        sections.tenants.push(currentTenant);
      } else if (line.startsWith('  instances:') && currentTenant) {
        currentTenant.instances = line.replace('  instances:', '').trim();
      } else if (line.startsWith('- ') && currentSection === 'request_labels') {
        sections.request_labels.push(line.replace('- ', '').trim());
      } else if (line.startsWith('  ') && currentSection === 'set_labels') {
        const parts = line.trim().split(':');
        if (parts.length === 2) {
          sections.set_labels[parts[0]] = parts[1].trim();
        }
      } else if (inEpilogue && line.startsWith('- ')) {
        sections.system.epilogue.push(line.replace('- ', '').trim());
      }
    }
    
    return sections;
  };

  // YAML Editor Functions
  const loadYamlFile = async () => {
    try {
      const response = await fetch('/cluster.yml');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      const parsed = parseYamlContent(content);
      setYamlSections(parsed);
      message.success('YAML file loaded successfully!');
    } catch (error) {
      message.error('Failed to load YAML file');
      console.error('Error loading YAML file:', error);
    }
  };

  const saveYamlFile = () => {
    try {
      // In a real application, this would save to the server
      message.success('YAML file saved successfully! (Note: This is a demo - file not actually saved)');
    } catch (error) {
      message.error('Failed to save YAML file');
      console.error('Error saving YAML file:', error);
    }
  };

  const downloadYamlFile = () => {
    try {
      // Generate YAML content from sections
      let yamlContent = '';
      
      // Devices section
      yamlContent += 'devices:\n';
      yamlSections.devices.forEach(device => {
        yamlContent += `- device_model: ${device.device_model}\n`;
        yamlContent += `  instances: ${device.instances}\n`;
      });
      
      // Networks section
      yamlContent += '\nnetworks:\n';
      yamlSections.networks.forEach(network => {
        yamlContent += `- network: ${network.network}\n`;
        yamlContent += `  nodes: ${network.nodes}\n`;
        yamlContent += `  links: ${network.links}\n`;
      });
      
      // Tenants section
      yamlContent += '\ntenants:\n';
      yamlSections.tenants.forEach(tenant => {
        yamlContent += `- tenant: ${tenant.tenant}\n`;
        yamlContent += `  instances: ${tenant.instances}\n`;
      });
      
      // System section
      yamlContent += '\nsystem:\n';
      yamlContent += '  epilogue:\n';
      yamlSections.system.epilogue.forEach(command => {
        yamlContent += `    - ${command}\n`;
      });
      
      // Request labels section
      yamlContent += '\nrequest_labels:\n';
      yamlSections.request_labels.forEach(label => {
        yamlContent += `  - ${label}\n`;
      });
      
      // Set labels section
      yamlContent += '\nset_labels:\n';
      Object.entries(yamlSections.set_labels).forEach(([key, value]) => {
        yamlContent += `  ${key}: ${value}\n`;
      });

      const blob = new Blob([yamlContent], { type: 'text/yaml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cluster.yml';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('YAML file downloaded!');
    } catch (error) {
      message.error('Failed to download YAML file');
      console.error('Error downloading YAML file:', error);
    }
  };

  // YAML Section Handlers
  const handleYamlDeviceChange = (index: number, field: string, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      devices: prev.devices.map((device, i) => 
        i === index ? { ...device, [field]: value } : device
      )
    }));
  };

  const handleAddYamlDevice = () => {
    setYamlSections(prev => ({
      ...prev,
      devices: [...prev.devices, { device_model: '', instances: '' }]
    }));
    message.success('New device added!');
  };

  const handleDeleteYamlDevice = (index: number) => {
    setYamlSections(prev => ({
      ...prev,
      devices: prev.devices.filter((_, i) => i !== index)
    }));
    message.success('Device deleted!');
  };

  const handleYamlNetworkChange = (index: number, field: string, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      networks: prev.networks.map((network, i) => 
        i === index ? { ...network, [field]: value } : network
      )
    }));
  };

  const handleAddYamlNetwork = () => {
    setYamlSections(prev => ({
      ...prev,
      networks: [...prev.networks, { network: '', nodes: '', links: '' }]
    }));
    message.success('New network added!');
  };

  const handleDeleteYamlNetwork = (index: number) => {
    setYamlSections(prev => ({
      ...prev,
      networks: prev.networks.filter((_, i) => i !== index)
    }));
    message.success('Network deleted!');
  };

  const handleYamlTenantChange = (index: number, field: string, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      tenants: prev.tenants.map((tenant, i) => 
        i === index ? { ...tenant, [field]: value } : tenant
      )
    }));
  };

  const handleAddYamlTenant = () => {
    setYamlSections(prev => ({
      ...prev,
      tenants: [...prev.tenants, { tenant: '', instances: '' }]
    }));
    message.success('New tenant added!');
  };

  const handleDeleteYamlTenant = (index: number) => {
    setYamlSections(prev => ({
      ...prev,
      tenants: prev.tenants.filter((_, i) => i !== index)
    }));
    message.success('Tenant deleted!');
  };

  const handleYamlEpilogueChange = (index: number, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      system: {
        ...prev.system,
        epilogue: prev.system.epilogue.map((item, i) => i === index ? value : item)
      }
    }));
  };

  const handleAddYamlEpilogue = () => {
    setYamlSections(prev => ({
      ...prev,
      system: {
        ...prev.system,
        epilogue: [...prev.system.epilogue, '']
      }
    }));
    message.success('New epilogue command added!');
  };

  const handleDeleteYamlEpilogue = (index: number) => {
    setYamlSections(prev => ({
      ...prev,
      system: {
        ...prev.system,
        epilogue: prev.system.epilogue.filter((_, i) => i !== index)
      }
    }));
    message.success('Epilogue command deleted!');
  };

  const handleYamlRequestLabelChange = (index: number, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      request_labels: prev.request_labels.map((item, i) => i === index ? value : item)
    }));
  };

  const handleAddYamlRequestLabel = () => {
    setYamlSections(prev => ({
      ...prev,
      request_labels: [...prev.request_labels, '']
    }));
    message.success('New request label added!');
  };

  const handleDeleteYamlRequestLabel = (index: number) => {
    setYamlSections(prev => ({
      ...prev,
      request_labels: prev.request_labels.filter((_, i) => i !== index)
    }));
    message.success('Request label deleted!');
  };

  const handleYamlSetLabelChange = (key: string, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      set_labels: { ...prev.set_labels, [key]: value }
    }));
  };

  const handleAddYamlSetLabel = () => {
    const key = prompt('Enter label key:');
    if (key) {
      setYamlSections(prev => ({
        ...prev,
        set_labels: { ...prev.set_labels, [key]: '' }
      }));
      message.success('New set label added!');
    }
  };

  const handleDeleteYamlSetLabel = (key: string) => {
    setYamlSections(prev => {
      const newSetLabels = { ...prev.set_labels };
      delete newSetLabels[key];
      return { ...prev, set_labels: newSetLabels };
    });
    message.success('Set label deleted!');
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
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
              Cluster YAML Configuration
            </h2>
            <p style={{ 
              margin: 0, 
              color: '#64748b', 
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              Manage your cluster configuration with structured editing
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              onClick={loadYamlFile}
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
              🔄 Reload
            </Button>
            <Button
              onClick={saveYamlFile}
              style={{ 
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                padding: '0 20px',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)'
              }}
            >
              💾 Save
            </Button>
            <Button
              onClick={downloadYamlFile}
              style={{ 
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: 'none',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                padding: '0 20px',
                boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)'
              }}
            >
              📥 Download
            </Button>
          </div>
        </div>
        
        <Tabs
          activeKey={yamlActiveTab}
          onChange={setYamlActiveTab}
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
          tabBarStyle={{
            background: '#f8fafc',
            margin: 0,
            padding: '0 20px',
            borderBottom: '1px solid #e2e8f0',
            borderRadius: '12px 12px 0 0'
          }}
          items={[
            {
              key: 'devices',
              label: (
                <span style={{
                  fontSize: '15px',
                  fontWeight: yamlActiveTab === 'devices' ? '600' : '500',
                  color: yamlActiveTab === 'devices' ? '#1e40af' : '#64748b',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}>
                  🖥️ Devices
                </span>
              ),
              children: (
                <div style={{ padding: '24px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '20px' 
                  }}>
                    <h3 style={{ margin: 0, color: '#1a365d' }}>Device Management</h3>
                    <Button 
                      type="primary" 
                      onClick={handleAddYamlDevice}
                      style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                    >
                      ➕ Add Device
                    </Button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {yamlSections.devices.map((device, index) => (
                      <div key={index} style={{
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '20px',
                        backgroundColor: '#f8fafc'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '16px' 
                        }}>
                          <h4 style={{ margin: 0, color: '#2d3748' }}>
                            Device #{index + 1}
                          </h4>
                          <Button
                            size="small"
                            danger
                            onClick={() => handleDeleteYamlDevice(index)}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#374151',
                              marginBottom: '8px' 
                            }}>
                              Device Model
                            </label>
                            <Input
                              value={device.device_model}
                              onChange={(e) => handleYamlDeviceChange(index, 'device_model', e.target.value)}
                              placeholder="e.g., R6500"
                              style={{ 
                                height: '40px',
                                borderRadius: '8px',
                                border: '2px solid #d1d5db'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#374151',
                              marginBottom: '8px' 
                            }}>
                              Instances
                            </label>
                            <Input
                              value={device.instances}
                              onChange={(e) => handleYamlDeviceChange(index, 'instances', e.target.value)}
                              placeholder="e.g., su1-gpu[1-32]"
                              style={{ 
                                height: '40px',
                                borderRadius: '8px',
                                border: '2px solid #d1d5db'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {yamlSections.devices.length === 0 && (
                      <div style={{ 
                        textAlign: 'center', 
                        color: '#666', 
                        fontStyle: 'italic',
                        padding: '40px'
                      }}>
                        No devices configured. Click "Add Device" to add one.
                      </div>
                    )}
                  </div>
                </div>
              )
            },
            {
              key: 'networks',
              label: (
                <span style={{
                  fontSize: '15px',
                  fontWeight: yamlActiveTab === 'networks' ? '600' : '500',
                  color: yamlActiveTab === 'networks' ? '#1e40af' : '#64748b',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}>
                  🌐 Networks
                </span>
              ),
              children: (
                <div style={{ padding: '24px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '20px' 
                  }}>
                    <h3 style={{ margin: 0, color: '#1a365d' }}>Network Management</h3>
                    <Button 
                      type="primary" 
                      onClick={handleAddYamlNetwork}
                      style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                    >
                      ➕ Add Network
                    </Button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {yamlSections.networks.map((network, index) => (
                      <div key={index} style={{
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '20px',
                        backgroundColor: '#f8fafc'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '16px' 
                        }}>
                          <h4 style={{ margin: 0, color: '#2d3748' }}>
                            Network #{index + 1}
                          </h4>
                          <Button
                            size="small"
                            danger
                            onClick={() => handleDeleteYamlNetwork(index)}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#374151',
                              marginBottom: '8px' 
                            }}>
                              Network Name
                            </label>
                            <Input
                              value={network.network}
                              onChange={(e) => handleYamlNetworkChange(index, 'network', e.target.value)}
                              placeholder="e.g., compute-network"
                              style={{ 
                                height: '40px',
                                borderRadius: '8px',
                                border: '2px solid #d1d5db'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#374151',
                              marginBottom: '8px' 
                            }}>
                              Nodes File
                            </label>
                            <Input
                              value={network.nodes}
                              onChange={(e) => handleYamlNetworkChange(index, 'nodes', e.target.value)}
                              placeholder="e.g., node_guid_mapping.csv"
                              style={{ 
                                height: '40px',
                                borderRadius: '8px',
                                border: '2px solid #d1d5db'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#374151',
                              marginBottom: '8px' 
                            }}>
                              Links File
                            </label>
                            <Input
                              value={network.links}
                              onChange={(e) => handleYamlNetworkChange(index, 'links', e.target.value)}
                              placeholder="e.g., links.csv"
                              style={{ 
                                height: '40px',
                                borderRadius: '8px',
                                border: '2px solid #d1d5db'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {yamlSections.networks.length === 0 && (
                      <div style={{ 
                        textAlign: 'center', 
                        color: '#666', 
                        fontStyle: 'italic',
                        padding: '40px'
                      }}>
                        No networks configured. Click "Add Network" to add one.
                      </div>
                    )}
                  </div>
                </div>
              )
            },
            {
              key: 'tenants',
              label: (
                <span style={{
                  fontSize: '15px',
                  fontWeight: yamlActiveTab === 'tenants' ? '600' : '500',
                  color: yamlActiveTab === 'tenants' ? '#1e40af' : '#64748b',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}>
                  🏢 Tenants
                </span>
              ),
              children: (
                <div style={{ padding: '24px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '20px' 
                  }}>
                    <h3 style={{ margin: 0, color: '#1a365d' }}>Tenant Management</h3>
                    <Button 
                      type="primary" 
                      onClick={handleAddYamlTenant}
                      style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                    >
                      ➕ Add Tenant
                    </Button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {yamlSections.tenants.map((tenant, index) => (
                      <div key={index} style={{
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '20px',
                        backgroundColor: '#f8fafc'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '16px' 
                        }}>
                          <h4 style={{ margin: 0, color: '#2d3748' }}>
                            Tenant #{index + 1}
                          </h4>
                          <Button
                            size="small"
                            danger
                            onClick={() => handleDeleteYamlTenant(index)}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#374151',
                              marginBottom: '8px' 
                            }}>
                              Tenant Name
                            </label>
                            <Input
                              value={tenant.tenant}
                              onChange={(e) => handleYamlTenantChange(index, 'tenant', e.target.value)}
                              placeholder="e.g., tenant1"
                              style={{ 
                                height: '40px',
                                borderRadius: '8px',
                                border: '2px solid #d1d5db'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#374151',
                              marginBottom: '8px' 
                            }}>
                              Instances
                            </label>
                            <Input
                              value={tenant.instances}
                              onChange={(e) => handleYamlTenantChange(index, 'instances', e.target.value)}
                              placeholder="e.g., su1-gpu[1-8]"
                              style={{ 
                                height: '40px',
                                borderRadius: '8px',
                                border: '2px solid #d1d5db'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {yamlSections.tenants.length === 0 && (
                      <div style={{ 
                        textAlign: 'center', 
                        color: '#666', 
                        fontStyle: 'italic',
                        padding: '40px'
                      }}>
                        No tenants configured. Click "Add Tenant" to add one.
                      </div>
                    )}
                  </div>
                </div>
              )
            },
            {
              key: 'system',
              label: (
                <span style={{
                  fontSize: '15px',
                  fontWeight: yamlActiveTab === 'system' ? '600' : '500',
                  color: yamlActiveTab === 'system' ? '#1e40af' : '#64748b',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}>
                  ⚙️ System
                </span>
              ),
              children: (
                <div style={{ padding: '24px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '20px' 
                  }}>
                    <h3 style={{ margin: 0, color: '#1a365d' }}>System Configuration</h3>
                    <Button 
                      type="primary" 
                      onClick={handleAddYamlEpilogue}
                      style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                    >
                      ➕ Add Epilogue Command
                    </Button>
                  </div>
                  <div style={{ 
                    border: '2px solid #e2e8f0', 
                    borderRadius: '12px', 
                    padding: '20px',
                    backgroundColor: '#f8fafc'
                  }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#2d3748' }}>Epilogue Commands</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {yamlSections.system.epilogue.map((command, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px',
                          padding: '12px',
                          background: 'white',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db'
                        }}>
                          <Input
                            value={command}
                            onChange={(e) => handleYamlEpilogueChange(index, e.target.value)}
                            placeholder="Enter epilogue command..."
                            style={{ 
                              flex: 1,
                              height: '36px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db'
                            }}
                          />
                          <Button
                            size="small"
                            danger
                            onClick={() => handleDeleteYamlEpilogue(index)}
                          >
                            🗑️
                          </Button>
                        </div>
                      ))}
                      {yamlSections.system.epilogue.length === 0 && (
                        <div style={{ 
                          textAlign: 'center', 
                          color: '#666', 
                          fontStyle: 'italic',
                          padding: '20px'
                        }}>
                          No epilogue commands configured. Click "Add Epilogue Command" to add one.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            },
            {
              key: 'labels',
              label: (
                <span style={{
                  fontSize: '15px',
                  fontWeight: yamlActiveTab === 'labels' ? '600' : '500',
                  color: yamlActiveTab === 'labels' ? '#1e40af' : '#64748b',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}>
                  🏷️ Labels
                </span>
              ),
              children: (
                <div style={{ padding: '24px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '20px' 
                  }}>
                    <h3 style={{ margin: 0, color: '#1a365d' }}>Label Management</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <Button 
                        type="primary" 
                        onClick={handleAddYamlRequestLabel}
                        style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                      >
                        ➕ Add Request Label
                      </Button>
                      <Button 
                        type="primary" 
                        onClick={handleAddYamlSetLabel}
                        style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}
                      >
                        ➕ Add Set Label
                      </Button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div style={{ 
                      border: '2px solid #e2e8f0', 
                      borderRadius: '12px', 
                      padding: '20px',
                      backgroundColor: '#f8fafc'
                    }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#2d3748' }}>Request Labels</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {yamlSections.request_labels.map((label, index) => (
                          <div key={index} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            padding: '12px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db'
                          }}>
                            <Input
                              value={label}
                              onChange={(e) => handleYamlRequestLabelChange(index, e.target.value)}
                              placeholder="Enter request label..."
                              style={{ 
                                flex: 1,
                                height: '36px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db'
                              }}
                            />
                            <Button
                              size="small"
                              danger
                              onClick={() => handleDeleteYamlRequestLabel(index)}
                            >
                              🗑️
                            </Button>
                          </div>
                        ))}
                        {yamlSections.request_labels.length === 0 && (
                          <div style={{ 
                            textAlign: 'center', 
                            color: '#666', 
                            fontStyle: 'italic',
                            padding: '20px'
                          }}>
                            No request labels configured.
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ 
                      border: '2px solid #e2e8f0', 
                      borderRadius: '12px', 
                      padding: '20px',
                      backgroundColor: '#f8fafc'
                    }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#2d3748' }}>Set Labels</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(yamlSections.set_labels).map(([key, value]) => (
                          <div key={key} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            padding: '12px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db'
                          }}>
                            <Input
                              value={key}
                              readOnly
                              style={{ 
                                width: '120px',
                                height: '36px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                background: '#f9fafb'
                              }}
                            />
                            <span style={{ color: '#6b7280' }}>:</span>
                            <Input
                              value={value}
                              onChange={(e) => handleYamlSetLabelChange(key, e.target.value)}
                              placeholder="Enter value..."
                              style={{ 
                                flex: 1,
                                height: '36px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db'
                              }}
                            />
                            <Button
                              size="small"
                              danger
                              onClick={() => handleDeleteYamlSetLabel(key)}
                            >
                              🗑️
                            </Button>
                          </div>
                        ))}
                        {Object.keys(yamlSections.set_labels).length === 0 && (
                          <div style={{ 
                            textAlign: 'center', 
                            color: '#666', 
                            fontStyle: 'italic',
                            padding: '20px'
                          }}>
                            No set labels configured.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
          ]}
        />
      </div>
    </div>
  );
};

export default ClusterYmlEditor;
