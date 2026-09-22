/* =====================================================
   kalender.js — Data & Render Kalender Pythagoras 2027
   ===================================================== */

const kalenderData = [
    {
        bulan: "Januari",
        nomor: 1,
        pembuktian: "Sel Terbang Pythagoras (3-4-5)",
        metode: "Proof by rearrangement — kotak satuan a² & b² terbang ke c²",
        kelompok: "Contoh Guru",
        tipe: "guru",
        status: "completed",
        file: "pages/bukti-01-januari.html",
        engine: "DOM-based tween (rAF)",
        catatan: "Contoh pertama: 9 kotak merah + 16 kotak hijau → 25 kotak di c²"
    },
    {
        bulan: "Februari",
        nomor: 2,
        pembuktian: "Perigal Klasik (3-4-5)",
        metode: "Diseksi Perigal — 4 irisan b² + a² menutup c² via translasi",
        kelompok: "Contoh Guru",
        tipe: "guru",
        status: "completed",
        file: "pages/bukti-02-februari.html",
        engine: "perigal-engine-v5.1.js (DFS + verifier luas irisan)",
        catatan: "Contoh kedua: lubang a² miring sejajar c²; panel uji transparan"
    },
    {
        bulan: "Maret",
        nomor: 3,
        pembuktian: "Rearrangement 4 Segitiga (3-4-5)",
        metode: "Persegi (a+b)²: susunan 1 (rongga c²) vs susunan 2 (rongga a²+b²)",
        kelompok: "Kelompok 1",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-03-maret.html",
        engine: "DOM-based tween (rAF)",
        catatan: "Kelompok pertama mengerjakan; 4 segitiga berotasi 90°"
    },
    {
        bulan: "April",
        nomor: 4,
        pembuktian: "Perigal 4 Posisi a² (Gunting-Tempel)",
        metode: "Observasi: lubang a² bisa di atas/kiri/kanan/bawah dalam c²",
        kelompok: "Kelompok 2",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-04-april.html",
        engine: "Galeri statis (screenshot applet) + iframe GeoGebra",
        catatan: "Tanpa solver: 6 screenshot + aktivitas kinestetik"
    },
    {
        bulan: "Mei",
        nomor: 5,
        pembuktian: "Aljabar Murni dari (a+b)²",
        metode: "(a+b)² = 2ab + c² = 2ab + a² + b² → coret 2ab → c² = a² + b²",
        kelompok: "Kelompok 3",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-05-mei.html",
        engine: "SVG + tween (dua panel berdampingan)",
        catatan: "Hanya butuh ekspansi kuadrat — ramah kelas 8 semester 1"
    },
    {
        bulan: "Juni",
        nomor: 6,
        pembuktian: "Diseksi Einstein (3-4-5)",
        metode: "Garis tinggi → 2 segitiga sebangun; luas ∝ kuadrat sisi miring",
        kelompok: "Kelompok 4",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-06-juni.html",
        engine: "SVG + tween + baris mini rasio",
        catatan: "Pengayaan: kesebangunan = materi kelas 9"
    },
    {
        bulan: "Juli",
        nomor: 7,
        pembuktian: "Garis Tinggi & Segitiga Sebangun (6-8-10)",
        metode: "a² = c·x, b² = c·y, x+y=c → a²+b² = c²",
        kelompok: "Kelompok 5",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-07-juli.html",
        engine: "SVG + tween (proyeksi di hipotenusa)",
        catatan: "Pengayaan: Proof #6 cut-the-knot"
    },
    {
        bulan: "Agustus",
        nomor: 8,
        pembuktian: "Diagram Tali Zhao Shuang / 'Behold!' Bhaskara (5-12-13)",
        metode: "c² = 4·(½ab) + (b−a)² → 169 = 120 + 49",
        kelompok: "Kelompok 6",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-08-agustus.html",
        engine: "SVG + tween (4 segitiga masuk + rongga tengah)",
        catatan: "Rongga (b−a)² = 49 jelas terlihat"
    },
    {
        bulan: "September",
        nomor: 9,
        pembuktian: "Trapesium Garfield (8-15-17)",
        metode: "Luas trapesium dua cara: ½(a+b)² = 2·(½ab) + ½c²",
        kelompok: "Kelompok 7",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-09-september.html",
        engine: "SVG + tween (3 segitiga rakit trapesium)",
        catatan: "Garfield = Presiden AS ke-20, satu-satunya presiden dengan bukti Pythagoras"
    },
    {
        bulan: "Oktober",
        nomor: 10,
        pembuktian: "Euclid I.47 'Kincir Angin' (3-4-5)",
        metode: "Rotasi 90° segitiga kongruen (SAS) → persegi-panjang = a² & b²",
        kelompok: "Kelompok 8",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-10-oktober.html",
        engine: "SVG + tween (rotasi 90° di A & B)",
        catatan: "Paling terkenal dalam sejarah; + pengayaan kongruen kelas 8"
    },
    {
        bulan: "November",
        nomor: 11,
        pembuktian: "Lingkaran Dalam & Garis Singgung (5-12-13)",
        metode: "r = (a+b−c)/2; ½r(a+b+c) = ½ab → a²+b² = c²",
        kelompok: "Kelompok 9",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-11-november.html",
        engine: "SVG + tween (lingkaran + 3 pasang singgung)",
        catatan: "+ pengayaan teselasi bidang (statis)"
    },
    {
        bulan: "Desember",
        nomor: 12,
        pembuktian: "Sintesis Dua Identitas Luas",
        metode: "(a+b)² = 2ab + c² DAN c² = 2ab + (b−a)² → kurangkan → a²+b² = c²",
        kelompok: "Kelompok 10",
        tipe: "siswa",
        status: "completed",
        file: "pages/bukti-12-desember.html",
        engine: "SVG + tween (dua panel berdampingan)",
        catatan: "Penutup tahun: mensintesis Bukti #2 (Feb) + #8 (Agu)"
    }
];

