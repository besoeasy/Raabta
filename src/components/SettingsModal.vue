<template>
  <div class="settings-modal fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-white rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl max-h-[80vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Settings</h2>
        <button @click="$emit('close')" class="p-2 hover:bg-gray-100 rounded-full transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- FileDrop Server Settings -->
      <div class="space-y-6">
        <div>
          <h3 class="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span>📁</span> FileDrop Server
          </h3>
          <p class="text-xs text-gray-500 mb-3">
            Files are encrypted before upload. Only the recipient can decrypt them.
          </p>
          
          <!-- Current Server -->
          <div class="mb-4">
            <label class="block text-sm text-gray-600 mb-1">Current Server</label>
            <div class="flex gap-2">
              <select 
                v-model="currentServer"
                @change="updateServer"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="server in savedServers" :key="server" :value="server">
                  {{ server }}
                </option>
              </select>
            </div>
          </div>
          
          <!-- Add New Server -->
          <div class="mb-4">
            <label class="block text-sm text-gray-600 mb-1">Add Custom Server</label>
            <div class="flex gap-2">
              <input 
                v-model="newServer"
                type="url"
                placeholder="https://your-filedrop-server.com"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                @keyup.enter="addServer"
              />
              <button 
                @click="addServer"
                :disabled="!isValidUrl(newServer)"
                class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
          
          <!-- Saved Servers List -->
          <div class="border border-gray-200 rounded-lg divide-y divide-gray-200">
            <div 
              v-for="server in savedServers" 
              :key="server"
              class="flex items-center justify-between p-3 hover:bg-gray-50"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span v-if="server === currentServer" class="text-green-500">✓</span>
                <span v-else class="text-gray-300">○</span>
                <span class="text-sm truncate" :class="{ 'font-medium': server === currentServer }">
                  {{ server }}
                </span>
                <span v-if="server === DEFAULT_SERVER" class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  default
                </span>
              </div>
              <button 
                v-if="server !== DEFAULT_SERVER"
                @click="removeServer(server)"
                class="text-red-500 hover:text-red-700 p-1"
                title="Remove server"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Info Section -->
        <div class="bg-blue-50 rounded-lg p-4">
          <h4 class="text-sm font-medium text-blue-900 mb-2">🔒 How it works</h4>
          <ul class="text-xs text-blue-800 space-y-1">
            <li>• Files are encrypted with AES-256-GCM before upload</li>
            <li>• Encryption key is derived from your shared secret</li>
            <li>• Only the recipient with matching keys can decrypt</li>
            <li>• Server only stores encrypted data</li>
          </ul>
        </div>

        <!-- API Info -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-2">🛠️ Self-host your server</h4>
          <p class="text-xs text-gray-600 mb-2">
            Your filedrop server should accept POST requests:
          </p>
          <code class="text-xs bg-gray-200 px-2 py-1 rounded block overflow-x-auto">
            curl -X POST -F "file=@yourfile.pdf" https://your-server.com/upload
          </code>
          <p class="text-xs text-gray-500 mt-2">
            Response should be the download URL (text or JSON with url/link field)
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { 
  getFiledropServer, 
  setFiledropServer, 
  getSavedServers, 
  addSavedServer, 
  removeSavedServer 
} from '../services/filedrop'

const emit = defineEmits(['close'])

const DEFAULT_SERVER = 'https://filedrop.besoeasy.com'

const currentServer = ref('')
const savedServers = ref([])
const newServer = ref('')

onMounted(() => {
  currentServer.value = getFiledropServer()
  savedServers.value = getSavedServers()
})

const updateServer = () => {
  setFiledropServer(currentServer.value)
}

const isValidUrl = (url) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

const addServer = () => {
  if (!isValidUrl(newServer.value)) return
  
  const url = newServer.value.trim().replace(/\/$/, '')
  addSavedServer(url)
  savedServers.value = getSavedServers()
  currentServer.value = url
  setFiledropServer(url)
  newServer.value = ''
}

const removeServer = (server) => {
  if (server === DEFAULT_SERVER) return
  
  removeSavedServer(server)
  savedServers.value = getSavedServers()
  
  // If removed server was current, switch to default
  if (currentServer.value === server) {
    currentServer.value = DEFAULT_SERVER
    setFiledropServer(DEFAULT_SERVER)
  }
}
</script>
