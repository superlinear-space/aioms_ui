import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  },
  server: {
    fs: {
      // 关闭 Vite 的文件系统访问限制，允许读取任意外部文件
      strict: false
    }
  }
})

