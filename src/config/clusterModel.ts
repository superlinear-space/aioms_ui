// src/config/clusterModel.ts

/**
 * 获取集群模型API的基础URL
 */
export const getClusterModelApiBase = (): string => {
  const apiBase = import.meta.env.VITE_CLUSTER_MODEL_API as string | undefined;
  const defaultUrl = 'http://localhost:3001';
  return apiBase || defaultUrl;
};

/**
 * 获取完整的API端点
 */
export const clusterModelApi = {
  cluster: () => `${getClusterModelApiBase()}/api/cluster`,
  deviceModel: (modelName: string) => `${getClusterModelApiBase()}/api/device-models/${modelName}`,
  health: () => `${getClusterModelApiBase()}/health`,
};