/* =====================================================
   Render kalender ke DOM
   ===================================================== */
function renderKalender() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.innerHTML = '';

    kalenderData.forEach(data => {
        const isClickable = data.status === 'completed';
        const tag = isClickable ? 'a' : 'div';
        const card = document.createElement(tag);

        if (isClickable) {
            card.href = data.file;
        }

        card.className = `month-card ${data.status}`;

        /* Badge kelompok */
        let badge = '';
        if (data.tipe === 'guru') badge = '👨‍🏫 Guru';
        else badge = `👥 ${data.kelompok}`;

        /* Ikon status */
        let statusIcon = '';
        if (data.status === 'completed') statusIcon = '✅';
        else if (data.status === 'in-progress') statusIcon = '🔄';
        else if (data.status === 'postponed') statusIcon = '️';
        else statusIcon = '';

        /* Notice untuk postponed */
        let notice = '';
        if (data.status === 'postponed') {
            notice = '<div class="development-notice">Ditunda — akan diisi menyusul</div>';
        } else if (data.status === 'pending') {
            notice = '<div class="development-notice">Dalam tahap pengembangan</div>';
        }

        card.innerHTML = `
            <div class="status-icon">${statusIcon}</div>
            <div class="month-header">
                <span class="month-name">${data.bulan}</span>
                <span class="month-badge">${badge}</span>
            </div>
            <div class="proof-number">Bukti #${data.nomor}</div>
            <div class="proof-title">${data.pembuktian}</div>
            <div class="group-name">${data.kelompok}</div>
            ${notice}
        `;

        if (!isClickable) {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                alert(`Pembuktian ${data.bulan} (${data.pembuktian}) belum tersedia.\n\nStatus: ${data.status}`);
            });
        }

        grid.appendChild(card);
    });
}

/* =====================================================
   Render tabel distribusi kelompok (untuk index.html)
   ===================================================== */
function renderTabelKelompok() {
    const tbody = document.getElementById('kelompokBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    kalenderData.forEach(data => {
        const tr = document.createElement('tr');
        let badgeClass = 'pending';
        let badgeText = '⏳ Belum';
        if (data.status === 'completed') { badgeClass = 'done'; badgeText = '✅ Selesai'; }
        else if (data.status === 'postponed') { badgeClass = 'postponed'; badgeText = '⏸️ Ditunda'; }
        else if (data.status === 'in-progress') { badgeClass = 'in-progress'; badgeText = ' Sedang'; }

        tr.innerHTML = `
            <td><strong>${data.kelompok}</strong></td>
            <td>${data.bulan}</td>
            <td>${data.pembuktian}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

/* =====================================================
   Hitung statistik untuk progress bar
   ===================================================== */
function getStats() {
    const total = kalenderData.length;
    const completed = kalenderData.filter(d => d.status === 'completed').length;
    const postponed = kalenderData.filter(d => d.status === 'postponed').length;
    const pending = total - completed - postponed;
    return { total, completed, postponed, pending };
}

/* =====================================================
   Inisialisasi saat DOM siap
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
    renderKalender();
    renderTabelKelompok();

    /* Update progress bar bila ada */
    const stats = getStats();
    const pbar = document.getElementById('progressFill');
    const ptxt = document.getElementById('progressText');
    const legendDone = document.getElementById('legendDone');
    const legendPost = document.getElementById('legendPost');
    const legendPend = document.getElementById('legendPend');

    if (pbar) pbar.style.width = (stats.completed / stats.total * 100) + '%';
    if (ptxt) ptxt.textContent = `${stats.completed}/${stats.total} Selesai`;
    if (legendDone) legendDone.textContent = `✅ Selesai (${stats.completed})`;
    if (legendPost) legendPost.textContent = `️ Ditunda (${stats.postponed})`;
    if (legendPend) legendPend.textContent = `⏳ Belum (${stats.pending})`;
});

/* Export untuk penggunaan eksternal */
window.kalenderData = kalenderData;
window.getStats = getStats;
