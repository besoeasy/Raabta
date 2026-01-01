import Peer from 'peerjs'
import { ref } from 'vue'

// Debug logger
const debug = (...args) => console.log('[PEER]', ...args)
const debugError = (...args) => console.error('[PEER ERROR]', ...args)

class PeerService {
  constructor() {
    this.peer = null
    this.connections = new Map() // Map of roomId -> DataConnection
    this.connected = ref(false)
    this.myPeerId = ref(null)
    this.myPublicKey = null
    this.messageHandler = null
    debug('PeerService initialized')
  }

  // Create a room ID from two public keys (sorted alphabetically)
  createRoomId(pubKey1, pubKey2) {
    const sorted = [pubKey1, pubKey2].sort()
    return `room-${sorted[0]}-${sorted[1]}`
  }

  // Initialize peer with our public key as ID
  async init(publicKey) {
    debug('=== INITIALIZING PEER ===')
    debug('My public key:', publicKey)
    
    // Close existing peer if any
    if (this.peer) {
      debug('Closing existing peer connection...')
      this.peer.destroy()
      this.peer = null
      this.connections.clear()
    }
    
    return new Promise((resolve, reject) => {
      // Use public key as peer ID directly
      const peerId = publicKey
      
      // Create peer using free PeerJS cloud server
      this.peer = new Peer(peerId, {
        debug: 0,
      })

      this.peer.on('open', (id) => {
        debug('✓ Connected to PeerServer')
        debug('My Peer ID:', id)
        this.myPeerId.value = id
        this.myPublicKey = publicKey
        this.connected.value = true
        resolve(id)
      })

      this.peer.on('connection', (conn) => {
        debug('=== INCOMING CONNECTION ===')
        debug('From peer:', conn.peer)
        debug('Metadata:', conn.metadata)
        
        // Use room ID from metadata if available, otherwise create it
        const roomId = conn.metadata?.roomId || this.createRoomId(this.myPublicKey, conn.peer)
        debug('Assigned to room:', roomId)
        
        this.setupConnection(conn, roomId)
      })

      this.peer.on('error', (err) => {
        debugError('Peer error:', err.type, err.message)
        
        if (err.type === 'unavailable-id') {
          // ID is taken (multiple tabs), still resolve so we can try to send
          debug('Peer ID taken - likely another tab is open')
          this.myPublicKey = publicKey
          resolve(publicKey)
        } else if (err.type === 'network' || err.type === 'server-error') {
          reject(err)
        }
      })

      this.peer.on('disconnected', () => {
        debug('⚠️  Disconnected from PeerServer')
        this.connected.value = false
      })

      this.peer.on('close', () => {
        debug('Peer connection closed')
        this.connected.value = false
      })
    })
  }

  // Setup connection event handlers
  setupConnection(conn, roomId) {
    debug('Setting up connection with room:', roomId)
    
    conn.on('open', () => {
      debug('✓ Connection opened for room:', roomId)
      this.connections.set(roomId, conn)
    })

    conn.on('data', (data) => {
      debug('=== RECEIVED MESSAGE ===')
      debug('From room:', roomId)
      debug('Data:', data)
      
      if (this.messageHandler && data.type === 'message') {
        const senderPubKey = data.fromPubKey
        
        this.messageHandler({
          from: senderPubKey,
          encryptedText: data.encryptedText,
          timestamp: data.timestamp,
          messageId: data.messageId
        })
      }
    })

    conn.on('close', () => {
      debug('Connection closed for room:', roomId)
      this.connections.delete(roomId)
    })

    conn.on('error', (err) => {
      debugError('Connection error for room', roomId, ':', err)
    })
  }

  // Subscribe to incoming messages
  subscribe(publicKey, onMessage) {
    debug('=== SUBSCRIBING TO MESSAGES ===')
    debug('My public key:', publicKey)
    
    this.messageHandler = onMessage
    
    // Just set the handler, connections are established on-demand
    debug('✓ Message handler registered')
  }

  // Send message to a peer
  async sendMessage(recipientPubKey, encryptedText) {
    debug('=== SENDING MESSAGE ===')
    debug('To peer (pubkey):', recipientPubKey)
    debug('My pubkey:', this.myPublicKey)
    debug('Encrypted text length:', encryptedText.length)
    
    if (!this.peer || !this.myPublicKey) {
      throw new Error('Not connected to PeerServer')
    }

    try {
      // Create room ID from both public keys
      const roomId = this.createRoomId(this.myPublicKey, recipientPubKey)
      debug('Room ID:', roomId)
      
      // Check if we already have a connection to this room
      let conn = this.connections.get(roomId)
      
      if (!conn || !conn.open) {
        debug('Creating new connection to room:', roomId)
        
        // Connect to the recipient's peer ID directly
        conn = this.peer.connect(recipientPubKey, {
          reliable: true,
          metadata: { 
            from: this.myPublicKey,
            roomId: roomId
          }
        })
        
        // Wait for connection to open
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'))
          }, 10000)
          
          conn.on('open', () => {
            clearTimeout(timeout)
            debug('✓ Connection established to recipient')
            this.setupConnection(conn, roomId)
            resolve()
          })
          
          conn.on('error', (err) => {
            clearTimeout(timeout)
            reject(err)
          })
        })
      }

      // Send the message
      const messageData = {
        type: 'message',
        fromPubKey: this.myPublicKey,
        encryptedText,
        timestamp: Date.now(),
        messageId: crypto.randomUUID()
      }
      
      conn.send(messageData)
      debug('✓ Message sent')
      
      return messageData.messageId
    } catch (error) {
      debugError('Failed to send message:', error)
      throw error
    }
  }

  // Close all connections
  close() {
    debug('Closing all connections...')
    
    for (const conn of this.connections.values()) {
      conn.close()
    }
    this.connections.clear()
    
    if (this.peer) {
      this.peer.destroy()
    }
    
    this.connected.value = false
  }
}

// Export singleton instance
export const peerService = new PeerService()
