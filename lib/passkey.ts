import { getAdminClient } from "@/lib/supabaseAdmin";

export type PasskeyUser = {
	id: string;
	label: string;
	created_at: string;
};

export type StoredCredential = {
	id: string; // base64url credentialID
	user_id: string;
	public_key: string; // base64url
	counter: number;
	transports: string[] | null;
};

export async function getOrCreateUserByLabel(label: string): Promise<PasskeyUser> {
	const admin = getAdminClient();
	const { data: existing } = await admin
		.from("passkey_users")
		.select("*")
		.eq("label", label)
		.maybeSingle();
	if (existing) return existing as PasskeyUser;
	const { data, error } = await admin
		.from("passkey_users")
		.insert({ label })
		.select("*")
		.single();
	if (error) throw new Error(error.message);
	return data as PasskeyUser;
}

export async function getUserById(id: string): Promise<PasskeyUser | null> {
	const admin = getAdminClient();
	const { data } = await admin.from("passkey_users").select("*").eq("id", id).maybeSingle();
	return (data as PasskeyUser | null) ?? null;
}

export async function listCredentials(userId: string): Promise<StoredCredential[]> {
	const admin = getAdminClient();
	const { data, error } = await admin
		.from("passkey_credentials")
		.select("*")
		.eq("user_id", userId);
	if (error) throw new Error(error.message);
	return (data ?? []) as StoredCredential[];
}

export async function getCredentialById(id: string): Promise<StoredCredential | null> {
	const admin = getAdminClient();
	const { data } = await admin
		.from("passkey_credentials")
		.select("*")
		.eq("id", id)
		.maybeSingle();
	return (data as StoredCredential | null) ?? null;
}

export async function saveCredential(c: {
	id: string;
	user_id: string;
	public_key: string;
	counter: number;
	transports: string[] | null;
}) {
	const admin = getAdminClient();
	const { error } = await admin.from("passkey_credentials").insert(c);
	if (error) throw new Error(error.message);
}

export async function updateCounter(id: string, counter: number) {
	const admin = getAdminClient();
	await admin.from("passkey_credentials").update({ counter }).eq("id", id);
}
