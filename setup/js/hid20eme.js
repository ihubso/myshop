// ============================================
// SUPABASE CONFIGURATION - YOUR PROJECT
// ============================================
const MYSUPABASE_URL = window.ENV?.MYSHOPSUPABASE_URL ;
const MY_ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY ;
const AUTH_setup_URL = `${MYSUPABASE_URL}/functions/v1/welcome-email`;

// Create a dedicated Supabase client for setup (YOUR project, not track.js)
let setupDB = null;