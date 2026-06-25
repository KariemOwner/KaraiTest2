/**
 * KARAI v2 - Authentication Module
 * Sarkas tapi Berguna
 *
 * Handles:
 * - Supabase Auth initialization
 * - Google OAuth login
 * - Guest mode
 * - User session management
 */

import {
    saveToStorage,
    getFromStorage,
    removeFromStorage,
    generateGuestId,
    showToast,
    log
} from './utils.js';
import { isSupabaseConfigured, getSupabaseUrl, getSupabaseAnonKey } from './config.js';

// ============================================
// CONFIGURATION
// ============================================

// Get config from config module
const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

// ============================================
// STATE
// ============================================

let supabase = null;
let currentUser = null;
let isGuest = false;
let guestSessionId = null;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize Supabase client
 */
export function initSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('Supabase credentials not configured. Using mock mode.');
        return null;
    }

    try {
        // Check if Supabase library is loaded from CDN
        if (!window.supabase || !window.supabase.createClient) {
            console.error('Supabase library not loaded from CDN');
            return null;
        }
        
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        log('Supabase initialized');
        return supabase;
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        return null;
    }
}

/**
 * Initialize authentication system
 */
export async function initAuth() {
    log('Initializing auth...');

    // Initialize Supabase if not already done
    if (!supabase) {
        initSupabase();
    }

    // Load existing session
    await loadUserFromStorage();

    // Setup auth state listener
    onAuthStateChange((event, session) => {
        handleAuthStateChange(event, session);
    });

    log('Auth initialized');
}

/**
 * Handle auth state changes
 */
function handleAuthStateChange(event, session) {
    switch (event) {
        case 'SIGNED_IN':
            currentUser = session.user;
            isGuest = false;
            saveToStorage('karai_user', currentUser);
            log('User signed in:', currentUser.email);
            break;

        case 'SIGNED_OUT':
            currentUser = null;
            isGuest = false;
            removeFromStorage('karai_user');
            log('User signed out');
            break;

        case 'TOKEN_REFRESHED':
            if (session) {
                currentUser = session.user;
                saveToStorage('karai_user', currentUser);
            }
            break;

        default:
            log('Auth event:', event);
    }
}

// ============================================
// AUTH STATE MANAGEMENT
// ============================================

/**
 * Get current user
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    return currentUser !== null;
}

/**
 * Check if user is guest
 */
export function isGuestUser() {
    return isGuest;
}

/**
 * Get user ID
 */
export function getUserId() {
    if (currentUser) {
        return currentUser.id;
    }
    if (isGuest && guestSessionId) {
        return guestSessionId;
    }
    return null;
}

/**
 * Get user tier
 */
export function getUserTier() {
    if (currentUser) {
        return currentUser.tier || 'free';
    }
    return 'guest';
}

/**
 * Get guest session ID
 */
export function getGuestSessionId() {
    return guestSessionId;
}

/**
 * Get Supabase client instance
 */
export function getSupabaseClient() {
    return supabase;
}

// ============================================
// GOOGLE OAUTH LOGIN
// ============================================

/**
 * Login with Google OAuth
 */
export async function loginWithGoogle() {
    try {
        if (!supabase) {
            // Mock mode for development without Supabase
            log('Mock Google login (no Supabase)');
            const mockUser = {
                id: generateGuestId(),
                email: 'user@example.com',
                name: 'Demo User',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
                tier: 'free'
            };
            setCurrentUser(mockUser, false);
            return { user: mockUser, error: null };
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });

        if (error) throw error;

        log('Google OAuth initiated');
        return { data, error: null };
    } catch (error) {
        console.error('Google login failed:', error);
        showToast('Login gagal: ' + error.message, 'error');
        return { data: null, error };
    }
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback() {
    try {
        if (!supabase) return null;

        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');

        if (accessToken) {
            const { data: { user }, error } = await supabase.auth.getUser();

            if (error) throw error;

            if (user) {
                // Get or create user profile
                const userProfile = await getOrCreateUserProfile(user);
                setCurrentUser(userProfile, false);

                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);

                log('OAuth callback successful');
                return userProfile;
            }
        }

        return null;
    } catch (error) {
        console.error('OAuth callback failed:', error);
        showToast('Login callback gagal', 'error');
        return null;
    }
}

