import React, { useState } from 'react';
import { Button, Input, Tabs, Collapse, App } from 'antd';
import type { DeviceGroup, Network, Tenant, System, Sections } from '../types/clusterTypes';

const { TabPane } = Tabs;

const ModelSection: React.FC<{
  title: string;
  modelType: keyof Omit<DeviceGroup, 'name' | 'devices' | 'sys_trap_monitor'>;
  groupName: string;
  modelData: Record<string, string | boolean>;
  onAddField: (groupName: string, modelType: keyof Omit<DeviceGroup, 'name' | 'devices' | 'sys_trap_monitor'>) => void;
  onFieldChange: (groupName: string, modelType: keyof Omit<DeviceGroup, 'name' | 'devices' | 'sys_trap_monitor'>, fieldName: string, value: string | boolean) => void;
  onRemoveField: (groupName: string, modelType: keyof Omit<DeviceGroup, 'name' | 'devices' | 'sys_trap_monitor'>, fieldName: string) => void;
}> = ({ title, modelType, groupName, modelData, onAddField, onFieldChange, onRemoveField }) => {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, color: '#1a365d', fontSize: '16px' }}>{title}</h4>
        <Button 
          size="small" 
          onClick={() => onAddField(groupName, modelType)}
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
                onRemoveField(groupName, modelType, fieldName);
                onFieldChange(groupName, modelType, e.target.value, newValue);
              }}
              style={{ fontSize: '12px' }}
            />
            <Input
              value={typeof fieldValue === 'boolean' ? (fieldValue ? 'true' : 'false') : fieldValue}
              onChange={(e) => {
                const value = e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value;
                onFieldChange(groupName, modelType, fieldName, value);
              }}
              placeholder={typeof fieldValue === 'boolean' ? 'true/false' : 'value'}
              style={{ fontSize: '12px' }}
            />
            <Button
              size="small"
              danger
              onClick={() => onRemoveField(groupName, modelType, fieldName)}
            >
              🗑️
            </Button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

