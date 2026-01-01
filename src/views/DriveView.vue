<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="flex items-center justify-between max-w-7xl mx-auto">
        <div class="flex items-center gap-4">
          <button 
            @click="$router.push('/chat')"
            class="p-2 hover:bg-gray-100 rounded-full transition"
            title="Back to Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">📁 My Drive</h1>
            <p class="text-sm text-gray-500">All your encrypted files stored locally</p>
          </div>
        </div>
        
        <div class="flex items-center gap-4">
          <!-- Storage Stats -->
          <div class="text-right">
            <p class="text-sm font-medium text-gray-900">{{ fileCount }} files</p>
            <p class="text-xs text-gray-500">{{ formatSize(totalSize) }} used</p>
          </div>
          
          <!-- Clear All Button -->
          <button 
            v-if="fileCount > 0"
            @click="clearAllFiles"
            class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            🗑️ Clear All
          </button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white border-b border-gray-200 px-6 py-3">
      <div class="flex items-center gap-3 max-w-7xl mx-auto">
        <button
          @click="filterType = 'all'"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition',
            filterType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          All ({{ files.length }})
        </button>
        <button
          @click="filterType = 'images'"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition',
            filterType === 'images' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          🖼️ Images ({{ imageFiles.length }})
        </button>
        <button
          @click="filterType = 'videos'"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition',
            filterType === 'videos' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          🎬 Videos ({{ videoFiles.length }})
        </button>
        <button
          @click="filterType = 'audio'"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition',
            filterType === 'audio' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          🎵 Audio ({{ audioFiles.length }})
        </button>
        <button
          @click="filterType = 'documents'"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition',
            filterType === 'documents' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          📄 Documents ({{ documentFiles.length }})
        </button>
        
        <div class="flex-1"></div>
        
        <!-- Search -->
        <div class="relative">
          <input 
            v-model="searchQuery"
            type="text"
            placeholder="Search files..."
            class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Files Grid -->
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-7xl mx-auto">
        <!-- Loading -->
        <div v-if="loading" class="text-center py-12">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p class="mt-4 text-gray-600">Loading files...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredFiles.length === 0" class="text-center py-16">
          <div class="text-6xl mb-4">📂</div>
          <h3 class="text-xl font-semibold text-gray-700 mb-2">No files found</h3>
          <p class="text-gray-500">
            {{ searchQuery ? 'Try a different search term' : 'Start chatting and sharing files!' }}
          </p>
        </div>

        <!-- Files List -->
        <div v-else class="space-y-2">
          <div 
            v-for="file in filteredFiles" 
            :key="file.id"
            class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition flex items-center gap-4"
          >
            <!-- File Icon/Preview -->
            <div class="flex-shrink-0">
              <div v-if="isImage(file.mimeType)" class="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                <img 
                  v-if="fileCache[file.id]"
                  :src="fileCache[file.id]"
                  :alt="file.originalName"
                  class="w-full h-full object-cover"
                />
                <div v-else @click="loadPreview(file)" class="w-full h-full flex items-center justify-center text-2xl cursor-pointer hover:bg-gray-200">
                  🖼️
                </div>
              </div>
              <div v-else class="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-3xl">
                {{ getFileIcon(file.mimeType) }}
              </div>
            </div>

            <!-- File Info -->
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-gray-900 truncate">{{ file.originalName }}</h4>
              <p class="text-sm text-gray-500">
                {{ formatSize(file.size) }} • {{ formatDate(file.timestamp) }}
              </p>
              <p class="text-xs text-gray-400 truncate">
                Conversation: {{ getContactName(file.conversationId) }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <button 
                @click="viewFile(file)"
                class="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                title="View"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                </svg>
              </button>
              <button 
                @click="downloadFile(file)"
                class="p-2 hover:bg-green-50 text-green-600 rounded-lg transition"
                title="Download"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
              <button 
                @click="deleteFileConfirm(file)"
                class="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'
import { isImageFile, isVideoFile, isAudioFile, formatFileSize } from '../services/filedrop'
import { getUsername } from 'daku'

const router = useRouter()
const chatStore = useChatStore()

const files = ref([])
const loading = ref(true)
const filterType = ref('all')
const searchQuery = ref('')
const fileCache = reactive({})

const fileCount = ref(0)
const totalSize = ref(0)

// Load files
const loadFiles = async () => {
  loading.value = true
  try {
    files.value = await chatStore.getAllFiles()
    const stats = await chatStore.getStorageStats()
    fileCount.value = stats.fileCount
    totalSize.value = stats.totalSize
  } catch (error) {
    console.error('Failed to load files:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadFiles()
})

// Filter files by type
const imageFiles = computed(() => files.value.filter(f => isImageFile(f.mimeType)))
const videoFiles = computed(() => files.value.filter(f => isVideoFile(f.mimeType)))
const audioFiles = computed(() => files.value.filter(f => isAudioFile(f.mimeType)))
const documentFiles = computed(() => files.value.filter(f => 
  !isImageFile(f.mimeType) && !isVideoFile(f.mimeType) && !isAudioFile(f.mimeType)
))

const filteredFiles = computed(() => {
  let result = files.value

  // Filter by type
  if (filterType.value === 'images') result = imageFiles.value
  else if (filterType.value === 'videos') result = videoFiles.value
  else if (filterType.value === 'audio') result = audioFiles.value
  else if (filterType.value === 'documents') result = documentFiles.value

  // Filter by search
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(f => f.originalName.toLowerCase().includes(query))
  }

  // Sort by newest first
  return result.sort((a, b) => b.timestamp - a.timestamp)
})

// Helpers
const isImage = (mimeType) => isImageFile(mimeType)
const formatSize = (bytes) => formatFileSize(bytes)

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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

const getContactName = (publicKey) => {
  const contact = chatStore.contacts.find(c => c.publicKey === publicKey)
  return contact ? contact.username : getUsername(publicKey)
}

// Load preview
const loadPreview = (file) => {
  if (file.blob) {
    fileCache[file.id] = URL.createObjectURL(file.blob)
  }
}

// View file
const viewFile = (file) => {
  if (!fileCache[file.id] && file.blob) {
    fileCache[file.id] = URL.createObjectURL(file.blob)
  }
  if (fileCache[file.id]) {
    window.open(fileCache[file.id], '_blank')
  }
}

// Download file
const downloadFile = (file) => {
  if (!file.blob) return
  
  const url = URL.createObjectURL(file.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.originalName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Delete file
const deleteFileConfirm = async (file) => {
  if (confirm(`Delete "${file.originalName}"?`)) {
    const success = await chatStore.deleteFile(file.id)
    if (success) {
      await loadFiles()
    } else {
      alert('Failed to delete file')
    }
  }
}

// Clear all files
const clearAllFiles = async () => {
  if (confirm(`Delete all ${fileCount.value} files? This cannot be undone!`)) {
    try {
      for (const file of files.value) {
        await chatStore.deleteFile(file.id)
      }
      await loadFiles()
    } catch (error) {
      console.error('Failed to clear files:', error)
      alert('Failed to clear files')
    }
  }
}
</script>
