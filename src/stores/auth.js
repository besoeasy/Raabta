import { defineStore } from 'pinia'
import { ref } from 'vue'
import { generateKeyPair, getPublicKey, getUsername, createAuth } from 'daku'
import { db } from '../db'

export const useAuthStore = defineStore('auth', () => {
  const privateKey = ref(null)
  const publicKey = ref(null)
  const username = ref(null)
  const isAuthenticated = ref(false)

  // Load identity from IndexedDB on init
  const init = async () => {
    try {
      const identity = await db.identity.get('current')
      if (identity) {
        privateKey.value = identity.privateKey
        publicKey.value = identity.publicKey
        username.value = identity.username
        isAuthenticated.value = true
      }
    } catch (error) {
      console.error('Failed to load identity:', error)
    }
  }

  // Generate new keypair (first time users)
  const generateNewIdentity = async () => {
    const keys = generateKeyPair()
    const name = getUsername(keys.publicKey)
    
    privateKey.value = keys.privateKey
    publicKey.value = keys.publicKey
    username.value = name
    isAuthenticated.value = true
    
    // Save to IndexedDB
    await db.identity.put({
      id: 'current',
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      username: name,
      createdAt: Date.now()
    })
    
    return { username: name, publicKey: keys.publicKey }
  }

  // Import existing key
  const importIdentity = async (key) => {
    try {
      const pubKey = getPublicKey(key)
      const name = getUsername(pubKey)
      
      privateKey.value = key
      publicKey.value = pubKey
      username.value = name
      isAuthenticated.value = true
      
      // Save to IndexedDB
      await db.identity.put({
        id: 'current',
        privateKey: key,
        publicKey: pubKey,
        username: name,
        createdAt: Date.now()
      })
      
      return true
    } catch (error) {
      console.error('Invalid private key:', error)
      return false
    }
  }

  // Create auth token (for server auth if needed)
  const createAuthToken = async () => {
    if (!privateKey.value) return null
    return await createAuth(privateKey.value)
  }

  // Logout - clears identity
  const logout = async () => {
    privateKey.value = null
    publicKey.value = null
    username.value = null
    isAuthenticated.value = false
    
    await db.identity.delete('current')
  }

  // Export private key (for backup)
  const exportPrivateKey = () => {
    return privateKey.value
  }

  return {
    privateKey,
    publicKey,
    username,
    isAuthenticated,
    init,
    generateNewIdentity,
    importIdentity,
    createAuthToken,
    logout,
    exportPrivateKey
  }
})
