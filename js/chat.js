/**
 * Chat Module - Handles text chat functionality
 * Manages message sending, rendering, and conversation state
 */

import { getCurrentUser, isGuestUser as isGuest, getGuestSessionId } from './auth.js';
import { saveConversation, saveMessage, getConversations, loadMessages } from './history.js';

// State
let currentConversationId = null;
let isLoading = false;

// DOM Elements
let chatContainer = null;
let inputElement = null;
let sendButton = null;
let loadingIndicator = null;

/**
 * Initialize chat module
 */
export function initChat() {
    chatContainer = document.getElementById('chat-container');
    inputElement = document.getElementById('chat-input');
    sendButton = document.getElementById('send-button');
    loadingIndicator = document.getElementById('loading-indicator');

    if (!chatContainer || !inputElement || !sendButton) {
        console.error('Chat DOM elements not found');
        return;
    }

    // Event listeners
    sendButton.addEventListener('click', handleSendMessage);
    inputElement.addEventListener('keydown', handleKeyDown);

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    console.log('Chat module initialized');
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl + Enter: Send message
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (inputElement && !isLoading) {
                handleSendMessage();
            }
        }

        // Ctrl + K: Focus input
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            if (inputElement) {
                inputElement.focus();
                inputElement.select();
            }
        }

        // Ctrl + N: New chat
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            startNewChat();
        }
    });
}

/**
 * Handle keydown in input
 */
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading) {
            handleSendMessage();
        }
    }
}

/**
 * Start a new chat session
 */
export async function startNewChat() {
    currentConversationId = null;
    
    // Clear chat container
    if (chatContainer) {
        chatContainer.innerHTML = '';
    }

    // Clear input
    if (inputElement) {
        inputElement.value = '';
    }

    // Show welcome message
    showWelcomeMessage();

    // Update UI
    if (window.updateChatList) {
        await window.updateChatList();
    }

    console.log('New chat started');
}

/**
 * Show welcome message
 */
function showWelcomeMessage() {
    const welcomeMessage = {
        role: 'assistant',
        content: `Yo! Gue KarAI, temen lo yang sarkas tapi berguna. 😏\n\nMau ngobrol apa hari ini? Jangan tanya hal bodoh ya, gue gak punya kesabaran unlimited.`
    };

    renderMessage(welcomeMessage);
}

/**
 * Handle send message
 */
async function handleSendMessage() {
    const message = inputElement?.value.trim();
    
    if (!message || isLoading) return;

    // Check guest limit
    if (isGuest()) {
        const remaining = await checkGuestLimit();
        if (remaining <= 0) {
            showError('Limit harian guest udah habis! Login buat lanjut.');
            return;
        }
    }

    // Clear input
    inputElement.value = '';

    // Add user message to UI
    const userMessage = {
        role: 'user',
        content: message
    };

    renderMessage(userMessage);

    // Show loading
    setLoading(true);

    try {
        // Get or create conversation
        if (!currentConversationId) {
            currentConversationId = await createConversation(message);
        }

        // Save user message to database
        await saveMessageToDb(userMessage);

        // Send to API
        const response = await sendToAPI(message);

        // Add assistant message to UI
        const assistantMessage = {
            role: 'assistant',
            content: response
        };

        renderMessage(assistantMessage);

        // Save assistant message to database
        await saveMessageToDb(assistantMessage);

        // Update guest usage
        if (isGuest()) {
            await incrementGuestUsage();
        }

    } catch (error) {
        console.error('Chat error:', error);
        showError('Waduh, ada error nih. Coba lagi dong.');
    } finally {
        setLoading(false);
    }
}

/**
 * Create new conversation
 */
async function createConversation(firstMessage) {
    const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
    const user = getCurrentUser();
    
    const conversationData = {
        title: title,
        mode: 'chat',
        user_id: user?.id || null,
        guest_session_id: isGuest() ? getGuestSessionId() : null
    };

    const conversationId = await saveConversation(conversationData);
    currentConversationId = conversationId;

    // Update chat list in sidebar
    if (window.updateChatList) {
        await window.updateChatList();
    }

    return conversationId;
}

/**
 * Save message to database
 */
async function saveMessageToDb(message) {
    if (!currentConversationId) return;

    await saveMessage({
        conversation_id: currentConversationId,
        role: message.role,
        content: message.content
    });
}

/**
 * Send message to API
 */
async function sendToAPI(message) {
    const response = await fetch('/api/chat.js', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            conversation_id: currentConversationId,
            mode: 'chat'
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
    }

    const data = await response.json();
    return data.response;
}

/**
 * Render message to chat container
 */
export function renderMessage(message) {
    if (!chatContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    if (message.role === 'user') {
        const user = getCurrentUser();
        const avatar = user?.avatar || getInitials(user?.name || 'User');
        avatarDiv.textContent = avatar;
        avatarDiv.style.backgroundColor = '#6366f1';
    } else {
        avatarDiv.textContent = 'KA';
        avatarDiv.style.backgroundColor = '#ec4899';
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Parse markdown and render
    const parsedContent = parseMarkdown(message.content);
    contentDiv.innerHTML = parsedContent;

    // Add copy button for assistant messages
    if (message.role === 'assistant') {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copy';
        copyButton.addEventListener('click', () => copyToClipboard(message.content));

        actionsDiv.appendChild(copyButton);
        contentDiv.appendChild(actionsDiv);
    }

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Parse markdown content
 */
function parseMarkdown(text) {
    if (!text) return '';

    let html = text;

    // Escape HTML
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre class="code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show toast notification
        showToast('Copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

/**
 * Show toast notification
 */
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

/**
 * Set loading state
 */
function setLoading(loading) {
    isLoading = loading;
    
    if (loadingIndicator) {
        loadingIndicator.style.display = loading ? 'flex' : 'none';
    }

    if (inputElement) {
        inputElement.disabled = loading;
    }

    if (sendButton) {
        sendButton.disabled = loading;
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    if (chatContainer) {
        chatContainer.appendChild(errorDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

/**
 * Get initials from name
 */
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

/**
 * Check guest daily limit
 */
async function checkGuestLimit() {
    try {
        const response = await fetch('/api/chat.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check_limit', guest_session_id: getGuestSessionId() })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.remaining || 0;
        }
    } catch (e) {
        console.error('Failed to check limit:', e);
    }
    return 10; // Default fallback
}

/**
 * Increment guest usage
 */
async function incrementGuestUsage() {
    try {
        await fetch('/api/chat.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'increment_usage', 
                guest_session_id: getGuestSessionId() 
            })
        });
    } catch (e) {
        console.error('Failed to increment usage:', e);
    }
}

/**
 * Load existing conversation
 */
export async function loadConversation(conversationId) {
    try {
        currentConversationId = conversationId;
        
        // Clear current chat
        if (chatContainer) {
            chatContainer.innerHTML = '';
        }

        // Load messages from database
        const messages = await loadMessages(conversationId);

        // Render messages
        messages.forEach(msg => {
            renderMessage({
                role: msg.role,
                content: msg.content
            });
        });

        console.log('Conversation loaded:', conversationId);
    } catch (error) {
        console.error('Failed to load conversation:', error);
        showError('Gagal load chat history.');
    }
}

/**
 * Get current conversation ID
 */
export function getCurrentConversationId() {
    return currentConversationId;
}
