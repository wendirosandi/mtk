const kalenderData = [
    {         bulan: "Januari",        nomor: 1,        pembuktian: "Sel Terbang Pythagoras",
        kelompok: "Contoh Guru",        tipe: "guru",        status: "completed",
        file: "pages/bukti-01-januari.html"     },
{ bulan:"Februari", nomor:2, pembuktian:"Rearrangement 4 Segitiga",
  kelompok:"Contoh Guru", tipe:"guru", status:"completed", 
  file:"pages/bukti-02-februari.html" },
{ bulan:"Maret", nomor:3, pembuktian:"Diseksi Perigal (Slice Fleksibel)",
  kelompok:"Kelompok 1", tipe:"siswa", status:"completed",
  file:"pages/bukti-03-maret.html" },
{ bulan:"April",  nomor:4, pembuktian:"Perigal Preset O− M− (5-12-13)",  kelompok:"Kelompok 2", tipe:"siswa", status:"completed", file:"pages/bukti-04-april.html" },
{ bulan:"Mei",    nomor:5, pembuktian:"Perigal Preset O− M+ (8-15-17)",  kelompok:"Kelompok 3", tipe:"siswa", status:"completed", file:"pages/bukti-05-mei.html" },
{ bulan:"Juni",   nomor:6, pembuktian:"Perigal Preset O+ M+ (9-40-41)",  kelompok:"Kelompok 4", tipe:"siswa", status:"completed", file:"pages/bukti-06-juni.html" },
{ bulan:"Juli",   nomor:7, pembuktian:"Perigal Preset O+ M− (7-24-25)",  kelompok:"Kelompok 5", tipe:"siswa", status:"completed", file:"pages/bukti-07-juli.html" },  
 
    {
        bulan: "Agustus",
        nomor: 8,
        pembuktian: "Rearrangement Proof",
        kelompok: "Kelompok 6",
        tipe: "siswa",
        status: "pending",
        file: "#"
    },
    {
        bulan: "September",
        nomor: 9,
        pembuktian: "Pembuktian Perigord",
        kelompok: "Kelompok 7",
        tipe: "siswa",
        status: "pending",
        file: "#"
    },
    {
        bulan: "Oktober",
        nomor: 10,
        pembuktian: "Leonardo da Vinci",
        kelompok: "Kelompok 8",
        tipe: "siswa",
        status: "pending",
        file: "#"
    },
    {
        bulan: "November",
        nomor: 11,
        pembuktian: "Pembuktian Pappus",
        kelompok: "Kelompok 9",
        tipe: "siswa",
        status: "pending",
        file: "#"
    },
    {
        bulan: "Desember",
        nomor: 12,
        pembuktian: "Shear Proof",
        kelompok: "Kelompok 10",
        tipe: "siswa",
        status: "pending",
        file: "#"
    }
];

function renderKalender() {
    const grid = document.getElementById('calendarGrid');
    
    kalenderData.forEach(data => {
        const card = document.createElement(data.status === 'completed' ? 'a' : 'div');
        
        if (data.status === 'completed') {
            card.href = data.file;
        }
        
        card.className = `month-card ${data.status}`;
        
        let badge = '';
        if (data.tipe === 'guru') {
            badge = '👨‍🏫 Guru';
        } else {
            badge = `👥 Kel. ${data.nomor - 2}`;
        }
        
        let statusIcon = '';
        if (data.status === 'completed') {
            statusIcon = '✅';
        } else if (data.status === 'in-progress') {
            statusIcon = '🔄';
        } else {
            statusIcon = '⏳';
        }
        
        let notice = '';
        if (data.status === 'pending') {
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
        
        if (data.status === 'pending') {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                alert(`Pembuktian ${data.bulan} masih dalam tahap pengembangan.\n\nSilakan tunggu sampai kelompok selesai mengerjakan.`);
            });
        }
        
        grid.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', renderKalender);