/**
 * Get or create user profile in database
 */
async function getOrCreateUserProfile(authUser) {
    try {
        if (!supabase) return null;

        // Try to get existing user
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

        if (existingUser) {
            return existingUser;
        }

        // Create new user
        const newUser = {
            id: authUser.id,
            email: authUser.email,
            name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            avatar: authUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authUser.id}`,
            tier: 'free'
        };

        const { data: createdUser, error: createError } = await supabase
            .from('users')
            .insert([newUser])
            .select()
            .single();

        if (createError) throw createError;

        return createdUser;
    } catch (error) {
        console.error('Failed to get/create user profile:', error);
        // Return minimal user object
        return {
            id: authUser.id,
            email: authUser.email,
            name: 'User',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${authUser.id}`,
            tier: 'free'
        };
    }
}

// ============================================
// GUEST MODE
// ============================================

/**
 * Login as guest
 */
export async function loginAsGuest() {
    try {
        // Generate or retrieve guest session ID
        let sessionId = getFromStorage('karai_guest_id');

        if (!sessionId) {
            sessionId = generateGuestId();
            saveToStorage('karai_guest_id', sessionId);
        }

        guestSessionId = sessionId;
        isGuest = true;

        const guestUser = {
            id: sessionId,
            email: null,
            name: 'Guest User',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
            tier: 'guest',
            isGuest: true
        };

        setCurrentUser(guestUser, true);

        // Track guest session in database if Supabase is available
        if (supabase) {
            await trackGuestSession(sessionId);
        }

        log('Guest login successful');
        showToast('Mode tamu aktif (50 pesan/hari)', 'info');

        return { user: guestUser, error: null };
    } catch (error) {
        console.error('Guest login failed:', error);
        showToast('Gagal masuk sebagai tamu', 'error');
        return { user: null, error };
    }
}

/**
 * Track guest session in database
 */
async function trackGuestSession(sessionId) {
    try {
        if (!supabase) return;

        const today = new Date().toISOString().split('T')[0];

        const { error } = await supabase
            .from('guest_sessions')
            .upsert({
                session_id: sessionId,
                ip_address: null, // Would need backend to get real IP
                user_agent: navigator.userAgent,
                message_count: 0,
                daily_limit: 50,
                last_active: new Date().toISOString()
            }, {
                onConflict: 'session_id'
            });

        if (error) throw error;

        log('Guest session tracked');
    } catch (error) {
        console.error('Failed to track guest session:', error);
    }
}

/**
 * Check guest daily limit
 */
export async function checkGuestLimit() {
    if (!isGuest) {
        return { allowed: true, remaining: Infinity, limit: Infinity };
    }

    try {
        if (!supabase) {
            // Mock check
            const stored = getFromStorage('karai_guest_usage');
            const today = new Date().toISOString().split('T')[0];

            if (!stored || stored.date !== today) {
                return { allowed: true, remaining: 50, limit: 50 };
            }

            const remaining = 50 - stored.count;
            return {
                allowed: remaining > 0,
                remaining: Math.max(0, remaining),
                limit: 50
            };
        }

        const { data, error } = await supabase.rpc('check_guest_limit', {
            p_session_id: guestSessionId
        });

        if (error) throw error;

        if (data && data.length > 0) {
            return data[0];
        }

        return { allowed: true, remaining: 50, limit: 50 };
    } catch (error) {
        console.error('Failed to check guest limit:', error);
        return { allowed: true, remaining: 50, limit: 50 };
    }
}

/**
 * Increment guest message count
 */
