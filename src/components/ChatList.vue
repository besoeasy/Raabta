<template>
  <div class="chat-list h-full bg-white border-r border-gray-200 flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xl font-semibold text-gray-800">Chats</h2>
        <button 
          @click="showAddContact = true"
          class="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition"
          title="Add Contact"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      
      <!-- Search -->
      <input 
        v-model="searchQuery"
        type="text" 
        placeholder="Search chats..."
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <!-- Chat List -->
    <div class="flex-1 overflow-y-auto">
      <div 
        v-for="contact in filteredContacts" 
        :key="contact.publicKey"
        @click="selectChat(contact.publicKey)"
        :class="[
          'p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition',
          activeChat === contact.publicKey ? 'bg-blue-50' : ''
        ]"
      >
        <div class="flex items-start gap-3">
          <!-- Avatar -->
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {{ contact.username.charAt(0).toUpperCase() }}
          </div>
          
          <!-- Chat Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <h3 class="font-semibold text-gray-900 truncate">{{ contact.username }}</h3>
              <span v-if="lastMessage(contact.publicKey)" class="text-xs text-gray-500">
                {{ formatTime(lastMessage(contact.publicKey).timestamp) }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <p class="text-sm text-gray-600 truncate">
                {{ lastMessagePreview(contact.publicKey) }}
              </p>
              <span 
                v-if="unreadCount(contact.publicKey) > 0"
                class="ml-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0"
              >
                {{ unreadCount(contact.publicKey) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="chatStore.contacts.length === 0" class="p-8 text-center text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p class="text-lg mb-2">No chats yet</p>
        <p class="text-sm">Add a contact to start chatting</p>
      </div>
    </div>

    <!-- Add Contact Modal -->
    <div 
      v-if="showAddContact"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showAddContact = false"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 class="text-lg font-semibold mb-4 text-gray-800">Add Contact</h3>
        <input 
          v-model="newContactKey"
          type="text" 
          placeholder="Paste public key..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 font-mono text-sm"
        />
        <div class="flex gap-2 justify-end">
          <button 
            @click="showAddContact = false"
            class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button 
            @click="addNewContact"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chat'

const chatStore = useChatStore()

const searchQuery = ref('')
const showAddContact = ref(false)
const newContactKey = ref('')

const activeChat = computed(() => chatStore.activeChat)

const filteredContacts = computed(() => {
  if (!searchQuery.value) {
    return chatStore.sortedContacts
  }
  return chatStore.sortedContacts.filter(contact => 
    contact.username.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const lastMessage = (publicKey) => {
  return chatStore.getLastMessage(publicKey)
}

const lastMessagePreview = (publicKey) => {
  const msg = lastMessage(publicKey)
  if (!msg) return 'No messages yet'
  const prefix = msg.isSent ? 'You: ' : ''
  return prefix + (msg.text.length > 30 ? msg.text.substring(0, 30) + '...' : msg.text)
}

const unreadCount = (publicKey) => {
  return chatStore.getUnreadCount(publicKey)
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 86400000) { // Less than 24 hours
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } else if (diff < 604800000) { // Less than 7 days
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

const selectChat = (publicKey) => {
  chatStore.setActiveChat(publicKey)
}

const addNewContact = async () => {
  if (newContactKey.value.trim()) {
    const success = await chatStore.addContact(newContactKey.value.trim())
    if (success) {
      newContactKey.value = ''
      showAddContact.value = false
    } else {
      alert('Invalid public key or contact already exists')
    }
  }
}
</script>
