import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { deriveSharedSecret, encrypt, decrypt, getUsername } from 'daku'
import { db, CACHE_DURATION, cleanupExpiredMessages } from '../db'
import { useAuthStore } from './auth'
import { nostrRelay } from '../services/nostr'
import { encryptAndUpload, downloadAndDecrypt } from '../services/filedrop'

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
      // Try to find existing contact with this nostr pubkey
      const existingContact = contacts.value.find(c => {
        // Check if contact's daku pubkey (without prefix) matches sender's nostr pubkey
        return c.publicKey.slice(2) === event.nostrPubKey
      })
      
      let senderDakuPubKey
      let decryptedText = null
      
      if (existingContact) {
        // Use the stored daku pubkey with correct prefix
        senderDakuPubKey = existingContact.publicKey
        console.log('[CHAT] Found existing contact with pubkey:', senderDakuPubKey)
        
        const sharedSecret = deriveSharedSecret(authStore.privateKey, senderDakuPubKey)
        decryptedText = await decrypt(event.encryptedText, sharedSecret)
      } else {
        // Try both prefixes (02 and 03) since we don't know the original
        console.log('[CHAT] No existing contact, trying both prefixes...')
        
        for (const prefix of ['02', '03']) {
          const tryPubKey = prefix + event.nostrPubKey
          console.log('[CHAT] Trying prefix:', prefix, '-> pubkey:', tryPubKey)
          
          try {
            const sharedSecret = deriveSharedSecret(authStore.privateKey, tryPubKey)
            const result = await decrypt(event.encryptedText, sharedSecret)
            
            if (result) {
              decryptedText = result
              senderDakuPubKey = tryPubKey
              console.log('[CHAT] ✓ Decryption successful with prefix:', prefix)
              break
            }
          } catch (e) {
            console.log('[CHAT] Prefix', prefix, 'failed:', e.message)
          }
        }
      }
      
      if (!decryptedText) {
        console.error('[CHAT] ✗ Failed to decrypt with any prefix')
        return
      }
      
      console.log('[CHAT] ✓ Decrypted:', decryptedText)
      
      // Auto-add contact if not exists
      if (!existingContact) {
        console.log('[CHAT] Adding new contact with pubkey:', senderDakuPubKey)
        await addContact(senderDakuPubKey)
      }
      
      // Check if this is a file message (JSON with type: 'file')
      let messageText = decryptedText
      let fileData = null
      
      try {
        const parsed = JSON.parse(decryptedText)
        if (parsed.type === 'file' && parsed.file) {
          fileData = parsed.file
          messageText = parsed.caption || `📎 ${parsed.file.originalName}`
          console.log('[CHAT] ✓ This is a file message:', fileData.originalName)
        }
      } catch {
        // Not JSON, regular text message
      }
      
      const message = {
        conversationId: senderDakuPubKey,
        text: messageText,
        encryptedText: event.encryptedText,
        from: senderDakuPubKey,
        to: authStore.publicKey,
        timestamp: event.timestamp,
        isSent: false,
        isRead: activeChat.value === senderDakuPubKey,
        expiresAt: event.timestamp + CACHE_DURATION,
        eventId: event.eventId,
        file: fileData
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

  // Send encrypted file
  const sendFile = async (contactPublicKey, file, caption = '') => {
    console.log('[CHAT] === SENDING FILE ===')
    console.log('[CHAT] Contact pubkey:', contactPublicKey)
    console.log('[CHAT] File:', file.name, 'size:', file.size, 'type:', file.type)
    
    if (!authStore.privateKey || !file) {
      console.log('[CHAT] Aborted: no private key or no file')
      return null
    }
    
    try {
      // Derive shared secret for E2E encryption
      const sharedSecret = deriveSharedSecret(authStore.privateKey, contactPublicKey)
      
      // Encrypt and upload file
      const fileData = await encryptAndUpload(file, sharedSecret)
      console.log('[CHAT] File uploaded:', fileData)
      
      // Create message with file attachment
      const messagePayload = {
        type: 'file',
        file: {
          url: fileData.url,
          iv: fileData.iv,
          originalName: fileData.originalName,
          mimeType: fileData.mimeType,
          size: fileData.size
        },
        caption: caption || ''
      }
      
      // Encrypt the message payload (contains file metadata)
      const encryptedText = await encrypt(JSON.stringify(messagePayload), sharedSecret)
      
      const now = Date.now()
      
      // Send via Nostr relay
      let eventId = null
      if (isConnected.value) {
        try {
          console.log('[CHAT] Sending file message via Nostr...')
          eventId = await nostrRelay.sendMessage(authStore.privateKey, contactPublicKey, encryptedText)
          console.log('[CHAT] ✓ File message sent via Nostr, event ID:', eventId)
        } catch (error) {
          console.error('[CHAT] ✗ Failed to send file via Nostr:', error)
        }
      }
      
      const message = {
        conversationId: contactPublicKey,
        text: caption || `📎 ${fileData.originalName}`,
        encryptedText,
        from: authStore.publicKey,
        to: contactPublicKey,
        timestamp: now,
        isSent: true,
        isRead: true,
        expiresAt: now + CACHE_DURATION,
        eventId,
        file: messagePayload.file
      }
      
      // Save to IndexedDB
      const id = await db.messages.add(message)
      message.id = id
      console.log('[CHAT] File message saved to DB with id:', id)
      
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
      console.error('Failed to send file:', error)
      return null
    }
  }

  // Download and decrypt a file from a message
  const downloadFile = async (message) => {
    console.log('[CHAT] === DOWNLOADING FILE ===')
    
    if (!message.file || !message.file.url) {
      console.error('[CHAT] No file in message')
      return null
    }
    
    try {
      // Get the contact's public key for deriving shared secret
      const contactPubKey = message.isSent ? message.to : message.from
      const sharedSecret = deriveSharedSecret(authStore.privateKey, contactPubKey)
      
      // Download and decrypt
      const decryptedBlob = await downloadAndDecrypt(
        message.file.url,
        sharedSecret,
        message.file.iv,
        message.file.mimeType
      )
      
      console.log('[CHAT] File decrypted successfully')
      return decryptedBlob
    } catch (error) {
      console.error('[CHAT] Failed to download/decrypt file:', error)
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
    sendFile,
    downloadFile,
    receiveMessage,
    markAsRead,
    setActiveChat,
    getMessages,
    getLastMessage,
    getUnreadCount
  }
})
