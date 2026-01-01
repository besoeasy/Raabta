<template>
  <Transition name="fade">
    <div 
      v-if="isVisible"
      class="fixed inset-0 bg-gray-900 z-50 flex flex-col"
    >
      <!-- Header -->
      <div class="absolute top-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-b from-black/50 to-transparent z-10">
        <div class="flex items-center justify-between text-white">
          <div class="flex items-center gap-2 md:gap-4">
            <div class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-lg md:text-xl font-semibold">
              {{ contactName.charAt(0).toUpperCase() }}
            </div>
            <div>
              <h3 class="font-semibold text-base md:text-lg">{{ contactName }}</h3>
              <p class="text-xs md:text-sm text-gray-300">{{ callStatusText }}</p>
            </div>
          </div>
          <div class="text-lg md:text-2xl font-mono">{{ callDuration }}</div>
        </div>
      </div>

      <!-- Video Containers -->
      <div class="flex-1 relative">
        <!-- Remote Video (full screen) -->
        <video 
          ref="remoteVideo"
          autoplay
          playsinline
          class="w-full h-full object-cover"
        ></video>

        <!-- Local Video (picture-in-picture) -->
        <div 
          :class="[
            'absolute bg-gray-800 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20',
            'top-16 right-3 w-32 h-24 md:top-20 md:right-6 md:w-48 md:h-36'
          ]"
          v-if="callType === 'video'"
        >
          <video 
            ref="localVideo"
            autoplay
            playsinline
            muted
            class="w-full h-full object-cover mirror"
          ></video>
        </div>

        <!-- Call connecting overlay -->
        <div 
          v-if="callStatus === 'connecting' || callStatus === 'ringing'"
          class="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm"
        >
          <div class="text-center text-white px-4">
            <div class="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-3xl md:text-4xl font-semibold mx-auto mb-4 md:mb-6">
              {{ contactName.charAt(0).toUpperCase() }}
            </div>
            <div v-if="callStatus === 'ringing'" class="mb-4">
              <div class="inline-block animate-pulse text-3xl md:text-4xl mb-2">📞</div>
            </div>
            <h2 class="text-xl md:text-2xl font-semibold mb-2">{{ contactName }}</h2>
            <p class="text-sm md:text-base text-gray-300">{{ callStatusText }}</p>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-black/50 to-transparent">
        <div class="flex items-center justify-center gap-4 md:gap-6">
          <!-- Mute Audio -->
          <button
            @click="toggleAudio"
            :class="[
              'w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition shadow-lg',
              isAudioMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            ]"
            :title="isAudioMuted ? 'Unmute' : 'Mute'"
          >
            <svg v-if="!isAudioMuted" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 md:h-6 md:w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 md:h-6 md:w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Toggle Video (only for video calls) -->
          <button
            v-if="callType === 'video'"
            @click="toggleVideo"
            :class="[
              'w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition shadow-lg',
              isVideoMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            ]"
            :title="isVideoMuted ? 'Turn on camera' : 'Turn off camera'"
          >
            <svg v-if="!isVideoMuted" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 md:h-6 md:w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 md:h-6 md:w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- End Call -->
          <button
            @click="endCall"
            class="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition shadow-lg"
            title="End call"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 md:h-8 md:w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  isVisible: Boolean,
  callType: {
    type: String,
    default: 'video' // 'video' or 'audio'
  },
  callStatus: {
    type: String,
    default: 'connecting' // 'connecting', 'ringing', 'connected', 'ended'
  },
  contactName: {
    type: String,
    required: true
  },
  localStream: MediaStream,
  remoteStream: MediaStream
})

const emit = defineEmits(['end-call', 'toggle-audio', 'toggle-video'])

const localVideo = ref(null)
const remoteVideo = ref(null)
const isAudioMuted = ref(false)
const isVideoMuted = ref(false)
const callStartTime = ref(null)
const callDuration = ref('00:00')

let durationInterval = null

const callStatusText = computed(() => {
  switch (props.callStatus) {
    case 'connecting': return 'Connecting...'
    case 'ringing': return 'Ringing...'
    case 'connected': return 'Connected'
    case 'ended': return 'Call ended'
    default: return ''
  }
})

// Update call duration
const updateDuration = () => {
  if (!callStartTime.value) return
  
  const elapsed = Math.floor((Date.now() - callStartTime.value) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  callDuration.value = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Watch for call status changes
watch(() => props.callStatus, (status) => {
  if (status === 'connected' && !callStartTime.value) {
    callStartTime.value = Date.now()
    durationInterval = setInterval(updateDuration, 1000)
  } else if (status === 'ended') {
    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
  }
})

// Watch for local stream changes
watch(() => props.localStream, (stream) => {
  if (stream && localVideo.value) {
    localVideo.value.srcObject = stream
  }
})

// Watch for remote stream changes
watch(() => props.remoteStream, (stream) => {
  if (stream && remoteVideo.value) {
    remoteVideo.value.srcObject = stream
  }
})

const toggleAudio = () => {
  if (props.localStream) {
    const audioTrack = props.localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      isAudioMuted.value = !audioTrack.enabled
      emit('toggle-audio', !audioTrack.enabled)
    }
  }
}

const toggleVideo = () => {
  if (props.localStream) {
    const videoTrack = props.localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      isVideoMuted.value = !videoTrack.enabled
      emit('toggle-video', !videoTrack.enabled)
    }
  }
}

const endCall = () => {
  emit('end-call')
}

onMounted(() => {
  if (props.localStream && localVideo.value) {
    localVideo.value.srcObject = props.localStream
  }
  if (props.remoteStream && remoteVideo.value) {
    remoteVideo.value.srcObject = props.remoteStream
  }
})

onUnmounted(() => {
  if (durationInterval) {
    clearInterval(durationInterval)
  }
})
</script>

<style scoped>
.mirror {
  transform: scaleX(-1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
