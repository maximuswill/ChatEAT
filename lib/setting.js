// Reads a ChatEAT setting (environment variable). Accepts the name in any letter case
// (CHATEAT_OWNER_EMAIL or chateat_owner_email), since Vercel treats those as different names.
// Surrounding quotes and spaces are removed, in case a value was pasted as "value".
export function setting(name) {
  const wanted = name.toLowerCase();
  const key = name in process.env ? name : Object.keys(process.env).find((k) => k.toLowerCase() === wanted);
  return String((key && process.env[key]) ?? "").trim().replace(/^["']|["']$/g, "").trim();
}