interface ClusterConfigEditorProps {
  sections: Sections;
  setSections: React.Dispatch<React.SetStateAction<Sections>>;
  fileName: string;
  setFileName: React.Dispatch<React.SetStateAction<string>>;
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

const ClusterConfigEditor: React.FC<ClusterConfigEditorProps> = ({
  sections,
  setSections,
  fileName,
  setFileName,
  activeTab,
  setActiveTab
}) => {
  const { message } = App.useApp();

  // Parse cluster_all.txt file content
  const parseClusterFile = (content: string) => {
    const lines = content.split('\n');
    let currentGroup: string | null = null;
    let currentModel: string | null = null;
    const deviceGroups: Record<string, DeviceGroup> = {};
    const networks: Record<string, Network> = {};
    const tenants: Record<string, Tenant> = {};
    const system: System = { checks: {} };
    let settings = '';
    let availableChecks = '';
    let currentNetwork: string | null = null;
    let currentTenant: string | null = null;
    let inSystemSection = false;
    let inAvailableChecksSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('Available check functions:')) {
        inAvailableChecksSection = true;
        availableChecks += line + '\n';
      } else if (inAvailableChecksSection && line && !line.startsWith('monitor_mode')) {
        availableChecks += line + '\n';
      } else if (line.startsWith('monitor_mode')) {
        inAvailableChecksSection = false;
        settings += line + '\n';
      } else if (line.startsWith('device_group')) {
        const match = line.match(/device_group\s+"([^"]+)"\s+"([^"]+)"/);
        if (match) {
          currentGroup = match[1];
          deviceGroups[currentGroup] = {
            name: currentGroup,
            devices: match[2],
            hardware_model: {},
            performance_model: {},
            service_model: {},
            active_test: {},
            available_exporters: {}
          };
        }
      } else if (line.includes('hardware_model') || line.includes('harward_model')) {
        currentModel = 'hardware_model';
      } else if (line.includes('performance_model')) {
        currentModel = 'performance_model';
      } else if (line.includes('service_model')) {
        currentModel = 'service_model';
      } else if (line.includes('active_test')) {
        currentModel = 'active_test';
      } else if (line.includes('available_exporters')) {
        currentModel = 'available_exporters';
      } else if (line.startsWith('network')) {
        const match = line.match(/network\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"/);
        if (match) {
          currentNetwork = match[1];
          networks[currentNetwork] = {
            name: currentNetwork,
            guid_mapping: match[2],
            link: match[3],
            links_check: false,
            checks: {}
          };
        }
      } else if (line.startsWith('tenant')) {
        const match = line.match(/tenant\s+"([^"]+)"\s+"([^"]+)"/);
        if (match) {
          currentTenant = match[1];
          tenants[currentTenant] = {
            name: currentTenant,
            devices: match[2],
            checks: {}
          };
        }
      } else if (line.startsWith('system')) {
        inSystemSection = true;
      } else if (inSystemSection && line && !line.startsWith('}') && !line.startsWith('#')) {
        system.checks[line] = true;
      } else if (line === '}') {
        if (inSystemSection) {
          inSystemSection = false;
        }
        currentModel = null;
        currentNetwork = null;
        currentTenant = null;
      } else if (currentGroup && currentModel && line && !line.startsWith('}') && !line.startsWith('#')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const key = parts[0];
          const value = parts.slice(1).join(' ');
          
          if (currentModel === 'available_exporters') {
            if (key === 'node_exporter' || key === 'dcgm_exporter') {
              (deviceGroups[currentGroup][currentModel] as any)[key] = true;
            }
          } else {
            const numValue = parseFloat(value);
            (deviceGroups[currentGroup][currentModel] as any)[key] = isNaN(numValue) ? value : numValue.toString();
          }
        } else if (parts.length === 1) {
          (deviceGroups[currentGroup][currentModel] as any)[parts[0]] = true;
        }
      } else if (currentNetwork && line && !line.startsWith('}') && !line.startsWith('#')) {
        if (line.includes('links_check')) {
          networks[currentNetwork].links_check = true;
        } else {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const key = parts[0];
            const value = parts.slice(1).join(' ');
            const numValue = parseFloat(value);
            networks[currentNetwork].checks[key] = isNaN(numValue) ? value : numValue.toString();
          } else if (parts.length === 1) {
            networks[currentNetwork].checks[parts[0]] = true;
          }
        }
      } else if (currentTenant && line && !line.startsWith('}') && !line.startsWith('#')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const key = parts[0];
          const value = parts.slice(1).join(' ');
          const numValue = parseFloat(value);
          tenants[currentTenant].checks[key] = isNaN(numValue) ? value : numValue.toString();
        } else if (parts.length === 1) {
          tenants[currentTenant].checks[parts[0]] = true;
        }
      }
    }

    return {
      settings,
      device_groups: deviceGroups,
      networks,
      tenants,
      system,
      available_checks: availableChecks || `# Available Check Functions Reference

## Hardware Model Checks
cpu_count_check <expected_count>
gpu_count_check <expected_count>
memory_stick_count_check <expected_count>
memory_speed_check <expected_speed_mhz>
nvme_count_check <expected_count>
nvme_disk_total_size_check <expected_size_gb>
ssd_count_check <expected_count>
ssd_disk_total_size_check <expected_size_gb>
infiniband_count_check <speed> <expected_count>
ethernet_count_check <expected_count>
psu_count_check <expected_count>
fan_count_check <expected_count>
temp_sensor_count_check <expected_count>

## Performance Model Checks
cpu_util_check <max_utilization_ratio>
gpu_ecc_check <max_ecc_errors>
gpu_temp_check <max_temperature_c>
link_flapping_check <max_flaps>
memory_usage_check <max_usage_ratio>
swap_usage_check <max_usage_ratio>
fs_usage_check <max_usage_ratio>
fs_free_volume_check <volume_pattern> <min_free_gb>
pcie_downgrade_check <device_file>

## Service Model Checks
fs_mount_check <mount_point>
dmesg_check

## Active Test Checks
gpu_stress_test
cpu_stress_test
memory_stress_test
network_stress_test

## Switch Performance Checks
switch_cpu_util_check <max_utilization_ratio>
switch_memory_usage_check <max_usage_ratio>
switch_temp_check <max_temperature_c>

## Network Checks
links_check
nccl_test <bandwidth_gbps>

## Tenant Checks
ping_server_check <comma_separated_ips>

## System Checks
all_exporters_status_check
alertmanager_status_check
prometheus_status_check
opensm_status_check
database_status_check

## Monitor Functions
sys_trap_monitor

## Available Exporters
node_exporter {
  textfile
  # other collectors
}
dcgm_exporter [
  # metrics list
]`
    };
  };

  // Load data from cluster_all.txt file
  const loadClusterFile = async () => {
    try {
      const filename = 'cluster_all.txt';
      console.log('Loading file from public directory:', filename);
      const response = await fetch(`/${filename}`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const content = await response.text();
      console.log('File content length:', content.length);
      console.log('First 200 chars:', content.substring(0, 200));
      
      const parsedData = parseClusterFile(content);
      console.log('Parsed data:', parsedData);
      console.log('System section:', parsedData.system);
      setSections(parsedData);
      message.success(`Configuration loaded from ${fileName} successfully!`);
    } catch (error) {
      message.error(`Failed to load configuration file: ${fileName}`);
      console.error('Error loading file:', error);
    }
  };

  // Load file on component mount
  React.useEffect(() => {
    loadClusterFile();
  }, []);

  const handleSaveConfig = () => {
    message.success('Configuration saved successfully!');
    console.log('Saving config:', sections);
  };

  const handleResetConfig = () => {
    setSections({
      'settings': `monitor_mode = alertmanager

# Add other top-level settings here
# Example:
# debug_mode = true
# log_level = info
# timeout = 30`,
      'device_groups': {
        'R6500': {
          name: 'R6500',
          devices: 'su1-gpu[1-32],su2-gpu[33-64],su3-gpu[65-96],su4-gpu[97-128]',
          hardware_model: {},
          performance_model: {},
          service_model: {},
          active_test: {},
          available_exporters: {}
        }
      },
      'networks': {},
      'tenants': {},
      'system': { checks: {} },
      'available_checks': ''
    });
    message.success('Configuration reset to default!');
  };

  const handleDownloadConfig = () => {
    const configText = JSON.stringify(sections, null, 2);
    const blob = new Blob([configText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = fileName.split('/').pop() || 'cluster_all.txt';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    message.success(`Configuration file ${filename} downloaded!`);
  };

  const handleSectionChange = (sectionName: keyof Sections, value: string) => {
    if (sectionName === 'device_groups') return;
    setSections(prev => ({
      ...prev,
      [sectionName]: value
    }));
  };

  const handleAddSection = () => {
    const newSectionName = prompt('Enter section name:');
    if (newSectionName && !(newSectionName in sections)) {
      if (newSectionName !== 'device_groups') {
        setSections(prev => ({
          ...prev,
          [newSectionName]: `# New section: ${newSectionName}\n# Add your configuration here`
        } as Sections));
        message.success(`Section "${newSectionName}" added successfully!`);
      } else {
        message.error('Cannot add device_groups section this way!');
      }
    } else if (newSectionName && newSectionName in sections) {
      message.error('Section already exists!');
    }
  };

  const handleDeviceGroupChange = (groupName: string, field: 'name' | 'devices', value: string) => {
    setSections(prev => ({
      ...prev,
      device_groups: {
        ...prev.device_groups,
        [groupName]: {
          ...prev.device_groups[groupName],
          [field]: value
        }
      }
    }));
  };

  const handleModelFieldChange = (groupName: string, modelType: keyof Omit<DeviceGroup, 'name' | 'devices' | 'sys_trap_monitor'>, fieldName: string, value: string | boolean) => {
    setSections(prev => ({
      ...prev,
      device_groups: {
        ...prev.device_groups,
        [groupName]: {
          ...prev.device_groups[groupName],
          [modelType]: {
            ...prev.device_groups[groupName][modelType],
            [fieldName]: value
          }
        }
      }
    }));
  };

  const handleAddModelField = (groupName: string, modelType: keyof Omit<DeviceGroup, 'name' | 'devices' | 'sys_trap_monitor'>) => {
    const fieldName = prompt('Enter field name:');
    if (fieldName) {
      setSections(prev => ({
        ...prev,
        device_groups: {
          ...prev.device_groups,
          [groupName]: {
            ...prev.device_groups[groupName],
            [modelType]: {
              ...prev.device_groups[groupName][modelType],
              [fieldName]: true
            }
          }
        }
      }));
    }
  };

  const handleRemoveModelField = (groupName: string, modelType: keyof Omit<DeviceGroup, 'name' | 'devices' | 'sys_trap_monitor'>, fieldName: string) => {
    setSections(prev => {
      const newModel = { ...prev.device_groups[groupName][modelType] };
      delete newModel[fieldName];
      return {
        ...prev,
        device_groups: {
          ...prev.device_groups,
          [groupName]: {
            ...prev.device_groups[groupName],
            [modelType]: newModel
          }
        }
      };
    });
  };

  const handleNetworkChange = (networkName: string, field: 'name' | 'guid_mapping' | 'link' | 'links_check', value: string | boolean) => {
    setSections(prev => ({
      ...prev,
      networks: {
        ...prev.networks,
        [networkName]: {
          ...prev.networks[networkName],
          [field]: value
        }
      }
    }));
  };

  const handleNetworkCheckChange = (networkName: string, checkName: string, value: string | boolean) => {
    setSections(prev => ({
      ...prev,
      networks: {
        ...prev.networks,
        [networkName]: {
          ...prev.networks[networkName],
          checks: {
            ...prev.networks[networkName].checks,
            [checkName]: value
          }
        }
      }
    }));
  };

  const handleAddNetworkCheck = (networkName: string) => {
    const checkName = prompt('Enter check name:');
    if (checkName) {
      setSections(prev => ({
        ...prev,
        networks: {
          ...prev.networks,
          [networkName]: {
            ...prev.networks[networkName],
            checks: {
              ...prev.networks[networkName].checks,
              [checkName]: true
            }
          }
        }
      }));
    }
  };

  const handleRemoveNetworkCheck = (networkName: string, checkName: string) => {
    setSections(prev => {
      const newChecks = { ...prev.networks[networkName].checks };
      delete newChecks[checkName];
      return {
        ...prev,
        networks: {
          ...prev.networks,
          [networkName]: {
            ...prev.networks[networkName],
            checks: newChecks
          }
        }
      };
    });
  };

  const handleAddNetwork = () => {
    const newNetworkName = `NEW_NETWORK_${Date.now()}`;
    setSections(prev => ({
      ...prev,
      networks: {
        ...prev.networks,
        [newNetworkName]: {
          name: newNetworkName,
          guid_mapping: '',
          link: '',
          links_check: false,
          checks: {}
        }
      }
    }));
    message.success('New network added!');
  };

  const handleDeleteNetwork = (networkName: string) => {
    setSections(prev => {
      const newNetworks = { ...prev.networks };
      delete newNetworks[networkName];
      return {
        ...prev,
        networks: newNetworks
      };
    });
    message.success(`Network "${networkName}" deleted!`);
  };

  const handleTenantChange = (tenantName: string, field: 'name' | 'devices', value: string) => {
    setSections(prev => ({
      ...prev,
      tenants: {
        ...prev.tenants,
        [tenantName]: {
          ...prev.tenants[tenantName],
          [field]: value
        }
      }
    }));
  };

  const handleTenantCheckChange = (tenantName: string, checkName: string, value: string | boolean) => {
    setSections(prev => ({
      ...prev,
      tenants: {
        ...prev.tenants,
        [tenantName]: {
          ...prev.tenants[tenantName],
          checks: {
            ...prev.tenants[tenantName].checks,
            [checkName]: value
          }
        }
      }
    }));
  };

  const handleAddTenantCheck = (tenantName: string) => {
    const checkName = prompt('Enter check name:');
    if (checkName) {
      setSections(prev => ({
        ...prev,
        tenants: {
          ...prev.tenants,
          [tenantName]: {
            ...prev.tenants[tenantName],
            checks: {
              ...prev.tenants[tenantName].checks,
              [checkName]: true
            }
          }
        }
      }));
    }
  };

  const handleRemoveTenantCheck = (tenantName: string, checkName: string) => {
    setSections(prev => {
      const newChecks = { ...prev.tenants[tenantName].checks };
      delete newChecks[checkName];
      return {
        ...prev,
        tenants: {
          ...prev.tenants,
          [tenantName]: {
            ...prev.tenants[tenantName],
            checks: newChecks
          }
        }
      };
    });
  };

  const handleAddTenant = () => {
    const newTenantName = `NEW_TENANT_${Date.now()}`;
    setSections(prev => ({
      ...prev,
      tenants: {
        ...prev.tenants,
        [newTenantName]: {
          name: newTenantName,
          devices: '',
          checks: {}
        }
      }
    }));
    message.success('New tenant added!');
  };

  const handleDeleteTenant = (tenantName: string) => {
    setSections(prev => {
      const newTenants = { ...prev.tenants };
      delete newTenants[tenantName];
      return {
        ...prev,
        tenants: newTenants
      };
    });
    message.success(`Tenant "${tenantName}" deleted!`);
  };

  const handleSystemCheckChange = (checkName: string, value: boolean) => {
    setSections(prev => ({
      ...prev,
      system: {
        ...prev.system,
        checks: {
          ...prev.system.checks,
          [checkName]: value
        }
      }
    }));
  };

  const handleAddSystemCheck = () => {
    const checkName = prompt('Enter system check name:');
    if (checkName) {
      setSections(prev => ({
        ...prev,
        system: {
          ...prev.system,
          checks: {
            ...prev.system.checks,
            [checkName]: true
          }
        }
      }));
      message.success(`System check "${checkName}" added!`);
    }
  };

  const handleRemoveSystemCheck = (checkName: string) => {
    setSections(prev => {
      const newChecks = { ...prev.system.checks };
      delete newChecks[checkName];
      return {
        ...prev,
        system: {
          ...prev.system,
          checks: newChecks
        }
      };
    });
    message.success(`System check "${checkName}" removed!`);
  };

  const handleAddDeviceGroup = () => {
    const newGroupName = `NEW_GROUP_${Date.now()}`;
    setSections(prev => ({
      ...prev,
      device_groups: {
        ...prev.device_groups,
        [newGroupName]: {
          name: newGroupName,
          devices: '',
          hardware_model: {},
          performance_model: {},
          service_model: {},
          active_test: {},
          available_exporters: {}
        }
      }
    }));
    message.success('New device group added!');
  };

  const handleDeleteDeviceGroup = (groupName: string) => {
    setSections(prev => {
      const newDeviceGroups = { ...prev.device_groups };
      delete newDeviceGroups[groupName];
      return {
        ...prev,
        device_groups: newDeviceGroups
      };
    });
    message.success(`Device group "${groupName}" deleted!`);
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#ffffff',
      padding: '24px',
      boxSizing: 'border-box',
      overflow: 'auto',
      zIndex: 10
    }}>
      <h1 style={{ 
        color: '#1a365d', 
        fontSize: '28px', 
        marginBottom: '8px',
        fontWeight: '600'
      }}>
        Cluster Configuration Editor
      </h1>
      <div style={{ 
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <label style={{ 
            color: '#4a5568', 
            fontSize: '16px',
            fontWeight: '500'
          }}>
            File:
          </label>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            style={{ 
              flex: 1,
              maxWidth: '500px'
            }}
            placeholder="Enter file path..."
          />
          <Button
            onClick={loadClusterFile}
            style={{ 
              backgroundColor: '#1890ff',
              borderColor: '#1890ff',
              color: 'white'
            }}
          >
            🔄 Reload
          </Button>
        </div>
        <div style={{ 
          fontSize: '12px',
          color: '#666',
          fontStyle: 'italic'
        }}>
          Note: Currently loading from public/cluster_all.txt. The file path above is for display/reference only.
        </div>
      </div>
      
      <div style={{ marginBottom: '24px' }}>
        <button 
          onClick={handleSaveConfig} 
          style={{ 
            marginRight: '12px', 
            padding: '10px 20px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          💾 Save All
        </button>
        <button 
          onClick={handleResetConfig} 
          style={{ 
            marginRight: '12px', 
            padding: '10px 20px',
            backgroundColor: '#52c41a',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          🔄 Reset All
        </button>
        <button 
          onClick={handleDownloadConfig}
          style={{ 
            marginRight: '12px',
            padding: '10px 20px',
            backgroundColor: '#722ed1',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          📥 Download
        </button>
        <button 
          onClick={handleAddSection}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#13c2c2',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ➕ Add Section
        </button>
      </div>
      
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}
        tabBarStyle={{
          marginBottom: '24px',
          borderBottom: '2px solid #f1f5f9'
        }}
        items={Object.entries(sections).map(([sectionName, content]) => ({
          key: sectionName,
          label: (
            <span style={{
              fontSize: '15px',
              fontWeight: '600',
              color: activeTab === sectionName ? '#3b82f6' : '#64748b',
              padding: '8px 16px',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }}>
              {sectionName.replace('_', ' ').toUpperCase()}
            </span>
          ),
          children: sectionName === 'device_groups' ? (
            <div style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#1a365d' }}>Device Groups Management</h3>
                <Button 
                  type="primary" 
                  onClick={handleAddDeviceGroup}
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
                  ➕ Add Device Group
                </Button>
              </div>
              <Collapse
                style={{
                  background: 'transparent',
                  border: 'none'
                }}
                items={Object.entries(content as Record<string, DeviceGroup>).map(([groupName, groupData]) => ({
                  key: groupName,
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
                          {groupData.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ 
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#1e293b',
                            marginBottom: '4px'
                          }}>
                            {groupData.name}
                          </div>
                          <div style={{ 
                            fontSize: '14px',
                            color: '#64748b'
                          }}>
                            Devices: {groupData.devices || 'Not specified'}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDeviceGroup(groupName);
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
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1a365d' }}>
                            Group Name:
                          </label>
                          <Input
                            value={groupData.name}
                            onChange={(e) => handleDeviceGroupChange(groupName, 'name', e.target.value)}
                          />
                        </div>
                        <div style={{ flex: 2 }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1a365d' }}>
                            Devices:
                          </label>
                          <Input
                            value={groupData.devices}
                            onChange={(e) => handleDeviceGroupChange(groupName, 'devices', e.target.value)}
                            placeholder="e.g., su1-gpu[1-32],su2-gpu[33-64]"
                          />
                        </div>
                      </div>
                      
                      <ModelSection
                        title="Hardware Model"
                        modelType="hardware_model"
                        groupName={groupName}
                        modelData={groupData.hardware_model}
                        onAddField={handleAddModelField}
                        onFieldChange={handleModelFieldChange}
                        onRemoveField={handleRemoveModelField}
                      />

                      <ModelSection
                        title="Performance Model"
                        modelType="performance_model"
                        groupName={groupName}
                        modelData={groupData.performance_model}
                        onAddField={handleAddModelField}
                        onFieldChange={handleModelFieldChange}
                        onRemoveField={handleRemoveModelField}
                      />

                      <ModelSection
                        title="Service Model"
                        modelType="service_model"
                        groupName={groupName}
                        modelData={groupData.service_model}
                        onAddField={handleAddModelField}
                        onFieldChange={handleModelFieldChange}
                        onRemoveField={handleRemoveModelField}
                      />

                      <ModelSection
                        title="Active Test"
                        modelType="active_test"
                        groupName={groupName}
                        modelData={groupData.active_test}
                        onAddField={handleAddModelField}
                        onFieldChange={handleModelFieldChange}
                        onRemoveField={handleRemoveModelField}
                      />

                      <ModelSection
                        title="Available Exporters"
                        modelType="available_exporters"
                        groupName={groupName}
                        modelData={groupData.available_exporters}
                        onAddField={handleAddModelField}
                        onFieldChange={handleModelFieldChange}
                        onRemoveField={handleRemoveModelField}
                      />
                    </div>
                  )
                }))}
              />
            </div>
          ) : sectionName === 'networks' ? (
            <div style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#1a365d' }}>Networks Management</h3>
                <Button 
                  type="primary" 
                  onClick={handleAddNetwork}
                  style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                >
                  ➕ Add Network
                </Button>
              </div>
              <Collapse
                items={Object.entries(content as Record<string, Network>).map(([networkName, networkData]) => ({
                  key: networkName,
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div>
                        <strong style={{ color: '#1a365d' }}>{networkData.name}</strong>
                        <span style={{ marginLeft: '10px', color: '#666', fontSize: '12px' }}>
                          GUID Mapping: {networkData.guid_mapping || 'Not specified'}
                        </span>
                      </div>
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNetwork(networkName);
                        }}
                        style={{ marginRight: '10px' }}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  ),
                  children: (
                    <div style={{ padding: '0' }}>
                      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1a365d' }}>
                            Network Name:
                          </label>
                          <Input
                            value={networkData.name}
                            onChange={(e) => handleNetworkChange(networkName, 'name', e.target.value)}
                          />
                        </div>
                        <div style={{ flex: 2 }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1a365d' }}>
                            GUID Mapping:
                          </label>
                          <Input
                            value={networkData.guid_mapping}
                            onChange={(e) => handleNetworkChange(networkName, 'guid_mapping', e.target.value)}
                            placeholder="e.g., node_guid_mapping.csv"
                          />
                        </div>
                        <div style={{ flex: 2 }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1a365d' }}>
                            Link:
                          </label>
                          <Input
                            value={networkData.link}
                            onChange={(e) => handleNetworkChange(networkName, 'link', e.target.value)}
                            placeholder="e.g., links.csv"
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'end', marginBottom: '5px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#1a365d' }}>
                            <input
                              type="checkbox"
                              checked={networkData.links_check}
                              onChange={(e) => handleNetworkChange(networkName, 'links_check', e.target.checked)}
                            />
                            Links Check
                          </label>
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0, color: '#1a365d', fontSize: '16px' }}>Additional Checks</h4>
                          <Button 
                            size="small" 
                            onClick={() => handleAddNetworkCheck(networkName)}
                            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}
                          >
                            ➕ Add Check
                          </Button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                          {Object.entries(networkData.checks).map(([checkName, checkValue]) => (
                            <React.Fragment key={checkName}>
                              <Input
                                value={checkName}
                                onChange={(e) => {
                                  const newValue = networkData.checks[checkName];
                                  handleRemoveNetworkCheck(networkName, checkName);
                                  handleNetworkCheckChange(networkName, e.target.value, newValue);
                                }}
                                style={{ fontSize: '12px' }}
                              />
                              <Input
                                value={typeof checkValue === 'boolean' ? (checkValue ? 'true' : 'false') : checkValue}
                                onChange={(e) => {
                                  const value = e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value;
                                  handleNetworkCheckChange(networkName, checkName, value);
                                }}
                                placeholder={typeof checkValue === 'boolean' ? 'true/false' : 'value'}
                                style={{ fontSize: '12px' }}
                              />
                              <Button
                                size="small"
                                danger
                                onClick={() => handleRemoveNetworkCheck(networkName, checkName)}
                              >
                                🗑️
                              </Button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                }))}
                style={{ backgroundColor: '#f8fafc' }}
              />
            </div>
          ) : sectionName === 'tenants' ? (
            <div style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#1a365d' }}>Tenants Management</h3>
                <Button 
                  type="primary" 
                  onClick={handleAddTenant}
                  style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                >
                  ➕ Add Tenant
                </Button>
              </div>
              <Collapse
                items={Object.entries(content as Record<string, Tenant>).map(([tenantName, tenantData]) => ({
                  key: tenantName,
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div>
                        <strong style={{ color: '#1a365d' }}>{tenantData.name}</strong>
                        <span style={{ marginLeft: '10px', color: '#666', fontSize: '12px' }}>
                          Devices: {tenantData.devices || 'Not specified'}
                        </span>
                      </div>
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTenant(tenantName);
                        }}
                        style={{ marginRight: '10px' }}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  ),
                  children: (
                    <div style={{ padding: '0' }}>
                      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1a365d' }}>
                            Tenant Name:
                          </label>
                          <Input
                            value={tenantData.name}
                            onChange={(e) => handleTenantChange(tenantName, 'name', e.target.value)}
                          />
                        </div>
                        <div style={{ flex: 2 }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#1a365d' }}>
                            Devices:
                          </label>
                          <Input
                            value={tenantData.devices}
                            onChange={(e) => handleTenantChange(tenantName, 'devices', e.target.value)}
                            placeholder="e.g., su1-gpu[1-8]"
                          />
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h4 style={{ margin: 0, color: '#1a365d', fontSize: '16px' }}>Checks</h4>
                          <Button 
                            size="small" 
                            onClick={() => handleAddTenantCheck(tenantName)}
                            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}
                          >
                            ➕ Add Check
                          </Button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                          {Object.entries(tenantData.checks).map(([checkName, checkValue]) => (
                            <React.Fragment key={checkName}>
                              <Input
                                value={checkName}
                                onChange={(e) => {
                                  const newValue = tenantData.checks[checkName];
                                  handleRemoveTenantCheck(tenantName, checkName);
                                  handleTenantCheckChange(tenantName, e.target.value, newValue);
                                }}
                                style={{ fontSize: '12px' }}
                              />
                              <Input
                                value={typeof checkValue === 'boolean' ? (checkValue ? 'true' : 'false') : checkValue}
                                onChange={(e) => {
                                  const value = e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value;
                                  handleTenantCheckChange(tenantName, checkName, value);
                                }}
                                placeholder={typeof checkValue === 'boolean' ? 'true/false' : 'value'}
                                style={{ fontSize: '12px' }}
                              />
                              <Button
                                size="small"
                                danger
                                onClick={() => handleRemoveTenantCheck(tenantName, checkName)}
                              >
                                🗑️
                              </Button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                }))}
                style={{ backgroundColor: '#f8fafc' }}
              />
            </div>
          ) : sectionName === 'system' ? (
            <div style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#1a365d' }}>System Checks Management</h3>
                <Button 
                  type="primary" 
                  onClick={handleAddSystemCheck}
                  style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                >
                  ➕ Add System Check
                </Button>
              </div>
              <div style={{ 
                border: '2px solid #e2e8f0', 
                borderRadius: '8px', 
                padding: '20px',
                backgroundColor: '#f8fafc'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center' }}>
                  {Object.entries((content as System).checks).map(([checkName, checkValue]) => (
                    <React.Fragment key={checkName}>
                      <div style={{ 
                        padding: '8px 12px', 
                        backgroundColor: 'white', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '4px',
                        fontFamily: '"Fira Code", "Monaco", "Menlo", "Ubuntu Mono", monospace',
                        fontSize: '14px'
                      }}>
                        {checkName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                          <input
                            type="checkbox"
                            checked={checkValue}
                            onChange={(e) => handleSystemCheckChange(checkName, e.target.checked)}
                          />
                          Enabled
                        </label>
                      </div>
                      <Button
                        size="small"
                        danger
                        onClick={() => handleRemoveSystemCheck(checkName)}
                      >
                        🗑️ Remove
                      </Button>
                    </React.Fragment>
                  ))}
                  {Object.keys((content as System).checks).length === 0 && (
                    <div style={{ 
                      gridColumn: '1 / -1', 
                      textAlign: 'center', 
                      color: '#666', 
                      fontStyle: 'italic',
                      padding: '20px'
                    }}>
                      No system checks configured. Click "Add System Check" to add one.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#f8fafc'
            }}>
              <textarea
                value={content as string}
                onChange={(e) => handleSectionChange(sectionName as keyof Sections, e.target.value)}
                style={{
                  width: '100%',
                  height: '500px',
                  fontFamily: '"Fira Code", "Monaco", "Menlo", "Ubuntu Mono", monospace',
                  fontSize: '14px',
                  padding: '20px',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  color: '#2d3748'
                }}
                placeholder={`Enter ${sectionName} configuration...`}
              />
            </div>
          )
        }))}
      />
    </div>
  );
};

export default ClusterConfigEditor;