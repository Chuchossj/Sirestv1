// Public browser configuration. Never put a service-role key here.
export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "kfzlfkuehouubrkpfmft";
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmemxma3VlaG91dWJya3BmbWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwOTAxNjMsImV4cCI6MjA3NjY2NjE2M30.GlyOdqfv_75QYdSiekCBpmN1qMlErKSNlToWk2ADVyU";

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`).replace(/\/$/, "");
