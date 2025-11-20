import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key for privileged operations.
export function getAdminClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
	if (!supabaseUrl || !serviceRoleKey) {
		throw new Error("Supabase admin client missing env vars");
	}
	return createClient(supabaseUrl, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}


