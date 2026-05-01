import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from root directory
  const rootEnv = {
    ...loadEnv(mode, path.resolve(__dirname, '..'), ''),
    ...process.env
  }
  
  return {
    plugins: [
      react(),
      tailwindcss()
    ],
    envDir: '../', // Look for .env in root
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: rootEnv.INTERNAL_API_URL || rootEnv.API_ROOT || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('Vite Proxy Error:', err);
            });
            proxy.on('proxyReq', (_, req, _res) => {
              console.log(`[Vite Proxy] Forwarding ${req.method} ${req.url} to Target`);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log(`[Vite Proxy] Received ${proxyRes.statusCode} from ${req.url}`);
            });
          },
        }
      }
    },
    define: {
      // Inject root env variables without prefix requirement
      'process.env': {
        API_PORT: rootEnv.API_PORT,
        API_ROOT: rootEnv.API_ROOT
      }
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      }
    }
  }
})
