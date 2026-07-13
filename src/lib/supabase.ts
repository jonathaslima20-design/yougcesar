import { createClient } from '@supabase/supabase-js';

// Get environment variables with fallbacks and validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Enhanced validation for environment variables
const isMisconfigured = !supabaseUrl || !supabaseAnonKey || supabaseUrl === 'undefined' || supabaseAnonKey === 'undefined';

if (isMisconfigured) {
  console.error('❌ SUPABASE CONFIGURATION ERROR:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlValue: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined',
    keyValue: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined',
    environment: import.meta.env.MODE,
    allEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
  });
}

// Log successful configuration (only in development)
if (!isMisconfigured && import.meta.env.DEV) {
  console.log('✅ SUPABASE CONFIGURED:', {
    url: `${supabaseUrl!.substring(0, 30)}...`,
    keyLength: supabaseAnonKey!.length,
    environment: import.meta.env.MODE
  });
}

const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

export const supabase = createClient(supabaseUrl || FALLBACK_URL, supabaseAnonKey || FALLBACK_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'vitrineturbo-web'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  // Add retry configuration for network issues
  retries: 3,
  // Add timeout configuration
  fetch: (url, options = {}) => {
    return fetch(url, {
      ...options,
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
  }
});

// Add session change listener for debugging
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔐 AUTH STATE CHANGE:', {
    event,
    userEmail: session?.user?.email,
    hasSession: !!session,
    timestamp: new Date().toISOString()
  });
  
  if (event === 'TOKEN_REFRESHED') {
    console.log('🔄 Token refreshed successfully');
  }
  
  if (event === 'SIGNED_OUT') {
    console.log('🚪 User signed out');
    localStorage.clear(); // Clear all stored data on sign out
  }
  
  if (event === 'SIGNED_IN') {
    console.log('✅ User signed in successfully');
  }
  
  if (event === 'USER_UPDATED') {
    console.log('👤 User profile updated');
  }
});

export default supabase;