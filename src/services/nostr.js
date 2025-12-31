import { SimplePool, finalizeEvent, getPublicKey } from 'nostr-tools'
import { hexToBytes } from '@noble/hashes/utils'
import { ref } from 'vue'

// Default public relays
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social'
]

// Custom event kind for Raabta encrypted messages
const RAABTA_MESSAGE_KIND = 14141

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
  }

  // Convert daku hex private key to nostr format
  getNostrKeys(dakuPrivateKey) {
    const privateKeyBytes = hexToBytes(dakuPrivateKey)
    const publicKey = getPublicKey(privateKeyBytes) // Returns 64-char nostr format
    return { privateKeyBytes, publicKey }
  }

  // Subscribe to messages for a public key
  async subscribe(dakuPrivateKey, onMessage) {
    const { privateKeyBytes, publicKey } = this.getNostrKeys(dakuPrivateKey)
    
    console.log('Subscribing with nostr pubkey:', publicKey)
    
    // Subscribe to messages tagged with our public key
    const sub = this.pool.subscribeMany(
      this.relays,
      [
        {
          kinds: [RAABTA_MESSAGE_KIND],
          '#p': [publicKey], // Messages addressed to us (64-char nostr format)
          since: Math.floor(Date.now() / 1000) - 86400 * 7 // Last 7 days
        }
      ],
      {
        onevent: (event) => {
          // Parse the encrypted message
          try {
            const senderNostrPubKey = event.pubkey
            const encryptedContent = event.content
            const timestamp = event.created_at * 1000
            
            // Convert sender's nostr pubkey back to daku format for decryption
            const senderDakuPubKey = nostrToDakuPubkey(senderNostrPubKey)
            
            console.log('Received message from nostr pubkey:', senderNostrPubKey)
            console.log('Converted to daku pubkey:', senderDakuPubKey)
            
            onMessage({
              from: senderDakuPubKey, // Return daku format for local storage
              nostrPubKey: senderNostrPubKey,
              encryptedText: encryptedContent,
              timestamp,
              eventId: event.id
            })
          } catch (error) {
            console.error('Failed to parse nostr event:', error)
          }
        },
        oneose: () => {
          console.log('Subscription caught up with relay')
          this.connected.value = true
        }
      }
    )

    this.subscriptions.set(publicKey, sub)
    return sub
  }

  // Send encrypted message via nostr
  async sendMessage(dakuPrivateKey, recipientDakuPubKey, encryptedText) {
    const { privateKeyBytes, publicKey } = this.getNostrKeys(dakuPrivateKey)
    
    // Convert recipient's daku pubkey to nostr format
    const recipientNostrPubKey = dakuToNostrPubkey(recipientDakuPubKey)
    
    console.log('Sending to daku pubkey:', recipientDakuPubKey)
    console.log('Converted to nostr pubkey:', recipientNostrPubKey)

    // Create nostr event
    const event = {
      kind: RAABTA_MESSAGE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', recipientNostrPubKey] // Tag recipient with 64-char nostr format
      ],
      content: encryptedText
    }

    // Sign and finalize
    const signedEvent = finalizeEvent(event, privateKeyBytes)
    
    console.log('Publishing event:', signedEvent.id)

    // Publish to relays
    const results = await Promise.allSettled(
      this.pool.publish(this.relays, signedEvent)
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    console.log(`Message published to ${successful}/${this.relays.length} relays`)

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
