import Dexie from 'dexie'

// Create Dexie database for chat app
export const db = new Dexie('RaabtaDB')

// Define schema - version 2 adds file attachment support
db.version(1).stores({
  // User identity storage
  identity: 'id, privateKey, publicKey, username, createdAt',
  
  // Contacts storage
  contacts: 'publicKey, username, addedAt, lastSeen',
  
  // Messages storage with indexes for querying
  messages: '++id, conversationId, from, to, timestamp, isRead, expiresAt',
  
  // Conversation metadata
  conversations: 'contactPublicKey, lastMessageAt, unreadCount'
})

// Version 2: Add file attachment fields to messages
db.version(2).stores({
  // User identity storage
  identity: 'id, privateKey, publicKey, username, createdAt',
  
  // Contacts storage
  contacts: 'publicKey, username, addedAt, lastSeen',
  
  // Messages storage - now with file support
  // file: { url, iv, originalName, mimeType, size }
  messages: '++id, conversationId, from, to, timestamp, isRead, expiresAt, [conversationId+timestamp]',
  
  // Conversation metadata
  conversations: 'contactPublicKey, lastMessageAt, unreadCount',
  
  // Settings storage for user preferences
  settings: 'key, value'
})

// Cache expiry duration: 1 year in milliseconds
export const CACHE_DURATION = 365 * 24 * 60 * 60 * 1000

// Clean up expired messages (older than 1 year)
export async function cleanupExpiredMessages() {
  const now = Date.now()
  await db.messages.where('expiresAt').below(now).delete()
}

// Run cleanup on init
cleanupExpiredMessages()
