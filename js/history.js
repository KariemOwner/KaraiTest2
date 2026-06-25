/**
 * History Module - Handles conversation and message persistence
 * Manages Supabase database operations for chat history
 */

import { getSupabaseClient, getCurrentUser, isGuestUser as isGuest, getGuestSessionId } from './auth.js';

/**
 * Save conversation to database
 */
export async function saveConversation(conversationData) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn('Supabase not initialized, using local storage');
        return saveConversationLocal(conversationData);
    }

    try {
        const { data, error } = await supabase
            .from('conversations')
            .insert([conversationData])
            .select()
            .single();

        if (error) throw error;
        return data.id;
    } catch (error) {
        console.error('Failed to save conversation:', error);
        // Fallback to local storage
        return saveConversationLocal(conversationData);
    }
}

/**
 * Save conversation to local storage (fallback)
 */
function saveConversationLocal(conversationData) {
    const conversations = getConversationsLocal();
    const newConv = {
        ...conversationData,
        id: 'local_' + Date.now(),
        created_at: new Date().toISOString()
    };
    conversations.unshift(newConv);
    localStorage.setItem('karai_conversations', JSON.stringify(conversations));
    return newConv.id;
}

/**
 * Save message to database
 */
export async function saveMessage(messageData) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn('Supabase not initialized, using local storage');
        return saveMessageLocal(messageData);
    }

    try {
        const { data, error } = await supabase
            .from('messages')
            .insert([messageData])
            .select()
            .single();

        if (error) throw error;
        return data.id;
    } catch (error) {
        console.error('Failed to save message:', error);
        // Fallback to local storage
        return saveMessageLocal(messageData);
    }
}

/**
 * Save message to local storage (fallback)
 */
function saveMessageLocal(messageData) {
    const messages = getMessagesLocal();
    const newMessage = {
        ...messageData,
        id: 'local_msg_' + Date.now(),
        created_at: new Date().toISOString()
    };
    messages.push(newMessage);
    localStorage.setItem('karai_messages', JSON.stringify(messages));
    return newMessage.id;
}

/**
 * Get all conversations for current user
 */
export async function getConversations() {
    const supabase = getSupabaseClient();
    const user = getCurrentUser();
    const guestSessionId = getGuestSessionId();

    if (!supabase) {
        return getConversationsLocal();
    }

    try {
        let query = supabase
            .from('conversations')
            .select('*')
            .order('created_at', { ascending: false });

        // Filter by user or guest session
        if (user) {
            query = query.eq('user_id', user.id);
        } else if (guestSessionId) {
            query = query.eq('guest_session_id', guestSessionId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Failed to get conversations:', error);
        return getConversationsLocal();
    }
}

/**
 * Get conversations from local storage
 */
function getConversationsLocal() {
    const stored = localStorage.getItem('karai_conversations');
    return stored ? JSON.parse(stored) : [];
}

/**
 * Get messages for a specific conversation
 */
export async function loadMessages(conversationId) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return getMessagesForConversationLocal(conversationId);
    }

    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Failed to load messages:', error);
        return getMessagesForConversationLocal(conversationId);
    }
}

/**
 * Get messages for conversation from local storage
 */
function getMessagesForConversationLocal(conversationId) {
    const messages = getMessagesLocal();
    return messages.filter(m => m.conversation_id === conversationId);
}

/**
 * Get all messages from local storage
 */
function getMessagesLocal() {
    const stored = localStorage.getItem('karai_messages');
    return stored ? JSON.parse(stored) : [];
}

/**
 * Delete conversation and its messages
 */
export async function deleteConversation(conversationId) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return deleteConversationLocal(conversationId);
    }

    try {
        // Delete messages first
        await supabase
            .from('messages')
            .delete()
            .eq('conversation_id', conversationId);

        // Delete conversation
        const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('id', conversationId);

        if (error) throw error;
        
        // Also delete from local storage if exists
        deleteConversationLocal(conversationId);
        
        return true;
    } catch (error) {
        console.error('Failed to delete conversation:', error);
        return deleteConversationLocal(conversationId);
    }
}

/**
 * Delete conversation from local storage
 */
function deleteConversationLocal(conversationId) {
    // Delete conversation
    const conversations = getConversationsLocal();
    const filteredConvs = conversations.filter(c => c.id !== conversationId);
    localStorage.setItem('karai_conversations', JSON.stringify(filteredConvs));

    // Delete messages
    const messages = getMessagesLocal();
    const filteredMsgs = messages.filter(m => m.conversation_id !== conversationId);
    localStorage.setItem('karai_messages', JSON.stringify(filteredMsgs));

    return true;
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(conversationId, title) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return updateConversationTitleLocal(conversationId, title);
    }

    try {
        const { error } = await supabase
            .from('conversations')
            .update({ title })
            .eq('id', conversationId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Failed to update conversation title:', error);
        return updateConversationTitleLocal(conversationId, title);
    }
}

/**
 * Update conversation title in local storage
 */
function updateConversationTitleLocal(conversationId, title) {
    const conversations = getConversationsLocal();
    const updated = conversations.map(c => 
        c.id === conversationId ? { ...c, title } : c
    );
    localStorage.setItem('karai_conversations', JSON.stringify(updated));
    return true;
}

/**
 * Clear all local storage data
 */
export function clearLocalStorage() {
    localStorage.removeItem('karai_conversations');
    localStorage.removeItem('karai_messages');
    console.log('Local storage cleared');
}

/**
 * Export chat history as JSON
 */
export async function exportChatHistory(conversationId) {
    const messages = await loadMessages(conversationId);
    const conversation = await getConversationById(conversationId);

    const exportData = {
        conversation: conversation,
        messages: messages,
        exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `karai-chat-${conversationId}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

/**
 * Get single conversation by ID
 */
async function getConversationById(conversationId) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        const conversations = getConversationsLocal();
        return conversations.find(c => c.id === conversationId);
    }

    try {
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', conversationId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Failed to get conversation:', error);
        return null;
    }
}
