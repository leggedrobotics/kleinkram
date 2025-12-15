<template>
  <div v-if="loading">Loading API modules...</div>
  <div v-else-if="error">{{ error }}</div>
  <table v-else>
    <thead>
      <tr>
        <th>Module</th>
        <th>Path</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="mod in modules" :key="mod.name">
        <td><a :href="mod.link">{{ mod.name }}</a></td>
        <td><code>{{ mod.path }}</code></td>
        <td>{{ mod.description }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { withBase } from 'vitepress'

const modules = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    // Use fetch to avoid build-time resolution errors if the file is missing
    const response = await fetch(withBase('/development/api/generated/api-modules.json'))
    if (!response.ok) {
        if (response.status === 404) {
            // File might not be generated yet, or not served
            console.warn('api-modules.json not found.')
            return
        }
        throw new Error(`HTTP error! status: ${String(response.status)}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await response.json()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    modules.value = data
  } catch (error_) {
    console.error('Failed to load api-modules.json', error_)
    error.value = 'Failed to load API modules. Make sure the backend container has started.'
  } finally {
    loading.value = false
  }
})
</script>
