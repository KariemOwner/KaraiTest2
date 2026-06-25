/**
 * KARAI v2 - Utility Functions
 * Sarkas tapi Berguna
 */

// ============================================
// CONSTANTS
// ============================================
export const CONSTANTS = {
    GUEST_DAILY_LIMIT: 50,
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    MODES: {
        CHAT: 'chat',
        VOICE: 'voice',
        CODING: 'coding'
    },
    STORAGE_KEYS: {
        USER: 'karai_user',
        SESSION: 'karai_session',
        CURRENT_CONVERSATION: 'karai_current_conversation',
        GUEST_ID: 'karai_guest_id'
    }
};

// ============================================
// DOM UTILITIES
// ============================================

/**
 * Get element by ID with type safety
 */
export function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id "${id}" not found`);
    }
    return element;
}

/**
 * Create element with attributes
 */
export function createElement(tag, className = '', attributes = {}) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    
    return element;
}

/**
 * Show element
 */
export function showElement(element) {
    if (element) {
        element.classList.remove('hidden');
    }
}

/**
 * Hide element
 */
export function hideElement(element) {
    if (element) {
        element.classList.add('hidden');
    }
}

/**
 * Toggle element visibility
 */
export function toggleElement(element, force) {
    if (element) {
        if (force !== undefined) {
            element.classList.toggle('hidden', !force);
        } else {
            element.classList.toggle('hidden');
        }
    }
}

// ============================================
// STORAGE UTILITIES
// ============================================

/**
 * Save data to localStorage
 */
export function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
}

/**
 * Get data from localStorage
 */
export function getFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

/**
 * Remove data from localStorage
 */
export function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Error removing from localStorage:', error);
        return false;
    }
}

/**
 * Clear all KarAI storage
 */
export function clearKarAIStorage() {
    Object.values(CONSTANTS.STORAGE_KEYS).forEach(key => {
        removeFromStorage(key);
    });
}

// ============================================
// DATE/TIME UTILITIES
// ============================================

/**
 * Format date to readable string
 */
export function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    return new Date(date).toLocaleDateString('id-ID', mergedOptions);
}

/**
 * Format time ago
 */
export function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = [
        { label: 'tahun', seconds: 31536000 },
        { label: 'bulan', seconds: 2592000 },
        { label: 'hari', seconds: 86400 },
        { label: 'jam', seconds: 3600 },
        { label: 'menit', seconds: 60 },
        { label: 'detik', seconds: 1 }
    ];
    
    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label} yang lalu`;
        }
    }
    
    return 'Baru saja';
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Truncate text with ellipsis
 */
export function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Generate unique ID
 */
export function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Generate guest session ID
 */
export function generateGuestId() {
    return `guest_${Date.now()}_${generateId().substring(0, 8)}`;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// IMAGE UTILITIES
// ============================================

/**
 * Validate image file
 */
export function validateImageFile(file) {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }
    
    if (!CONSTANTS.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        return { 
            valid: false, 
            error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP' 
        };
    }
    
    if (file.size > CONSTANTS.MAX_IMAGE_SIZE) {
        return { 
            valid: false, 
            error: 'Image too large. Max size is 5MB' 
        };
    }
    
    return { valid: true };
}

/**
 * Convert file to base64
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/**
 * Resize image
 */
export function resizeImage(file, maxWidth = 800, maxHeight = 600) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL(file.type, 0.8));
        };
        
        img.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

// ============================================
// API UTILITIES
// ============================================

/**
 * Make API request
 */
export async function apiRequest(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {}),
        },
    };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({
                message: 'Request failed'
            }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// ============================================
// DEBOUNCE/THROTTLE
// ============================================

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================
// MARKDOWN UTILITIES
// ============================================

/**
 * Render markdown to HTML using marked library
 */
export function renderMarkdown(text) {
    if (typeof marked === 'undefined') {
        console.warn('Marked library not loaded');
        return escapeHtml(text);
    }
    
    return marked.parse(text, {
        breaks: true,
        gfm: true,
    });
}

// ============================================
// NOTIFICATION UTILITIES
// ============================================

/**
 * Show toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toast = createElement('div', 'toast', {
        'data-type': type
    });
    toast.textContent = message;
    
    // Add styles inline for simplicity
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-primary);
        font-size: 14px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    // Type-specific colors
    const colors = {
        info: 'var(--accent-primary)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)'
    };
    
    toast.style.borderColor = colors[type] || colors.info;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

/**
 * Check if modifier key is pressed
 */
export function isModifierPressed(event, key = 'ctrl') {
    if (key === 'ctrl') {
        return event.ctrlKey || event.metaKey;
    }
    if (key === 'shift') {
        return event.shiftKey;
    }
    if (key === 'alt') {
        return event.altKey;
    }
    return false;
}

/**
 * Register keyboard shortcut
 */
export function registerShortcut(key, modifier, callback) {
    document.addEventListener('keydown', (event) => {
        if (isModifierPressed(event, modifier) && event.key.toLowerCase() === key.toLowerCase()) {
            event.preventDefault();
            callback(event);
        }
    });
}

// ============================================
// MISC UTILITIES
// ============================================

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy:', error);
        return false;
    }
}

/**
 * Download file
 */
export function downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Check if user is online
 */
export function isOnline() {
    return navigator.onLine;
}

/**
 * Log with timestamp
 */
export function log(...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}]`, ...args);
}
