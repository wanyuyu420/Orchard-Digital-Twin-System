import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  const currentModule = ref('dashboard')
  const isUiHidden = ref(false) // Pure mode

  // View Mode: Workstation (Clear) vs Focus (Blurred)
  const viewMode = computed(() => {
    if (['dashboard', 'simulation', 'meteo'].includes(currentModule.value)) {
      return 'workstation'
    }
    return 'focus'
  })

  function setModule(moduleName: string) {
    currentModule.value = moduleName
  }

  function toggleUi() {
    isUiHidden.value = !isUiHidden.value
  }

  return { currentModule, isUiHidden, viewMode, setModule, toggleUi }
})
