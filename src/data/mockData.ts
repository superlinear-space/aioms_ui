// Prometheus风格的CheckRequest数据模拟
export interface CheckRequest {
    domain: string;
    instance: string;
    check_function: string;
    value: 0 | 1 | 2 ; // 0: successful(绿), 1: failed(红), 2: unknown(灰)
    timestamp?: number;
  }
  
  // 状态映射
  export const STATUS_MAP = {
    0: { label: 'Successful', color: '#52c41a', bgColor: '#f6ffed' },
    1: { label: 'Failed', color: '#ff4d4f', bgColor: '#fff2f0' },
    2: { label: 'Unknown', color: '#faad14', bgColor: '#fffbe6' }
  } as const;
  
  // 按domain分组的数据结构
  export interface DomainMatrixData {
    domain: string;
    instances: {
      [instance: string]: {
        [checkFunction: string]: CheckRequest;
      };
    };
  }
  
  // 将CheckRequest数据转换为矩阵格式
  export const transformToMatrix = (data: CheckRequest[]): DomainMatrixData[] => {
    const domainMap = new Map<string, DomainMatrixData>();
    
    data.forEach(item => {
      if (!domainMap.has(item.domain)) {
        domainMap.set(item.domain, {
          domain: item.domain,
          instances: {}
        });
      }
      
      const domainData = domainMap.get(item.domain)!;
      
      if (!domainData.instances[item.instance]) {
        domainData.instances[item.instance] = {};
      }
      
      domainData.instances[item.instance][item.check_function] = item;
    });
    
    return Array.from(domainMap.values());
  };