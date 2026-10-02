/**
 * Mesin_Kisi.js — Metadata per MATERI + mapping LKPD→materi
 * v2.0
 */
window.MESIN_KISI = {
  mapel: 'Matematika', kelas: 8, semester: 'Ganjil', tahun: '2025/2026',

  // ===== METADATA PER MATERI (sumber Kisi-kisi.html) =====
  materi: {
    m011: { tp: 'Menerapkan sifat operasi perpangkatan', indikator: 'Menyederhanakan perkalian/pembagian berpangkat', level: ['C2','C3'], bentuk: ['Scaffolding','Isian','Pilihan Ganda'], bank: { M:20, S:20, U:20 }, figure: null },
    m012: { tp: 'Menyajikan bilangan dalam bentuk baku', indikator: 'Mengubah desimal/bulat ↔ bentuk baku', level: ['C2'], bentuk: ['Pilihan Ganda'], bank: { M:10, S:10, U:10 }, figure: null },
    m013: { tp: 'Menerapkan operasi bentuk akar', indikator: 'Menyederhanakan penjumlahan/perkalian akar', level: ['C2','C3'], bentuk: ['Pilihan Ganda'], bank: { M:20, S:20, U:20 }, figure: null },
    m014: { tp: 'Merasionalkan penyebut', indikator: 'Merasionalkan pecahan berpenyebut akar', level: ['C3'], bentuk: ['Isian','Pilihan Ganda'], bank: { M:14, S:13, U:13 }, figure: null },
    m015a: { tp: 'Penerapan pangkat', indikator: 'Soal cerita pangkat', level: ['C3'], bentuk: ['Pilihan Ganda'], bank: { M:10, S:10, U:10 }, figure: null },
    m015b: { tp: 'Penerapan akar', indikator: 'Soal cerita akar', level: ['C3'], bentuk: ['Pilihan Ganda'], bank: { M:10, S:10, U:10 }, figure: null },
    m021: { tp: 'Memahami teorema Pythagoras', indikator: 'Pembuktian & penerapan dasar', level: ['C2'], bentuk: ['Scaffolding'], bank: { M:10, S:10, U:10 }, figure: 'Figure ABC' },
    m021a: { tp: 'Variasi rumus Pythagoras', indikator: 'Menentukan rumus yang benar', level: ['C2'], bentuk: ['Benar/Salah'], bank: { M:0, S:0, U:0 }, figure: 'Figure ABC' },
    m022: { tp: 'Mengidentifikasi jenis segitiga', indikator: 'Lancip/siku/tumpul dari sisi', level: ['C2','C3'], bentuk: ['Scaffolding','Dropdown'], bank: { M:10, S:10, U:10 }, figure: null },
    m022a: { tp: 'Jenis segitiga (B/S)', indikator: 'Varian B/S', level: ['C2'], bentuk: ['Benar/Salah'], bank: { M:0, S:0, U:0 }, figure: null },
    m023: { tp: 'Pythagoras bangun gabungan', indikator: 'Hitung sisi pada segitiga gabungan', level: ['C3'], bentuk: ['Pilihan Ganda'], bank: { M:5, S:5, U:5 }, figure: ['F1','F2','F3','F4','F5'] },
    m023a: { tp: 'Pythagoras persegi', indikator: 'Diagonal persegi', level: ['C3'], bentuk: ['Pilihan Ganda'], bank: { M:5, S:5, U:5 }, figure: 'Persegi' },
    m024: { tp: 'Segitiga istimewa', indikator: 'Rasio 30-60-90 & 45-45-90', level: ['C3'], bentuk: ['Pilihan Ganda'], bank: { M:5, S:5, U:5 }, figure: 'Istimewa' }
  },

  // ===== MAPPING LKPD → MATERI =====
  lkpd: {
    'MTK-005': {
      judul: 'Berpangkat, Akar, Pythagoras (PTS)',
      materi: ['m011','m012','m013','m014','m021a','m022','m023'],
      komposisi: {
        K1: { materi: 'm014', bentuk: 'kartu+bs', jumlah: 6, bobot: 50 },
        K2: { materi: 'm023', bentuk: 'scaffold', jumlah: 1, bobot: 50, figure: 'F7' },
        KUIS: {
          Q1: { materi: 'm011', bentuk: 'mc', jumlah: 6, bobot: 10 },
          Q2: { materi: 'm013', bentuk: 'mc', jumlah: 6, bobot: 10 },
          Q3: { materi: 'm012', bentuk: 'mc', jumlah: 4, bobot: 10 },
          Q4: { materi: 'm021a', bentuk: 'bs', jumlah: 10, bobot: 10 },
          Q5: { materi: 'm022', bentuk: 'scaffold+dropdown', jumlah: 10, bobot: 10 },
          Q6: { materi: 'm023', bentuk: 'mc2', jumlah: 1, bobot: 10 },
          Q7: { materi: 'm023', bentuk: 'mc3', jumlah: 1, bobot: 10 },
          Q8: { materi: 'm023', bentuk: 'mc2', jumlah: 1, bobot: 10 },
          Q9: { materi: 'm023', bentuk: 'mc2', jumlah: 1, bobot: 10 },
          Q10: { materi: 'm023', bentuk: 'mc2', jumlah: 1, bobot: 10 }
        }
      },
      waktu: { total: 2400, minExit: 1200, overtime: 600 }
    }
  }
};