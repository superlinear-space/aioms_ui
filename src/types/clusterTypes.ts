export interface DeviceGroup {
  name: string;
  devices: string;
  hardware_model: Record<string, string | boolean>;
  performance_model: Record<string, string | boolean>;
  service_model: Record<string, string | boolean>;
  active_test: Record<string, string | boolean>;
  available_exporters: Record<string, string | boolean>;
  [key: string]: any;
}

export interface Network {
  name: string;
  guid_mapping: string;
  link: string;
  links_check: boolean;
  checks: Record<string, string | boolean>;
}

export interface Tenant {
  name: string;
  devices: string;
  checks: Record<string, string | boolean>;
}

export interface System {
  checks: Record<string, boolean>;
}

export interface Sections {
  settings: string;
  device_groups: Record<string, DeviceGroup>;
  networks: Record<string, Network>;
  tenants: Record<string, Tenant>;
  system: System;
  available_checks: string;
}

export interface YamlSections {
  devices: Array<{device_model: string, instances: string}>;
  networks: Array<{network: string, nodes: string, links: string}>;
  tenants: Array<{tenant: string, instances: string}>;
  system: { epilogue: string[] };
  request_labels: string[];
  set_labels: Record<string, string>;
}

// Default export for all types
export default {
  DeviceGroup,
  Network,
  Tenant,
  System,
  Sections,
  YamlSections
};
