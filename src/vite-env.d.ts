/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROMETHEUS_BASE_URL: string;
  // 未来可以添加更多环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