export async function incrementGuestMessageCount() {
    if (!isGuest) return;

    try {
        const today = new Date().toISOString().split('T')[0];

        if (!supabase) {
            // Local storage tracking
            const stored = getFromStorage('karai_guest_usage');
            const count = (stored && stored.date === today) ? stored.count + 1 : 1;
            saveToStorage('karai_guest_usage', { date: today, count });
            return count;
        }

        const { error } = await supabase.rpc('increment_guest_count', {
            p_session_id: guestSessionId
        });

        if (error) throw error;

        log('Guest message count incremented');
    } catch (error) {
        console.error('Failed to increment guest count:', error);
    }
}

// ============================================
// USER SESSION MANAGEMENT
// ============================================

/**
 * Set current user
 */
function setCurrentUser(user, guest) {
    currentUser = user;
    isGuest = guest;

    if (user && !guest) {
        saveToStorage('karai_user', user);
    }

    // Update UI
    updateUserUI(user);
}

/**
 * Load user from storage
 */
export async function loadUserFromStorage() {
    try {
        // Check for OAuth callback first
        if (window.location.hash.includes('access_token')) {
            const user = await handleOAuthCallback();
            if (user) return user;
        }

        // Try to load from storage
        const storedUser = getFromStorage('karai_user');
        if (storedUser) {
            currentUser = storedUser;
            isGuest = false;
            updateUserUI(storedUser);
            log('User loaded from storage');
            return storedUser;
        }

        // Check for guest session
        const guestId = getFromStorage('karai_guest_id');
        if (guestId) {
            return await loginAsGuest();
        }

        return null;
    } catch (error) {
        console.error('Failed to load user from storage:', error);
        return null;
    }
}

/**
 * Update user UI elements
 */
function updateUserUI(user) {
    if (!user) return;

    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    const tierEl = document.getElementById('user-tier');

    if (avatarEl) {
        avatarEl.src = user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default';
        avatarEl.alt = user.name || 'User';
    }

    if (nameEl) {
        nameEl.textContent = user.name || 'User';
    }

    if (tierEl) {
        tierEl.textContent = user.tier === 'guest' ? 'Tamu' : (user.tier || 'Free');
    }
}

// ============================================
// LOGOUT
// ============================================

/**
 * Logout user
 */
export async function logout() {
    try {
        if (supabase && !isGuest) {
            await supabase.auth.signOut();
        }

        // Clear local state
        currentUser = null;
        isGuest = false;
        guestSessionId = null;

        // Clear storage
        removeFromStorage('karai_user');
        removeFromStorage('karai_guest_id');
        removeFromStorage('karai_guest_usage');

        // Reset UI
        const avatarEl = document.getElementById('user-avatar');
        const nameEl = document.getElementById('user-name');
        const tierEl = document.getElementById('user-tier');

        if (avatarEl) avatarEl.src = '';
        if (nameEl) nameEl.textContent = 'User';
        if (tierEl) tierEl.textContent = 'Free';

        log('User logged out');
        showToast('Berhasil logout', 'success');

        return { success: true };
    } catch (error) {
        console.error('Logout failed:', error);
        showToast('Logout gagal', 'error');
        return { success: false, error };
    }
}

// ============================================
// AUTO-REFRESH SESSION
// ============================================

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(callback) {
    if (!supabase) return;

    supabase.auth.onAuthStateChange((event, session) => {
        log('Auth state changed:', event);

        switch (event) {
            case 'SIGNED_IN':
                getOrCreateUserProfile(session.user).then(user => {
                    setCurrentUser(user, false);
                    callback(user);
                });
                break;

            case 'SIGNED_OUT':
                currentUser = null;
                isGuest = false;
                callback(null);
                break;

            case 'TOKEN_REFRESHED':
                // Session refreshed, no action needed
                break;

            default:
                log('Unknown auth event:', event);
        }
    });
}

// ============================================
// EXPORT ALL PUBLIC FUNCTIONS
// ============================================

export default {
    initSupabase,
    getCurrentUser,
    isAuthenticated,
    isGuestUser,
    getUserId,
    getUserTier,
    loginWithGoogle,
    handleOAuthCallback,
    loginAsGuest,
    checkGuestLimit,
    incrementGuestMessageCount,
    loadUserFromStorage,
    logout,
    onAuthStateChange
};
