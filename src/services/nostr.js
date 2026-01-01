import { SimplePool, finalizeEvent, getPublicKey } from 'nostr-tools'
import { hexToBytes } from '@noble/hashes/utils'
import { ref } from 'vue'

// Default public relays - using more reliable ones
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.mom',
]

// Custom event kind for Raabta encrypted messages
const RAABTA_MESSAGE_KIND = 14141

// Debug logger
const debug = (...args) => console.log('[NOSTR]', ...args)
const debugError = (...args) => console.error('[NOSTR ERROR]', ...args)

// Convert between daku (66-char with prefix) and nostr (64-char raw) pubkeys
const dakuToNostrPubkey = (dakuPubKey) => {
  // Daku uses compressed format with 02/03 prefix, nostr uses raw x-coordinate
  if (dakuPubKey.length === 66) {
    return dakuPubKey.slice(2) // Remove 02 or 03 prefix
  }
  return dakuPubKey
}

const nostrToDakuPubkey = (nostrPubKey) => {
  // Add 02 prefix (compressed format, even y). 
  // Note: This may not be the exact original key, but works for ECDH
  if (nostrPubKey.length === 64) {
    return '02' + nostrPubKey
  }
  return nostrPubKey
}

class NostrRelay {
  constructor() {
    this.pool = new SimplePool()
    this.relays = [...DEFAULT_RELAYS]
    this.subscriptions = new Map()
    this.connected = ref(false)
    this.messageHandlers = []
    debug('NostrRelay initialized with relays:', this.relays)
  }

  // Convert daku hex private key to nostr format
  getNostrKeys(dakuPrivateKey) {
    const privateKeyBytes = hexToBytes(dakuPrivateKey)
    const publicKey = getPublicKey(privateKeyBytes) // Returns 64-char nostr format
    return { privateKeyBytes, publicKey }
  }

  // Subscribe to messages for a public key
  async subscribe(dakuPrivateKey, onMessage) {
    debug('=== SUBSCRIBING TO MESSAGES ===')
    const { privateKeyBytes, publicKey } = this.getNostrKeys(dakuPrivateKey)

    debug('My nostr pubkey (64 chars):', publicKey)
    debug('My nostr pubkey length:', publicKey.length)

    const filter = {
      kinds: [RAABTA_MESSAGE_KIND],
      '#p': [publicKey],
      since: Math.floor(Date.now() / 1000) - 86400 * 7
    }
    debug('Subscription filter:', JSON.stringify(filter))

    return new Promise(async (resolve) => {
      // Subscribe to messages tagged with our public key
      debug('Creating subscription with pool:', !!this.pool)
      debug('Relays:', this.relays)
      debug('Filter:', JSON.stringify(filter))
      
      let eoseCount = 0
      const totalRelays = this.relays.length
      
      // Use subscribe (single subscription) instead of subscribeMany
      // This seems to work more reliably with nostr-tools
      const sub = this.pool.subscribe(
        this.relays,
        [filter],
        {
          onevent: (event) => {
            debug('=== RECEIVED EVENT ===')
            debug('Event ID:', event.id)
            debug('Event kind:', event.kind)
            debug('Sender nostr pubkey:', event.pubkey)
            debug('Tags:', JSON.stringify(event.tags))
            debug('Content length:', event.content?.length)
            debug('Content preview:', event.content?.substring(0, 50) + '...')
            debug('Callback function exists:', !!onMessage)
            
            // Parse the encrypted message
            try {
              const senderNostrPubKey = event.pubkey
              const encryptedContent = event.content
              const timestamp = event.created_at * 1000
              
              // Convert sender's nostr pubkey back to daku format for decryption
              const senderDakuPubKey = nostrToDakuPubkey(senderNostrPubKey)
              
              debug('Converted sender to daku pubkey:', senderDakuPubKey)
              debug('Calling onMessage callback...')
              
              onMessage({
                from: senderDakuPubKey,
                nostrPubKey: senderNostrPubKey,
                encryptedText: encryptedContent,
                timestamp,
                eventId: event.id
              })
              
              debug('✓ onMessage callback completed')
            } catch (error) {
              debugError('Failed to parse nostr event:', error)
            }
          },
          oneose: () => {
            eoseCount++
            debug(`Subscription EOSE - ${eoseCount}/${totalRelays} relays caught up`)
            
            if (eoseCount >= totalRelays || eoseCount >= 2) {
              debug('Subscription is active, will continue receiving new events...')
              this.connected.value = true
              resolve(sub)
            }
          },
          onclose: (reason) => {
            debugError('Subscription closed:', reason)
            this.connected.value = false
          }
        }
      )

      this.subscriptions.set(publicKey, sub)
      debug('Subscription created and stored, sub exists:', !!sub)
      
      // Diagnostic: manually query for recent events to test if relays have them
      setTimeout(async () => {
        debug('🔍 Diagnostic: Manually querying for any recent events...')
        const testEvents = await this.pool.querySync(this.relays, {
          kinds: [RAABTA_MESSAGE_KIND],
          '#p': [publicKey],
          limit: 5
        })
        debug('📊 Found', testEvents.length, 'recent events in manual query')
        if (testEvents.length > 0) {
          debug('⚠️  Events exist but subscription is not receiving them!')
          testEvents.forEach(e => {
            debug('- Event:', e.id.substring(0, 16) + '...', 'at', new Date(e.created_at * 1000).toISOString())
          })
        }
      }, 3000)
      
      setTimeout(() => {
        if (!this.connected.value) {
          debug('Connection timeout - resolving anyway')
          this.connected.value = true
          resolve(sub)
        }
      }, 5000)
    })
  }

