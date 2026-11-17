// supabase/functions/ai-content/index.ts
// Draft generator AI untuk Bank Soal. Tidak pernah auto-publish.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, msg: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const aiKey = Deno.env.get("AI_API_KEY");
  const aiBase = Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1";
  const aiModel = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } }
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ ok: false, msg: "Sesi tidak valid" }, 401);

  const { data: profile } = await caller
    .from("profiles").select("role,school_id,username").eq("id", user.id).single();
  if (!profile || !["guru", "admin"].includes(profile.role)) {
    return json({ ok: false, msg: "Akses guru diperlukan" }, 403);
  }

  if (!aiKey) {
    return json({ ok: false, msg: "AI belum dikonfigurasi. Hubungi admin untuk mengatur AI_API_KEY." });
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, msg: "Body tidak valid" }, 400); }
  if (body.kind !== "bank") {
    return json({ ok: false, msg: "Jenis konten ini belum diaktifkan" }, 400);
  }

  const p = body.params || {};
  const items = Math.min(30, Math.max(1, Number(p.items) || 5));
  const itemKind = String(p.item_kind || "num");
  if (!["num", "mc", "bs", "match", "scaffold", "text"].includes(itemKind)) {
    return json({ ok: false, msg: "Jenis soal tidak dikenal" }, 400);
  }
  if (!p.subject_id) return json({ ok: false, msg: "Mapel wajib" }, 400);

  const admin = createClient(url, service);
  const job = await admin.from("ai_jobs").insert({
    school_id: profile.school_id, requested_by: user.id, kind: "bank",
    status: "running", params: p, provider: aiBase, model: aiModel
  }).select("id").single();
  if (job.error) return json({ ok: false, msg: job.error.message }, 500);
  const jobId = job.data.id;

  const schemaHint = itemKind === "num"
    ? '{"answer": <number>, "tol": <number>}'
    : itemKind === "mc" || itemKind === "bs"
      ? '{"key": "<jawaban>", "options": ["..."]}'
      : itemKind === "match"
        ? '{"keys": ["..."]}'
        : itemKind === "scaffold"
          ? '{"answers": [1,2,3]}'
          : "{}";

  const prompt = `Buat ${items} soal ${itemKind} untuk SMP kelas ${p.grade_level || "8"}.
Mapel: ${p.subject_name || "Matematika"}.
Topik: ${p.topic || "-"}.
Indikator: ${p.indicator || "-"}.
Kesulitan: ${p.difficulty || "B"}.
Instruksi tambahan: ${p.instructions || "-"}.

Jawab HANYA JSON valid dengan bentuk:
{"items":[{"prompt":"...","difficulty":"A|B|C","indicator":"...","payload":${schemaHint},"explanation":"..."}]}
Jangan sertakan markdown, komentar, atau teks lain.`;

  let aiRes: Response;
  try {
    aiRes = await fetch(`${aiBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: aiModel,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Anda penyusun soal matematika SMP. Output harus JSON valid." },
          { role: "user", content: prompt }
        ]
      })
    });
  } catch (e) {
    await admin.from("ai_jobs").update({ status: "failed", error: String(e), finished_at: new Date().toISOString() }).eq("id", jobId);
    return json({ ok: false, msg: "Gagal menghubungi provider AI" }, 502);
  }

  if (!aiRes.ok) {
    const err = await aiRes.text();
    await admin.from("ai_jobs").update({ status: "failed", error: err.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", jobId);
    return json({ ok: false, msg: "Provider AI menolak permintaan" }, 502);
  }

  const payload = await aiRes.json();
  const content = payload?.choices?.[0]?.message?.content || "";
  let parsed: any;
  try {
    parsed = JSON.parse(String(content).replace(/```json|```/g, "").trim());
  } catch {
    await admin.from("ai_jobs").update({ status: "failed", error: "Output bukan JSON", finished_at: new Date().toISOString() }).eq("id", jobId);
    return json({ ok: false, msg: "Output AI tidak valid" }, 502);
  }

  const rows = Array.isArray(parsed.items) ? parsed.items.slice(0, items) : [];
  if (!rows.length) {
    await admin.from("ai_jobs").update({ status: "failed", error: "Tidak ada item", finished_at: new Date().toISOString() }).eq("id", jobId);
    return json({ ok: false, msg: "AI tidak menghasilkan soal" }, 502);
  }

  const drafts = rows.map((it: any) => ({
    school_id: profile.school_id,
    subject_id: p.subject_id,
    pool_id: p.pool_id || null,
    indicator: String(it.indicator || p.indicator || "").trim() || null,
    kind: itemKind,
    difficulty: ["A", "B", "C"].includes(it.difficulty) ? it.difficulty : (p.difficulty || null),
    payload: Object.assign({}, it.payload || {}, { prompt: String(it.prompt || "").trim() }),
    status: "draft",
    created_by: user.id
  })).filter((x: any) => x.payload.prompt);

  if (!drafts.length) {
    await admin.from("ai_jobs").update({ status: "failed", error: "Prompt kosong", finished_at: new Date().toISOString() }).eq("id", jobId);
    return json({ ok: false, msg: "AI tidak menghasilkan soal valid" }, 502);
  }

  const inserted = await admin.from("bank_items").insert(drafts).select("id");
  if (inserted.error) {
    await admin.from("ai_jobs").update({ status: "failed", error: inserted.error.message, finished_at: new Date().toISOString() }).eq("id", jobId);
    return json({ ok: false, msg: inserted.error.message }, 500);
  }

  const usage = payload.usage || {};
  await admin.from("ai_jobs").update({
    status: "done",
    result: { draft_ids: (inserted.data || []).map((x: any) => x.id), count: drafts.length },
    tokens_in: usage.prompt_tokens || null,
    tokens_out: usage.completion_tokens || null,
    finished_at: new Date().toISOString()
  }).eq("id", jobId);

  return json({ ok: true, job_id: jobId, drafts: inserted.data || [], count: drafts.length });
});
