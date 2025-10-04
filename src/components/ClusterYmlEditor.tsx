import React, { useState } from 'react';
import { Button, Input, Tabs, App, Table, Space, Collapse, Spin, Alert, Form, InputNumber, Switch, Select, Card, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, InfoCircleOutlined, SaveOutlined } from '@ant-design/icons';
import * as yaml from 'js-yaml';
import type { YamlSections } from '../types/clusterTypes';
import type { ColumnsType } from 'antd/es/table';

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

  // Base directory configuration
  const [modelDir, setModelDir] = useState<string>("./public/clusters/yiwu2-6");
  const [showDirectoryModal, setShowDirectoryModal] = useState<boolean>(false);

  // Add state for device model configurations and editing
  const [deviceModelConfigs, setDeviceModelConfigs] = useState<Record<string, any>>({});
  const [loadingConfigs, setLoadingConfigs] = useState<Record<string, boolean>>({});
  const [editingConfigs, setEditingConfigs] = useState<Record<string, any>>({});
  const [savingConfigs, setSavingConfigs] = useState<Record<string, boolean>>({});
  // Remove the activeEpilogueTab state since we won't need it anymore
  // const [activeEpilogueTab, setActiveEpilogueTab] = useState<string>('0'); // Remove this line

  // YAML Parser using js-yaml
  const parseYamlContent = (content: string) => {
    try {
      const parsed = yaml.load(content) as any;
      
      // Transform the parsed YAML to match our expected structure
      const sections: YamlSections = {
        devices: parsed.devices || [],
        networks: parsed.networks || [],
        tenants: parsed.tenants || [],
        system: { epilogue: parsed.system?.epilogue || [] },
        request_labels: parsed.request_labels || [],
        set_labels: parsed.set_labels || {}
      };
      
      console.log('Parsed YAML:', sections);
      return sections;
    } catch (error) {
      console.error('Error parsing YAML:', error);
      message.error('Failed to parse YAML content');
      return {
        devices: [],
        networks: [],
        tenants: [],
        system: { epilogue: [] },
        request_labels: [],
        set_labels: {}
      };
    }
  };

  // YAML Editor Functions
  const loadYamlFile = async () => {
    try {
      const yamlPath = `${modelDir}/cluster.yml`;
      const response = await fetch(yamlPath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      const parsed = parseYamlContent(content);
      setYamlSections(parsed);
      message.success('YAML file loaded successfully!');
    } catch (error) {
      message.error(`Failed to load YAML file from ${modelDir}`);
      console.error('Error loading YAML file:', error);
    }
  };

  // Load YAML file on component mount
  React.useEffect(() => {
    loadYamlFile();
  }, []);

  const saveYamlFile = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        message.error('Saving requires a Chromium-based browser (File System Access API)');
        return;
      }
  
      const dirHandle = await (window as any).showDirectoryPicker();
  
      // Ensure subdirectories
      const deviceModelsDir = await dirHandle.getDirectoryHandle('device_models', { create: true });
      const networksDir = await dirHandle.getDirectoryHandle('networks', { create: true });
      await dirHandle.getDirectoryHandle('tenants', { create: true });
  
      // 1) Write cluster.yml
      let yamlContent = '';
      yamlContent += 'devices:\n';
      yamlSections.devices.forEach(device => {
        yamlContent += `- device_model: ${device.device_model}\n`;
        yamlContent += `  instances: ${device.instances}\n`;
      });
      yamlContent += '\nnetworks:\n';
      yamlSections.networks.forEach(network => {
        yamlContent += `- network: ${network.network}\n`;
        yamlContent += `  nodes: ${network.nodes}\n`;
        yamlContent += `  links: ${network.links}\n`;
      });
      yamlContent += '\ntenants:\n';
      yamlSections.tenants.forEach(tenant => {
        yamlContent += `- tenant: ${tenant.tenant}\n`;
        yamlContent += `  instances: ${tenant.instances}\n`;
      });
      yamlContent += '\nsystem:\n';
      yamlContent += '  epilogue:\n';
      yamlSections.system.epilogue.forEach(cmd => {
        yamlContent += `  - ${cmd}\n`;
      });
      yamlContent += '\nrequest_labels:\n';
      yamlSections.request_labels.forEach(label => {
        yamlContent += `- ${label}\n`;
      });
      yamlContent += '\nset_labels:\n';
      const setLabelsKeys = Object.keys(yamlSections.set_labels || {});
      if (setLabelsKeys.length === 0) {
        yamlContent += '{}\n';
      } else {
        setLabelsKeys.forEach(k => {
          yamlContent += `  ${k}: ${yamlSections.set_labels[k]}\n`;
        });
      }
  
      await writeTextFile(dirHandle, 'cluster.yml', yamlContent);
  
      // 2) Write device model YAMLs (edited > loaded > fetched from modelDir)
      for (const d of yamlSections.devices) {
        const model = d.device_model?.trim();
        if (!model) continue;
  
        let content: string | null = null;
        const edited = editingConfigs[model];
        if (edited) {
          content = yaml.dump(edited);
        } else {
          const loaded = deviceModelConfigs[model];
          if (loaded) {
            content = yaml.dump(loaded);
          } else {
            try {
              const res = await fetch(`${modelDir}/device_models/${model}.yml`, { cache: 'no-store' });
              if (res.ok) content = await res.text();
            } catch {}
          }
        }
  
        if (content) {
          await writeTextFile(deviceModelsDir, `${model}.yml`, content);
        } else {
          message.warning(`Skipped saving device model: ${model}.yml (no config found)`);
        }
      }
  
      // 3) Copy network files (nodes, links) into networks/
      for (const nw of yamlSections.networks) {
        // nodes
        const nodesName = nw.nodes?.trim();
        if (nodesName) {
          const nodesRes = await resolveNetworkFile(nodesName);
          if (nodesRes) {
            await writeFileFromResponse(networksDir, nodesName, nodesRes);
          } else {
            message.warning(`Nodes file not found: ${nodesName}`);
          }
        }
        // links
        const linksName = nw.links?.trim();
        if (linksName) {
          const linksRes = await resolveNetworkFile(linksName);
          if (linksRes) {
            await writeFileFromResponse(networksDir, linksName, linksRes);
          } else {
            message.warning(`Links file not found: ${linksName}`);
          }
        }
      }
  
      message.success('Configuration saved to selected directory');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Save failed:', err);
      message.error('Failed to save configuration');
    }
  };
  
  // Try multiple candidate paths under current modelDir for network files
  const resolveNetworkFile = async (filename: string): Promise<Response | null> => {
    const candidates = [
      `${modelDir}/networks/${filename}`,
      `${modelDir}/${filename}`,
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) return res;
      } catch {}
    }
    return null;
  };
  
  // Helper: write text
  const writeTextFile = async (dirHandle: any, fileName: string, content: string) => {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  };
  
  // Helper: write from fetch Response (binary-safe)
  const writeFileFromResponse = async (dirHandle: any, fileName: string, res: Response) => {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(await res.arrayBuffer());
    await writable.close();
  };

  // Function to load device model configuration
  const loadDeviceModelConfig = async (deviceModel: string) => {
    if (deviceModelConfigs[deviceModel] || loadingConfigs[deviceModel]) {
      return; // Already loaded or loading
    }

    setLoadingConfigs(prev => ({ ...prev, [deviceModel]: true }));
    
    try {
      const configPath = `${modelDir}/device_models/${deviceModel}.yml`;
      const response = await fetch(configPath);
      
      if (response.ok) {
        const content = await response.text();
        const config = parseDeviceModelContent(content);
        setDeviceModelConfigs(prev => ({ ...prev, [deviceModel]: config }));
        setEditingConfigs(prev => ({ ...prev, [deviceModel]: JSON.parse(JSON.stringify(config)) }));
      } else {
        setDeviceModelConfigs(prev => ({ ...prev, [deviceModel]: null }));
      }
    } catch (error) {
      console.error(`Error loading device model config for ${deviceModel}:`, error);
      setDeviceModelConfigs(prev => ({ ...prev, [deviceModel]: null }));
      message.error(`Failed to load configuration for ${deviceModel}`);
    } finally {
      setLoadingConfigs(prev => ({ ...prev, [deviceModel]: false }));
    }
  };

  // Function to save device model configuration
  const saveDeviceModelConfig = async (deviceModel: string) => {
    setSavingConfigs(prev => ({ ...prev, [deviceModel]: true }));
    
    try {
      const configPath = `${modelDir}/device_models/${deviceModel}.yml`;
      const yamlContent = yaml.dump(editingConfigs[deviceModel]);
      
      // In a real application, this would save to the server
      // For now, we'll just update the local state
      setDeviceModelConfigs(prev => ({ ...prev, [deviceModel]: editingConfigs[deviceModel] }));
      message.success(`Device model configuration for ${deviceModel} saved successfully!`);
    } catch (error) {
      console.error(`Error saving device model config for ${deviceModel}:`, error);
      message.error(`Failed to save device model configuration for ${deviceModel}`);
    } finally {
      setSavingConfigs(prev => ({ ...prev, [deviceModel]: false }));
    }
  };

  // Function to update editing configuration
  const updateEditingConfig = (deviceModel: string, path: string, value: any) => {
    setEditingConfigs(prev => {
      const newConfig = { ...prev[deviceModel] };
      const keys = path.split('.');
      let current = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return { ...prev, [deviceModel]: newConfig };
    });
  };

  // Function to render editable form fields for configuration
  const renderConfigField = (deviceModel: string, config: any, path: string = '') => {
    if (typeof config === 'object' && config !== null && !Array.isArray(config)) {
      return (
        <div style={{ marginLeft: path ? '16px' : '0' }}>
          {Object.entries(config).map(([key, value]) => (
            <div key={key} style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '4px' 
              }}>
                {key}
              </label>
              {renderConfigField(deviceModel, value, path ? `${path}.${key}` : key)}
            </div>
          ))}
        </div>
      );
    } else if (Array.isArray(config)) {
      return (
        <div style={{ marginLeft: path ? '16px' : '0' }}>
          {config.map((item, index) => (
            <div key={index} style={{ marginBottom: '8px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '12px', 
                fontWeight: '500', 
                color: '#6b7280',
                marginBottom: '4px' 
              }}>
                Item {index + 1}
              </label>
              {renderConfigField(deviceModel, item, `${path}[${index}]`)}
            </div>
          ))}
        </div>
      );
    } else {
      // Render input field based on value type
      const currentPath = path;
      
      if (typeof config === 'boolean') {
        return (
          <Switch
            checked={config}
            onChange={(checked) => updateEditingConfig(deviceModel, currentPath, checked)}
          />
        );
      } else if (typeof config === 'number') {
        return (
          <InputNumber
            value={config}
            onChange={(value) => updateEditingConfig(deviceModel, currentPath, value)}
            style={{ width: '100%' }}
          />
        );
      } else {
        return (
          <Input
            value={config}
            onChange={(e) => updateEditingConfig(deviceModel, currentPath, e.target.value)}
            placeholder={`Enter ${path.split('.').pop()}`}
          />
        );
      }
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

  // Add the ModelSection component (similar to ClusterConfigEditor)
  const ModelSection: React.FC<{
    title: string;
    modelType: string;
    deviceModel: string;
    modelData: Record<string, any>;
    onAddField: (deviceModel: string, modelType: string) => void;
    onFieldChange: (deviceModel: string, modelType: string, fieldName: string, value: any) => void;
    onRemoveField: (deviceModel: string, modelType: string, fieldName: string) => void;
  }> = ({ title, modelType, deviceModel, modelData, onAddField, onFieldChange, onRemoveField }) => {
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ margin: 0, color: '#1a365d', fontSize: '16px' }}>{title}</h4>
          <Button 
            size="small" 
            onClick={() => onAddField(deviceModel, modelType)}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}
          >
            ➕ Add Field
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
          {Object.entries(modelData).map(([fieldName, fieldValue]) => (
            <React.Fragment key={fieldName}>
              <Input
                value={fieldName}
                onChange={(e) => {
                  const newValue = modelData[fieldName];
                  onRemoveField(deviceModel, modelType, fieldName);
                  onFieldChange(deviceModel, modelType, e.target.value, newValue);
                }}
                placeholder="Field name"
                style={{ fontSize: '12px' }}
              />
              {typeof fieldValue === 'boolean' ? (
                <Button
                  type={fieldValue ? 'primary' : 'default'}
                  size="small"
                  onClick={() => onFieldChange(deviceModel, modelType, fieldName, !fieldValue)}
                  style={{ 
                    fontSize: '12px',
                    fontWeight: '500',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: fieldValue ? '#3b82f6' : 'transparent',
                    borderColor: fieldValue ? '#3b82f6' : '#e2e8f0',
                    borderWidth: '2px',
                    color: fieldValue ? 'white' : '#64748b',
                    boxShadow: fieldValue 
                      ? '0 2px 8px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
                      : '0 1px 2px rgba(0, 0, 0, 0.05)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {fieldValue ? (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                    }} />
                  ) : (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'transparent',
                      border: '2px solid #e2e8f0'
                    }} />
                  )}
                </Button>
              ) : (
                <Input
                  value={typeof fieldValue === 'number' ? fieldValue.toString() : fieldValue}
                  onChange={(e) => {
                    let value: any = e.target.value;
                    if (typeof fieldValue === 'number') {
                      value = parseFloat(e.target.value) || 0;
                    }
                    onFieldChange(deviceModel, modelType, fieldName, value);
                  }}
                  placeholder="Field value"
                  style={{ fontSize: '12px' }}
                />
              )}
              <Button
                size="small"
                danger
                onClick={() => onRemoveField(deviceModel, modelType, fieldName)}
                style={{ minWidth: '60px' }}
              >
                🗑️
              </Button>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // Add handlers for device model configuration
  const handleAddModelField = (deviceModel: string, modelType: string) => {
    const fieldName = prompt('Enter field name:');
    if (fieldName) {
      setEditingConfigs(prev => {
        const newConfig = { ...prev[deviceModel] };
        const pathParts = modelType.split('.');
        let current = newConfig;
        
        // Navigate to the correct nested object
        for (let i = 0; i < pathParts.length; i++) {
          if (!current[pathParts[i]]) {
            current[pathParts[i]] = {};
          }
          current = current[pathParts[i]];
        }
        
        current[fieldName] = '';
        return { ...prev, [deviceModel]: newConfig };
      });
    }
  };

  const handleModelFieldChange = (deviceModel: string, modelType: string, fieldName: string, value: any) => {
    setEditingConfigs(prev => {
      const newConfig = { ...prev[deviceModel] };
      const pathParts = modelType.split('.');
      let current = newConfig;
      
      // Navigate to the correct nested object
      for (let i = 0; i < pathParts.length; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = {};
        }
        current = current[pathParts[i]];
      }
      
      current[fieldName] = value;
      return { ...prev, [deviceModel]: newConfig };
    });
  };

  const handleRemoveModelField = (deviceModel: string, modelType: string, fieldName: string) => {
    setEditingConfigs(prev => {
      const newConfig = { ...prev[deviceModel] };
      const pathParts = modelType.split('.');
      let current = newConfig;
      
      // Navigate to the correct nested object
      for (let i = 0; i < pathParts.length; i++) {
        if (!current[pathParts[i]]) {
          return { ...prev, [deviceModel]: newConfig };
        }
        current = current[pathParts[i]];
      }
      
      if (current && typeof current === 'object') {
        delete current[fieldName];
      }
      return { ...prev, [deviceModel]: newConfig };
    });
  };

  const handleDirectorySelect = () => {
    setShowDirectoryModal(true);
  };

  const handleDirectoryConfirm = (newDir: string) => {
    setModelDir(newDir);
    setShowDirectoryModal(false);
    message.success(`Directory changed to: ${newDir}`);
    // Reload the YAML file with the new directory
    loadYamlFile();
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
              onClick={handleDirectorySelect}
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
              📁 Load
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
                      style={{ 
                        height: '40px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        border: 'none',
                        fontWeight: '600',
                        fontSize: '14px',
                        padding: '0 20px',
                        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      ➕ Add Device
                    </Button>
                  </div>
                  
                  <Collapse
                    style={{
                      background: 'transparent',
                      border: 'none'
                    }}
                    items={yamlSections.devices.map((device, index) => ({
                      key: index.toString(),
                      label: (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          width: '100%',
                          padding: '8px 0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '16px',
                              fontWeight: '600'
                            }}>
                              {device.device_model.charAt(0)}
                            </div>
                            <div>
                              <div style={{ 
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#1e293b',
                                marginBottom: '4px'
                              }}>
                                {device.device_model}
                              </div>
                              <div style={{ 
                                fontSize: '14px',
                                color: '#64748b'
                              }}>
                                Instances: {device.instances || 'Not specified'}
                              </div>
                            </div>
                          </div>
                          <Button
                            type="text"
                            danger
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteYamlDevice(index);
                            }}
                            style={{ 
                              height: '32px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      ),
                      children: (
                        <div style={{ padding: '0' }}>
                          <div style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
                            <div style={{ flex: 1 }}>
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
                            <div style={{ flex: 1 }}>
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

                          {/* Device Model Configuration Section */}
                          <div style={{ 
                            border: '2px solid #e2e8f0', 
                            borderRadius: '12px', 
                            padding: '20px',
                            backgroundColor: '#f8fafc',
                            marginTop: '20px'
                          }}>
                            <h4 style={{ margin: '0 0 16px 0', color: '#2d3748' }}>
                              Device Model Configuration
                            </h4>
                            
                            {(() => {
                              const deviceModel = device.device_model;
                              
                              if (!deviceModel) {
                                return (
                                  <Alert
                                    message="No device model specified"
                                    type="warning"
                                  />
                                );
                              }

                              const config = deviceModelConfigs[deviceModel];
                              const editingConfig = editingConfigs[deviceModel];
                              const isLoading = loadingConfigs[deviceModel];
                              const isSaving = savingConfigs[deviceModel];

                              if (isLoading) {
                                return (
                                  <div style={{ padding: '16px', textAlign: 'center' }}>
                                    <Spin size="small" />
                                    <span style={{ marginLeft: '8px' }}>Loading device model configuration...</span>
                                  </div>
                                );
                              }

                              if (config === null) {
                                return (
                                  <Alert
                                    message={`Device model configuration not found: ${deviceModel}.yml`}
                                    type="error"
                                  />
                                );
                              }

                              if (config === undefined) {
                                return (
                                  <div style={{ padding: '16px' }}>
                                    <Button
                                      type="link"
                                      icon={<InfoCircleOutlined />}
                                      onClick={() => loadDeviceModelConfig(deviceModel)}
                                    >
                                      Load device model configuration
                                    </Button>
                                  </div>
                                );
                              }

                              return (
                                <div>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    marginBottom: '16px' 
                                  }}>
                                    <span style={{ color: '#64748b', fontSize: '14px' }}>
                                      Configuration for: {deviceModel}
                                    </span>
                                    <Button
                                      type="primary"
                                      icon={<SaveOutlined />}
                                      onClick={() => saveDeviceModelConfig(deviceModel)}
                                      loading={isSaving}
                                      size="small"
                                    >
                                      Save Configuration
                                    </Button>
                                  </div>
                                  
                                  <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
                                    {editingConfig && (
                                      <>
                                        {/* Dynamically render model sections based on what's in the YAML file */}
                                        {Object.entries(editingConfig).map(([modelType, modelData]) => {
                                          // Skip non-model fields if any
                                          if (typeof modelData !== 'object' || modelData === null) {
                                            return null;
                                          }

                                          // Convert model type to display name
                                          const getDisplayName = (type: string) => {
                                            return type
                                              .split('_')
                                              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                              .join(' ');
                                          };

                                          // Check if modelData is an object with nested objects (for tabbed display)
                                          const hasNestedObjects = Object.values(modelData).some(value => 
                                            typeof value === 'object' && value !== null && !Array.isArray(value)
                                          );

                                          if (hasNestedObjects) {
                                            // Render as tabbed pane
                                            const tabItems = Object.entries(modelData).map(([subType, subData]) => ({
                                              key: subType,
                                              label: (
                                                <span style={{
                                                  fontSize: '14px',
                                                  fontWeight: '500',
                                                  color: '#374151'
                                                }}>
                                                  {getDisplayName(subType)}
                                                </span>
                                              ),
                                              children: (
                                                <div style={{ padding: '16px 0' }}>
                                                  <ModelSection
                                                    title=""
                                                    modelType={`${modelType}.${subType}`}
                                                    deviceModel={deviceModel}
                                                    modelData={subData}
                                                    onAddField={handleAddModelField}
                                                    onFieldChange={handleModelFieldChange}
                                                    onRemoveField={handleRemoveModelField}
                                                  />
                                                </div>
                                              )
                                            }));

                                            return (
                                              <div key={modelType} style={{ marginBottom: '24px' }}>
                                                <h4 style={{ 
                                                  margin: '0 0 16px 0', 
                                                  color: '#1a365d', 
                                                  fontSize: '18px',
                                                  fontWeight: '600'
                                                }}>
                                                  {getDisplayName(modelType)}
                                                </h4>
                                                <Tabs
                                                  defaultActiveKey={Object.keys(modelData)[0]}
                                                  items={tabItems}
                                                  style={{
                                                    background: '#ffffff',
                                                    borderRadius: '8px',
                                                    border: '1px solid #e2e8f0'
                                                  }}
                                                  tabBarStyle={{
                                                    background: '#f8fafc',
                                                    margin: 0,
                                                    padding: '0 16px',
                                                    borderBottom: '1px solid #e2e8f0',
                                                    borderRadius: '8px 8px 0 0'
                                                  }}
                                                />
                                              </div>
                                            );
                                          } else {
                                            // Render as regular ModelSection
                                            return (
                                              <ModelSection
                                                key={modelType}
                                                title={getDisplayName(modelType)}
                                                modelType={modelType}
                                                deviceModel={deviceModel}
                                                modelData={modelData}
                                                onAddField={handleAddModelField}
                                                onFieldChange={handleModelFieldChange}
                                                onRemoveField={handleRemoveModelField}
                                              />
                                            );
                                          }
                                        })}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )
                    }))}
                  />
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
          style={{ 
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #13c2c2, #08979c)',
            border: 'none',
            fontWeight: '600',
            fontSize: '14px',
            padding: '0 20px',
            boxShadow: '0 4px 6px -1px rgba(19, 194, 194, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ➕ Add Network
        </Button>
      </div>

      <Collapse
        style={{ background: 'transparent', border: 'none' }}
        items={yamlSections.networks.map((network, index) => ({
          key: index.toString(),
          label: (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              width: '100%',
              padding: '8px 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #13c2c2, #08979c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  {(network.network || 'N').charAt(0)}
                </div>
                <div>
                  <div style={{ 
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '4px'
                  }}>
                    {network.network || 'Unnamed Network'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>
                    Nodes: {network.nodes || 'Not specified'} | Links: {network.links || 'Not specified'}
                  </div>
                </div>
              </div>
              <Button
                type="text"
                danger
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteYamlNetwork(index);
                }}
                style={{ 
                  height: '32px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                🗑️ Delete
              </Button>
            </div>
          ),
          children: (
            <div style={{ padding: '0' }}>
              <div style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
                <div style={{ flex: 1 }}>
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
                <div style={{ flex: 1 }}>
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
                <div style={{ flex: 1 }}>
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
          )
        }))}
      />

      {yamlSections.networks.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          color: '#64748b', 
          fontStyle: 'italic',
          padding: '60px 20px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #e2e8f0'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌐</div>
          <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
            No networks configured
          </div>
          <div style={{ fontSize: '14px' }}>
            Click "Add Network" to create your first network configuration
          </div>
        </div>
      )}
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
                      style={{ 
                        height: '40px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        border: 'none',
                        fontWeight: '600',
                        fontSize: '14px',
                        padding: '0 20px',
                        boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      ➕ Add Tenant
                    </Button>
                  </div>
                  
                  <Collapse
                    style={{
                      background: 'transparent',
                      border: 'none'
                    }}
                    items={yamlSections.tenants.map((tenant, index) => ({
                      key: index.toString(),
                      label: (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          width: '100%',
                          padding: '8px 0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '16px',
                              fontWeight: '600'
                            }}>
                              {tenant.tenant.charAt(0) || 'T'}
                            </div>
                            <div>
                              <div style={{ 
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#1e293b',
                                marginBottom: '4px'
                              }}>
                                {tenant.tenant || 'Unnamed Tenant'}
                              </div>
                              <div style={{ 
                                fontSize: '14px',
                                color: '#64748b'
                              }}>
                                Instances: {tenant.instances || 'Not specified'}
                              </div>
                            </div>
                          </div>
                          <Button
                            type="text"
                            danger
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteYamlTenant(index);
                            }}
                            style={{ 
                              height: '32px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      ),
                      children: (
                        <div style={{ padding: '0' }}>
                          <div style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
                            <div style={{ flex: 1 }}>
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
                            <div style={{ flex: 1 }}>
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
                      )
                    }))}
                  />
                  
                  {yamlSections.tenants.length === 0 && (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#64748b', 
                      fontStyle: 'italic',
                      padding: '60px 20px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px',
                      border: '2px dashed #e2e8f0'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
                      <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                        No tenants configured
                      </div>
                      <div style={{ fontSize: '14px' }}>
                        Click "Add Tenant" to create your first tenant configuration
                      </div>
                    </div>
                  )}
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
                      style={{ 
                        height: '40px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        border: 'none',
                        fontWeight: '600',
                        fontSize: '14px',
                        padding: '0 20px',
                        boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
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
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        ⚙️
                      </div>
                      <h4 style={{ margin: 0, color: '#2d3748', fontSize: '16px' }}>
                        Epilogue Commands
                      </h4>
                    </div>
                    
                    {yamlSections.system.epilogue.length > 0 ? (
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
                              style={{
                                height: '32px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                flexShrink: 0
                              }}
                            >
                              🗑️
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ 
                        textAlign: 'center', 
                        color: '#64748b', 
                        fontStyle: 'italic',
                        padding: '40px 20px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px dashed #d1d5db'
                      }}>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📝</div>
                        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                          No epilogue commands configured
                        </div>
                        <div style={{ fontSize: '12px' }}>
                          Click "Add Epilogue Command" to add your first command
                        </div>
                      </div>
                    )}
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
      {showDirectoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '500px',
            maxWidth: '90vw',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1a365d' }}>
              Select Cluster Directory
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
              Choose the directory containing your cluster configuration files (cluster.yml, device_models/, networks/, etc.)
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '8px' 
              }}>
                Directory Path
              </label>
              <Input
                value={modelDir}
                onChange={(e) => setModelDir(e.target.value)}
                placeholder="e.g., ./public/clusters/yiwu2-6"
                style={{ 
                  height: '40px',
                  borderRadius: '8px',
                  border: '2px solid #d1d5db'
                }}
              />
              <div style={{ 
                fontSize: '12px', 
                color: '#64748b', 
                marginTop: '4px' 
              }}>
                Current: {modelDir}
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end' 
            }}>
              <Button
                onClick={() => setShowDirectoryModal(false)}
                style={{
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  color: '#374151'
                }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={() => handleDirectoryConfirm(modelDir)}
                style={{
                  height: '36px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  border: 'none'
                }}
              >
                Load Directory
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClusterYmlEditor;