  // Send encrypted message via nostr
  async sendMessage(dakuPrivateKey, recipientDakuPubKey, encryptedText) {
    debug('=== SENDING MESSAGE ===')
    const { privateKeyBytes, publicKey } = this.getNostrKeys(dakuPrivateKey)

    debug('My nostr pubkey:', publicKey)
    debug('Recipient daku pubkey:', recipientDakuPubKey)
    debug('Recipient daku pubkey length:', recipientDakuPubKey.length)

    // Convert recipient's daku pubkey to nostr format
    const recipientNostrPubKey = dakuToNostrPubkey(recipientDakuPubKey)

    debug('Recipient nostr pubkey:', recipientNostrPubKey)
    debug('Recipient nostr pubkey length:', recipientNostrPubKey.length)
    debug('Encrypted text length:', encryptedText.length)

    // Create nostr event
    const event = {
      kind: RAABTA_MESSAGE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', recipientNostrPubKey]
      ],
      content: encryptedText
    }

    debug('Event before signing:', JSON.stringify(event))

    // Sign and finalize
    const signedEvent = finalizeEvent(event, privateKeyBytes)

    debug('Signed event ID:', signedEvent.id)
    debug('Signed event pubkey:', signedEvent.pubkey)
    debug('Signed event sig:', signedEvent.sig?.substring(0, 20) + '...')

    // Publish to relays
    debug('Publishing to relays:', this.relays)

    const publishPromises = this.pool.publish(this.relays, signedEvent)

    const results = await Promise.allSettled(publishPromises)

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        debug(`✓ Published to ${this.relays[i]}`)
      } else {
        debugError(`✗ Failed ${this.relays[i]}:`, result.reason)
      }
    })

    const successful = results.filter(r => r.status === 'fulfilled').length
    debug(`Published to ${successful}/${this.relays.length} relays`)

    return signedEvent.id
  }

  // Fetch message history for a contact
  async fetchHistory(dakuPrivateKey, contactDakuPubKey, since = 0) {
    const { publicKey } = this.getNostrKeys(dakuPrivateKey)
    const contactNostrPubKey = dakuToNostrPubkey(contactDakuPubKey)

    const events = await this.pool.querySync(this.relays, [
      {
        kinds: [RAABTA_MESSAGE_KIND],
        authors: [contactNostrPubKey],
        '#p': [publicKey],
        since: since ? Math.floor(since / 1000) : Math.floor(Date.now() / 1000) - 86400 * 365
      },
      {
        kinds: [RAABTA_MESSAGE_KIND],
        authors: [publicKey],
        '#p': [contactNostrPubKey],
        since: since ? Math.floor(since / 1000) : Math.floor(Date.now() / 1000) - 86400 * 365
      }
    ])

    return events.map(event => ({
      from: nostrToDakuPubkey(event.pubkey),
      encryptedText: event.content,
      timestamp: event.created_at * 1000,
      eventId: event.id
    })).sort((a, b) => a.timestamp - b.timestamp)
  }

  // Add custom relay
  addRelay(url) {
    if (!this.relays.includes(url)) {
      this.relays.push(url)
    }
  }

  // Remove relay
  removeRelay(url) {
    this.relays = this.relays.filter(r => r !== url)
  }

  // Close all subscriptions
  close() {
    for (const sub of this.subscriptions.values()) {
      sub.close()
    }
    this.subscriptions.clear()
    this.pool.close(this.relays)
    this.connected.value = false
  }
}

// Singleton instance
export const nostrRelay = new NostrRelay()
export { DEFAULT_RELAYS }
