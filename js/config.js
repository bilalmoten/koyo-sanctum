// Supabase setup
// Replace these with your Supabase credentials
const SUPABASE_URL = "https://iipodamyhiyidvrfggva.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcG9kYW15aGl5aWR2cmZnZ3ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNzkwMjUsImV4cCI6MjA3Mjk1NTAyNX0.3PvX1uIstWiw5lkwxm6aBjI3pJvFS0K8tJzWe0D3dU0";

// Initialize Supabase client after the library loads
let supabaseClient = null;
let initAttempts = 0;
const maxInitAttempts = 10;

// Function to initialize Supabase
function initSupabase() {
    initAttempts++;

    if (typeof supabase !== 'undefined') {
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            window.supabase = supabaseClient;
            console.log('Supabase client initialized successfully');
            return true;
        } catch (error) {
            console.error('Error creating Supabase client:', error);
            return false;
        }
    } else {
        console.log(`Supabase library not loaded yet (attempt ${initAttempts}/${maxInitAttempts})`);
        return false;
    }
}

// Try to initialize immediately
if (!initSupabase()) {
    // If not ready, try again after a short delay
    const checkSupabase = setInterval(() => {
        if (initSupabase() || initAttempts >= maxInitAttempts) {
            clearInterval(checkSupabase);
            if (initAttempts >= maxInitAttempts) {
                console.error('Failed to initialize Supabase after maximum attempts');
            }
        }
    }, 100);

    // Also try on window load as backup
    window.addEventListener('load', () => {
        if (!window.supabase) {
            initSupabase();
        }
    });
}

