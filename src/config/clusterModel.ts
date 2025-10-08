// src/config/clusterModel.ts

/**
 * 计算用于前端 fetch 的集群模型目录基路径
 * - 读取 VITE_CLUSTER_MODEL_DIR
 * - 开发环境 (Vite dev server) 绝对路径使用 /@fs 直访
 * - 未配置时返回空字符串，表示回退到 public 根目录
 */
export const getClusterModelBase = (): string => {
  const envDir = (import.meta as any).env?.VITE_CLUSTER_MODEL_DIR as string | undefined;
  const isDev = !!(import.meta as any).env?.DEV;

  if (!envDir || envDir.trim() === '') return '';

  // 绝对路径
  if (envDir.startsWith('/')) {
    return isDev ? `/@fs${envDir}` : envDir;
  }

  // 相对路径或 URL 路径前缀，直接返回（相对当前站点）
  return envDir;
};


