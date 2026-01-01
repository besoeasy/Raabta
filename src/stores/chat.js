import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { deriveSharedSecret, encrypt, decrypt, getUsername } from 'daku'
import { db, CACHE_DURATION, cleanupExpiredMessages } from '../db'
import { useAuthStore } from './auth'
import { peerService } from '../services/peer'
import { encryptAndUpload, downloadAndDecrypt } from '../services/filedrop'

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore()
  
  // Contacts list
  const contacts = ref([])
  
  // Messages indexed by contact public key
  const messages = ref({})
  
  // Currently active chat
  const activeChat = ref(null)
  
  // Sidebar visibility
  const sidebarVisible = ref(true)
  
  // Peer connection status
  const isConnected = computed(() => peerService.connected.value)
  
  // Processed message IDs to avoid duplicates
  const processedMessages = ref(new Set())

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
      
      // Connect to PeerJS if authenticated
      if (authStore.privateKey) {
        console.log('[CHAT] Connecting to PeerJS...')
        await connectPeer()
        console.log('[CHAT] Peer connection complete, isConnected:', isConnected.value)
      } else {
        console.log('[CHAT] No private key, skipping Peer connection')
      }
    } catch (error) {
      console.error('[CHAT] Failed to load chat data:', error)
    }
  }
  
  // Connect to PeerJS and subscribe to messages
  const connectPeer = async () => {
    console.log('[CHAT] === CONNECTING TO PEERJS ===')
    console.log('[CHAT] Private key exists:', !!authStore.privateKey)
    
    if (!authStore.privateKey) {
      console.log('[CHAT] No private key, aborting')
      return
    }
    
    try {
      console.log('[CHAT] Initializing peer with public key...')
      await peerService.init(authStore.publicKey)
      
      console.log('[CHAT] Subscribing to messages...')
      peerService.subscribe(authStore.publicKey, handleIncomingMessage)
      
      console.log('[CHAT] Subscribing to P2P file transfers...')
      peerService.subscribeFiles(handleIncomingFile)
      
      console.log('[CHAT] ✓ Connected to PeerJS server, isConnected:', isConnected.value)
    } catch (error) {
      console.error('[CHAT] ✗ Failed to connect to PeerJS:', error)
    }
  }
  
  // Handle incoming message from Peer
  const handleIncomingMessage = async (event) => {
    console.log('[CHAT] === INCOMING MESSAGE ===')
    console.log('[CHAT] Message ID:', event.messageId)
    console.log('[CHAT] From (pubkey):', event.from)
    console.log('[CHAT] Encrypted text length:', event.encryptedText?.length)
    
    // Skip if already processed
    if (processedMessages.value.has(event.messageId)) {
      console.log('[CHAT] Already processed, skipping')
      return
    }
    
    // Skip our own messages (we already have them locally)
    if (event.from === authStore.publicKey) {
      console.log('[CHAT] This is my own message, skipping')
      return
    }
    
    try {
      const senderPubKey = event.from
      
      // Try to find existing contact
      let existingContact = contacts.value.find(c => c.publicKey === senderPubKey)
      
      let decryptedText = null
      
      if (existingContact) {
        // Use the stored pubkey
        console.log('[CHAT] Found existing contact with pubkey:', senderPubKey)
        
        const sharedSecret = deriveSharedSecret(authStore.privateKey, senderPubKey)
        decryptedText = await decrypt(event.encryptedText, sharedSecret)
      } else {
        // Try to decrypt with the sender's pubkey
        console.log('[CHAT] No existing contact, attempting decryption...')
        
        try {
          const sharedSecret = deriveSharedSecret(authStore.privateKey, senderPubKey)
          decryptedText = await decrypt(event.encryptedText, sharedSecret)
        } catch (e) {
          console.error('[CHAT] Decryption failed:', e.message)
        }
      }
      
      if (!decryptedText) {
        console.error('[CHAT] ✗ Failed to decrypt message')
        return
      }
      
      console.log('[CHAT] ✓ Decrypted:', decryptedText)
      
      // Auto-add contact if not exists
      if (!existingContact) {
        console.log('[CHAT] Adding new contact with pubkey:', senderPubKey)
        await addContact(senderPubKey)
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
        conversationId: senderPubKey,
        text: messageText,
        encryptedText: event.encryptedText,
        from: senderPubKey,
        to: authStore.publicKey,
        timestamp: event.timestamp,
        isSent: false,
        isRead: activeChat.value === senderPubKey,
        expiresAt: event.timestamp + CACHE_DURATION,
        messageId: event.messageId,
        file: fileData
      }
      
      const id = await db.messages.add(message)
      message.id = id
      
      processedMessages.value.add(event.messageId)
      
      if (!messages.value[senderPubKey]) {
        messages.value[senderPubKey] = []
      }
      messages.value[senderPubKey].push(message)
      messages.value[senderPubKey].sort((a, b) => a.timestamp - b.timestamp)
      
      console.log('[CHAT] ✓ Message saved and added to UI')
    } catch (error) {
      console.error('[CHAT] ✗ Failed to process incoming message:', error)
    }
  }

  // Handle incoming P2P file
  const handleIncomingFile = async (event) => {
    console.log('[CHAT] === INCOMING P2P FILE ===')
    console.log('[CHAT] Event type:', event.type)
    
    if (event.type === 'progress') {
      console.log(`[CHAT] Receiving ${event.fileName}: ${event.progress.toFixed(1)}%`)
      // Could show notification here
    } else if (event.type === 'complete') {
      console.log('[CHAT] File received:', event.fileName)
      
      try {
        const senderPubKey = event.from
        
        // Auto-add contact if not exists
        let existingContact = contacts.value.find(c => c.publicKey === senderPubKey)
        if (!existingContact) {
          await addContact(senderPubKey)
        }
        
        // Create blob URL for file
        const fileUrl = URL.createObjectURL(event.blob)
        
        const message = {
          conversationId: senderPubKey,
          text: `📎 ${event.fileName}`,
          from: senderPubKey,
          to: authStore.publicKey,
          timestamp: event.timestamp,
          isSent: false,
          isRead: activeChat.value === senderPubKey,
          expiresAt: event.timestamp + CACHE_DURATION,
          file: {
            originalName: event.fileName,
            mimeType: event.mimeType,
            size: event.blob.size,
            blobUrl: fileUrl, // Store blob URL directly
            isP2P: true
          }
        }
        
        const id = await db.messages.add(message)
        message.id = id
        
        if (!messages.value[senderPubKey]) {
          messages.value[senderPubKey] = []
        }
        messages.value[senderPubKey].push(message)
        messages.value[senderPubKey].sort((a, b) => a.timestamp - b.timestamp)
        
        console.log('[CHAT] ✓ P2P file saved and added to UI')
      } catch (error) {
        console.error('[CHAT] ✗ Failed to process P2P file:', error)
      }
    }
  }
  
  // Disconnect from Peer
  const disconnectPeer = () => {
    peerService.close()
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
      
      // Send via PeerJS
      let messageId = null
      if (isConnected.value) {
        try {
          console.log('[CHAT] Sending via PeerJS...')
          messageId = await peerService.sendMessage(contactPublicKey, encryptedText)
          console.log('[CHAT] ✓ Message sent via PeerJS, message ID:', messageId)
        } catch (error) {
          console.error('[CHAT] ✗ Failed to send via PeerJS:', error)
        }
      } else {
        console.log('[CHAT] ✗ Not connected to PeerJS, message saved locally only')
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
        messageId
      }
      
      // Save to IndexedDB
      const id = await db.messages.add(message)
      message.id = id
      console.log('[CHAT] Message saved to DB with id:', id)
      
      // Track processed message
      if (messageId) {
        processedMessages.value.add(messageId)
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
      
      // Send via PeerJS
      let messageId = null
      if (isConnected.value) {
        try {
          console.log('[CHAT] Sending file message via PeerJS...')
          messageId = await peerService.sendMessage(contactPublicKey, encryptedText)
          console.log('[CHAT] ✓ File message sent via PeerJS, message ID:', messageId)
        } catch (error) {
          console.error('[CHAT] ✗ Failed to send file via PeerJS:', error)
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
        messageId,
        file: messagePayload.file
      }
      
      // Save to IndexedDB
      const id = await db.messages.add(message)
      message.id = id
      console.log('[CHAT] File message saved to DB with id:', id)
      
      // Track processed message
      if (messageId) {
        processedMessages.value.add(messageId)
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

  // Send file via P2P (no server)
  const sendFileP2P = async (contactPublicKey, file, onProgress) => {
    console.log('[CHAT] === SENDING FILE P2P ===')
    console.log('[CHAT] Contact pubkey:', contactPublicKey)
    console.log('[CHAT] File:', file.name, 'size:', file.size)
    
    if (!authStore.privateKey || !file) {
      console.log('[CHAT] Aborted: no private key or no file')
      return null
    }
    
    if (!isConnected.value) {
      throw new Error('Not connected to peer network')
    }
    
    try {
      // Send file via P2P
      const transferId = await peerService.sendFileP2P(contactPublicKey, file, onProgress)
      console.log('[CHAT] File sent P2P, transfer ID:', transferId)
      
      const now = Date.now()
      
      // Create blob URL for local display
      const fileUrl = URL.createObjectURL(file)
      
      const message = {
        conversationId: contactPublicKey,
        text: `📎 ${file.name}`,
        from: authStore.publicKey,
        to: contactPublicKey,
        timestamp: now,
        isSent: true,
        isRead: true,
        expiresAt: now + CACHE_DURATION,
        file: {
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          blobUrl: fileUrl,
          isP2P: true
        }
      }
      
      // Save to IndexedDB
      const id = await db.messages.add(message)
      message.id = id
      console.log('[CHAT] P2P file message saved to DB with id:', id)
      
      // Update local state
      if (!messages.value[contactPublicKey]) {
        messages.value[contactPublicKey] = []
      }
      messages.value[contactPublicKey].push(message)
      
      return message
    } catch (error) {
      console.error('Failed to send file P2P:', error)
      throw error
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
    sidebarVisible,
    sortedContacts,
    totalUnread,
    isConnected,
    init,
    connectPeer,
    disconnectPeer,
    addContact,
    removeContact,
    sendMessage,
    sendFile,
    sendFileP2P,
    downloadFile,
    receiveMessage,
    markAsRead,
    setActiveChat,
    getMessages,
    getLastMessage,
    getUnreadCount
  }
})
