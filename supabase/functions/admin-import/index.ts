// supabase/functions/admin-import/index.ts
// Import CSV Admin: validasi, dry-run, commit akademik inti, dan pembuatan akun.
// Tidak pernah menerima/menyimpan password dari CSV.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const ACCOUNT_KINDS = ["guru", "siswa"];
const CORE_KINDS = [
  "sekolah", "tahun_pelajaran", "kelas", "mata_pelajaran",
  "wali_kelas", "penugasan_guru", "keanggotaan_siswa",
  "kategori_siswa_umum", "kategori_siswa_mapel"
];
const CONTENT_KINDS = ["modul_materi", "asesmen", "soal_asesmen", "bank_soal", "nilai_historis"];
const ALL_KINDS = CORE_KINDS.concat(CONTENT_KINDS);

type Row = { row_no: number; raw: Record<string, unknown>; normalized: Record<string, unknown>; status: string; error: string | null };

function str(v: unknown) { return String(v ?? "").trim(); }
function bool(v: unknown) { return v === true || str(v).toLowerCase() === "true" || str(v) === "1"; }
function isDate(v: string) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + "T00:00:00Z")); }
function usernameOk(v: string) { return /^[a-z0-9._-]{3,40}$/.test(v); }
function pick(raw: Record<string, unknown>, mapping: Record<string, string>, field: string) {
  const key = mapping[field] || field;
  return raw[key];
}
function normalize(kind: string, raw: Record<string, unknown>, mapping: Record<string, string>) {
  const g = (f: string) => str(pick(raw, mapping, f));
  switch (kind) {
    case "sekolah": return { kode: g("kode").toUpperCase(), name: g("nama"), headmaster: g("kepala_sekolah"), address: g("alamat"), logo_url: g("logo_url"), settings_json: g("settings_json") };
    case "tahun_pelajaran": return { label: g("label"), mulai: g("mulai"), selesai: g("selesai"), aktif: bool(pick(raw, mapping, "aktif")) };
    case "kelas": return { tahun_label: g("tahun_label"), tingkat_label: g("tingkat_label"), label: g("label") };
    case "mata_pelajaran": return { kode: g("kode").toUpperCase(), nama: g("nama") };
    case "guru":
    case "siswa": return { username: g("username").toLowerCase(), nama_lengkap: g("nama_lengkap"), jenis_kelamin: g("jenis_kelamin").toUpperCase(), status: g("status").toLowerCase() || "aktif" };
    case "wali_kelas": return { tahun_label: g("tahun_label"), kelas_label: g("kelas_label"), guru_username: g("guru_username").toLowerCase() };
    case "penugasan_guru": return { tahun_label: g("tahun_label"), guru_username: g("guru_username").toLowerCase(), mapel_kode: g("mapel_kode").toUpperCase(), kelas_label: g("kelas_label") };
    case "keanggotaan_siswa": return { tahun_label: g("tahun_label"), kelas_label: g("kelas_label"), siswa_username: g("siswa_username").toLowerCase() };
    case "kategori_siswa_umum": return { tahun_label: g("tahun_label"), kelas_label: g("kelas_label"), siswa_username: g("siswa_username").toLowerCase(), kategori: g("kategori").toUpperCase() };
    case "kategori_siswa_mapel": return { tahun_label: g("tahun_label"), kelas_label: g("kelas_label"), siswa_username: g("siswa_username").toLowerCase(), mapel_kode: g("mapel_kode").toUpperCase(), kategori: g("kategori").toUpperCase() };
    case "modul_materi": return { mapel_kode: g("mapel_kode").toUpperCase(), tingkat_label: g("tingkat_label"), modul_judul: g("modul_judul"), modul_deskripsi: g("modul_deskripsi"), modul_urutan: g("modul_urutan"), topik_judul: g("topik_judul"), topik_urutan: g("topik_urutan"), materi_jenis: g("materi_jenis").toLowerCase(), materi_judul: g("materi_judul"), materi_url: g("materi_url"), materi_urutan: g("materi_urutan") };
    case "asesmen": return { tahun_label: g("tahun_label"), mapel_kode: g("mapel_kode").toUpperCase(), tingkat_label: g("tingkat_label"), modul_judul: g("modul_judul"), topik_judul: g("topik_judul"), kode: g("kode").toUpperCase(), judul: g("judul"), jenis: g("jenis").toLowerCase() || "lkpd", status: g("status").toLowerCase() || "draft", semester: g("semester"), kolaborasi: g("kolaborasi").toLowerCase() || "none", pengiriman: g("pengiriman").toLowerCase() || "portal", file_url: g("file_url"), prasyarat_kode: g("prasyarat_kode").toUpperCase(), config_json: g("config_json"), published_at: g("published_at") };
    case "soal_asesmen": return { asesmen_kode: g("asesmen_kode").toUpperCase(), item_key: g("item_key"), jenis: g("jenis").toLowerCase(), kesulitan: g("kesulitan").toUpperCase(), soal: g("soal"), kunci: g("kunci"), pilihan: g("pilihan"), keys: g("keys"), answers: g("answers"), weight: g("weight"), urutan: g("urutan") };
    case "bank_soal": return { mapel_kode: g("mapel_kode").toUpperCase(), pool_judul: g("pool_judul"), indikator: g("indikator"), jenis: g("jenis").toLowerCase(), kesulitan: g("kesulitan").toUpperCase(), soal: g("soal"), kunci: g("kunci"), pilihan: g("pilihan"), keys: g("keys"), answers: g("answers"), status: g("status").toLowerCase() || "active" };
    case "nilai_historis": return { tahun_label: g("tahun_label"), kelas_label: g("kelas_label"), siswa_username: g("siswa_username").toLowerCase(), asesmen_kode: g("asesmen_kode").toUpperCase(), skor: g("skor"), max_skor: g("max_skor"), sumber: g("sumber").toLowerCase() || "impor", catatan: g("catatan") };
    default: return {};
  }
}

