// scripts/bootstrap-school.mjs
// Bootstrap sekolah baru + admin pertama melalui Supabase Auth Admin API.
// Tidak menyimpan password ke file/log. Password sementara hanya dicetak sekali.
//
// Pemakaian (PowerShell):
//   $env:SUPABASE_URL="https://<project>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"   # jangan commit
//   $env:BOOTSTRAP_SCHOOL_CODE="SMPN2KAR"
//   $env:BOOTSTRAP_SCHOOL_NAME="SMPN 2 Karawang Barat"
//   $env:BOOTSTRAP_SCHOOL_HEADMASTER="Nama Kepala Sekolah"
//   $env:BOOTSTRAP_SCHOOL_ADDRESS="Alamat sekolah"
//   $env:BOOTSTRAP_ADMIN_USERNAME="admin.sekolah"
//   $env:BOOTSTRAP_ADMIN_NAME="Nama Admin"
//   $env:BOOTSTRAP_ADMIN_GENDER="L"                       # L/P, opsional
//   node scripts/bootstrap-school.mjs --dry-run
//   node scripts/bootstrap-school.mjs
import { randomBytes } from "node:crypto";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function need(name) {
  const v = String(process.env[name] || "").trim();
  if (!v) die("Env " + name + " wajib diisi.");
  return v;
}
function die(msg) {
  console.error("GAGAL: " + msg);
  process.exit(1);
}
function password() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(18);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
async function api(path, opts = {}) {
  const res = await fetch(URL_BASE + path, {
    ...opts,
    headers: {
      apikey: SERVICE,
      Authorization: "Bearer " + SERVICE,
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
async function cleanup(schoolId, userId) {
  if (userId) {
    try { await api("/auth/v1/admin/users/" + userId, { method: "DELETE" }); } catch { /* lanjut */ }
  }
  if (schoolId) {
    try { await api("/rest/v1/schools?id=eq." + schoolId, { method: "DELETE" }); } catch { /* lanjut */ }
  }
}

if (!URL_BASE || !SERVICE) {
  die("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi (env, jangan ditulis di file).");
}
const code = need("BOOTSTRAP_SCHOOL_CODE").toUpperCase();
const schoolName = need("BOOTSTRAP_SCHOOL_NAME");
const headmaster = String(process.env.BOOTSTRAP_SCHOOL_HEADMASTER || "").trim();
const address = String(process.env.BOOTSTRAP_SCHOOL_ADDRESS || "").trim();
const username = need("BOOTSTRAP_ADMIN_USERNAME").toLowerCase();
const adminName = need("BOOTSTRAP_ADMIN_NAME");
const gender = String(process.env.BOOTSTRAP_ADMIN_GENDER || "").trim().toUpperCase();

if (!/^[A-Z0-9._-]{3,40}$/.test(code)) die("Kode sekolah hanya huruf/angka/titik/garis (3–40).");
if (!/^[a-z0-9._-]{3,40}$/.test(username)) die("Username admin hanya huruf kecil/angka/titik/garis (3–40).");
if (gender && !["L", "P"].includes(gender)) die("BOOTSTRAP_ADMIN_GENDER harus L atau P.");

const email = username + "@" + code.toLowerCase() + ".admin.lms";

const existing = await api("/rest/v1/schools?select=id,code&code=eq." + encodeURIComponent(code));
if (existing.status >= 400) die("Gagal membaca schools: " + JSON.stringify(existing.body));
if (Array.isArray(existing.body) && existing.body.length) {
  die("Sekolah dengan kode " + code + " sudah ada. Bootstrap tidak menimpa sekolah lama.");
}

const userCheck = await api("/rest/v1/profiles?select=id,username&username=eq." + encodeURIComponent(username));
if (userCheck.status >= 400) die("Gagal membaca profiles: " + JSON.stringify(userCheck.body));
if (Array.isArray(userCheck.body) && userCheck.body.length) {
  die("Username " + username + " sudah dipakai. Pilih username admin lain.");
}

console.log("Rencana bootstrap:");
console.log("  Sekolah : " + code + " — " + schoolName);
console.log("  Admin   : " + username + " (" + adminName + ")");
console.log("  Email   : " + email);
console.log("  Mode    : " + (DRY ? "DRY-RUN (tidak menulis apa pun)" : "MENULIS ke database"));
if (DRY) {
  console.log("Dry-run selesai. Periksa kembali data sebelum menjalankan tanpa --dry-run.");
  process.exit(0);
}

let schoolId = null;
let userId = null;
try {
  const school = await api("/rest/v1/schools", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{ code, name: schoolName, headmaster: headmaster || null, address: address || null, settings: {} }])
  });
  if (school.status >= 400 || !school.body?.[0]?.id) throw new Error("Gagal membuat sekolah: " + JSON.stringify(school.body));
  schoolId = school.body[0].id;

  const temp = password();
  const created = await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: temp, email_confirm: true })
  });
  if (created.status >= 400 || !created.body?.id) throw new Error("Gagal membuat akun Auth: " + JSON.stringify(created.body));
  userId = created.body.id;

  const profile = await api("/rest/v1/profiles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{
      id: userId,
      school_id: schoolId,
      role: "admin",
      username,
      full_name: adminName,
      gender: gender || null,
      status: "aktif",
      must_change_password: true,
      settings: {}
    }])
  });
  if (profile.status >= 400) throw new Error("Gagal membuat profil admin: " + JSON.stringify(profile.body));

  const audit = await api("/rest/v1/audit_logs", {
    method: "POST",
    body: JSON.stringify([{
      school_id: schoolId, actor_id: userId, action: "bootstrap_school",
      entity: "schools", entity_id: schoolId,
      detail: { code, username }
    }])
  });
  if (audit.status >= 400) console.warn("PERINGATAN: audit_logs gagal ditulis, bootstrap tetap berhasil.");

  console.log("");
  console.log("BERHASIL.");
  console.log("Sekolah ID : " + schoolId);
  console.log("Admin ID   : " + userId);
  console.log("Username   : " + username);
  console.log("Email login: " + email);
  console.log("Password sementara: " + temp);
  console.log("");
  console.log("PENTING: password di atas hanya tampil sekali. Jangan simpan di repo/log/chat.");
  console.log("Login lewat tab Admin, lalu ganti password saat diminta.");
} catch (e) {
  console.error("Bootstrap gagal, membersihkan artefak yang baru dibuat...");
  await cleanup(schoolId, userId);
  die(e.message);
}
