// supabase/functions/admin-users/index.ts
// Admin mengelola akun; pengguna dapat mengganti password sendiri.
// Service role tidak pernah dikirim ke browser dan password tidak pernah di-log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, msg: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ ok: false, msg: "Sesi tidak valid" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, msg: "Body tidak valid" }, 400); }
  const action = String(body.action || "create");
  const admin = createClient(url, service);

  /* ---------------- GANTI PASSWORD SENDIRI (semua pengguna) ---------------- */
  if (action === "change_password") {
    const current = String(body.current_password || "");
    const next = String(body.new_password || "");
    if (!current || next.length < 12) {
      return json({ ok: false, msg: "Password baru minimal 12 karakter" }, 400);
    }
    if (!user.email) return json({ ok: false, msg: "Akun tidak memiliki email login" }, 400);

    const verifier = createClient(url, anon);
    const { error: verifyErr } = await verifier.auth.signInWithPassword({
      email: user.email, password: current
    });
    if (verifyErr) return json({ ok: false, msg: "Password saat ini salah" }, 400);

    const upd = await admin.auth.admin.updateUserById(user.id, { password: next });
    if (upd.error) return json({ ok: false, msg: upd.error.message }, 400);

    const { data: self } = await admin.from("profiles")
      .select("school_id").eq("id", user.id).single();
    await admin.from("profiles").update({ must_change_password: false }).eq("id", user.id);
    await admin.from("audit_logs").insert({
      school_id: (self && self.school_id) || null,
      actor_id: user.id,
      action: "change_password",
      entity: "profiles",
      entity_id: user.id,
      detail: { self: true }
    });
    return json({ ok: true });
  }

  /* ---------------- ADMIN ONLY ---------------- */
  const { data: profile } = await caller
    .from("profiles").select("role,school_id").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return json({ ok: false, msg: "Akses admin diperlukan" }, 403);
  }

  if (action === "create") {
    const username = String(body.username || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const role = String(body.role || "siswa");
    const gender = String(body.gender || "").trim().toUpperCase();
    const status = String(body.status || "aktif").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return json({ ok: false, msg: "Username tidak valid" }, 400);
    if (!fullName) return json({ ok: false, msg: "Nama lengkap wajib" }, 400);
    if (!["guru", "siswa", "admin"].includes(role)) return json({ ok: false, msg: "Role tidak valid" }, 400);
    if (gender && !["L", "P"].includes(gender)) return json({ ok: false, msg: "Jenis kelamin harus L/P" }, 400);
    if (!["aktif", "nonaktif"].includes(status)) return json({ ok: false, msg: "Status harus aktif/nonaktif" }, 400);

    const { data: school } = await admin
      .from("schools").select("code").eq("id", profile.school_id).single();
    if (!school) return json({ ok: false, msg: "Sekolah tidak ditemukan" }, 400);

    const { data: existing } = await admin.from("profiles")
      .select("id,role").eq("school_id", profile.school_id).eq("username", username).maybeSingle();
    if (existing) return json({ ok: false, msg: "Username sudah dipakai" }, 409);

    const email = `${username}@${String(school.code).toLowerCase()}.${role}.lms`;
    const provided = String(body.password || "");
    const password = provided.length >= 8 ? provided : randomPassword();
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (created.error) return json({ ok: false, msg: created.error.message }, 400);

    const ins = await admin.from("profiles").insert({
      id: created.data.user.id,
      school_id: profile.school_id,
      role,
      username,
      full_name: fullName,
      gender: gender || null,
      status,
      must_change_password: !provided,
      settings: {}
    });
    if (ins.error) {
      await admin.auth.admin.deleteUser(created.data.user.id);
      return json({ ok: false, msg: ins.error.message }, 400);
    }
    if (status === "nonaktif") {
      await admin.auth.admin.updateUserById(created.data.user.id, { ban_duration: "876000h" });
    }
    await admin.from("audit_logs").insert({
      school_id: profile.school_id, actor_id: user.id, action: "create_account",
      entity: "profiles", entity_id: created.data.user.id,
      detail: { username, role }
    });
    return json({
      ok: true, id: created.data.user.id, email,
      temp_password: provided ? undefined : password
    });
  }

  if (action === "reset") {
    const userId = String(body.user_id || "");
    const password = String(body.password || "");
    if (!userId || password.length < 8) return json({ ok: false, msg: "Data tidak valid" }, 400);
    const target = await admin.from("profiles")
      .select("id,username,role").eq("id", userId).eq("school_id", profile.school_id).single();
    if (target.error || !target.data) return json({ ok: false, msg: "Pengguna tidak ditemukan" }, 404);
    const r = await admin.auth.admin.updateUserById(userId, { password });
    if (r.error) return json({ ok: false, msg: r.error.message }, 400);
    await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
    await admin.from("audit_logs").insert({
      school_id: profile.school_id, actor_id: user.id, action: "reset_password",
      entity: "profiles", entity_id: userId, detail: { username: target.data.username }
    });
    return json({ ok: true });
  }

  if (action === "deactivate" || action === "reactivate") {
    const userId = String(body.user_id || "");
    if (!userId) return json({ ok: false, msg: "Pengguna wajib dipilih" }, 400);
    if (userId === user.id) return json({ ok: false, msg: "Tidak dapat menonaktifkan akun sendiri" }, 400);
    const target = await admin.from("profiles")
      .select("id,username,role").eq("id", userId).eq("school_id", profile.school_id).single();
    if (target.error || !target.data) return json({ ok: false, msg: "Pengguna tidak ditemukan" }, 404);

    const active = action === "reactivate";
    const upd = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "none" : "876000h"
    });
    if (upd.error) return json({ ok: false, msg: upd.error.message }, 400);
    await admin.from("profiles").update({ status: active ? "aktif" : "nonaktif" }).eq("id", userId);
    await admin.from("audit_logs").insert({
      school_id: profile.school_id, actor_id: user.id,
      action: active ? "reactivate_account" : "deactivate_account",
      entity: "profiles", entity_id: userId,
      detail: { username: target.data.username, role: target.data.role }
    });
    return json({ ok: true });
  }

  return json({ ok: false, msg: "Aksi tidak dikenal" }, 400);
});
