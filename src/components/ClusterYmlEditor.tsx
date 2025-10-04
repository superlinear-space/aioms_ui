import React, { useState } from 'react';
import { Button, Input, Tabs, App, Collapse, Spin, Alert, InputNumber, Switch } from 'antd';
import { InfoCircleOutlined, SaveOutlined } from '@ant-design/icons';
import * as yaml from 'js-yaml';
import type { YamlSections } from '../types/clusterTypes';
import { prometheusService } from '../services/prometheusService';
import configData from '../../config.json';
import { useSearchParams } from 'react-router-dom';

/*
Directory structure of the cluster configuration:

cluster.yml         # Cluster definition
device_models/      # Device model definitions
├── device_model_name.yml
tenants/            # Tenant-specific configurations
 └── tenant_name.yml     # Tenant-specific checks
networks/            # Tenant-specific configurations
    └── network_name.yml     # Tenant-specific checks 
network_name_nodes_file.csv
network_name_links_file.csv
*/

interface ClusterYmlEditorProps {
  yamlSections: YamlSections;
  setYamlSections: React.Dispatch<React.SetStateAction<YamlSections>>;
  yamlActiveTab: string;
  setYamlActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

// Generic YAML handlers factory
const createYamlHandlers = <T extends Record<string, any>>(
  sectionKey: keyof YamlSections,
  defaultItem: T,
  setYamlSections: React.Dispatch<React.SetStateAction<YamlSections>>,
  message: any,
  itemType: string
) => ({
  handleChange: (index: number, field: string, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] as T[]).map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  },
  handleAdd: () => {
    setYamlSections(prev => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] as T[]), defaultItem]
    }));
    message.success(`New ${itemType} added!`);
  },
  handleDelete: (index: number) => {
    setYamlSections(prev => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] as T[]).filter((_, i) => i !== index)
    }));
    message.success(`${itemType} deleted!`);
  }
});

// Specialized handlers for system epilogue (different structure)
const createEpilogueHandlers = (
  setYamlSections: React.Dispatch<React.SetStateAction<YamlSections>>,
  message: any
) => ({
  handleChange: (index: number, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      system: {
        ...prev.system,
        epilogue: prev.system.epilogue.map((item, i) => i === index ? value : item)
      }
    }));
  },
  handleAdd: () => {
    setYamlSections(prev => ({
      ...prev,
      system: {
        ...prev.system,
        epilogue: [...prev.system.epilogue, '']
      }
    }));
    message.success('New epilogue command added!');
  },
  handleDelete: (index: number) => {
    setYamlSections(prev => ({
      ...prev,
      system: {
        ...prev.system,
        epilogue: prev.system.epilogue.filter((_, i) => i !== index)
      }
    }));
    message.success('Epilogue command deleted!');
  }
});

// Specialized handlers for request labels (array of strings)
const createRequestLabelHandlers = (
  setYamlSections: React.Dispatch<React.SetStateAction<YamlSections>>,
  message: any
) => ({
  handleChange: (index: number, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      request_labels: prev.request_labels.map((item, i) => i === index ? value : item)
    }));
  },
  handleAdd: () => {
    setYamlSections(prev => ({
      ...prev,
      request_labels: [...prev.request_labels, '']
    }));
    message.success('New request label added!');
  },
  handleDelete: (index: number) => {
    setYamlSections(prev => ({
      ...prev,
      request_labels: prev.request_labels.filter((_, i) => i !== index)
    }));
    message.success('Request label deleted!');
  }
});

// Specialized handlers for set labels (object)
const createSetLabelHandlers = (
  setYamlSections: React.Dispatch<React.SetStateAction<YamlSections>>,
  message: any
) => ({
  handleChange: (key: string, value: string) => {
    setYamlSections(prev => ({
      ...prev,
      set_labels: { ...prev.set_labels, [key]: value }
    }));
  },
  handleAdd: () => {
    const key = prompt('Enter label key:');
    if (key) {
      setYamlSections(prev => ({
        ...prev,
        set_labels: { ...prev.set_labels, [key]: '' }
      }));
      message.success('New set label added!');
    }
  },
  handleDelete: (key: string) => {
    setYamlSections(prev => {
      const newSetLabels = { ...prev.set_labels };
      delete newSetLabels[key];
      return { ...prev, set_labels: newSetLabels };
    });
    message.success('Set label deleted!');
  }
});

