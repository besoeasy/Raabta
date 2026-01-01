<template>
  <Transition name="slide-up">
    <div 
      v-if="isVisible"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click.self="decline"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-bounce-slow">
        <!-- Caller Avatar -->
        <div class="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-4xl font-semibold mx-auto mb-6 shadow-lg">
          {{ callerName.charAt(0).toUpperCase() }}
        </div>

        <!-- Ringing Animation -->
        <div class="mb-6">
          <div class="inline-block animate-pulse text-5xl">
            <svg v-if="callType === 'video'" xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </div>
        </div>

        <!-- Caller Info -->
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ callerName }}
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-8">
          Incoming {{ callType }} call...
        </p>

        <!-- Action Buttons -->
        <div class="flex gap-4 justify-center">
          <!-- Decline -->
          <button
            @click="decline"
            class="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition shadow-lg hover:shadow-xl transform hover:scale-105"
            title="Decline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white rotate-135" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </button>

          <!-- Accept -->
          <button
            @click="accept"
            class="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition shadow-lg hover:shadow-xl transform hover:scale-105"
            title="Accept"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  isVisible: Boolean,
  callerName: {
    type: String,
    required: true
  },
  callType: {
    type: String,
    default: 'video' // 'video' or 'audio'
  }
})

const emit = defineEmits(['accept', 'decline'])

const accept = () => {
  emit('accept')
}

const decline = () => {
  emit('decline')
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.animate-bounce-slow {
  animation: bounce-slow 2s ease-in-out infinite;
}

@keyframes bounce-slow {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.rotate-135 {
  transform: rotate(135deg);
}
</style>
