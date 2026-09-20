/* =====================================================
   calendar-template.js — Blok kalender bulanan 2027
   (Bagian ATAS model Atas-Bawah pada template export)
   ===================================================== */
const MONTHS_2027 = {
    1:  { nama:'Januari',   offset:5, days:31 },  // offset = hari pertama (Min=0)
    2:  { nama:'Februari',  offset:1, days:28 },
    3:  { nama:'Maret',     offset:1, days:31 },
    4:  { nama:'April',     offset:4, days:30 },
    5:  { nama:'Mei',       offset:6, days:31 },
    6:  { nama:'Juni',      offset:2, days:30 },
    7:  { nama:'Juli',      offset:4, days:31 },
    8:  { nama:'Agustus',   offset:0, days:31 },
    9:  { nama:'September', offset:3, days:30 },
    10: { nama:'Oktober',   offset:5, days:31 },
    11: { nama:'November',  offset:1, days:30 },
    12: { nama:'Desember',  offset:3, days:31 }
};

function renderCalendar(container, month) {
    const d = MONTHS_2027[month];
    const dows = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
    let h = `<div class="cal-title">
                <span class="cal-month">${d.nama.toUpperCase()}</span>
                <span class="cal-year">2027</span>
             </div><div class="cal-grid">`;
    dows.forEach((w,i)=> h += `<div class="cal-dow${i===0?' sun':''}">${w}</div>`);
    for (let i=0;i<d.offset;i++) h += `<div class="cal-cell empty"></div>`;
    for (let day=1; day<=d.days; day++) {
        const dow = (d.offset + day - 1) % 7;
        h += `<div class="cal-cell${dow===0?' sun':''}">${day}</div>`;
    }
    h += `</div>
    <div class="cal-meta">
        <div class="cal-meta-title">📌 Meta Info — kreativitas siswa</div>
        <div class="cal-meta-line">• Ulang tahun : ....................................................</div>
        <div class="cal-meta-line">• Kegiatan sekolah : ..........................................</div>
        <div class="cal-meta-line">• Catatan : .........................................................</div>
    </div>`;
    container.innerHTML = h;
}
window.renderCalendar = renderCalendar;
