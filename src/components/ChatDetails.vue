<template>
  <Transition name="slide">
    <div 
      v-if="chatStore.sidebarVisible"
      @mousemove="resetTimer"
      @click="resetTimer"
      :class="[
        'flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden',
        'fixed md:relative inset-0 md:inset-auto z-50 md:z-auto',
        'w-full md:w-96'
      ]"
    >
      <!-- No Chat Selected -->
      <div v-if="!activeContact" class="flex-1 flex items-center justify-center p-6">
      <div class="text-center text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm">Select a chat to view details</p>
      </div>
    </div>

    <!-- Chat Details Content -->
    <template v-else>
      <!-- Header -->
      <div class="p-4 md:p-6 border-b border-gray-200">
        <!-- Close button for mobile -->
        <button 
          @click="chatStore.sidebarVisible = false"
          class="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition md:hidden z-10"
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>

        <div class="text-center">
          <div class="w-16 md:w-20 h-16 md:h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl md:text-3xl font-semibold mx-auto mb-3">
            {{ activeContact.username.charAt(0).toUpperCase() }}
          </div>
          <h3 class="text-lg md:text-xl font-semibold text-gray-900 mb-1">{{ activeContact.username }}</h3>
          <p class="text-xs text-gray-500 font-mono">{{ shortenKey(activeContact.publicKey) }}</p>
          
          <!-- Action Buttons -->
          <div class="flex gap-2 mt-4">
            <button 
              @click="copyKey(activeContact.publicKey)"
              class="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm"
              title="Copy Public Key"
            >
              📋 Copy Key
            </button>
            <button 
              @click="deleteContact"
              class="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition text-sm"
              title="Delete Contact"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-200 bg-gray-50">
        <button 
          @click="activeTab = 'media'"
          :class="[
            'flex-1 px-4 py-3 text-sm font-medium transition',
            activeTab === 'media' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
              : 'text-gray-600 hover:text-gray-900'
          ]"
        >
          📎 Media
        </button>
        <button 
          @click="activeTab = 'info'"
          :class="[
            'flex-1 px-4 py-3 text-sm font-medium transition',
            activeTab === 'info' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
              : 'text-gray-600 hover:text-gray-900'
          ]"
        >
          ℹ️ Info
        </button>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto">
        <!-- Media Tab -->
        <div v-if="activeTab === 'media'" class="p-4 space-y-4">
          <!-- Search -->
          <div class="relative">
            <input 
              v-model="searchQuery"
              type="text"
              placeholder="Search files..."
              class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <!-- File Type Filter -->
          <div class="flex gap-2 flex-wrap">
            <button
              @click="filterType = 'all'"
              :class="[
                'px-3 py-1 rounded-full text-xs font-medium transition',
                filterType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              All ({{ allFiles.length }})
            </button>
            <button
              @click="filterType = 'images'"
              :class="[
                'px-3 py-1 rounded-full text-xs font-medium transition',
                filterType === 'images' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              🖼️ Images ({{ imageFiles.length }})
            </button>
            <button
              @click="filterType = 'videos'"
              :class="[
                'px-3 py-1 rounded-full text-xs font-medium transition',
                filterType === 'videos' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              🎬 Videos ({{ videoFiles.length }})
            </button>
            <button
              @click="filterType = 'audio'"
              :class="[
                'px-3 py-1 rounded-full text-xs font-medium transition',
                filterType === 'audio' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              🎵 Audio ({{ audioFiles.length }})
            </button>
            <button
              @click="filterType = 'documents'"
              :class="[
                'px-3 py-1 rounded-full text-xs font-medium transition',
                filterType === 'documents' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              📄 Docs ({{ documentFiles.length }})
            </button>
          </div>

          <!-- Files Grid/List -->
          <div v-if="filteredFiles.length > 0" class="space-y-2">
            <!-- Images Grid -->
            <div v-if="filterType === 'all' || filterType === 'images'" class="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div 
                v-for="file in (filterType === 'all' ? imageFiles : filteredFiles).slice(0, filterType === 'all' ? 9 : undefined)"
                :key="file.id"
                @click="openFile(file)"
                class="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition"
              >
                <img 
                  v-if="fileCache[file.id]"
                  :src="fileCache[file.id]"
                  :alt="file.file.originalName"
                  class="w-full h-full object-cover"
                />
                <div v-else @click.stop="loadFile(file)" class="w-full h-full flex items-center justify-center text-2xl">
                  📷
                </div>
              </div>
            </div>

            <!-- Show all button for images in 'all' view -->
            <button 
              v-if="filterType === 'all' && imageFiles.length > 9"
              @click="filterType = 'images'"
              class="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all {{ imageFiles.length }} images →
            </button>

            <!-- Videos, Audio, Documents (List View) -->
            <div v-if="filterType !== 'images'" class="space-y-2">
              <div 
                v-for="file in (filterType === 'all' ? [...videoFiles, ...audioFiles, ...documentFiles].slice(0, 5) : filteredFiles)"
                :key="file.id"
                @click="downloadFileToDevice(file)"
                class="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition"
              >
                <div class="text-2xl">
                  {{ getFileIcon(file.file.mimeType) }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-sm truncate text-gray-900">{{ file.file.originalName }}</p>
                  <p class="text-xs text-gray-500">
                    {{ formatFileSize(file.file.size) }} • {{ formatDate(file.timestamp) }}
                  </p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <!-- Show all button -->
              <button 
                v-if="filterType === 'all' && (videoFiles.length + audioFiles.length + documentFiles.length) > 5"
                @click="filterType = 'documents'"
                class="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all {{ videoFiles.length + audioFiles.length + documentFiles.length }} files →
              </button>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p class="text-sm">No {{ filterType === 'all' ? 'files' : filterType }} found</p>
          </div>
        </div>

        <!-- Info Tab -->
        <div v-if="activeTab === 'info'" class="p-3 md:p-4 space-y-4 md:space-y-6">
          <!-- Statistics -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Statistics</h4>
            <div class="grid grid-cols-2 gap-2 md:gap-3">
              <div class="bg-blue-50 rounded-lg p-2 md:p-3">
                <p class="text-2xl font-bold text-blue-600">{{ messageCount }}</p>
                <p class="text-xs text-blue-800">Messages</p>
              </div>
              <div class="bg-purple-50 rounded-lg p-3">
                <p class="text-2xl font-bold text-purple-600">{{ allFiles.length }}</p>
                <p class="text-xs text-purple-800">Files Shared</p>
              </div>
            </div>
          </div>

          <!-- Contact Info -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Contact Info</h4>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-gray-500">Username</label>
                <p class="text-sm font-medium text-gray-900">{{ activeContact.username }}</p>
              </div>
              <div>
                <label class="text-xs text-gray-500">Public Key</label>
                <div class="flex items-center gap-2 mt-1">
                  <input 
                    type="text" 
                    :value="activeContact.publicKey" 
                    readonly
                    class="flex-1 px-2 py-1 bg-gray-100 rounded text-xs font-mono"
                  />
                  <button 
                    @click="copyKey(activeContact.publicKey)"
                    class="p-1 hover:bg-gray-100 rounded"
                  >
                    📋
                  </button>
                </div>
              </div>
              <div>
                <label class="text-xs text-gray-500">Added On</label>
                <p class="text-sm text-gray-900">{{ formatDate(activeContact.addedAt) }}</p>
              </div>
            </div>
          </div>

          <!-- Encryption Info -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Security</h4>
            <div class="bg-green-50 border border-green-200 rounded-lg p-3">
              <div class="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <div>
                  <p class="text-sm font-medium text-green-900">End-to-end encrypted</p>
                  <p class="text-xs text-green-700 mt-1">All messages and files are encrypted using your shared secret</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useChatStore } from '../stores/chat'