const ClusterYmlEditor: React.FC<ClusterYmlEditorProps> = ({
  yamlSections,
  setYamlSections,
  yamlActiveTab,
  setYamlActiveTab
}) => {
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  // Update the modelDir state initialization:
  const [modelDir, setModelDir] = useState<string>(() => {
    // Try to get from URL params first, then localStorage, then default
    const urlDir = searchParams.get('clusterDir');
    const savedDir = localStorage.getItem('clusterModelDir');
    return urlDir || savedDir || "./";
  });
  const [showDirectoryModal, setShowDirectoryModal] = useState<boolean>(false);

  // Add state for device model configurations and editing
  const [nameConfigs, setDeviceModelConfigs] = useState<Record<string, any>>({});
  const [loadingConfigs, setLoadingConfigs] = useState<Record<string, boolean>>({});
  const [editingConfigs, setEditingConfigs] = useState<Record<string, any>>({});
  const [savingConfigs, setSavingConfigs] = useState<Record<string, boolean>>({});
  
  // Add state for Prometheus rules generation
  const [generatingRules, setGeneratingRules] = useState<boolean>(false);
  const [showPromRulesModal, setShowPromRulesModal] = useState<boolean>(false);
  const [promRulesConfig, setPromRulesConfig] = useState({
    cluster_dir: configData.DEFAULT_CLUSTER_DIR,
    output_dir: `${modelDir}/prometheus_rules`
  });
  
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

  // Device Model YAML Parser
  const parseDeviceModelContent = (content: string) => {
    try {
      const parsed = yaml.load(content) as any;
      console.log('Parsed device model YAML:', parsed);
      return parsed;
    } catch (error) {
      console.error('Error parsing device model YAML:', error);
      message.error('Failed to parse device model content');
      return null;
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
      const namesDir = await dirHandle.getDirectoryHandle('device_models', { create: true });
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
          const loaded = nameConfigs[model];
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
          await writeTextFile(namesDir, `${model}.yml`, content);
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

  // Function to load device model, network, or tenant configuration
  const loadDeviceModelConfig = async (name: string, type: 'device' | 'network' | 'tenant' = 'device') => {
    if (nameConfigs[name] || loadingConfigs[name]) {
      return; // Already loaded or loading
    }

    setLoadingConfigs(prev => ({ ...prev, [name]: true }));
    
    try {
      const configPath = type === 'device' 
        ? `${modelDir}/device_models/${name}.yml`
        : type === 'network'
        ? `${modelDir}/networks/${name}.yml`
        : `${modelDir}/tenants/${name}.yml`;
      const response = await fetch(configPath);
      
      if (response.ok) {
        const content = await response.text();
        const config = parseDeviceModelContent(content);
        setDeviceModelConfigs(prev => ({ ...prev, [name]: config }));
        setEditingConfigs(prev => ({ ...prev, [name]: JSON.parse(JSON.stringify(config)) }));
      } else {
        setDeviceModelConfigs(prev => ({ ...prev, [name]: null }));
      }
    } catch (error) {
      console.error(`Error loading ${type} config for ${name}:`, error);
      setDeviceModelConfigs(prev => ({ ...prev, [name]: null }));
      message.error(`Failed to load configuration for ${name}`);
    } finally {
      setLoadingConfigs(prev => ({ ...prev, [name]: false }));
    }
  };

  // Function to save device model, network, or tenant configuration
  const saveDeviceModelConfig = async (name: string, type: 'device' | 'network' | 'tenant' = 'device') => {
    setSavingConfigs(prev => ({ ...prev, [name]: true }));
    
    try {
      // In a real application, this would save to the server
      // For now, we'll just update the local state
      setDeviceModelConfigs(prev => ({ ...prev, [name]: editingConfigs[name] }));
      const typeName = type === 'device' ? 'Device model' : type === 'network' ? 'Network' : 'Tenant';
      message.success(`${typeName} configuration for ${name} saved successfully!`);
    } catch (error) {
      console.error(`Error saving ${type} config for ${name}:`, error);
      message.error(`Failed to save ${type} configuration for ${name}`);
    } finally {
      setSavingConfigs(prev => ({ ...prev, [name]: false }));
    }
  };


  // Function to update editing configuration
  const updateEditingConfig = (name: string, path: string, value: any) => {
    setEditingConfigs(prev => {
      const newConfig = { ...prev[name] };
      const keys = path.split('.');
      let current = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return { ...prev, [name]: newConfig };
    });
  };

  // Reusable Configuration Section Component
  const ConfigurationSection: React.FC<{
    name: string;
    type: 'device' | 'network' | 'tenant';
    title: string;
  }> = ({ name, type, title }) => {
    return (
      <div style={{ marginTop: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <h4 style={{ margin: 0, color: '#495057' }}>
            {title}: {name}
          </h4>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ 
              fontSize: '12px', 
              color: '#6c757d',
              fontStyle: 'italic'
            }}>
              {nameConfigs[name] ? 'Loaded' : 'Not loaded'}
            </span>
            {!nameConfigs[name] && (
              <Button
                type="default"
                onClick={() => loadDeviceModelConfig(name, type)}
                loading={loadingConfigs[name]}
                size="small"
              >
                Load Configuration
              </Button>
            )}
            {nameConfigs[name] && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => saveDeviceModelConfig(name, type)}
                loading={savingConfigs[name]}
                size="small"
              >
                Save Configuration
              </Button>
            )}
          </div>
        </div>
        
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
          {editingConfigs[name] && (
            <>
              {/* Dynamically render configuration sections based on what's in the YAML file */}
              {Object.entries(editingConfigs[name]).map(([configType, configData]) => {
                // Skip non-config fields if any
                if (typeof configData !== 'object' || configData === null) {
                  return null;
                }

                // Convert config type to display name
                const getDisplayName = (type: string) => {
                  return type
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                };

                // Check if configData is an object with nested objects (for tabbed display)
                const hasNestedObjects = Object.values(configData).some(value => 
                  typeof value === 'object' && value !== null && !Array.isArray(value)
                );

                if (hasNestedObjects) {
                  // Render as tabbed pane
                  const tabItems = Object.entries(configData).map(([subType, subData]) => ({
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
                      <div style={{ padding: '16px' }}>
                        {renderConfigField(name, subData, `${configType}.${subType}`)}
                      </div>
                    )
                  }));

                  return (
                    <div key={configType} style={{ marginBottom: '24px' }}>
                      <h5 style={{ 
                        margin: '0 0 16px 0', 
                        color: '#1a365d',
                        fontSize: '16px',
                        fontWeight: '600'
                      }}>
                        {getDisplayName(configType)}
                      </h5>
                      <Tabs
                        defaultActiveKey={Object.keys(configData)[0]}
                        items={tabItems}
                        size="small"
                        style={{ marginTop: '8px' }}
                      />
                    </div>
                  );
                } else {
                  // Render as simple section
                  return (
                    <div key={configType} style={{ marginBottom: '24px' }}>
                      <h5 style={{ 
                        margin: '0 0 16px 0', 
                        color: '#1a365d',
                        fontSize: '16px',
                        fontWeight: '600'
                      }}>
                        {getDisplayName(configType)}
                      </h5>
                      <div style={{ padding: '16px' }}>
                        {renderConfigField(name, configData, configType)}
                      </div>
                    </div>
                  );
                }
              })}
            </>
          )}
        </div>
      </div>
    );
  };

  // Function to render editable form fields for configuration
  const renderConfigField = (name: string, config: any, path: string = '') => {
    // Remove the local updateEditingConfig function and use the global one
    // const updateEditingConfig = (name: string, fieldPath: string, value: any) => { ... }
    
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
              {renderConfigField(name, value, path ? `${path}.${key}` : key)}
            </div>
          ))}
        </div>
      );
    } else if (Array.isArray(config)) {
      return (
        <div style={{ marginLeft: path ? '16px' : '0' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '10px' }}>

            <Button 
              size="small" 
              onClick={() => {
                const newValue = [...config, ''];
                updateEditingConfig(name, path, newValue); // This will now use the global function
              }}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}
            >
              ➕ Add Item
            </Button>
          </div>
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '12px'
          }}>
            {config.map((item, index) => {
            // Check if the item is a string that can be split by space
            if (typeof item === 'string' && item.includes(' ')) {
              const parts = item.split(' ');
              const key = parts[0];
              const value = parts.slice(1).join(' ');
              
              return (
                <div key={index} style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  alignItems: 'center',
                  padding: '8px 0',
                }}>
                  <div style={{ flex: '0 0 200px' }}>
                    <Input
                      value={key}
                      onChange={(e) => {
                        const newValue = [...config];
                        newValue[index] = e.target.value + ' ' + value;
                        updateEditingConfig(name, path, newValue);
                      }}
                      placeholder="Enter key"
                      size="small"
                    />
                  </div>
                  <div style={{ flex: '1' }}>
                    <Input
                      value={value}
                      onChange={(e) => {
                        const newValue = [...config];
                        newValue[index] = key + ' ' + e.target.value;
                        updateEditingConfig(name, path, newValue);
                      }}
                      placeholder="Enter value"
                      size="small"
                    />
                  </div>
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      const newValue = config.filter((_, i) => i !== index);
                      updateEditingConfig(name, path, newValue);
                    }}
                    style={{ 
                      minWidth: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    🗑️
                  </Button>
                </div>
              );
            } else if (typeof item === 'string' && !item.includes(' ')) {
              // Display single key with radio button
              return (
                <div key={index} style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  alignItems: 'center',
                  padding: '8px 0',
                }}>
                  <div style={{ flex: '0 0 200px' }}>
                    <Input
                      value={item}
                      onChange={(e) => {
                        const newValue = [...config];
                        newValue[index] = e.target.value;
                        updateEditingConfig(name, path, newValue);
                      }}
                      placeholder="Enter key"
                      size="small"
                    />
                  </div>
                  <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          // If unchecked, remove the item from the array
                          const newValue = config.filter((_, i) => i !== index);
                          updateEditingConfig(name, path, newValue);
                        }
                      }}
                      style={{ 
                        width: '16px',
                        height: '16px',
                        accentColor: '#1890ff'
                      }}
                    />
                  </div>
                  <div style={{ flex: '1' }}>
                    <span style={{ color: '#6b7280', fontSize: '12px', fontStyle: 'italic' }}>
                      (enabled)
                    </span>
                  </div>
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      const newValue = config.filter((_, i) => i !== index);
                      updateEditingConfig(name, path, newValue);
                    }}
                    style={{ 
                      minWidth: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    🗑️
                  </Button>
                </div>
              );
            } else {
              // Display non-splittable items as simple input fields
              return (
                <div key={index} style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  alignItems: 'center',
                  padding: '8px 0',
                }}>
                  <div style={{ flex: '1' }}>
                    <Input
                      value={typeof item === 'number' ? item.toString() : item}
                      onChange={(e) => {
                        const newValue = [...config];
                        let value: any = e.target.value;
                        if (typeof item === 'number') {
                          value = parseFloat(e.target.value) || 0;
                        }
                        newValue[index] = value;
                        updateEditingConfig(name, path, newValue);
                      }}
                      placeholder="Enter value"
                      size="small"
                    />
                  </div>
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      const newValue = config.filter((_, i) => i !== index);
                      updateEditingConfig(name, path, newValue);
                    }}
                    style={{ 
                      minWidth: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    🗑️
                  </Button>
                </div>
              );
            }
          })}
          </div>
        </div>
      );
    } else {
      // Render input field based on value type
      const currentPath = path;
      
      if (typeof config === 'boolean') {
        return (
          <Switch
            checked={config}
            onChange={(checked) => updateEditingConfig(name, currentPath, checked)}
          />
        );
      } else if (typeof config === 'number') {
        return (
          <InputNumber
            value={config}
            onChange={(value) => updateEditingConfig(name, currentPath, value)}
            style={{ width: '100%' }}
          />
        );
      } else {
        return (
          <Input
            value={config}
            onChange={(e) => updateEditingConfig(name, currentPath, e.target.value)}
            placeholder={`Enter ${path.split('.').pop()}`}
          />
        );
      }
    }
  };

  // Create handlers using the factory functions
  const deviceHandlers = createYamlHandlers(
    'devices', 
    { device_model: '', instances: '' }, 
    setYamlSections, 
    message, 
    'device'
  );
  
  const networkHandlers = createYamlHandlers(
    'networks', 
    { network: '', nodes: '', links: '' }, 
    setYamlSections, 
    message, 
    'network'
  );
  
  const tenantHandlers = createYamlHandlers(
    'tenants', 
    { tenant: '', instances: '' }, 
    setYamlSections, 
    message, 
    'tenant'
  );

  const epilogueHandlers = createEpilogueHandlers(setYamlSections, message);
  const requestLabelHandlers = createRequestLabelHandlers(setYamlSections, message);
  const setLabelHandlers = createSetLabelHandlers(setYamlSections, message);

  const handleDirectorySelect = () => {
    setShowDirectoryModal(true);
  };

  const handleDirectoryConfirm = (newDir: string) => {
    setModelDir(newDir);
    // Save to localStorage for persistence
    localStorage.setItem('clusterModelDir', newDir);
    setShowDirectoryModal(false);
    message.success(`Directory changed to: ${newDir}`);
    // Reload the YAML file with the new directory
    loadYamlFile();
  };

  const handleGeneratePromRules = async () => {
    setGeneratingRules(true);
    try {
      const result = await prometheusService.generatePromRules({
        cluster_dir: promRulesConfig.cluster_dir,
        output_dir: promRulesConfig.output_dir
      });
      message.success(`Generated ${result.rules_count} Prometheus rules successfully!`);
      setShowPromRulesModal(false);
    } catch (error: any) {
      message.error(`Failed to generate Prometheus rules: ${error.message}`);
    } finally {
      setGeneratingRules(false);
    }
  };

  const handleOpenPromRulesModal = () => {
    setPromRulesConfig({
      cluster_dir: configData.DEFAULT_CLUSTER_DIR,
      output_dir: `${modelDir}/prometheus_rules`
    });
    setShowPromRulesModal(true);
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
            <Button
              onClick={handleOpenPromRulesModal}
              loading={generatingRules}
              style={{ 
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                padding: '0 20px',
                boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)'
              }}
            >
              📊 Generate Prom Rules
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
                      onClick={deviceHandlers.handleAdd}
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
                              deviceHandlers.handleDelete(index);
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
                                onChange={(e) => deviceHandlers.handleChange(index, 'device_model', e.target.value)}
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
                                onChange={(e) => deviceHandlers.handleChange(index, 'instances', e.target.value)}
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
                          {device.device_model && (
                            <ConfigurationSection 
                              name={device.device_model}
                              type="device"
                              title="Device Model Configuration"
                            />
                          )}
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
          onClick={networkHandlers.handleAdd}
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
                  networkHandlers.handleDelete(index);
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
                    onChange={(e) => networkHandlers.handleChange(index, 'network', e.target.value)}
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
                    onChange={(e) => networkHandlers.handleChange(index, 'nodes', e.target.value)}
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
                    onChange={(e) => networkHandlers.handleChange(index, 'links', e.target.value)}
                    placeholder="e.g., links.csv"
                    style={{ 
                      height: '40px',
                      borderRadius: '8px',
                      border: '2px solid #d1d5db'
                    }}
                  />
                </div>
              </div>
              
              {/* Network Configuration Section */}
              {network.network && (
                <ConfigurationSection 
                  name={network.network}
                  type="network"
                  title="Network Configuration"
                />
              )}
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
                      onClick={tenantHandlers.handleAdd}
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
                              tenantHandlers.handleDelete(index);
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
                                onChange={(e) => tenantHandlers.handleChange(index, 'tenant', e.target.value)}
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
                                onChange={(e) => tenantHandlers.handleChange(index, 'instances', e.target.value)}
                                placeholder="e.g., su1-gpu[1-8]"
                                style={{ 
                                  height: '40px',
                                  borderRadius: '8px',
                                  border: '2px solid #d1d5db'
                                }}
                              />
                            </div>
                          </div>
                          
                          {/* Tenant Configuration Section */}
                          {tenant.tenant && (
                            <ConfigurationSection 
                              name={tenant.tenant}
                              type="tenant"
                              title="Tenant Configuration"
                            />
                          )}
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
                      onClick={epilogueHandlers.handleAdd}
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
                          onChange={(e) => epilogueHandlers.handleChange(index, e.target.value)}
                          placeholder="Enter epilogue command..."
                          style={{ flex: 1 }}
                        />
                        <Button
                          danger
                          onClick={() => epilogueHandlers.handleDelete(index)}
                        >
                          🗑️
                        </Button>
                      </div>
                    ))}
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
                        onClick={requestLabelHandlers.handleAdd}
                        style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                      >
                        ➕ Add Request Label
                      </Button>
                      <Button 
                        type="primary" 
                        onClick={setLabelHandlers.handleAdd}
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
                              onChange={(e) => requestLabelHandlers.handleChange(index, e.target.value)}
                              placeholder="Enter request label..."
                              style={{ flex: 1 }}
                            />
                            <Button
                              danger
                              onClick={() => requestLabelHandlers.handleDelete(index)}
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
                              style={{ width: '120px', background: '#f9fafb' }}
                            />
                            <span style={{ color: '#6b7280' }}>:</span>
                            <Input
                              value={value}
                              onChange={(e) => setLabelHandlers.handleChange(key, e.target.value)}
                              placeholder="Enter value..."
                              style={{ flex: 1 }}
                            />
                            <Button
                              danger
                              onClick={() => setLabelHandlers.handleDelete(key)}
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
      {showPromRulesModal && (
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
            width: '600px',
            maxWidth: '90vw',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1a365d' }}>
              Generate Prometheus Rules
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
              Configure the cluster directory and output directory for Prometheus rules generation.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '8px' 
              }}>
                Cluster Directory
              </label>
              <Input
                value={promRulesConfig.cluster_dir}
                onChange={(e) => setPromRulesConfig(prev => ({ ...prev, cluster_dir: e.target.value }))}
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
                Path to the cluster configuration directory containing cluster.yml
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '8px' 
              }}>
                Output Directory
              </label>
              <Input
                value={promRulesConfig.output_dir}
                onChange={(e) => setPromRulesConfig(prev => ({ ...prev, output_dir: e.target.value }))}
                placeholder="e.g., ./output/prometheus_rules"
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
                Directory where the generated Prometheus rules will be saved
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end' 
            }}>
              <Button
                onClick={() => setShowPromRulesModal(false)}
                disabled={generatingRules}
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
                onClick={handleGeneratePromRules}
                loading={generatingRules}
                style={{
                  height: '36px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  fontWeight: '600'
                }}
              >
                {generatingRules ? 'Generating...' : 'Generate Rules'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClusterYmlEditor;
