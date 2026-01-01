<template>
  <div class="h-screen flex">
    <!-- Sidebar -->
    <div class="w-80 flex-shrink-0 flex flex-col bg-white border-r border-gray-200">
      <!-- User Info -->
      <div class="p-4 border-b border-gray-200 bg-gray-50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold relative">
            {{ authStore.username?.charAt(0).toUpperCase() }}
            <!-- Connection status indicator -->
            <span 
              :class="[
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                chatStore.isConnected ? 'bg-green-500' : 'bg-yellow-500'
              ]"
              :title="chatStore.isConnected ? 'Connected to Nostr' : 'Connecting...'"
            ></span>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-gray-900 truncate">{{ authStore.username }}</h3>
            <p class="text-xs text-gray-500 font-mono truncate">{{ shortenKey(authStore.publicKey) }}</p>
          </div>
          <button 
            @click="$router.push('/drive')"
            class="p-2 hover:bg-gray-200 rounded-full transition"
            title="My Drive"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          </button>
          <button 
            @click="showSettings = true"
            class="p-2 hover:bg-gray-200 rounded-full transition"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Chat List -->
      <ChatList class="flex-1" />
    </div>

    <!-- Chat Window -->
    <div class="flex-1">
      <ChatWindow />
    </div>

    <!-- Chat Details Sidebar -->
    <ChatDetails />

    <!-- Settings Modal -->
    <div 
      v-if="showSettings"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showSettings = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-semibold mb-6 text-gray-900">Settings</h3>
        
        <div class="space-y-6">
       
          <!-- Your Identity -->
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Your Username</label>
            <p class="text-lg font-semibold text-gray-900">{{ authStore.username }}</p>
          </div>
          
          <!-- Public Key -->
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Your Public Key</label>
            <div class="flex gap-2">
              <input 
                type="text" 
                :value="authStore.publicKey" 
                readonly
                class="flex-1 px-3 py-2 bg-gray-100 rounded-lg font-mono text-xs"
              />
              <button 
                @click="copyKey(authStore.publicKey)"
                class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                title="Copy"
              >
                📋
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">Share this with others so they can message you</p>
          </div>
          
          <!-- Private Key Backup -->
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">Backup Private Key</label>
            <button 
              @click="showPrivateKey = !showPrivateKey"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left"
            >
              {{ showPrivateKey ? 'Hide Private Key' : 'Show Private Key' }}
            </button>
            <div v-if="showPrivateKey" class="mt-2">
              <div class="flex gap-2">
                <input 
                  type="text" 
                  :value="authStore.privateKey" 
                  readonly
                  class="flex-1 px-3 py-2 bg-red-50 border border-red-200 rounded-lg font-mono text-xs"
                />
                <button 
                  @click="copyKey(authStore.privateKey)"
                  class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  📋
                </button>
              </div>
              <p class="text-xs text-red-600 mt-1">⚠️ Never share this! Anyone with this key can access your account.</p>
            </div>
          </div>
          
          <!-- FileDrop Settings -->
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-2">FileDrop Server</label>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-700 truncate flex-1">{{ currentFiledropServer }}</span>
              <button 
                @click="showSettings = false; showFiledropSettings = true"
                class="px-3 py-1 text-sm text-blue-500 hover:text-blue-700 transition"
              >
                Configure
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">Server used for encrypted file sharing</p>
          </div>
          
          <!-- Logout -->
          <div class="pt-4 border-t border-gray-200">
            <button 
              @click="handleLogout"
              class="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
            <p class="text-xs text-gray-500 mt-2 text-center">Make sure you've backed up your private key before logging out!</p>
          </div>
        </div>
        
        <button 
          @click="showSettings = false"
          class="mt-6 w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          Close
        </button>
      </div>
    </div>

    <!-- FileDrop Settings Modal -->
    <SettingsModal v-if="showFiledropSettings" @close="showFiledropSettings = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { getFiledropServer } from '../services/filedrop'
import ChatList from '../components/ChatList.vue'
import ChatWindow from '../components/ChatWindow.vue'
import ChatDetails from '../components/ChatDetails.vue'
import SettingsModal from '../components/SettingsModal.vue'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

const showSettings = ref(false)
const showPrivateKey = ref(false)
const showFiledropSettings = ref(false)

const currentFiledropServer = computed(() => getFiledropServer())

const shortenKey = (key) => {
  if (!key) return ''
  return key.slice(0, 6) + '...' + key.slice(-6)
}

const copyKey = async (key) => {
  await navigator.clipboard.writeText(key)
  alert('Copied to clipboard!')
}

const handleLogout = async () => {
  if (confirm('Are you sure you want to logout? Make sure you have backed up your private key!')) {
    chatStore.disconnectNostr()
    await authStore.logout()
    router.push('/')
  }
}
</script>
