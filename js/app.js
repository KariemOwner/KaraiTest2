/**
 * Main Application Entry Point
 * Initializes all modules and handles app lifecycle
 */

import { initAuth, getCurrentUser, isGuestUser as isGuest, logout, getGuestSessionId } from './auth.js';
import { initChat, startNewChat, loadConversation, getCurrentConversationId } from './chat.js';
import { getConversations, deleteConversation } from './history.js';

// State
let currentMode = 'chat'; // chat, voice, coding

/**
 * Initialize the application
 */
export async function initApp() {
    console.log('Initializing KarAI v2...');

    // Initialize auth first
    await initAuth();

    // Check if user is authenticated or guest
    const user = getCurrentUser();
    const guest = isGuest();

    if (!user && !guest) {
        // Show login screen
        showLoginScreen();
        setupLoginListeners();
        return;
    }

    // Show main app
    showMainApp();

    // Initialize chat module
    initChat();

    // Load chat history
    await loadChatHistory();

    // Setup event listeners
    setupEventListeners();

    console.log('KarAI v2 initialized successfully');
}

/**
 * Setup login page event listeners
 */
function setupLoginListeners() {
    // Google login button
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
    }

    // Guest login button
    const guestLoginBtn = document.getElementById('guest-login-btn');
    if (guestLoginBtn) {
        guestLoginBtn.addEventListener('click', handleGuestLogin);
    }
}

/**
 * Handle Google login
 */
async function handleGoogleLogin() {
    const { loginWithGoogle } = await import('./auth.js');
    await loginWithGoogle();
}

/**
 * Handle guest login
 */
async function handleGuestLogin() {
    const { loginAsGuest } = await import('./auth.js');
    const result = await loginAsGuest();
    if (result && !result.error) {
        window.location.reload();
    }
}

/**
 * Show login screen
 */
function showLoginScreen() {
    const appContainer = document.getElementById('app-container');
    const loginPage = document.getElementById('login-page');

    if (appContainer) appContainer.classList.add('hidden');
    if (loginPage) loginPage.classList.remove('hidden');
}

/**
 * Show main application
 */
function showMainApp() {
    const appContainer = document.getElementById('app-container');
    const loginPage = document.getElementById('login-page');

    if (appContainer) appContainer.classList.remove('hidden');
    if (loginPage) loginPage.classList.add('hidden');
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
    // New chat button
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            startNewChat();
        });
    }

    // Mode switch buttons
    setupModeSwitch();

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

/**
 * Setup mode switching
 */
function setupModeSwitch() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.dataset.mode;
            switchMode(mode);
        });
    });
}

/**
 * Switch between modes
 */
function switchMode(mode) {
    currentMode = mode;

    // Update active state on buttons
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // For now, only chat mode is implemented
    if (mode !== 'chat') {
        showComingSoon(mode);
    }
}

/**
 * Show coming soon message for unimplemented modes
 */
function showComingSoon(mode) {
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) return;

    const modeNames = {
        'voice': 'Voice Mode',
        'coding': 'Coding Mode'
    };

    chatContainer.innerHTML = `
        <div class="coming-soon">
            <div class="coming-soon-icon">🚧</div>
            <h3>${modeNames[mode] || mode} Coming Soon</h3>
            <p>Fitur ini masih dalam pengembangan. Balik ke Chat mode dulu ya!</p>
            <button onclick="document.querySelector('[data-mode=chat]').click()">Back to Chat</button>
        </div>
    `;
}

/**
 * Handle logout
 */
async function handleLogout() {
    await logout();
    window.location.reload();
}

/**
 * Load chat history into sidebar
 */
async function loadChatHistory() {
    try {
        const conversations = await getConversations();
        renderChatList(conversations);
        
        // Make updateChatList available globally for chat.js
        window.updateChatList = updateChatList;
        
    } catch (error) {
        console.error('Failed to load chat history:', error);
    }
}

/**
 * Update chat list (called from chat.js)
 */
async function updateChatList() {
    try {
        const conversations = await getConversations();
        renderChatList(conversations);
    } catch (error) {
        console.error('Failed to update chat list:', error);
    }
}

/**
 * Render chat list in sidebar
 */
function renderChatList(conversations) {
    const chatList = document.getElementById('chat-history-list');
    if (!chatList) return;

    chatList.innerHTML = '';

    if (!conversations || conversations.length === 0) {
        chatList.innerHTML = `
            <div class="empty-state">
                <p>Belum ada chat history</p>
                <small>Start new chat untuk mulai</small>
            </div>
        `;
        return;
    }

    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'chat-history-item';
        item.dataset.conversationId = conv.id;

        const title = conv.title || 'Untitled Chat';
        const mode = conv.mode || 'chat';
        const date = new Date(conv.created_at).toLocaleDateString('id-ID');

        item.innerHTML = `
            <div class="chat-item-content">
                <span class="chat-item-title">${escapeHtml(title)}</span>
                <span class="chat-item-meta">${getModeIcon(mode)} ${date}</span>
            </div>
            <button class="delete-chat-btn" title="Delete chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
            </button>
        `;

        // Click to load conversation
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-chat-btn')) {
                loadConversation(conv.id);
            }
        });

        // Delete button
        const deleteBtn = item.querySelector('.delete-chat-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteConversation(conv.id);
        });

        chatList.appendChild(item);
    });
}

/**
 * Handle delete conversation
 */
async function handleDeleteConversation(conversationId) {
    if (!confirm('Yakin mau hapus chat ini?')) return;

    try {
        await deleteConversation(conversationId);
        await updateChatList();
        
        // If current conversation is deleted, start new chat
        const currentConvId = getCurrentConversationId();
        if (currentConvId === conversationId) {
            startNewChat();
        }
    } catch (error) {
        console.error('Failed to delete conversation:', error);
        alert('Gagal hapus chat. Coba lagi.');
    }
}

/**
 * Get mode icon
 */
function getModeIcon(mode) {
    const icons = {
        'chat': '💬',
        'voice': '🎤',
        'coding': '💻'
    };
    return icons[mode] || '💬';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update user info in UI
 */
export function updateUserUI() {
    const user = getCurrentUser();
    const userName = document.getElementById('user-name');
    const userTier = document.getElementById('user-tier');
    const userAvatar = document.getElementById('user-avatar');

    if (user) {
        // Logged in user
        if (userName) userName.textContent = user.name || 'User';
        if (userTier) userTier.textContent = user.tier === 'guest' ? 'Tamu' : (user.tier || 'Free');
        if (userAvatar && user.avatar) {
            userAvatar.src = user.avatar;
        } else if (userAvatar) {
            userAvatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || 'user'}`;
        }
    }
}

/**
 * Get initials from name
 */
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

/**
 * Get current mode
 */
export function getCurrentMode() {
    return currentMode;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
