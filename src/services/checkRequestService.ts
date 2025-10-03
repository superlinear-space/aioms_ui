import type { CheckRequest, DomainMatrixData } from '../data/mockData';
import { transformToMatrix } from '../data/mockData';
import * as yaml from 'js-yaml';

// 模拟API延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// YAML配置接口
interface YamlConfig {
  check_requests: CheckRequest[];
}

export class CheckRequestService {
  private static cachedData: CheckRequest[] | null = null;
  private static lastLoadTime: number = 0;
  private static readonly CACHE_DURATION = 30000; // 30秒缓存

  // 从YAML文件加载数据
  private static async loadFromYaml(): Promise<CheckRequest[]> {
    try {
      const response = await fetch('/check_requests.yaml');
      if (!response.ok) {
        throw new Error(`Failed to load YAML file: ${response.statusText}`);
      }
      
      const yamlText = await response.text();
      const config = yaml.load(yamlText) as YamlConfig;
      
      if (!config || !config.check_requests) {
        throw new Error('Invalid YAML format: missing check_requests array');
      }
      
      // 验证数据格式
      const validatedData = config.check_requests.map((item, index) => {
        if (!item.domain || !item.instance || !item.check_function || 
            typeof item.value !== 'number' || item.value < 0 || item.value > 2) {
          throw new Error(`Invalid data at index ${index}: ${JSON.stringify(item)}`);
        }
        return {
          domain: item.domain,
          instance: item.instance,
          check_function: item.check_function,
          value: item.value as 0 | 1 | 2,
          timestamp: item.timestamp || Date.now()
        };
      });
      
      return validatedData;
    } catch (error) {
      console.error('Failed to load YAML data:', error);
      // 返回空数组而不是抛出错误，让界面能正常显示
      return [];
    }
  }

  // 获取所有CheckRequest数据（带缓存）
  static async getCheckRequests(): Promise<CheckRequest[]> {
    const now = Date.now();
    
    // 如果缓存有效，直接返回缓存数据
    if (this.cachedData && (now - this.lastLoadTime) < this.CACHE_DURATION) {
      return this.cachedData;
    }
    
    await delay(200); // 模拟网络延迟
    const data = await this.loadFromYaml();
    
    // 更新缓存
    this.cachedData = data;
    this.lastLoadTime = now;
    
    return data;
  }

  // 获取按domain分组的矩阵数据
  static async getMatrixData(): Promise<DomainMatrixData[]> {
    const data = await this.getCheckRequests();
    return transformToMatrix(data);
  }

  // 根据domain过滤数据
  static async getCheckRequestsByDomain(domain: string): Promise<CheckRequest[]> {
    await delay(100);
    const allData = await this.getCheckRequests();
    return allData.filter(item => item.domain === domain);
  }

  // 根据instance过滤数据
  static async getCheckRequestsByInstance(instance: string): Promise<CheckRequest[]> {
    await delay(100);
    const allData = await this.getCheckRequests();
    return allData.filter(item => item.instance === instance);
  }

  // 根据check_function过滤数据
  static async getCheckRequestsByCheckFunction(checkFunction: string): Promise<CheckRequest[]> {
    await delay(100);
    const allData = await this.getCheckRequests();
    return allData.filter(item => item.check_function === checkFunction);
  }

  // 刷新数据（清除缓存并重新加载）
  static async refreshData(): Promise<CheckRequest[]> {
    this.cachedData = null;
    this.lastLoadTime = 0;
    await delay(500);
    return this.getCheckRequests();
  }

  // 获取所有唯一的domains
  static async getDomains(): Promise<string[]> {
    const data = await this.getCheckRequests();
    return Array.from(new Set(data.map(item => item.domain))).sort();
  }

  // 获取所有唯一的instances
  static async getInstances(): Promise<string[]> {
    const data = await this.getCheckRequests();
    return Array.from(new Set(data.map(item => item.instance))).sort();
  }

  // 获取所有唯一的check_functions
  static async getCheckFunctions(): Promise<string[]> {
    const data = await this.getCheckRequests();
    return Array.from(new Set(data.map(item => item.check_function))).sort();
  }
}