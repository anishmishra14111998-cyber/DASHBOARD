// Coveted Hospitality employee accounts for the HR time-clock.
// Passwords are stored only as salted SHA-256 hashes — the plaintext is
// handed to each employee once and never persisted here.
//
// To add/remove staff: generate a salt + hash with
//   node -e 'const c=require("crypto");const salt=c.randomBytes(8).toString("hex");
//            const pass="THEPASS";console.log(salt, c.createHash("sha256").update(salt+":"+pass).digest("hex"))'

export interface HrUser {
  id: string;     // login id (lowercase)
  name: string;   // display name
  salt: string;
  hash: string;   // sha256(salt + ":" + password)
}

export const HR_USERS: HrUser[] = [
  { id: "ricky",   name: "Ricky",           salt: "6d3b48d98aebffaf", hash: "0038eebff92d186b5e26f59a399827292c4f043cd21eec83acbe6f5071bde54d" },
  { id: "michael", name: "Michael",         salt: "ffe8317ae6a6e94f", hash: "1e16317896986e7f709464a60b94cb17428344960dd8e2df86ebefb87443a5fe" },
  { id: "maria",   name: "Maria Fernandez", salt: "6ab579a7aeeb5a12", hash: "9b5e840ff77d4b41605dcca4c98ca4aef1fad1c0d3e386aaaceb8a38c0afb4d6" },
  { id: "dom",     name: "Dom",             salt: "5aab7070ec6a387b", hash: "bb5b395fbc1b61cc0dd2d335e9f62e013b745322474d868d9dadd3fa62afa4e9" },
];

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hrUserById(id: string): HrUser | undefined {
  return HR_USERS.find((u) => u.id === id);
}

export async function verifyHrCredentials(id: string, password: string): Promise<HrUser | null> {
  const u = hrUserById(id.toLowerCase().trim());
  if (!u) return null;
  const h = await sha256Hex(`${u.salt}:${password}`);
  return h === u.hash ? u : null;
}

export function publicUser(u: HrUser): { id: string; name: string } {
  return { id: u.id, name: u.name };
}
