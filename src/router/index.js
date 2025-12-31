import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('../views/ChatView.vue'),
      meta: { requiresAuth: true }
    },
  ],
})

// Track if chat store has been initialized
let chatInitialized = false

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Initialize auth store if not done
  if (!authStore.isAuthenticated) {
    await authStore.init()
  }
  
  // Initialize chat store when going to chat (only once)
  if (to.meta.requiresAuth && authStore.isAuthenticated && !chatInitialized) {
    const chatStore = useChatStore()
    await chatStore.init()
    chatInitialized = true
  }
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/')
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next('/chat')
  } else {
    next()
  }
})

export default router
