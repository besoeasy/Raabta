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
        
        <!-- Call Buttons -->
        <button 
          @click="startCall('audio')"
          class="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
          title="Audio Call"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
        </button>
        <button 
          @click="startCall('video')"
          class="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
          title="Video Call"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        </button>
        
        <button 
          @click="chatStore.sidebarVisible = !chatStore.sidebarVisible"
          :class="[
            'p-2 rounded-full transition',
            chatStore.sidebarVisible ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
          ]"
          :title="chatStore.sidebarVisible ? 'Hide Details' : 'Show Details'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
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
      <div 
        ref="messagesContainer" 
        class="flex-1 overflow-y-auto p-4 space-y-3 relative"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <!-- Drop Zone Overlay -->
        <Transition name="fade">
          <div 
            v-if="isDragging"
            class="absolute inset-0 bg-blue-500/10 backdrop-blur-sm border-4 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10"
          >
            <div class="text-center">
              <div class="text-6xl mb-4">📁</div>
              <p class="text-xl font-semibold text-blue-600 mb-2">Drop file here</p>
              <p class="text-sm text-blue-500">Send directly via P2P (no server)</p>
            </div>
          </div>
        </Transition>

        <div 
          v-for="message in chatMessages" 
          :key="message.id"
          :class="[
            'max-w-[75%] rounded-2xl px-4 py-2 relative group',
            message.isSent 
              ? 'ml-auto bg-blue-500 text-white rounded-br-md' 
              : 'mr-auto bg-white text-gray-900 rounded-bl-md shadow-sm'
          ]"
          @contextmenu.prevent="showDeleteMenu(message, $event)"
        >
          <!-- Delete Button (visible on hover) -->
          <button
            v-if="message.messageHash"
            @click="confirmDelete(message)"
            class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600 flex items-center justify-center"
            title="Delete for everyone"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
          <!-- File Attachment -->
          <div v-if="message.file" class="mb-2">
            <!-- P2P Badge -->
            <div v-if="message.file.isP2P" class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              P2P Transfer
            </div>
            
            <!-- Image Preview -->
            <div v-if="isImage(message.file.mimeType)" class="mb-2">
              <img 
                v-if="fileCache[message.id]"
                :src="fileCache[message.id]"
                :alt="message.file.originalName"
                class="max-w-full rounded-lg cursor-pointer"
                @click="openFile(message)"
              />
              <div 
                v-else
                class="w-48 h-32 bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer"
                @click="loadFile(message)"
              >
                <span class="text-gray-500 text-sm">📷 Click to load image</span>
              </div>
            </div>
            
            <!-- Video Preview -->
            <div v-else-if="isVideo(message.file.mimeType)" class="mb-2">
              <video 
                v-if="fileCache[message.id]"
                :src="fileCache[message.id]"
                controls
                class="max-w-full rounded-lg"
              />
              <div 
                v-else
                class="w-48 h-32 bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer"
                @click="loadFile(message)"
              >
                <span class="text-gray-500 text-sm">🎬 Click to load video</span>
              </div>
            </div>
            
            <!-- Audio Preview -->
            <div v-else-if="isAudio(message.file.mimeType)" class="mb-2">
              <audio 
                v-if="fileCache[message.id]"
                :src="fileCache[message.id]"
                controls
                class="w-full"
              />
              <div 
                v-else
                class="w-48 h-12 bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer"
                @click="loadFile(message)"
              >
                <span class="text-gray-500 text-sm">🎵 Click to load audio</span>
              </div>
            </div>
            
            <!-- Other File Types -->
            <div 
              v-else
              @click="downloadFileToDevice(message)"
              class="flex items-center gap-3 p-3 bg-gray-100/50 rounded-lg cursor-pointer hover:bg-gray-100 transition"
              :class="{ 'bg-blue-400/30 hover:bg-blue-400/40': message.isSent }"
            >
              <div class="text-3xl">📄</div>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate" :class="message.isSent ? 'text-white' : 'text-gray-900'">
                  {{ message.file.originalName }}
                </p>
                <p class="text-xs" :class="message.isSent ? 'text-blue-100' : 'text-gray-500'">
                  {{ formatFileSize(message.file.size) }}
                </p>
              </div>
              <div class="text-2xl">⬇️</div>
            </div>
          </div>
          
          <!-- Message Text -->
          <p v-if="!message.file || message.text !== `📎 ${message.file?.originalName}`" class="break-words">
            {{ message.text }}
          </p>
          
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
            <p class="text-sm">Messages & files are encrypted with your shared secret</p>
          </div>
        </div>
      </div>

      <!-- Upload Progress -->
      <div v-if="isUploading" class="bg-blue-50 border-t border-blue-200 px-4 py-2">
        <div class="flex items-center gap-3">
          <div class="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span class="text-sm text-blue-700">Encrypting & uploading file...</span>
        </div>
      </div>

      <!-- P2P Transfer Progress -->
      <div v-if="p2pTransferProgress !== null" class="bg-green-50 border-t border-green-200 px-4 py-3">
        <div class="space-y-2">
          <div class="flex items-center gap-3">
            <div class="animate-pulse h-4 w-4 bg-green-500 rounded-full"></div>
            <span class="text-sm text-green-700 font-medium">Sending via P2P: {{ p2pFileName }}</span>
          </div>
          <div class="w-full bg-green-200 rounded-full h-2 overflow-hidden">
            <div 
              class="bg-green-500 h-full transition-all duration-300"
              :style="{ width: p2pTransferProgress + '%' }"
            ></div>
          </div>
          <p class="text-xs text-green-600">{{ p2pTransferProgress.toFixed(0) }}% complete</p>
        </div>
      </div>

      <!-- Input Area -->
      <div class="bg-white border-t border-gray-200 p-4">
        <form @submit.prevent="sendMessage" class="flex gap-2 items-end">
          <!-- File Attachment Button (Server) -->
          <button 
            type="button"
            @click="$refs.fileInput.click()"
            class="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
            title="Attach file (via server)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input 
            ref="fileInput"
            type="file"
            class="hidden"
            @change="handleFileSelect"
          />
          
          <!-- P2P File Button -->
          <button 
            type="button"
            @click="$refs.p2pFileInput.click()"
            class="p-2 hover:bg-green-100 rounded-full transition text-green-600"
            title="Send file P2P (no server)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <input 
            ref="p2pFileInput"
            type="file"
            class="hidden"
            @change="handleP2PFileSelect"
          />
          
          <input 
            v-model="newMessage"
            type="text" 
            placeholder="Type a message..."
            class="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            type="submit"
            :disabled="!newMessage.trim() || isUploading"
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
    
    <!-- Incoming Call Modal -->
    <IncomingCallModal
      :is-visible="!!chatStore.incomingCall"
      :caller-name="incomingCallContact?.username || 'Unknown'"
      :call-type="chatStore.incomingCall?.callType || 'video'"
      @accept="handleAcceptCall"
      @decline="handleDeclineCall"
    />
    
    <!-- Call Window -->
    <CallWindow
      :is-visible="!!chatStore.activeCall"
      :call-type="chatStore.activeCall?.callType || 'video'"
      :call-status="chatStore.callStatus"
      :contact-name="activeCallContact?.username || 'Unknown'"
      :local-stream="chatStore.activeCall?.localStream"
      :remote-stream="chatStore.activeCall?.remoteStream"
      @end-call="handleEndCall"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, reactive } from 'vue'
