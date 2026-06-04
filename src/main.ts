import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Global Styles
import './assets/styles/main.scss'

// Cesium is loaded globally via index.html from /Cesium-1.82-epawse/
// Widget styles are also loaded in index.html

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
