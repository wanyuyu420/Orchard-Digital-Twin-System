import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import createExternal from 'vite-plugin-external'

// https://vitejs.dev/config/
export default defineConfig({
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
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
		}
  }
})