import { useChatStore } from '../stores/chat'
import { isImageFile, isVideoFile, isAudioFile, formatFileSize } from '../services/filedrop'
import CallWindow from './CallWindow.vue'
import IncomingCallModal from './IncomingCallModal.vue'

const chatStore = useChatStore()

const newMessage = ref('')
const showInfo = ref(false)
const messagesContainer = ref(null)
const fileInput = ref(null)
const p2pFileInput = ref(null)
const isUploading = ref(false)
const fileCache = reactive({}) // Cache decrypted file URLs
const isDragging = ref(false)
const p2pTransferProgress = ref(null)
const p2pFileName = ref('')

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

const isImage = (mimeType) => isImageFile(mimeType)
const isVideo = (mimeType) => isVideoFile(mimeType)
const isAudio = (mimeType) => isAudioFile(mimeType)

const sendMessage = async () => {
  if (!newMessage.value.trim() || !chatStore.activeChat) return
  
  await chatStore.sendMessage(chatStore.activeChat, newMessage.value.trim())
  newMessage.value = ''
}

// Handle file selection
const handleFileSelect = async (event) => {
  const file = event.target.files?.[0]
  if (!file || !chatStore.activeChat) return
  
  // Reset input
  event.target.value = ''
  
  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    alert('File too large. Maximum size is 50MB.')
    return
  }
  
  isUploading.value = true
  
  try {
    // Send file with optional caption
    const caption = newMessage.value.trim()
    await chatStore.sendFile(chatStore.activeChat, file, caption)
    newMessage.value = ''
  } catch (error) {
    console.error('Failed to send file:', error)
    alert('Failed to send file: ' + error.message)
  } finally {
    isUploading.value = false
  }
}

