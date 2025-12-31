import Dexie from 'dexie'

// Create Dexie database for chat app
export const db = new Dexie('RaabtaDB')

// Define schema
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

// Cache expiry duration: 1 year in milliseconds
export const CACHE_DURATION = 365 * 24 * 60 * 60 * 1000

// Clean up expired messages (older than 1 year)
export async function cleanupExpiredMessages() {
  const now = Date.now()
  await db.messages.where('expiresAt').below(now).delete()
}

// Run cleanup on init
cleanupExpiredMessages()
