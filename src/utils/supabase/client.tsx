import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl, publicAnonKey } from "./info";

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient(
      supabaseUrl,
      publicAnonKey
    );
  }
  return supabaseClient;
}

export const supabase = createClient();