// Load and decrypt file for preview
const loadFile = async (message) => {
  if (fileCache[message.id]) return
  
  try {
    // Get from database or download
    const blob = await chatStore.downloadFile(message)
    if (blob) {
      fileCache[message.id] = URL.createObjectURL(blob)
    }
  } catch (error) {
    console.error('Failed to load file:', error)
    alert('Failed to decrypt file: ' + error.message)
  }
}

// Open file in new tab
const openFile = async (message) => {
  if (!fileCache[message.id]) {
    await loadFile(message)
  }
  if (fileCache[message.id]) {
    window.open(fileCache[message.id], '_blank')
  }
}

// Download file to device
const downloadFileToDevice = async (message) => {
  try {
    const blob = await chatStore.downloadFile(message)
    
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = message.file.originalName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error('Failed to download file:', error)
    alert('Failed to download file: ' + error.message)
  }
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

// Delete message
const confirmDelete = async (message) => {
  if (!message.messageHash) {
    alert('Cannot delete this message (no hash)')
    return
  }
  
  if (confirm('Delete this message for everyone?')) {
    try {
      const success = await chatStore.deleteMessage(message.messageHash, chatStore.activeChat)
      if (!success) {
        alert('Failed to delete message')
      }
    } catch (error) {
      console.error('Failed to delete message:', error)
      alert('Failed to delete message: ' + error.message)
    }
  }
}

const showDeleteMenu = (message, event) => {
  // Same as click delete for now
  confirmDelete(message)
}

// Drag and drop handlers
const onDragOver = (e) => {
  isDragging.value = true
}

const onDragLeave = (e) => {
  // Only hide if leaving the container, not child elements
  if (e.target === messagesContainer.value) {
    isDragging.value = false
  }
}

const onDrop = async (e) => {
  isDragging.value = false
  const file = e.dataTransfer.files[0]
  if (file && chatStore.activeChat) {
    await sendFileP2P(file)
  }
}

// P2P file transfer
const handleP2PFileSelect = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  
  event.target.value = ''
  await sendFileP2P(file)
}

const sendFileP2P = async (file) => {
  if (!chatStore.activeChat) return
  
  p2pTransferProgress.value = 0
  p2pFileName.value = file.name
  
  try {
    await chatStore.sendFileP2P(chatStore.activeChat, file, (progress) => {
      p2pTransferProgress.value = progress
    })
    
    // Keep progress visible briefly
    setTimeout(() => {
      p2pTransferProgress.value = null
      p2pFileName.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to send file P2P:', error)
    alert('Failed to send file: ' + error.message)
    p2pTransferProgress.value = null
    p2pFileName.value = ''
  }
}

// Call handling
const startCall = async (callType) => {
  if (!chatStore.activeChat) return
  
  try {
    await chatStore.makeCall(chatStore.activeChat, callType)
  } catch (error) {
    console.error('Failed to start call:', error)
    alert('Failed to start call: ' + error.message)
  }
}

const handleAcceptCall = async () => {
  try {
    await chatStore.answerCall()
  } catch (error) {
    console.error('Failed to answer call:', error)
    alert('Failed to answer call: ' + error.message)
  }
}

const handleDeclineCall = () => {
  chatStore.declineCall()
}

const handleEndCall = () => {
  chatStore.endCall()
}

// Computed for call UI
const incomingCallContact = computed(() => {
  if (!chatStore.incomingCall) return null
  return chatStore.contacts.find(c => c.publicKey === chatStore.incomingCall.from)
})

const activeCallContact = computed(() => {
  if (!chatStore.activeCall) return null
  return chatStore.contacts.find(c => c.publicKey === chatStore.activeCall.pubKey)
})

</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
