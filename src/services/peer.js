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
    this.fileHandler = null
    this.fileTransfers = new Map() // Track ongoing file transfers
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
      debug('=== RECEIVED DATA ===')
      debug('From room:', roomId)
      debug('Data type:', data.type)
      
      if (data.type === 'message' && this.messageHandler) {
        const senderPubKey = data.fromPubKey
        this.messageHandler({
          from: senderPubKey,
          encryptedText: data.encryptedText,
          timestamp: data.timestamp,
          messageId: data.messageId,
          messageHash: data.messageHash
        })
      } else if (data.type === 'delete-message') {
        debug('Delete message instruction received:', data.messageHash)
        if (this.messageHandler) {
          this.messageHandler({
            type: 'delete',
            messageHash: data.messageHash,
            from: data.fromPubKey
          })
        }
      } else if (data.type === 'file-start' && this.fileHandler) {
        debug('File transfer starting:', data.fileName, 'size:', data.fileSize)
        this.fileTransfers.set(data.transferId, {
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          totalChunks: data.totalChunks,
          chunks: [],
          receivedChunks: 0,
          fromPubKey: data.fromPubKey,
          timestamp: data.timestamp
        })
        this.fileHandler({
          type: 'progress',
          transferId: data.transferId,
          fileName: data.fileName,
          progress: 0,
          from: data.fromPubKey
        })
      } else if (data.type === 'file-chunk') {
        const transfer = this.fileTransfers.get(data.transferId)
        if (transfer) {
          transfer.chunks[data.chunkIndex] = data.chunk
          transfer.receivedChunks++
          const progress = (transfer.receivedChunks / transfer.totalChunks) * 100
          debug(`Received chunk ${data.chunkIndex + 1}/${transfer.totalChunks} (${progress.toFixed(1)}%)`)
          
          if (this.fileHandler) {
            this.fileHandler({
              type: 'progress',
              transferId: data.transferId,
              fileName: transfer.fileName,
              progress: progress,
              from: transfer.fromPubKey
            })
          }
          
          if (transfer.receivedChunks === transfer.totalChunks) {
            debug('File transfer complete, reassembling...')
            const blob = new Blob(transfer.chunks, { type: transfer.mimeType })
            this.fileTransfers.delete(data.transferId)
            
            if (this.fileHandler) {
              this.fileHandler({
                type: 'complete',
                transferId: data.transferId,
                fileName: transfer.fileName,
                blob: blob,
                mimeType: transfer.mimeType,
                from: transfer.fromPubKey,
                timestamp: transfer.timestamp
              })
            }
          }
        }
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
  async sendMessage(recipientPubKey, encryptedText, messageHash) {
    debug('=== SENDING MESSAGE ===')
    debug('To peer (pubkey):', recipientPubKey)
    debug('My pubkey:', this.myPublicKey)
    debug('Encrypted text length:', encryptedText.length)
    debug('Message hash:', messageHash)
    
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
        messageId: crypto.randomUUID(),
        messageHash: messageHash
      }
      
      conn.send(messageData)
      debug('✓ Message sent')
      
      return messageData.messageId
    } catch (error) {
      debugError('Failed to send message:', error)
      throw error
    }
  }

  // Send delete message instruction
  async sendDeleteMessage(recipientPubKey, messageHash) {
    debug('=== SENDING DELETE MESSAGE ===')
    debug('To peer:', recipientPubKey)
    debug('Message Hash:', messageHash)
    
    if (!this.peer || !this.myPublicKey) {
      throw new Error('Not connected to PeerServer')
    }

    try {
      const roomId = this.createRoomId(this.myPublicKey, recipientPubKey)
      let conn = this.connections.get(roomId)
      
      if (!conn || !conn.open) {
        conn = this.peer.connect(recipientPubKey, {
          reliable: true,
          metadata: { 
            from: this.myPublicKey,
            roomId: roomId
          }
        })
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)
          conn.on('open', () => {
            clearTimeout(timeout)
            this.setupConnection(conn, roomId)
            resolve()
          })
          conn.on('error', (err) => {
            clearTimeout(timeout)
            reject(err)
          })
        })
      }

      conn.send({
        type: 'delete-message',
        messageHash,
        fromPubKey: this.myPublicKey,
        timestamp: Date.now()
      })
      
      debug('✓ Delete instruction sent')
      return true
    } catch (error) {
      debugError('Failed to send delete instruction:', error)
      throw error
    }
  }

  // Send file via P2P (no server)
  async sendFileP2P(recipientPubKey, file, onProgress) {
    debug('=== SENDING FILE P2P ===')
    debug('To peer:', recipientPubKey)
    debug('File:', file.name, 'size:', file.size)
    
    if (!this.peer || !this.myPublicKey) {
      throw new Error('Not connected to PeerServer')
    }

    try {
      const roomId = this.createRoomId(this.myPublicKey, recipientPubKey)
      let conn = this.connections.get(roomId)
      
      if (!conn || !conn.open) {
        conn = this.peer.connect(recipientPubKey, {
          reliable: true,
          metadata: { 
            from: this.myPublicKey,
            roomId: roomId
          }
        })
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)
          conn.on('open', () => {
            clearTimeout(timeout)
            this.setupConnection(conn, roomId)
            resolve()
          })
          conn.on('error', (err) => {
            clearTimeout(timeout)
            reject(err)
          })
        })
      }

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer()
      const transferId = crypto.randomUUID()
      const CHUNK_SIZE = 16 * 1024 // 16KB chunks for reliable transfer
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE)
      
      debug(`Splitting into ${totalChunks} chunks`)
      
      // Send file metadata first
      conn.send({
        type: 'file-start',
        transferId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        totalChunks,
        fromPubKey: this.myPublicKey,
        timestamp: Date.now()
      })
      
      // Send chunks with delay to avoid overwhelming the connection
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength)
        const chunk = arrayBuffer.slice(start, end)
        
        conn.send({
          type: 'file-chunk',
          transferId,
          chunkIndex: i,
          chunk
        })
        
        const progress = ((i + 1) / totalChunks) * 100
        if (onProgress) {
          onProgress(progress)
        }
        
        debug(`Sent chunk ${i + 1}/${totalChunks} (${progress.toFixed(1)}%)`)
        
        // Small delay to prevent overwhelming
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
      
      debug('✓ File sent successfully')
      return transferId
    } catch (error) {
      debugError('Failed to send file:', error)
      throw error
    }
  }

  // Subscribe to file transfers
  subscribeFiles(onFile) {
    this.fileHandler = onFile
  }

  // Close all connections
  close() {
    debug('Closing all connections...')
    
    for (const conn of this.connections.values()) {
      conn.close()
    }
    this.connections.clear()
    this.fileTransfers.clear()
    
    if (this.peer) {
      this.peer.destroy()
    }
    
    this.connected.value = false
  }
}

// Export singleton instance
export const peerService = new PeerService()
