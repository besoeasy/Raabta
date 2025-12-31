/**
 * FileDrop Service - Encrypted file sharing
 * 
 * Files are encrypted using the same shared secret used for messages,
 * ensuring only the intended recipient can decrypt them.
 */

const DEFAULT_FILEDROP_SERVER = 'https://filedrop.besoeasy.com'

// Get current filedrop server from localStorage or use default
export function getFiledropServer() {
  return localStorage.getItem('filedropServer') || DEFAULT_FILEDROP_SERVER
}

// Set custom filedrop server
export function setFiledropServer(server) {
  if (server && server.trim()) {
    // Remove trailing slash
    const url = server.trim().replace(/\/$/, '')
    localStorage.setItem('filedropServer', url)
    return url
  }
  localStorage.removeItem('filedropServer')
  return DEFAULT_FILEDROP_SERVER
}

// Get list of saved filedrop servers
export function getSavedServers() {
  const saved = localStorage.getItem('filedropServers')
  const servers = saved ? JSON.parse(saved) : []
  // Always include default
  if (!servers.includes(DEFAULT_FILEDROP_SERVER)) {
    servers.unshift(DEFAULT_FILEDROP_SERVER)
  }
  return servers
}

// Add a new server to saved list
export function addSavedServer(server) {
  if (!server || !server.trim()) return
  const url = server.trim().replace(/\/$/, '')
  const servers = getSavedServers()
  if (!servers.includes(url)) {
    servers.push(url)
    localStorage.setItem('filedropServers', JSON.stringify(servers))
  }
}

// Remove a server from saved list (can't remove default)
export function removeSavedServer(server) {
  if (server === DEFAULT_FILEDROP_SERVER) return
  const servers = getSavedServers().filter(s => s !== server)
  localStorage.setItem('filedropServers', JSON.stringify(servers))
}

/**
 * Encrypt a file using AES-256-GCM with the shared secret
 * @param {File} file - The file to encrypt
 * @param {string} sharedSecret - The hex-encoded shared secret
 * @returns {Promise<{encryptedBlob: Blob, iv: string, originalName: string, mimeType: string}>}
 */
export async function encryptFile(file, sharedSecret) {
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()
  
  // Convert hex shared secret to CryptoKey
  const keyBytes = hexToBytes(sharedSecret)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Encrypt the file
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    arrayBuffer
  )
  
  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
    iv: bytesToHex(iv),
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size
  }
}

/**
 * Decrypt a file using AES-256-GCM with the shared secret
 * @param {ArrayBuffer} encryptedData - The encrypted file data
 * @param {string} sharedSecret - The hex-encoded shared secret
 * @param {string} iv - The hex-encoded IV
 * @param {string} mimeType - The original MIME type
 * @returns {Promise<Blob>}
 */
export async function decryptFile(encryptedData, sharedSecret, iv, mimeType) {
  // Convert hex shared secret to CryptoKey
  const keyBytes = hexToBytes(sharedSecret)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  // Convert hex IV to bytes
  const ivBytes = hexToBytes(iv)
  
  // Decrypt the file
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    cryptoKey,
    encryptedData
  )
  
  return new Blob([decryptedBuffer], { type: mimeType })
}

/**
 * Upload an encrypted file to filedrop server
 * @param {Blob} encryptedBlob - The encrypted file blob
 * @param {string} filename - Optional filename (will be random for privacy)
 * @returns {Promise<string>} - The download URL
 */
export async function uploadToFiledrop(encryptedBlob) {
  const server = getFiledropServer()
  
  // Create form data
  const formData = new FormData()
  // Use a random filename for privacy
  const randomName = crypto.randomUUID() + '.enc'
  formData.append('file', encryptedBlob, randomName)
  
  // Upload to server
  const response = await fetch(`${server}/upload`, {
    method: 'POST',
    body: formData
  })
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }
  
  const result = await response.text()
  
  // Parse response - could be JSON or plain URL
  try {
    const json = JSON.parse(result)
    return json.url || json.link || json.download || result.trim()
  } catch {
    return result.trim()
  }
}

/**
 * Download encrypted file from URL
 * @param {string} url - The file URL
 * @returns {Promise<ArrayBuffer>}
 */
export async function downloadFromFiledrop(url) {
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }
  
  return await response.arrayBuffer()
}

/**
 * Complete flow: Encrypt and upload a file
 * @param {File} file - The file to send
 * @param {string} sharedSecret - The shared secret with recipient
 * @returns {Promise<{url: string, iv: string, originalName: string, mimeType: string, size: number}>}
 */
export async function encryptAndUpload(file, sharedSecret) {
  console.log('[FILEDROP] Encrypting file:', file.name, 'size:', file.size)
  
  // Encrypt the file
  const { encryptedBlob, iv, originalName, mimeType, size } = await encryptFile(file, sharedSecret)
  
  console.log('[FILEDROP] Encrypted, uploading to:', getFiledropServer())
  
  // Upload to server
  const url = await uploadToFiledrop(encryptedBlob)
  
  console.log('[FILEDROP] Upload complete:', url)
  
  return {
    url,
    iv,
    originalName,
    mimeType,
    size
  }
}

/**
 * Complete flow: Download and decrypt a file
 * @param {string} url - The file URL
 * @param {string} sharedSecret - The shared secret
 * @param {string} iv - The IV used for encryption
 * @param {string} mimeType - The original MIME type
 * @returns {Promise<Blob>}
 */
export async function downloadAndDecrypt(url, sharedSecret, iv, mimeType) {
  console.log('[FILEDROP] Downloading from:', url)
  
  // Download encrypted file
  const encryptedData = await downloadFromFiledrop(url)
  
  console.log('[FILEDROP] Downloaded, decrypting...')
  
  // Decrypt
  const decryptedBlob = await decryptFile(encryptedData, sharedSecret, iv, mimeType)
  
  console.log('[FILEDROP] Decrypted successfully')
  
  return decryptedBlob
}

// Helper: Convert hex string to Uint8Array
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

// Helper: Convert Uint8Array to hex string
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Helper: Check if a message contains file attachment
export function hasFileAttachment(message) {
  return message.file && message.file.url
}

// Helper: Check if file is an image
export function isImageFile(mimeType) {
  return mimeType && mimeType.startsWith('image/')
}

// Helper: Check if file is a video
export function isVideoFile(mimeType) {
  return mimeType && mimeType.startsWith('video/')
}

// Helper: Check if file is audio
export function isAudioFile(mimeType) {
  return mimeType && mimeType.startsWith('audio/')
}

// Helper: Format file size
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}