import { isImageFile, isVideoFile, isAudioFile, formatFileSize } from '../services/filedrop'

const chatStore = useChatStore()

// Auto-collapse timer
let collapseTimer = null
const AUTO_COLLAPSE_DELAY = 60000 // 1 minute

const resetTimer = () => {
  if (collapseTimer) {
    clearTimeout(collapseTimer)
  }
  collapseTimer = setTimeout(() => {
    chatStore.sidebarVisible = false
  }, AUTO_COLLAPSE_DELAY)
}

// Start timer when sidebar becomes visible
watch(() => chatStore.sidebarVisible, (visible) => {
  if (visible) {
    resetTimer()
  } else {
    if (collapseTimer) {
      clearTimeout(collapseTimer)
    }
  }
})

onMounted(() => {
  if (chatStore.sidebarVisible) {
    resetTimer()
  }
})

onUnmounted(() => {
  if (collapseTimer) {
    clearTimeout(collapseTimer)
  }
})

const activeTab = ref('media')
const searchQuery = ref('')
const filterType = ref('all')
const fileCache = reactive({})

const activeContact = computed(() => {
  if (!chatStore.activeChat) return null
  return chatStore.contacts.find(c => c.publicKey === chatStore.activeChat)
})

const chatMessages = computed(() => {
  if (!chatStore.activeChat) return []
  return chatStore.getMessages(chatStore.activeChat)
})

const messageCount = computed(() => chatMessages.value.length)

// Get all files from messages
const allFiles = computed(() => {
  return chatMessages.value.filter(msg => msg.file)
})

// Categorize files by type
const imageFiles = computed(() => {
  return allFiles.value.filter(msg => isImageFile(msg.file.mimeType))
})

const videoFiles = computed(() => {
  return allFiles.value.filter(msg => isVideoFile(msg.file.mimeType))
})

const audioFiles = computed(() => {
  return allFiles.value.filter(msg => isAudioFile(msg.file.mimeType))
})

const documentFiles = computed(() => {
  return allFiles.value.filter(msg => 
    !isImageFile(msg.file.mimeType) && 
    !isVideoFile(msg.file.mimeType) && 
    !isAudioFile(msg.file.mimeType)
  )
})

// Filter files based on search and type
const filteredFiles = computed(() => {
  let files = allFiles.value

  // Filter by type
  if (filterType.value === 'images') {
    files = imageFiles.value
  } else if (filterType.value === 'videos') {
    files = videoFiles.value
  } else if (filterType.value === 'audio') {
    files = audioFiles.value
  } else if (filterType.value === 'documents') {
    files = documentFiles.value
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    files = files.filter(msg => 
      msg.file.originalName.toLowerCase().includes(query)
    )
  }

  return files
})

const shortenKey = (key) => {
  if (!key) return ''
  return key.slice(0, 8) + '...' + key.slice(-8)
}

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
}

const getFileIcon = (mimeType) => {
  if (isImageFile(mimeType)) return '🖼️'
  if (isVideoFile(mimeType)) return '🎬'
  if (isAudioFile(mimeType)) return '🎵'
  if (mimeType.includes('pdf')) return '📕'
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦'
  if (mimeType.includes('text')) return '📝'
  return '📄'
}

// Load and decrypt file for preview
const loadFile = async (message) => {
  if (fileCache[message.id]) return
  
  try {
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
    alert('Failed to decrypt file: ' + error.message)
  }
}

const copyKey = async (key) => {
  await navigator.clipboard.writeText(key)
  alert('Copied to clipboard!')
}

const deleteContact = async () => {
  if (confirm('Are you sure you want to delete this contact and all messages?')) {
    await chatStore.removeContact(chatStore.activeChat)
  }
}
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
