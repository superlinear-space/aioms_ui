import * as yaml from 'js-yaml';
import { prometheusConfig } from '../config/prometheus';
import { getClusterModelBase } from '../config/clusterModel';
export interface ClusterDevice {
  device_model: string;
  instances: string;
}

export interface ClusterConfig {
  devices: ClusterDevice[];
}

export interface DeviceModelCheck {
  hardware_model?: string[];
  performance_model?: string[];
  service_model?: string[];
  active_test_suite?: string[];
}

export interface PrometheusQueryResult {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: {
        __name__: string;
        domain: string;
        cf: string;
        hostname: string;
        instance: string;
        [key: string]: string;
      };
      value: [number, string];
    }>;
  };
}

export interface MatrixData {
  domain: string;
  instances: Record<string, Record<string, { value: number; inputValue?: string }>>;
}

export class PrometheusService {
  private static readonly PROMETHEUS_BASE_URL = prometheusConfig.baseUrl;

  /**
   * 解析cluster.yml文件获取设备配置
   */
  static async loadClusterConfig(): Promise<ClusterConfig> {
    try {
      const base = getClusterModelBase();
      // 若设置了 VITE_CLUSTER_MODEL_DIR，则从该目录读取；否则回退到 public 根
      const url = base ? `${base}/cluster.yml` : '/cluster.yml';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load cluster.yml from ${url}: ${response.status}`);
      }
      const content = await response.text();
      const parsed = yaml.load(content) as ClusterConfig;
      return parsed;
    } catch (error) {
      console.error('Error loading cluster config:', error);
      throw error;
    }
  }

  /**
   * 解析device model YAML文件获取check functions
   */
  static async loadDeviceModelConfig(deviceModel: string): Promise<DeviceModelCheck> {
    try {
      // 优先尝试 .yml，其次尝试 .yaml，兼容不同扩展名
      const base = getClusterModelBase();
      const prefix = base ? `${base}/device_models` : '/device_models';
      const ymlUrl = `${prefix}/${deviceModel}.yml`;
      const yamlUrl = `${prefix}/${deviceModel}.yaml`;

      let response = await fetch(ymlUrl);
      if (!response.ok) {
        response = await fetch(yamlUrl);
      }
      if (!response.ok) {
        throw new Error(`Failed to load device model file: tried ${ymlUrl} and ${yamlUrl}, status ${response.status}`);
      }

      const content = await response.text();
      const parsed = yaml.load(content) as DeviceModelCheck;
      return parsed || {} as DeviceModelCheck;
    } catch (error) {
      console.error(`Error loading device model config for ${deviceModel}:`, error);
      throw error;
    }
  }

  /**
   * 展开instances范围，如su1-gpu[1-32] -> [su1-gpu1, su1-gpu2, ..., su1-gpu32]
   */
  static expandInstances(instancesStr: string): string[] {
    const instances: string[] = [];
    const parts = instancesStr.split(',');

    for (const part of parts) {
      const trimmed = part.trim();

      // 检查是否包含范围模式 [start-end]，支持后缀（如: service-access-[1-4]-a）
      // 兼容无后缀（如: storage[01-07]）与有后缀（如: service-access-[1-4]-a）两种情况
      const rangeMatch = trimmed.match(/^(.*)\[(\d+)-(\d+)\](.*)$/);
      if (rangeMatch) {
        const [, prefix, startStr, endStr, suffix] = rangeMatch;
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        for (let i = start; i <= end; i++) {
          // 处理零填充，如[01-07] -> 01, 02, ..., 07
          const paddedI = startStr.length === endStr.length && startStr.startsWith('0')
            ? i.toString().padStart(startStr.length, '0')
            : i.toString();
          instances.push(`${prefix}${paddedI}${suffix}`);
        }
      } else {
        instances.push(trimmed);
      }
    }

    return instances;
  }

  /**
   * 从device model配置中提取所有check function名称
   */
  static extractCheckFunctions(deviceModelConfig: DeviceModelCheck): string[] {
    const checkFunctions: string[] = [];

    // 从各个模型中提取check function名称（忽略空格后的数据）
    const models = [
      deviceModelConfig.hardware_model || [],
      deviceModelConfig.performance_model || [],
      deviceModelConfig.service_model || [],
      deviceModelConfig.active_test_suite || []
    ];

    for (const model of models) {
      for (const item of model) {
        // 提取空格前的部分作为check function名称
        const checkFunction = item.split(' ')[0];
        if (checkFunction && !checkFunctions.includes(checkFunction)) {
          checkFunctions.push(checkFunction);
        }
      }
    }

    return checkFunctions;
  }


  /**
   * 查询Prometheus API获取CHECK_INPUT数据
   */
  static async queryPrometheusInput(domain: string, checkFunction: string): Promise<PrometheusQueryResult> {
    const query = `CHECK_INPUT{domain="${domain}", cf="${checkFunction}"}`;
    const url = `${this.PROMETHEUS_BASE_URL}/api/v1/query?query=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.status}`);
      }
      const data = await response.json();
      return data as PrometheusQueryResult;
    } catch (error) {
      console.error(`Error querying Prometheus INPUT for ${domain}/${checkFunction}:`, error);
      throw error;
    }
  }


  /**
   * 查询Prometheus API获取监控数据
   */
  static async queryPrometheus(domain: string, checkFunction: string): Promise<PrometheusQueryResult> {
    const query = `CHECK{domain="${domain}", cf="${checkFunction}"}`;
    const url = `${this.PROMETHEUS_BASE_URL}/api/v1/query?query=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.status}`);
      }
      const data = await response.json();
      return data as PrometheusQueryResult;
    } catch (error) {
      console.error(`Error querying Prometheus for ${domain}/${checkFunction}:`, error);
      throw error;
    }
  }

  /**
   * 一次性查询所有CHECK数据（不带过滤标签）
   */
  static async queryAllChecks(): Promise<PrometheusQueryResult> {
    const query = `CHECK`;
    const url = `${this.PROMETHEUS_BASE_URL}/api/v1/query?query=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.status}`);
      }
      const data = await response.json();
      return data as PrometheusQueryResult;
    } catch (error) {
      console.error(`Error querying Prometheus for all CHECK:`, error);
      throw error;
    }
  }

  /**
   * 一次性查询所有CHECK_INPUT数据（不带过滤标签）
   */
  static async queryAllInputs(): Promise<PrometheusQueryResult> {
    const query = `CHECK_INPUT`;
    const url = `${this.PROMETHEUS_BASE_URL}/api/v1/query?query=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Prometheus query failed: ${response.status}`);
      }
      const data = await response.json();
      return data as PrometheusQueryResult;
    } catch (error) {
      console.error(`Error querying Prometheus for all CHECK_INPUT:`, error);
      throw error;
    }
  }

  /**
   * 构建完整的矩阵数据
   */
  static async buildMatrixData(): Promise<MatrixData[]> {
    try {
      // 1. 加载cluster配置
      const clusterConfig = await this.loadClusterConfig();
      // 2. 预取所有CHECK与CHECK_INPUT数据
      let allChecks: PrometheusQueryResult | null = null;
      let allInputs: PrometheusQueryResult | null = null;
      try {
        allChecks = await this.queryAllChecks();
      } catch (e) {
        console.warn('Failed to query all CHECK metrics:', e);
      }
      try {
        allInputs = await this.queryAllInputs();
      } catch (e) {
        console.warn('Failed to query all CHECK_INPUT metrics:', e);
      }

      // 3. 将查询结果构建为快速索引
      const checksMap: Record<string, Record<string, Record<string, number>>> = {};
      if (allChecks?.status === 'success' && allChecks.data?.result) {
        for (const item of allChecks.data.result) {
          const domain = item.metric.domain;
          const hostname = item.metric.hostname;
          const cf = item.metric.cf;
          const value = parseInt(item.value[1], 10);
          if (!domain || !hostname || !cf || Number.isNaN(value)) continue;
          checksMap[domain] = checksMap[domain] || {};
          checksMap[domain][hostname] = checksMap[domain][hostname] || {};
          checksMap[domain][hostname][cf] = value;
        }
      }

      const inputsMap: Record<string, Record<string, Record<string, string>>> = {};
      if (allInputs?.status === 'success' && allInputs.data?.result) {
        for (const item of allInputs.data.result) {
          const domain = item.metric.domain;
          const hostname = item.metric.hostname;
          const cf = item.metric.cf;
          const raw = item.value[1];
          if (!domain || !hostname || !cf) continue;
          let displayValue = raw as unknown as string;
          try {
            const parsed = JSON.parse(String(raw));
            if (Array.isArray(parsed)) {
              displayValue = parsed.join(', ');
            } else {
              displayValue = String(parsed);
            }
          } catch {
            displayValue = String(raw);
          }
          inputsMap[domain] = inputsMap[domain] || {};
          inputsMap[domain][hostname] = inputsMap[domain][hostname] || {};
          inputsMap[domain][hostname][cf] = displayValue;
        }
      }

      const matrixData: MatrixData[] = [];

      // 4. 处理每个device model
      for (const device of clusterConfig.devices) {
        const domain = device.device_model;
        const instancesStr = device.instances;

        // 展开instances
        const instances = this.expandInstances(instancesStr);

        // 加载device model配置获取check functions
        const deviceModelConfig = await this.loadDeviceModelConfig(domain);
        const checkFunctions = this.extractCheckFunctions(deviceModelConfig);

        // 初始化矩阵数据结构
        const domainData: MatrixData = {
          domain,
          instances: {}
        };

        // 为每个instance初始化check function数据
        for (const instance of instances) {
          domainData.instances[instance] = {};
          for (const checkFunction of checkFunctions) {
            domainData.instances[instance][checkFunction] = { value: 2, inputValue: '' }; // 默认为unknown
          }
        }

        // 使用批量查询结果填充当前domain的数据
        const domainChecks = checksMap[domain] || {};
        const domainInputs = inputsMap[domain] || {};
        for (const [hostname, cfToValue] of Object.entries(domainChecks)) {
          if (!domainData.instances[hostname]) continue;
          for (const [cf, value] of Object.entries(cfToValue)) {
            if (domainData.instances[hostname][cf] !== undefined) {
              domainData.instances[hostname][cf].value = value as number;
            }
          }
        }
        for (const [hostname, cfToInput] of Object.entries(domainInputs)) {
          if (!domainData.instances[hostname]) continue;
          for (const [cf, inputValue] of Object.entries(cfToInput)) {
            if (domainData.instances[hostname][cf] !== undefined) {
              domainData.instances[hostname][cf].inputValue = inputValue as string;
            }
          }
        }

        matrixData.push(domainData);
      }

      return matrixData;
    } catch (error) {
      console.error('Error building matrix data:', error);
      throw error;
    }
  }
}
import axios from 'axios';

const API_BASE_URL = 'http://localhost:15000/api';

export interface GeneratePromRulesRequest {
  cluster_dir: string;
  output_dir: string;
}

export interface GeneratePromRulesResponse {
  success: boolean;
  message: string;
  output_dir: string;
  cluster_dir: string;
  files_generated: number;
  prometheus_files: string[];
  command_output: string;
  command: string;
}

export interface SuperAlarmStatus {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export const prometheusService = {
  async generatePromRules(request: GeneratePromRulesRequest): Promise<GeneratePromRulesResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/generate_prom_rules`, request);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to generate Prometheus rules');
    }
  },

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      return response.data.status === 'OK';
    } catch (error) {
      return false;
    }
  },

  async checkSuperAlarm(): Promise<SuperAlarmStatus> {
    try {
      const response = await axios.get(`${API_BASE_URL}/check_superalarm`);
      return response.data;
    } catch (error: any) {
      return {
        available: false,
        error: error.response?.data?.error || 'Failed to check superalarm status'
      };
    }
  }
};