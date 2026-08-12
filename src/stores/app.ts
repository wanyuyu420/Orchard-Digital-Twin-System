import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  const currentModule = ref('orchard-dashboard')
  const isUiHidden = ref(false)

  const viewMode = computed(() => {
    if (
      ['orchard-dashboard', 'canopy-analysis', 'agri-decision', 'gis-test', 'tileset-test'].includes(
        currentModule.value,
      )
    ) {
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
