import { findLocalKnowledge } from './localKnowledgeBase';

/**
 * DAFTAR AKSI CEPAT (QUICK ACTIONS)
 * Muncul otomatis saat user menyapa atau meminta menu.
 */
export const QUICK_ACTIONS = [
    { label: "🏠 Dashboard", text: "Buka Dashboard" },
    { label: "👥 Perangkat", text: "Buka Perangkat" },
    { label: "💰 Keuangan", text: "Buka Keuangan" },
    { label: "🗺️ Peta Aset", text: "Buka Peta Aset" },
    { label: "📄 Layanan SK", text: "Buka Manajemen SK" },
    { label: "⚙️ Pengaturan", text: "Buka Pengaturan" },
    { label: "📊 Laporan", text: "Buka Laporan" },
    { label: "🏘️ Data RT/RW", text: "Buka RT RW" }
];

/**
 * LOCAL INTENT SERVICE
 * Menggabungkan Navigasi Perintah & Database Pengetahuan Lokal
 * Mencakup seluruh rute aplikasi Simpekdes.
 */
export const checkLocalIntent = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase().trim();

    // 1. CEK DATABASE PENGETAHUAN (Q&A SIMPEKDES)
    const knowledgeAnswer = findLocalKnowledge(lower);
    if (knowledgeAnswer) {
        return {
            text: knowledgeAnswer,
            actionPath: null,
            isKnowledge: true
        };
    }
    
    // 2. CEK SAPAAN DASAR (Trigger Quick Actions)
    if (['halo', 'hai', 'pagi', 'siang', 'sore', 'malam', 'tes', 'assalamualaikum', 'ping', 'permisi', 'menu', 'bantuan', 'help'].some(w => lower === w || lower.startsWith(w + ' '))) {
        return {
            text: "Halo! 👋 Saya siap membantu administrasi desa Anda. Silakan pilih **Menu Cepat** di bawah ini untuk navigasi instan, atau tanyakan sesuatu.",
            actionPath: null,
            isGreeting: true // Marker penting untuk memunculkan tombol aksi
        };
    }

    // 3. LOGIKA NAVIGASI LENGKAP

    // --- A. DASHBOARD & UMUM ---
    if (lower.includes('dashboard utama') || lower === 'dashboard' || lower === 'beranda' || lower === 'home') {
        return { text: "Siap, kembali ke **Dashboard Utama**. [NAVIGATE:/app]", actionPath: '/app' };
    }
    if (lower.includes('organisasi desa hub') || lower.includes('pusat organisasi')) {
        return { text: "Membuka **Hub Organisasi Desa**. [NAVIGATE:/app/organisasi-desa]", actionPath: '/app/organisasi-desa' };
    }

    // --- B. MODUL PEMERINTAHAN ---
    if (lower.includes('histori perangkat') || lower.includes('purna tugas') || lower.includes('mantan perangkat')) {
        return { text: "Membuka data **Histori Perangkat Desa**. [NAVIGATE:/app/histori-perangkat]", actionPath: '/app/histori-perangkat' };
    }
    if (lower.includes('rekapitulasi aparatur') || lower.includes('rekap perangkat')) {
        return { text: "Membuka **Rekapitulasi Aparatur**. [NAVIGATE:/app/rekapitulasi-aparatur]", actionPath: '/app/rekapitulasi-aparatur' };
    }
    if (lower.includes('perangkat') || lower.includes('staf') || lower.includes('aparatur')) {
        return { text: "Membuka data **Perangkat Desa**. [NAVIGATE:/app/perangkat]", actionPath: '/app/perangkat' };
    }
    if (lower.includes('kalender') || lower.includes('agenda') || lower.includes('kegiatan desa')) {
        return { text: "Membuka **Kalender Kegiatan**. [NAVIGATE:/app/kalender-kegiatan]", actionPath: '/app/kalender-kegiatan' };
    }
    // Cek laporan spesifik dulu (keuangan), baru laporan umum
    if (lower.includes('laporan umum') || (lower.includes('laporan') && !lower.includes('keuangan') && !lower.includes('realisasi'))) {
        return { text: "Membuka halaman **Laporan Umum**. [NAVIGATE:/app/laporan]", actionPath: '/app/laporan' };
    }
    if (lower.includes('manajemen admin') || lower.includes('kelola user') || lower.includes('daftar admin')) {
        return { text: "Membuka **Manajemen Admin**. [NAVIGATE:/app/manajemen-admin]", actionPath: '/app/manajemen-admin' };
    }
    if (lower.includes('pengaturan') || lower.includes('setting') || lower.includes('konfigurasi')) {
        return { text: "Membuka **Pengaturan Aplikasi**. [NAVIGATE:/app/pengaturan]", actionPath: '/app/pengaturan' };
    }

    // --- C. ORGANISASI DESA (BPD, LPM, PKK, Karang Taruna, RT/RW) ---
    
    // 1. BPD
    if (lower.includes('berita acara bpd') || lower.includes('musyawarah bpd')) {
        return { text: "Membuka **Berita Acara BPD**. [NAVIGATE:/app/bpd/berita-acara]", actionPath: '/app/bpd/berita-acara' };
    }
    if (lower.includes('pengaturan bpd')) {
        return { text: "Membuka **Pengaturan BPD**. [NAVIGATE:/app/bpd/pengaturan]", actionPath: '/app/bpd/pengaturan' };
    }
    if (lower.includes('data bpd') || lower.includes('anggota bpd')) {
        return { text: "Membuka **Data Anggota BPD**. [NAVIGATE:/app/bpd/data]", actionPath: '/app/bpd/data' };
    }
    if (lower.includes('bpd') || lower.includes('badan permusyawaratan')) {
        return { text: "Membuka **Dashboard BPD**. [NAVIGATE:/app/bpd]", actionPath: '/app/bpd' };
    }

    // 2. LPM
    if (lower.includes('program lpm') || lower.includes('kegiatan lpm')) {
        return { text: "Membuka **Program Kerja LPM**. [NAVIGATE:/app/lpm/program]", actionPath: '/app/lpm/program' };
    }
    if (lower.includes('data lpm') || lower.includes('anggota lpm')) {
        return { text: "Membuka **Data Anggota LPM**. [NAVIGATE:/app/lpm/data]", actionPath: '/app/lpm/data' };
    }
    if (lower.includes('lpm')) {
        return { text: "Membuka **Dashboard LPM**. [NAVIGATE:/app/lpm]", actionPath: '/app/lpm' };
    }

    // 3. PKK
    if (lower.includes('program pkk') || lower.includes('kegiatan pkk')) {
        return { text: "Membuka **Program Kerja PKK**. [NAVIGATE:/app/pkk/program]", actionPath: '/app/pkk/program' };
    }
    if (lower.includes('data pkk') || lower.includes('anggota pkk') || lower.includes('kader pkk')) {
        return { text: "Membuka **Data Anggota PKK**. [NAVIGATE:/app/pkk/data]", actionPath: '/app/pkk/data' };
    }
    if (lower.includes('pkk')) {
        return { text: "Membuka **Dashboard PKK**. [NAVIGATE:/app/pkk]", actionPath: '/app/pkk' };
    }

    // 4. Karang Taruna
    if (lower.includes('kegiatan karang taruna') || lower.includes('acara pemuda')) {
        return { text: "Membuka **Kegiatan Karang Taruna**. [NAVIGATE:/app/karang-taruna/kegiatan]", actionPath: '/app/karang-taruna/kegiatan' };
    }
    if (lower.includes('data karang taruna') || lower.includes('anggota karang taruna')) {
        return { text: "Membuka **Data Pengurus Karang Taruna**. [NAVIGATE:/app/karang-taruna/data]", actionPath: '/app/karang-taruna/data' };
    }
    if (lower.includes('karang taruna') || lower.includes('pemuda')) {
        return { text: "Membuka **Dashboard Karang Taruna**. [NAVIGATE:/app/karang-taruna]", actionPath: '/app/karang-taruna' };
    }

    // 5. RT/RW
    if (lower.includes('rekap rt') || lower.includes('rekap rw') || lower.includes('rekap penduduk')) {
        return { text: "Membuka **Rekapitulasi RT/RW**. [NAVIGATE:/app/rt-rw/rekapitulasi]", actionPath: '/app/rt-rw/rekapitulasi' };
    }
    if (lower.includes('data rt') || lower.includes('ketua rt')) {
        return { text: "Membuka **Data RT**. [NAVIGATE:/app/rt-rw/rt]", actionPath: '/app/rt-rw/rt' };
    }
    if (lower.includes('data rw') || lower.includes('ketua rw')) {
        return { text: "Membuka **Data RW**. [NAVIGATE:/app/rt-rw/rw]", actionPath: '/app/rt-rw/rw' };
    }
    if (lower.includes('rt') || lower.includes('rw') || lower.includes('kependudukan')) {
        return { text: "Membuka **Dashboard RT/RW & Kependudukan**. [NAVIGATE:/app/rt-rw]", actionPath: '/app/rt-rw' };
    }

    // --- D. MODUL E-FILE & SK ---
    // Spesifik Data SK
    if (lower.includes('sk perangkat')) return { text: "Membuka **Data SK Perangkat Desa**. [NAVIGATE:/app/data-sk/perangkat]", actionPath: '/app/data-sk/perangkat' };
    if (lower.includes('sk bpd')) return { text: "Membuka **Data SK BPD**. [NAVIGATE:/app/data-sk/bpd]", actionPath: '/app/data-sk/bpd' };
    if (lower.includes('sk lpm')) return { text: "Membuka **Data SK LPM**. [NAVIGATE:/app/data-sk/lpm]", actionPath: '/app/data-sk/lpm' };
    if (lower.includes('sk pkk')) return { text: "Membuka **Data SK PKK**. [NAVIGATE:/app/data-sk/pkk]", actionPath: '/app/data-sk/pkk' };
    if (lower.includes('sk karang taruna')) return { text: "Membuka **Data SK Karang Taruna**. [NAVIGATE:/app/data-sk/karang_taruna]", actionPath: '/app/data-sk/karang_taruna' };
    if (lower.includes('sk rt') || lower.includes('sk rw')) return { text: "Membuka **Data SK RT/RW**. [NAVIGATE:/app/data-sk/rt_rw]", actionPath: '/app/data-sk/rt_rw' };

    if (lower.includes('manajemen sk') || lower.includes('upload sk') || lower.includes('input sk')) {
        return { text: "Membuka **Manajemen SK**. [NAVIGATE:/app/manajemen-sk]", actionPath: '/app/manajemen-sk' };
    }
    if (lower.includes('efile') || lower.includes('e-file') || lower.includes('arsip')) {
        return { text: "Membuka **Dashboard E-File**. [NAVIGATE:/app/efile]", actionPath: '/app/efile' };
    }

    // --- E. MODUL KEUANGAN ---
    if (lower.includes('penganggaran') || lower.includes('apbdes') || lower.includes('anggaran')) {
        return { text: "Membuka **Penganggaran (APBDes)**. [NAVIGATE:/app/keuangan/penganggaran]", actionPath: '/app/keuangan/penganggaran' };
    }
    if (lower.includes('penatausahaan') || lower.includes('bku') || lower.includes('kas umum')) {
        return { text: "Membuka **Penatausahaan (BKU)**. [NAVIGATE:/app/keuangan/penatausahaan]", actionPath: '/app/keuangan/penatausahaan' };
    }
    if (lower.includes('laporan realisasi') || (lower.includes('laporan') && lower.includes('keuangan'))) {
        return { text: "Membuka **Laporan Realisasi Anggaran**. [NAVIGATE:/app/keuangan/laporan]", actionPath: '/app/keuangan/laporan' };
    }
    if (lower.includes('keuangan')) {
        return { text: "Membuka **Dashboard Keuangan**. [NAVIGATE:/app/keuangan]", actionPath: '/app/keuangan' };
    }

    // --- F. MODUL ASET ---
    if (lower.includes('manajemen aset') || lower.includes('data barang') || lower.includes('input aset')) {
        return { text: "Membuka **Manajemen Aset (KIB)**. [NAVIGATE:/app/aset/manajemen]", actionPath: '/app/aset/manajemen' };
    }
    if (lower.includes('peta aset') || lower.includes('lokasi aset') || lower.includes('gis')) {
        return { text: "Membuka **Peta Aset Desa**. [NAVIGATE:/app/aset/peta]", actionPath: '/app/aset/peta' };
    }
    if (lower.includes('aset') || lower.includes('inventaris')) {
        return { text: "Membuka **Dashboard Aset**. [NAVIGATE:/app/aset]", actionPath: '/app/aset' };
    }

    return null; // Tidak ada match lokal -> Lanjut ke AI Cloud
};