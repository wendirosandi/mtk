// supabase/functions/admin-users/index.ts
// Hanya admin yang boleh membuat/mengatur akun. Service role tidak pernah ke browser.
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

  const { data: profile } = await caller
    .from("profiles").select("role,school_id").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return json({ ok: false, msg: "Akses admin diperlukan" }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, msg: "Body tidak valid" }, 400); }
  const action = String(body.action || "create");

  const admin = createClient(url, service);

  if (action === "create") {
    const username = String(body.username || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const role = String(body.role || "siswa");
    const password = String(body.password || "");
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return json({ ok: false, msg: "Username tidak valid" }, 400);
    if (!fullName) return json({ ok: false, msg: "Nama lengkap wajib" }, 400);
    if (!["guru", "siswa", "admin"].includes(role)) return json({ ok: false, msg: "Role tidak valid" }, 400);
    if (password.length < 8) return json({ ok: false, msg: "Password minimal 8 karakter" }, 400);

    const { data: school } = await admin
      .from("schools").select("code").eq("id", profile.school_id).single();
    if (!school) return json({ ok: false, msg: "Sekolah tidak ditemukan" }, 400);

    const email = `${username}@${String(school.code).toLowerCase()}.${role}.lms`;
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
      settings: {}
    });
    if (ins.error) {
      await admin.auth.admin.deleteUser(created.data.user.id);
      return json({ ok: false, msg: ins.error.message }, 400);
    }
    return json({ ok: true, id: created.data.user.id, email });
  }

  if (action === "reset") {
    const userId = String(body.user_id || "");
    const password = String(body.password || "");
    if (!userId || password.length < 8) return json({ ok: false, msg: "Data tidak valid" }, 400);
    const r = await admin.auth.admin.updateUserById(userId, { password });
    if (r.error) return json({ ok: false, msg: r.error.message }, 400);
    return json({ ok: true });
  }

  return json({ ok: false, msg: "Aksi tidak dikenal" }, 400);
});
