import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { deriveSharedSecret, encrypt, decrypt, getUsername } from 'daku'
import { db, CACHE_DURATION, cleanupExpiredMessages } from '../db'
import { useAuthStore } from './auth'
import { nostrRelay } from '../services/nostr'

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore()
  
  // Contacts list
  const contacts = ref([])
  
  // Messages indexed by contact public key
  const messages = ref({})
  
  // Currently active chat
  const activeChat = ref(null)
  
  // Nostr connection status
  const isConnected = ref(false)
  
  // Processed event IDs to avoid duplicates
  const processedEvents = ref(new Set())

  // Load data from IndexedDB and connect to Nostr
  const init = async () => {
    console.log('[CHAT] === INITIALIZING CHAT STORE ===')
    console.log('[CHAT] Auth store private key exists:', !!authStore.privateKey)
    console.log('[CHAT] Auth store public key:', authStore.publicKey)
    
    try {
      // Clean expired messages
      await cleanupExpiredMessages()
      console.log('[CHAT] Cleaned expired messages')
      
      // Load contacts
      contacts.value = await db.contacts.toArray()
      console.log('[CHAT] Loaded contacts:', contacts.value.length)
      
      // Load all messages grouped by conversation
      const allMessages = await db.messages.toArray()
      console.log('[CHAT] Loaded messages:', allMessages.length)
      
      const grouped = {}
      
      for (const msg of allMessages) {
        if (!grouped[msg.conversationId]) {
          grouped[msg.conversationId] = []
        }
        grouped[msg.conversationId].push(msg)
        // Track processed events
        if (msg.eventId) {
          processedEvents.value.add(msg.eventId)
        }
      }
      
      // Sort messages by timestamp
      for (const key in grouped) {
        grouped[key].sort((a, b) => a.timestamp - b.timestamp)
      }
      
      messages.value = grouped
      
      // Connect to Nostr relays if authenticated
      if (authStore.privateKey) {
        console.log('[CHAT] Connecting to Nostr...')
        await connectNostr()
        console.log('[CHAT] Nostr connection complete, isConnected:', isConnected.value)
      } else {
        console.log('[CHAT] No private key, skipping Nostr connection')
      }
    } catch (error) {
      console.error('[CHAT] Failed to load chat data:', error)
    }
  }
  
  // Connect to Nostr and subscribe to messages
  const connectNostr = async () => {
    console.log('[CHAT] === CONNECTING TO NOSTR ===')
    console.log('[CHAT] Private key exists:', !!authStore.privateKey)
    
    if (!authStore.privateKey) {
      console.log('[CHAT] No private key, aborting')
      return
    }
    
    try {
      console.log('[CHAT] Subscribing to messages (waiting for EOSE)...')
      await nostrRelay.subscribe(authStore.privateKey, handleIncomingMessage)
      // Use the nostr service's connected status
      isConnected.value = nostrRelay.connected.value
      console.log('[CHAT] ✓ Connected to Nostr relays, isConnected:', isConnected.value)
    } catch (error) {
      console.error('[CHAT] ✗ Failed to connect to Nostr:', error)
      isConnected.value = false
    }
  }
  
  // Handle incoming message from Nostr
  const handleIncomingMessage = async (event) => {
    console.log('[CHAT] === INCOMING MESSAGE ===')
    console.log('[CHAT] Event ID:', event.eventId)
    console.log('[CHAT] From (daku pubkey):', event.from)
    console.log('[CHAT] From (nostr pubkey):', event.nostrPubKey)
    console.log('[CHAT] Encrypted text length:', event.encryptedText?.length)
    
    // Skip if already processed
    if (processedEvents.value.has(event.eventId)) {
      console.log('[CHAT] Already processed, skipping')
      return
    }
    
    // Skip our own messages (we already have them locally)
    const { publicKey: myNostrPubKey } = nostrRelay.getNostrKeys(authStore.privateKey)
    console.log('[CHAT] My nostr pubkey:', myNostrPubKey)
    console.log('[CHAT] Sender nostr pubkey:', event.nostrPubKey)
    
    if (event.nostrPubKey === myNostrPubKey) {
      console.log('[CHAT] This is my own message, skipping')
      return
    }
    
    try {
      const senderDakuPubKey = event.from
      
      console.log('[CHAT] Deriving shared secret with sender...')
      const sharedSecret = deriveSharedSecret(authStore.privateKey, senderDakuPubKey)
      console.log('[CHAT] Shared secret derived (length):', sharedSecret.length)
      
      console.log('[CHAT] Decrypting message...')
      const decryptedText = await decrypt(event.encryptedText, sharedSecret)
      
      if (!decryptedText) {
        console.error('[CHAT] ✗ Failed to decrypt - returned null')
        return
      }
      
      console.log('[CHAT] ✓ Decrypted:', decryptedText)
      
      // Auto-add contact if not exists
      if (!contacts.value.find(c => c.publicKey === senderDakuPubKey)) {
        console.log('[CHAT] Adding new contact...')
        await addContact(senderDakuPubKey)
      }
      
      const message = {
        conversationId: senderDakuPubKey,
        text: decryptedText,
        encryptedText: event.encryptedText,
        from: senderDakuPubKey,
        to: authStore.publicKey,
        timestamp: event.timestamp,
        isSent: false,
        isRead: activeChat.value === senderDakuPubKey,
        expiresAt: event.timestamp + CACHE_DURATION,
        eventId: event.eventId
      }
      
      const id = await db.messages.add(message)
      message.id = id
      
      processedEvents.value.add(event.eventId)
      
      if (!messages.value[senderDakuPubKey]) {
        messages.value[senderDakuPubKey] = []
      }
      messages.value[senderDakuPubKey].push(message)
      messages.value[senderDakuPubKey].sort((a, b) => a.timestamp - b.timestamp)
      
      console.log('[CHAT] ✓ Message saved and added to UI')
    } catch (error) {
      console.error('[CHAT] ✗ Failed to process incoming message:', error)
    }
  }
  
  // Disconnect from Nostr
  const disconnectNostr = () => {
    nostrRelay.close()
    isConnected.value = false
  }

  // Add new contact by public key
  const addContact = async (publicKey) => {
    if (!publicKey || contacts.value.find(c => c.publicKey === publicKey)) {
      return false
    }
    
    try {
      const username = getUsername(publicKey)
      const contact = {
        publicKey,
        username,
        addedAt: Date.now(),
        lastSeen: Date.now()
      }
      
      await db.contacts.put(contact)
      contacts.value.push(contact)
      
      // Initialize empty messages array
      if (!messages.value[publicKey]) {
        messages.value[publicKey] = []
      }
      
      return true
    } catch (error) {
      console.error('Failed to add contact:', error)
      return false
    }
  }

  // Remove contact and their messages
  const removeContact = async (publicKey) => {
    try {
      await db.contacts.delete(publicKey)
      await db.messages.where('conversationId').equals(publicKey).delete()
      
      contacts.value = contacts.value.filter(c => c.publicKey !== publicKey)
      delete messages.value[publicKey]
      
      if (activeChat.value === publicKey) {
        activeChat.value = null
      }
      
      return true
    } catch (error) {
      console.error('Failed to remove contact:', error)
      return false
    }
  }

  // Send encrypted message
  const sendMessage = async (contactPublicKey, messageText) => {
    console.log('[CHAT] === SENDING MESSAGE ===')
    console.log('[CHAT] Contact pubkey:', contactPublicKey)
    console.log('[CHAT] Contact pubkey length:', contactPublicKey.length)
    console.log('[CHAT] Message text:', messageText)
    console.log('[CHAT] Is connected:', isConnected.value)
    
    if (!authStore.privateKey || !messageText.trim()) {
      console.log('[CHAT] Aborted: no private key or empty message')
      return null
    }
    
    try {
      // Derive shared secret for E2E encryption
      console.log('[CHAT] Deriving shared secret...')
      const sharedSecret = deriveSharedSecret(authStore.privateKey, contactPublicKey)
      console.log('[CHAT] Shared secret derived (length):', sharedSecret.length)
      
      // Encrypt message
      console.log('[CHAT] Encrypting message...')
      const encryptedText = await encrypt(messageText, sharedSecret)
      console.log('[CHAT] Encrypted text length:', encryptedText.length)
      console.log('[CHAT] Encrypted text preview:', encryptedText.substring(0, 50) + '...')
      
      const now = Date.now()
      
      // Send via Nostr relay
      let eventId = null
      if (isConnected.value) {
        try {
          console.log('[CHAT] Sending via Nostr...')
          eventId = await nostrRelay.sendMessage(authStore.privateKey, contactPublicKey, encryptedText)
          console.log('[CHAT] ✓ Message sent via Nostr, event ID:', eventId)
        } catch (error) {
          console.error('[CHAT] ✗ Failed to send via Nostr:', error)
        }
      } else {
        console.log('[CHAT] ✗ Not connected to Nostr, message saved locally only')
      }
      
      const message = {
        conversationId: contactPublicKey,
        text: messageText,
        encryptedText,
        from: authStore.publicKey,
        to: contactPublicKey,
        timestamp: now,
        isSent: true,
        isRead: true,
        expiresAt: now + CACHE_DURATION,
        eventId
      }
      
      // Save to IndexedDB
      const id = await db.messages.add(message)
      message.id = id
      console.log('[CHAT] Message saved to DB with id:', id)
      
      // Track processed event
      if (eventId) {
        processedEvents.value.add(eventId)
      }
      
      // Update local state
      if (!messages.value[contactPublicKey]) {
        messages.value[contactPublicKey] = []
      }
      messages.value[contactPublicKey].push(message)
      
      return message
    } catch (error) {
      console.error('Failed to send message:', error)
      return null
    }
  }

  // Receive encrypted message
  const receiveMessage = async (senderPublicKey, encryptedText) => {
    if (!authStore.privateKey) return null
    
    try {
      // Derive shared secret
      const sharedSecret = deriveSharedSecret(authStore.privateKey, senderPublicKey)
      
      // Decrypt message
      const decryptedText = await decrypt(encryptedText, sharedSecret)
      
      if (!decryptedText) {
        console.error('Failed to decrypt message')
        return null
      }
      
      const now = Date.now()
      const message = {
        conversationId: senderPublicKey,
        text: decryptedText,
        encryptedText,
        from: senderPublicKey,
        to: authStore.publicKey,
        timestamp: now,
        isSent: false,
        isRead: activeChat.value === senderPublicKey,
        expiresAt: now + CACHE_DURATION // Cache for 1 year
      }
      
      // Auto-add contact if not exists
      if (!contacts.value.find(c => c.publicKey === senderPublicKey)) {
        await addContact(senderPublicKey)
      }
      
      // Save to IndexedDB
      const id = await db.messages.add(message)
      message.id = id
      
      // Update local state
      if (!messages.value[senderPublicKey]) {
        messages.value[senderPublicKey] = []
      }
      messages.value[senderPublicKey].push(message)
      
      return message
    } catch (error) {
      console.error('Failed to receive message:', error)
      return null
    }
  }

  // Mark messages as read
  const markAsRead = async (contactPublicKey) => {
    const msgs = messages.value[contactPublicKey] || []
    const unreadIds = msgs
      .filter(m => m.from === contactPublicKey && !m.isRead)
      .map(m => m.id)
    
    if (unreadIds.length > 0) {
      // Update in IndexedDB
      await db.messages.where('id').anyOf(unreadIds).modify({ isRead: true })
      
      // Update local state
      msgs.forEach(m => {
        if (m.from === contactPublicKey) {
          m.isRead = true
        }
      })
    }
  }

  // Set active chat
  const setActiveChat = async (publicKey) => {
    activeChat.value = publicKey
    if (publicKey) {
      await markAsRead(publicKey)
    }
  }

  // Get messages for a contact
  const getMessages = (contactPublicKey) => {
    return messages.value[contactPublicKey] || []
  }

  // Get last message for a contact
  const getLastMessage = (contactPublicKey) => {
    const msgs = messages.value[contactPublicKey]
    if (!msgs || msgs.length === 0) return null
    return msgs[msgs.length - 1]
  }

  // Get unread count for a contact
  const getUnreadCount = (contactPublicKey) => {
    const msgs = messages.value[contactPublicKey] || []
    return msgs.filter(m => m.from === contactPublicKey && !m.isRead).length
  }

  // Sorted contacts by last message time
  const sortedContacts = computed(() => {
    return [...contacts.value].sort((a, b) => {
      const lastA = getLastMessage(a.publicKey)
      const lastB = getLastMessage(b.publicKey)
      const timeA = lastA ? lastA.timestamp : a.addedAt
      const timeB = lastB ? lastB.timestamp : b.addedAt
      return timeB - timeA
    })
  })

  // Total unread messages
  const totalUnread = computed(() => {
    return contacts.value.reduce((sum, contact) => {
      return sum + getUnreadCount(contact.publicKey)
    }, 0)
  })

  return {
    contacts,
    messages,
    activeChat,
    sortedContacts,
    totalUnread,
    isConnected,
    init,
    connectNostr,
    disconnectNostr,
    addContact,
    removeContact,
    sendMessage,
    receiveMessage,
    markAsRead,
    setActiveChat,
    getMessages,
    getLastMessage,
    getUnreadCount
  }
})
