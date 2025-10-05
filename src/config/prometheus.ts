// src/config/prometheus.ts

interface PrometheusConfig {
  baseUrl: string;
}

/**
 * 获取 Prometheus 配置
 * 优先级：环境变量 > 默认值
 */
export const getPrometheusConfig = (): PrometheusConfig => {
  // Vite 会将 VITE_ 开头的环境变量注入到 import.meta.env
  const baseUrl = import.meta.env.VITE_PROMETHEUS_BASE_URL || 'http://localhost:9090';
  
  return {
    baseUrl
  };
};

export const prometheusConfig = getPrometheusConfig();
