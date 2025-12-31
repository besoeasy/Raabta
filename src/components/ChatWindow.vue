<template>
  <div class="chat-window h-full flex flex-col bg-gray-50">
    <!-- No Chat Selected -->
    <div v-if="!activeContact" class="flex-1 flex items-center justify-center">
      <div class="text-center text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p class="text-xl mb-2">Select a chat</p>
        <p class="text-sm">Choose a conversation from the sidebar</p>
      </div>
    </div>

    <!-- Chat Content -->
    <template v-else>
      <!-- Chat Header -->
      <div class="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
          {{ activeContact.username.charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1">
          <h3 class="font-semibold text-gray-900">{{ activeContact.username }}</h3>
          <p class="text-xs text-gray-500 truncate font-mono">{{ shortenKey(activeContact.publicKey) }}</p>
        </div>
        <button 
          @click="showInfo = true"
          class="p-2 hover:bg-gray-100 rounded-full transition"
          title="Contact Info"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <!-- Messages Area -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div 
          v-for="message in chatMessages" 
          :key="message.id"
          :class="[
            'max-w-[75%] rounded-2xl px-4 py-2',
            message.isSent 
              ? 'ml-auto bg-blue-500 text-white rounded-br-md' 
              : 'mr-auto bg-white text-gray-900 rounded-bl-md shadow-sm'
          ]"
        >
          <p class="break-words">{{ message.text }}</p>
          <p :class="[
            'text-xs mt-1',
            message.isSent ? 'text-blue-100' : 'text-gray-500'
          ]">
            {{ formatTime(message.timestamp) }}
            <span v-if="message.isSent" class="ml-1">
              {{ message.isRead ? '✓✓' : '✓' }}
            </span>
          </p>
        </div>

        <!-- Empty Messages -->
        <div v-if="chatMessages.length === 0" class="h-full flex items-center justify-center">
          <div class="text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p class="mb-2">End-to-end encrypted</p>
            <p class="text-sm">Messages are encrypted with your shared secret</p>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="bg-white border-t border-gray-200 p-4">
        <form @submit.prevent="sendMessage" class="flex gap-3">
          <input 
            v-model="newMessage"
            type="text" 
            placeholder="Type a message..."
            class="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            type="submit"
            :disabled="!newMessage.trim()"
            class="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>
    </template>

    <!-- Contact Info Modal -->
    <div 
      v-if="showInfo && activeContact"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showInfo = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <div class="text-center mb-6">
          <div class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl font-semibold mx-auto mb-3">
            {{ activeContact.username.charAt(0).toUpperCase() }}
          </div>
          <h3 class="text-xl font-semibold text-gray-900">{{ activeContact.username }}</h3>
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Public Key</label>
            <div class="flex gap-2">
              <input 
                type="text" 
                :value="activeContact.publicKey" 
                readonly
                class="flex-1 px-3 py-2 bg-gray-100 rounded-lg font-mono text-xs"
              />
              <button 
                @click="copyKey(activeContact.publicKey)"
                class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                title="Copy"
              >
                📋
              </button>
            </div>
          </div>
          
          <div class="flex gap-2 pt-4">
            <button 
              @click="showInfo = false"
              class="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Close
            </button>
            <button 
              @click="deleteContact"
              class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Delete Contact
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useChatStore } from '../stores/chat'

const chatStore = useChatStore()

const newMessage = ref('')
const showInfo = ref(false)
const messagesContainer = ref(null)

const activeContact = computed(() => {
  if (!chatStore.activeChat) return null
  return chatStore.contacts.find(c => c.publicKey === chatStore.activeChat)
})

const chatMessages = computed(() => {
  if (!chatStore.activeChat) return []
  return chatStore.getMessages(chatStore.activeChat)
})

// Auto-scroll to bottom when new messages arrive
watch(chatMessages, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}, { deep: true })

const shortenKey = (key) => {
  if (!key) return ''
  return key.slice(0, 8) + '...' + key.slice(-8)
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !chatStore.activeChat) return
  
  await chatStore.sendMessage(chatStore.activeChat, newMessage.value.trim())
  newMessage.value = ''
}

const copyKey = async (key) => {
  await navigator.clipboard.writeText(key)
  alert('Public key copied to clipboard!')
}

const deleteContact = async () => {
  if (confirm('Are you sure you want to delete this contact and all messages?')) {
    await chatStore.removeContact(chatStore.activeChat)
    showInfo.value = false
  }
}
</script>
