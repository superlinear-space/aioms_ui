import * as yaml from 'js-yaml';

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
  private static readonly PROMETHEUS_BASE_URL = 'http://localhost:9090';

  /**
   * 解析cluster.yml文件获取设备配置
   */
  static async loadClusterConfig(): Promise<ClusterConfig> {
    try {
      const response = await fetch('/cluster.yml');
      if (!response.ok) {
        throw new Error(`Failed to load cluster.yml: ${response.status}`);
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
      const response = await fetch(`/device_models/${deviceModel}.yml`);
      if (!response.ok) {
        throw new Error(`Failed to load ${deviceModel}.yml: ${response.status}`);
      }
      const content = await response.text();
      const parsed = yaml.load(content) as DeviceModelCheck;
      return parsed;
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
      
      // 检查是否包含范围模式 [start-end]
      const rangeMatch = trimmed.match(/^(.+)\[(\d+)-(\d+)\]$/);
      if (rangeMatch) {
        const [, prefix, startStr, endStr] = rangeMatch;
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        
        for (let i = start; i <= end; i++) {
          // 处理零填充，如[01-07] -> 01, 02, ..., 07
          const paddedI = startStr.length === endStr.length && startStr.startsWith('0') 
            ? i.toString().padStart(startStr.length, '0')
            : i.toString();
          instances.push(`${prefix}${paddedI}`);
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
   * 构建完整的矩阵数据
   */
  static async buildMatrixData(): Promise<MatrixData[]> {
    try {
      // 1. 加载cluster配置
      const clusterConfig = await this.loadClusterConfig();
      
      const matrixData: MatrixData[] = [];
      
      // 2. 处理每个device model
      for (const device of clusterConfig.devices) {
        const domain = device.device_model;
        const instancesStr = device.instances;
        
        // 3. 展开instances
        const instances = this.expandInstances(instancesStr);
        
        // 4. 加载device model配置获取check functions
        const deviceModelConfig = await this.loadDeviceModelConfig(domain);
        const checkFunctions = this.extractCheckFunctions(deviceModelConfig);
        
        // 5. 初始化矩阵数据结构
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
        
        // 6. 查询Prometheus获取实际数据
        for (const checkFunction of checkFunctions) {
          try {
            // 查询CHECK状态
            const queryResult = await this.queryPrometheus(domain, checkFunction);
            
            if (queryResult.status === 'success' && queryResult.data.result) {
              // 处理查询结果
              for (const result of queryResult.data.result) {
                const hostname = result.metric.hostname;
                const value = parseInt(result.value[1], 10);
                
                // 如果hostname在instances中，更新对应的值
                if (domainData.instances[hostname]) {
                  domainData.instances[hostname][checkFunction] = { value, inputValue: '' };
                }
              }
            }

            // 查询CHECK_INPUT数据
            try {
              const inputResult = await this.queryPrometheusInput(domain, checkFunction);
              
              if (inputResult.status === 'success' && inputResult.data.result) {
                for (const result of inputResult.data.result) {
                  const hostname = result.metric.hostname;
                  const inputValue = result.value[1];
                  
                  // 解析输入值（可能是数字、字符串或列表）
                  let displayValue = inputValue;
                  try {
                    // 尝试解析为JSON（处理列表情况）
                    const parsed = JSON.parse(inputValue);
                    if (Array.isArray(parsed)) {
                      displayValue = parsed.join(', ');
                    } else {
                      displayValue = String(parsed);
                    }
                  } catch {
                    // 如果不是JSON，直接使用字符串值
                    displayValue = String(inputValue);
                  }
                  
                  // 如果hostname在instances中，更新inputValue
                  if (domainData.instances[hostname] && domainData.instances[hostname][checkFunction]) {
                    domainData.instances[hostname][checkFunction].inputValue = displayValue;
                  }
                }
              }
            } catch (error) {
              console.warn(`Failed to query INPUT for ${domain}/${checkFunction}:`, error);
              // 继续处理，不影响CHECK状态显示
            }

          } catch (error) {
            console.warn(`Failed to query ${domain}/${checkFunction}:`, error);
            // 保持默认的unknown状态
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
