<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 md:p-8">
      <!-- Logo -->
      <div class="text-center mb-6 md:mb-8">
        <div class="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 md:h-10 md:w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold text-gray-900">Raabta</h1>
        <p class="text-sm md:text-base text-gray-600 mt-2">Private, encrypted messaging</p>
      </div>

      <!-- Tabs -->
      <div class="flex mb-4 md:mb-6 bg-gray-100 rounded-lg p-1">
        <button 
          @click="activeTab = 'new'"
          :class="[
            'flex-1 py-2 rounded-md transition font-medium text-sm md:text-base',
            activeTab === 'new' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
          ]"
        >
          New Identity
        </button>
        <button 
          @click="activeTab = 'import'"
          :class="[
            'flex-1 py-2 rounded-md transition font-medium text-sm md:text-base',
            activeTab === 'import' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
          ]"
        >
          Import Key
        </button>
      </div>

      <!-- New Identity Tab -->
      <div v-if="activeTab === 'new'">
        <p class="text-gray-600 text-sm mb-6">
          Generate a new cryptographic identity. Your private key is stored locally and never leaves your device.
        </p>
        <button 
          @click="createNewIdentity"
          :disabled="isLoading"
          class="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {{ isLoading ? 'Generating...' : 'Generate Identity' }}
        </button>
      </div>

      <!-- Import Key Tab -->
      <div v-if="activeTab === 'import'">
        <p class="text-gray-600 text-sm mb-4">
          Import your existing private key to restore your identity.
        </p>
        <textarea 
          v-model="importKey"
          placeholder="Paste your private key here..."
          rows="3"
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm mb-4"
        ></textarea>
        <button 
          @click="importExistingKey"
          :disabled="!importKey.trim() || isLoading"
          class="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {{ isLoading ? 'Importing...' : 'Import Key' }}
        </button>
      </div>

      <!-- Security Notice -->
      <div class="mt-8 p-4 bg-yellow-50 rounded-lg">
        <div class="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div>
            <h4 class="font-semibold text-yellow-800 text-sm">Important</h4>
            <p class="text-yellow-700 text-xs mt-1">
              Your private key is your identity. If you lose it, you cannot recover your account. Back it up securely!
            </p>
          </div>
        </div>
      </div>

      <!-- Powered By -->
      <p class="text-center text-gray-400 text-xs mt-6">
        Powered by <span class="font-semibold">daku</span> cryptography
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'

const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()

const activeTab = ref('new')
const importKey = ref('')
const isLoading = ref(false)

const createNewIdentity = async () => {
  isLoading.value = true
  try {
    await authStore.generateNewIdentity()
    await chatStore.init()
    router.push('/chat')
  } catch (error) {
    console.error('Failed to generate identity:', error)
    alert('Failed to generate identity. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const importExistingKey = async () => {
  if (!importKey.value.trim()) return
  
  isLoading.value = true
  try {
    const success = await authStore.importIdentity(importKey.value.trim())
    if (success) {
      await chatStore.init()
      router.push('/chat')
    } else {
      alert('Invalid private key. Please check and try again.')
    }
  } catch (error) {
    console.error('Failed to import key:', error)
    alert('Failed to import key. Please check and try again.')
  } finally {
    isLoading.value = false
  }
}
</script>