async function validateRows(admin: any, schoolId: string, kind: string, rows: Row[]) {
  const years = new Map<string, any>(), classes = new Map<string, any>();
  const subjects = new Map<string, any>(), profiles = new Map<string, any>(), grades = new Map<string, any>();
  const modules = new Map<string, any[]>(), moduleByGrade = new Map<string, any>();
  const topics = new Map<string, any>(), assessments = new Map<string, any>();
  const memberships = new Set<string>();
  const [y, c, s, p, gr, m, t, a, cm] = await Promise.all([
    admin.from("academic_years").select("id,label,is_active").eq("school_id", schoolId),
    admin.from("classes").select("id,label,academic_year_id,homeroom_id").eq("school_id", schoolId),
    admin.from("subjects").select("id,code").eq("school_id", schoolId),
    admin.from("profiles").select("id,username,role,status,full_name,gender").eq("school_id", schoolId),
    admin.from("grade_levels").select("id,label").eq("school_id", schoolId),
    admin.from("modules").select("id,subject_id,grade_level_id,title").eq("school_id", schoolId),
    admin.from("topics").select("id,module_id,title"),
    admin.from("assessments").select("id,code,academic_year_id,package_frozen_at").eq("school_id", schoolId),
    admin.from("class_memberships").select("class_id,profile_id,left_at").is("left_at", null)
  ]);
  (y.data || []).forEach((x: any) => years.set(x.label, x));
  (c.data || []).forEach((x: any) => classes.set(x.academic_year_id + "|" + x.label, x));
  (s.data || []).forEach((x: any) => subjects.set(x.code, x));
  (p.data || []).forEach((x: any) => profiles.set(x.username, x));
  (gr.data || []).forEach((x: any) => grades.set(x.label, x));
  (m.data || []).forEach((x: any) => {
    const k = x.subject_id + "|" + x.title;
    if (!modules.has(k)) modules.set(k, []);
    modules.get(k)!.push(x);
    if (x.grade_level_id) moduleByGrade.set(x.subject_id + "|" + x.grade_level_id + "|" + x.title, x);
  });
  (t.data || []).forEach((x: any) => topics.set(x.module_id + "|" + x.title, x));
  (a.data || []).forEach((x: any) => assessments.set(String(x.code).toUpperCase(), x));
  (cm.data || []).forEach((x: any) => memberships.add(x.class_id + "|" + x.profile_id));

  const seen = new Set<string>();
  const assessmentCodes = new Set<string>(assessments.keys());
  let activeYears = 0;

  for (const row of rows) {
    const n: any = row.normalized;
    const errs: string[] = [];
    const key = (k: string) => { if (seen.has(k)) errs.push("DUPLICATE_FILE: " + k); seen.add(k); };

    if (kind === "sekolah") {
      if (!n.kode) errs.push("REQUIRED: kode");
      if (n.settings_json) { try { JSON.parse(n.settings_json); } catch { errs.push("FORMAT: settings_json"); } }
    } else if (kind === "tahun_pelajaran") {
      if (!n.label) errs.push("REQUIRED: label");
      if (!isDate(n.mulai) || !isDate(n.selesai)) errs.push("FORMAT: tanggal");
      if (n.mulai && n.selesai && n.selesai <= n.mulai) errs.push("FORMAT: selesai harus setelah mulai");
      if (n.aktif && ++activeYears > 1) errs.push("FORMAT: hanya satu tahun aktif");
      key("year|" + n.label);
    } else if (kind === "kelas") {
      if (!n.tahun_label || !n.tingkat_label || !n.label) errs.push("REQUIRED: tahun/tingkat/kelas");
      if (!years.has(n.tahun_label)) errs.push("REF_NOT_FOUND: tahun " + n.tahun_label);
      if (!grades.has(n.tingkat_label)) errs.push("REF_NOT_FOUND: tingkat " + n.tingkat_label);
      const yid = years.get(n.tahun_label)?.id;
      key("class|" + yid + "|" + n.label);
    } else if (kind === "mata_pelajaran") {
      if (!n.kode || !n.nama) errs.push("REQUIRED: kode/nama");
      key("subject|" + n.kode);
    } else if (kind === "guru" || kind === "siswa") {
      if (!usernameOk(n.username)) errs.push("USERNAME: " + n.username);
      if (!n.nama_lengkap) errs.push("REQUIRED: nama_lengkap");
      if (n.jenis_kelamin && !["L","P"].includes(n.jenis_kelamin)) errs.push("FORMAT: jenis_kelamin");
      if (n.status && !["aktif","nonaktif"].includes(n.status)) errs.push("FORMAT: status");
      const ex = profiles.get(n.username);
      if (ex && ex.role !== kind) errs.push("ROLE: username sudah dipakai sebagai " + ex.role);
      key("user|" + n.username);
    } else if (kind === "wali_kelas") {
      const cls = classes.get(years.get(n.tahun_label)?.id + "|" + n.kelas_label);
      if (!years.has(n.tahun_label) || !cls) errs.push("REF_NOT_FOUND: tahun/kelas");
      const t = profiles.get(n.guru_username);
      if (!t || t.role !== "guru") errs.push("REF_NOT_FOUND: guru " + n.guru_username);
      key("homeroom|" + (cls?.id || n.kelas_label));
    } else if (kind === "penugasan_guru") {
      const y = years.get(n.tahun_label); const t = profiles.get(n.guru_username); const sb = subjects.get(n.mapel_kode);
      if (!y) errs.push("REF_NOT_FOUND: tahun");
      if (!t || t.role !== "guru") errs.push("REF_NOT_FOUND: guru");
      if (!sb) errs.push("REF_NOT_FOUND: mapel");
      if (n.kelas_label && !classes.get(y?.id + "|" + n.kelas_label)) errs.push("REF_NOT_FOUND: kelas");
      key("assign|" + (t?.id || n.guru_username) + "|" + (sb?.id || n.mapel_kode) + "|" + (y?.id || n.tahun_label) + "|" + n.kelas_label);
    } else if (kind === "keanggotaan_siswa") {
      const y = years.get(n.tahun_label); const cls = classes.get(y?.id + "|" + n.kelas_label); const st = profiles.get(n.siswa_username);
      if (!y || !cls) errs.push("REF_NOT_FOUND: tahun/kelas");
      if (!st || st.role !== "siswa") errs.push("REF_NOT_FOUND: siswa");
      key("member|" + (cls?.id || n.kelas_label) + "|" + (st?.id || n.siswa_username));
    } else if (kind === "kategori_siswa_umum" || kind === "kategori_siswa_mapel") {
      const y = years.get(n.tahun_label); const cls = classes.get(y?.id + "|" + n.kelas_label); const st = profiles.get(n.siswa_username);
      if (!y || !cls) errs.push("REF_NOT_FOUND: tahun/kelas");
      if (!st || st.role !== "siswa") errs.push("REF_NOT_FOUND: siswa");
      if (!["A","B","C"].includes(n.kategori)) errs.push("CATEGORY: A/B/C");
      if (kind === "kategori_siswa_mapel" && !subjects.has(n.mapel_kode)) errs.push("REF_NOT_FOUND: mapel");
      key("cat|" + (st?.id || n.siswa_username) + "|" + (kind === "kategori_siswa_mapel" ? n.mapel_kode : "umum") + "|" + (y?.id || n.tahun_label));
    } else if (kind === "modul_materi") {
      const sb = subjects.get(n.mapel_kode);
      if (!sb) errs.push("REF_NOT_FOUND: mapel " + n.mapel_kode);
      if (!grades.has(n.tingkat_label)) errs.push("REF_NOT_FOUND: tingkat " + n.tingkat_label);
      if (!n.modul_judul || !n.topik_judul || !n.materi_judul) errs.push("REQUIRED: modul/topik/materi");
      if (!["dokumen","video","app","geogebra","pdf","lkpd_ref"].includes(n.materi_jenis)) errs.push("FORMAT: materi_jenis");
      if (n.materi_url && !/^https?:\/\//i.test(n.materi_url) && !(n.materi_url.charAt(0) === "/" && n.materi_url.indexOf("//") !== 0)) {
        errs.push("FORMAT: materi_url harus http(s) atau path relatif");
      }
      key("mod|" + n.mapel_kode + "|" + n.tingkat_label + "|" + n.modul_judul + "|" + n.topik_judul + "|" + n.materi_judul + "|" + n.materi_url);
    } else if (kind === "asesmen") {
      const y = years.get(n.tahun_label);
      const sb = subjects.get(n.mapel_kode);
      if (!y) errs.push("REF_NOT_FOUND: tahun " + n.tahun_label);
      if (!sb) errs.push("REF_NOT_FOUND: mapel " + n.mapel_kode);
      if (!n.kode || !n.judul) errs.push("REQUIRED: kode/judul");
      if (!["lkpd","kuis","tugas","projek"].includes(n.jenis)) errs.push("FORMAT: jenis");
      if (!["draft","active","exambro","inactive","locked","archived"].includes(n.status)) errs.push("FORMAT: status");
      if (!["none","optional","optional_fixed","required","required_fixed"].includes(n.kolaborasi)) errs.push("FORMAT: kolaborasi");
      if (!["portal","exambro","direct"].includes(n.pengiriman)) errs.push("FORMAT: pengiriman");
      if (n.semester && !["1","2"].includes(n.semester)) errs.push("FORMAT: semester");
      if (n.config_json) { try { JSON.parse(n.config_json); } catch { errs.push("FORMAT: config_json"); } }
      if (n.status === "active" && !n.published_at) errs.push("REQUIRED: published_at untuk status active");
      if (n.published_at && isNaN(Date.parse(n.published_at))) errs.push("FORMAT: published_at");
      if (n.prasyarat_kode && n.prasyarat_kode === n.kode) errs.push("DEPENDENCY: prasyarat tidak boleh dirinya sendiri");
      if (n.prasyarat_kode && !assessmentCodes.has(n.prasyarat_kode)) errs.push("REF_NOT_FOUND: prasyarat " + n.prasyarat_kode);
      if (n.modul_judul && sb) {
        let mod: any = null;
        if (n.tingkat_label) {
          const g = grades.get(n.tingkat_label);
          if (!g) errs.push("REF_NOT_FOUND: tingkat " + n.tingkat_label);
          else mod = moduleByGrade.get(sb.id + "|" + g.id + "|" + n.modul_judul);
          if (!mod) errs.push("REF_NOT_FOUND: modul " + n.modul_judul);
        } else {
          const list = modules.get(sb.id + "|" + n.modul_judul) || [];
          if (!list.length) errs.push("REF_NOT_FOUND: modul " + n.modul_judul);
          else if (list.length > 1) errs.push("AMBIGUOUS: modul " + n.modul_judul + " ada di beberapa tingkat; isi tingkat_label");
          else mod = list[0];
        }
        if (mod && n.topik_judul && !topics.has(mod.id + "|" + n.topik_judul)) {
          errs.push("REF_NOT_FOUND: topik " + n.topik_judul);
        }
      } else if (n.topik_judul && !n.modul_judul) {
        errs.push("DEPENDENCY: topik_judul memerlukan modul_judul");
      }
      key("assess|" + n.kode);
      if (n.kode) assessmentCodes.add(n.kode);
    } else if (kind === "soal_asesmen") {
      if (!n.asesmen_kode || !assessmentCodes.has(n.asesmen_kode)) errs.push("REF_NOT_FOUND: asesmen " + n.asesmen_kode);
      if (!n.item_key) errs.push("REQUIRED: item_key");
      if (!n.soal) errs.push("REQUIRED: soal");
      if (!["num","mc","bs","match","scaffold","text"].includes(n.jenis)) errs.push("FORMAT: jenis");
      if (n.kesulitan && !["A","B","C"].includes(n.kesulitan)) errs.push("FORMAT: kesulitan");
      if (n.weight && (isNaN(Number(n.weight)) || Number(n.weight) < 0)) errs.push("FORMAT: weight");
      if (n.jenis === "num" && (n.kunci === "" || isNaN(Number(n.kunci)))) errs.push("REQUIRED: kunci numerik");
      if ((n.jenis === "mc" || n.jenis === "bs") && !n.kunci) errs.push("REQUIRED: kunci");
      if (n.jenis === "match" && !n.keys) errs.push("REQUIRED: keys");
      if (n.jenis === "scaffold" && (!n.answers || String(n.answers).split(",").some((x: string) => x.trim() === "" || isNaN(Number(x))))) errs.push("REQUIRED: answers numerik");
      key("soal|" + n.asesmen_kode + "|" + n.item_key);
    } else if (kind === "bank_soal") {
      if (!subjects.has(n.mapel_kode)) errs.push("REF_NOT_FOUND: mapel " + n.mapel_kode);
      if (!n.pool_judul) errs.push("REQUIRED: pool_judul");
      if (!n.soal) errs.push("REQUIRED: soal");
      if (!["num","mc","bs","match","scaffold","text"].includes(n.jenis)) errs.push("FORMAT: jenis");
      if (n.kesulitan && !["A","B","C"].includes(n.kesulitan)) errs.push("FORMAT: kesulitan");
      if (!["draft","active","archived"].includes(n.status)) errs.push("FORMAT: status");
      if (n.jenis === "num" && (n.kunci === "" || isNaN(Number(n.kunci)))) errs.push("REQUIRED: kunci numerik");
      if ((n.jenis === "mc" || n.jenis === "bs") && !n.kunci) errs.push("REQUIRED: kunci");
      if (n.jenis === "match" && !n.keys) errs.push("REQUIRED: keys");
      if (n.jenis === "scaffold" && (!n.answers || String(n.answers).split(",").some((x: string) => x.trim() === "" || isNaN(Number(x))))) errs.push("REQUIRED: answers numerik");
      key("bank|" + n.mapel_kode + "|" + n.pool_judul + "|" + n.indikator + "|" + n.jenis + "|" + n.soal);
    } else if (kind === "nilai_historis") {
      const y = years.get(n.tahun_label);
      const cls = classes.get(y?.id + "|" + n.kelas_label);
      const st = profiles.get(n.siswa_username);
      const as = assessments.get(n.asesmen_kode);
      if (!y || !cls) errs.push("REF_NOT_FOUND: tahun/kelas");
      if (!st || st.role !== "siswa") errs.push("REF_NOT_FOUND: siswa");
      if (!as) errs.push("REF_NOT_FOUND: asesmen " + n.asesmen_kode);
      if (cls && st && !memberships.has(cls.id + "|" + st.id)) errs.push("DEPENDENCY: siswa bukan anggota kelas");
      const score = Number(n.skor), max = n.max_skor === "" ? 100 : Number(n.max_skor);
      if (n.skor === "" || isNaN(score)) errs.push("FORMAT: skor");
      if (isNaN(max) || max <= 0) errs.push("FORMAT: max_skor");
      if (!isNaN(score) && !isNaN(max) && (score < 0 || score > max)) errs.push("SCORE_RANGE: skor 0..max");
      if (!["impor","manual"].includes(n.sumber)) errs.push("FORMAT: sumber harus impor/manual");
      key("grade|" + n.asesmen_kode + "|" + n.siswa_username);
    }

    row.status = errs.length ? "invalid" : "valid";
    row.error = errs.length ? errs.join("; ") : null;
  }
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr, n => chars[n % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, msg: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ ok: false, msg: "Sesi tidak valid" }, 401);
  const { data: profile } = await caller.from("profiles").select("role,school_id").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return json({ ok: false, msg: "Akses admin diperlukan" }, 403);

  const admin = createClient(url, service);
  const { data: school } = await admin.from("schools").select("code,name").eq("id", profile.school_id).single();
  if (!school) return json({ ok: false, msg: "Sekolah tidak ditemukan" }, 400);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, msg: "Body tidak valid" }, 400); }

  /* ---------------- HISTORY ---------------- */
  if (body.action === "history") {
    const r = await admin.from("data_import_batches")
      .select("id,kind,file_name,status,counts,created_at,committed_at")
      .eq("school_id", profile.school_id).order("created_at", { ascending: false }).limit(50);
    return json({ ok: true, rows: r.data || [] });
  }

  /* ---------------- BATCH DETAIL ---------------- */
  if (body.action === "batch") {
    const b = await admin.from("data_import_batches").select("*").eq("id", body.batchId).eq("school_id", profile.school_id).single();
    if (b.error) return json({ ok: false, msg: "Batch tidak ditemukan" }, 404);
    const rows = await admin.from("data_import_rows").select("row_no,status,action,error,normalized,target_id").eq("batch_id", body.batchId).order("row_no");
    return json({ ok: true, batch: b.data, rows: rows.data || [] });
  }

  /* ---------------- VALIDATE / DRY RUN ---------------- */
  if (body.action === "validate") {
    const kind = String(body.kind || "");
    if (!ACCOUNT_KINDS.includes(kind) && !ALL_KINDS.includes(kind)) {
      return json({ ok: false, msg: "Jenis import tidak dikenal" }, 400);
    }
    const rawRows = Array.isArray(body.rows) ? body.rows : [];
    if (!rawRows.length) return json({ ok: false, msg: "File kosong" }, 400);
    if (rawRows.length > 2000) return json({ ok: false, msg: "Maksimal 2.000 baris per batch" }, 400);
    const mapping = body.mapping || {};

    const rows: Row[] = rawRows.map((raw: any, i: number) => ({
      row_no: i + 2, raw, normalized: normalize(kind, raw, mapping), status: "pending", error: null
    }));
    if (kind === "sekolah") {
      rows.forEach((r: any) => { if (r.normalized.kode && r.normalized.kode !== school.code) r.error = "SCHOOL_SCOPE: kode sekolah tidak cocok"; });
      rows.forEach((r: any) => { if (r.error) r.status = "invalid"; });
    }
    await validateRows(admin, profile.school_id, kind, rows);
    if (kind === "sekolah") {
      rows.forEach((r: any) => {
        if (r.normalized.kode && r.normalized.kode !== String(school.code).toUpperCase()) {
          r.status = "invalid";
          r.error = (r.error ? r.error + "; " : "") + "SCHOOL_SCOPE: kode sekolah tidak cocok (" + school.code + ")";
        }
      });
    }

    const batch = await admin.from("data_import_batches").insert({
      school_id: profile.school_id, kind, file_name: body.fileName || null,
      status: "validated", mapping, requested_by: user.id,
      counts: { total: rows.length, valid: rows.filter(r => r.status === "valid").length,
                invalid: rows.filter(r => r.status === "invalid").length }
    }).select("id").single();
    if (batch.error) return json({ ok: false, msg: batch.error.message }, 500);

    const inserts = rows.map(r => ({
      batch_id: batch.data.id, row_no: r.row_no, raw: r.raw,
      normalized: r.normalized, status: r.status, error: r.error
    }));
    for (let i = 0; i < inserts.length; i += 200) {
      const ins = await admin.from("data_import_rows").insert(inserts.slice(i, i + 200));
      if (ins.error) return json({ ok: false, msg: ins.error.message }, 500);
    }
    return json({
      ok: true, batch_id: batch.data.id,
      counts: { total: rows.length, valid: rows.filter(r => r.status === "valid").length,
                invalid: rows.filter(r => r.status === "invalid").length },
      rows: rows.map(r => ({ row_no: r.row_no, status: r.status, error: r.error, normalized: r.normalized }))
    });
  }

  /* ---------------- COMMIT ---------------- */
  if (body.action === "commit") {
    const batchId = String(body.batchId || "");
    const b = await admin.from("data_import_batches").select("*").eq("id", batchId).eq("school_id", profile.school_id).single();
    if (b.error || !b.data) return json({ ok: false, msg: "Batch tidak ditemukan" }, 404);
    if (b.data.status !== "validated") return json({ ok: false, msg: "Batch tidak siap commit" }, 400);

    if (ACCOUNT_KINDS.includes(b.data.kind)) {
      const rows = await admin.from("data_import_rows").select("*").eq("batch_id", batchId).eq("status", "valid").order("row_no");
      if (rows.error) return json({ ok: false, msg: rows.error.message }, 500);
      let inserted = 0, skipped = 0, failed = 0;
      const credentials: any[] = [];
      await admin.from("data_import_batches").update({ status: "committing" }).eq("id", batchId);
      for (const r of rows.data || []) {
        const n = r.normalized;
        const ex = await admin.from("profiles").select("id,status").eq("school_id", profile.school_id).eq("username", n.username).maybeSingle();
        if (ex.data) {
          const nextStatus = n.status || "aktif";
          await admin.from("profiles").update({ full_name: n.nama_lengkap, gender: n.jenis_kelamin || null, status: nextStatus }).eq("id", ex.data.id);
          if (nextStatus !== ex.data.status) {
            await admin.auth.admin.updateUserById(ex.data.id, {
              ban_duration: nextStatus === "nonaktif" ? "876000h" : "none"
            });
          }
          await admin.from("data_import_rows").update({ status: "committed", action: "skip", target_id: ex.data.id }).eq("id", r.id);
          skipped++;
          continue;
        }
        const email = `${n.username}@${String(school.code).toLowerCase()}.${b.data.kind}.lms`;
        const password = randomPassword();
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (created.error) {
          await admin.from("data_import_rows").update({ status: "failed", action: "error", error: created.error.message }).eq("id", r.id);
          failed++;
          continue;
        }
        const ins = await admin.from("profiles").insert({
          id: created.data.user.id, school_id: profile.school_id,
          role: b.data.kind, username: n.username, full_name: n.nama_lengkap,
          gender: n.jenis_kelamin || null, status: n.status || "aktif",
          must_change_password: true, settings: {}
        });
        if (ins.error) {
          await admin.auth.admin.deleteUser(created.data.user.id);
          await admin.from("data_import_rows").update({ status: "failed", action: "error", error: ins.error.message }).eq("id", r.id);
          failed++;
          continue;
        }
        if ((n.status || "aktif") === "nonaktif") {
          await admin.auth.admin.updateUserById(created.data.user.id, { ban_duration: "876000h" });
        }
        await admin.from("data_import_rows").update({ status: "committed", action: "insert", target_id: created.data.user.id }).eq("id", r.id);
        credentials.push({ username: n.username, email, temp_password: password, role: b.data.kind });
        inserted++;
      }
      const status = failed ? "partial" : "committed";
      await admin.from("data_import_batches").update({
        status, committed_at: new Date().toISOString(),
        counts: { total: (rows.data || []).length, inserted, updated: 0, skipped, failed }
      }).eq("id", batchId);
      await admin.from("audit_logs").insert({
        school_id: profile.school_id, actor_id: user.id, action: "import_commit",
        entity: "data_import_batches", entity_id: batchId,
        detail: { kind: b.data.kind, inserted, skipped, failed }
      });
      return json({ ok: true, status, inserted, skipped, failed, credentials });
    }

    if (!ALL_KINDS.includes(b.data.kind)) return json({ ok: false, msg: "Jenis import tidak dikenal" }, 400);
    const rpc = await admin.rpc("app_import_commit", { p_batch: batchId });
    if (rpc.error) return json({ ok: false, msg: rpc.error.message }, 500);
    return json(rpc.data || { ok: false, msg: "Tidak ada respons" });
  }

  return json({ ok: false, msg: "Aksi tidak dikenal" }, 400);
});
