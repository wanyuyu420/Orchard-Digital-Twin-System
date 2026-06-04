import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import createExternal from 'vite-plugin-external'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      createExternal({
        externals: {
          cesium: 'Cesium'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/assets/styles/_variables.scss" as *; @use "@/assets/styles/_mixins.scss" as *;`
        }
      }
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true
        },
        '/tiles/': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true
        },
        '/terrain/': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true
        },
        '/simulation/': {
          target: 'http://127.0.0.1:8081',
          changeOrigin: true
        },
        // GeoServer 静态底图代理
        '/geoserver': {
          target: env.VITE_GEOSERVER_URL || 'http://127.0.0.1:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/geoserver/, '/geoserver')
        }
      }
    }
  }
})
