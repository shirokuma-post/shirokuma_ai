import { createClient } from "@supabase/supabase-js";

/** Service-role client — bypasses RLS. Use only in cron/worker API routes. */
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
