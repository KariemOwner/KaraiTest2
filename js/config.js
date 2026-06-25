/**
 * KARAI v2 - Configuration Module
 * Sarkas tapi Berguna
 * 
 * Centralized configuration for environment variables
 */

// ============================================
// CONFIGURATION OBJECT
// ============================================

export const config = {
    // Supabase Configuration
    supabase: {
        url: window.KARAI_CONFIG?.SUPABASE_URL || '',
        anonKey: window.KARAI_CONFIG?.SUPABASE_ANON_KEY || ''
    },
    
    // API Configuration
    api: {
        baseUrl: '/api'
    },
    
    // Feature Flags
    features: {
        enableGuestMode: true,
        guestDailyLimit: 50,
        enableVoiceMode: false, // Disabled for now
        enableCodingMode: false  // Disabled for now
    },
    
    // UI Configuration
    ui: {
        maxImageSize: 5 * 1024 * 1024, // 5MB
        supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get Supabase URL
 */
export function getSupabaseUrl() {
    return config.supabase.url;
}

/**
 * Get Supabase Anon Key
 */
export function getSupabaseAnonKey() {
    return config.supabase.anonKey;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured() {
    return !!(config.supabase.url && config.supabase.anonKey);
}

/**
 * Get API base URL
 */
export function getApiBaseUrl() {
    return config.api.baseUrl;
}

/**
 * Get guest daily limit
 */
export function getGuestDailyLimit() {
    return config.features.guestDailyLimit;
}

/**
 * Check if guest mode is enabled
 */
export function isGuestModeEnabled() {
    return config.features.enableGuestMode;
}

/**
 * Check if voice mode is enabled
 */
export function isVoiceModeEnabled() {
    return config.features.enableVoiceMode;
}

/**
 * Check if coding mode is enabled
 */
export function isCodingModeEnabled() {
    return config.features.enableCodingMode;
}

/**
 * Get max image size
 */
export function getMaxImageSize() {
    return config.ui.maxImageSize;
}

/**
 * Get supported image types
 */
export function getSupportedImageTypes() {
    return config.ui.supportedImageTypes;
}

export default config;
