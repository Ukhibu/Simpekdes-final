/**
 * LOCAL INTENT SERVICE
 * Bertugas menangani perintah navigasi dan pertanyaan dasar secara lokal
 * tanpa menggunakan kuota API Key.
 */

export const checkLocalIntent = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase().trim();
    
    // Keyword Matching
    const actionWords = ['buka', 'lihat', 'pergi', 'tuju', 'akses', 'menu', 'tampilkan', 'ke', 'pindah'];
    const isNavigationRequest = actionWords.some(w => lower.includes(w));

    // Jika user hanya menyapa
    if (lower === 'halo' || lower === 'hai' || lower === 'selamat pagi' || lower === 'assalamualaikum') {
        return {
            text: "Waalaikumsalam / Halo! 👋 Ada yang bisa saya bantu? Katakan 'Buka Menu Keuangan' atau tanyakan sesuatu.",
            actionPath: null
        };
    }

    // --- LOGIKA NAVIGASI ---
    
    // 1. Dashboard & Umum
    if (lower.includes('dashboard') || lower.includes('beranda') || lower.includes('halaman utama')) {
        return { text: "Siap, kembali ke **Dashboard Utama**. [NAVIGATE:/app]", actionPath: '/app' };
    }
    if (lower.includes('pengaturan') || lower.includes('setting')) {
        return { text: "Membuka halaman **Pengaturan Aplikasi**. [NAVIGATE:/app/pengaturan]", actionPath: '/app/pengaturan' };
    }
    if (lower.includes('kalender') || lower.includes('agenda')) {
        return { text: "Membuka **Kalender Kegiatan**. [NAVIGATE:/app/kalender-kegiatan]", actionPath: '/app/kalender-kegiatan' };
    }

    // 2. Keuangan
    if (lower.includes('keuangan') || lower.includes('anggaran') || lower.includes('apbdes')) {
        return { text: "Baik, saya bukakan modul **Keuangan Desa**. [NAVIGATE:/app/keuangan]", actionPath: '/app/keuangan' };
    }

    // 3. Aset
    if (lower.includes('aset') || lower.includes('inventaris') || lower.includes('barang')) {
        if (lower.includes('peta')) return { text: "Membuka **Peta Aset**. [NAVIGATE:/app/aset/peta]", actionPath: '/app/aset/peta' };
        return { text: "Siap, menuju menu **Aset & Inventaris**. [NAVIGATE:/app/aset]", actionPath: '/app/aset' };
    }

    // 4. Pemerintahan / Perangkat
    if (lower.includes('perangkat') || lower.includes('staf') || lower.includes('pegawai')) {
        return { text: "Membuka data **Perangkat Desa**. [NAVIGATE:/app/perangkat]", actionPath: '/app/perangkat' };
    }

    // 5. Surat / SK
    if (lower.includes('surat') || lower.includes('sk') || lower.includes('arsip')) {
        return { text: "Membuka manajemen **Surat & SK**. [NAVIGATE:/app/manajemen-sk]", actionPath: '/app/manajemen-sk' };
    }

    // 6. Lembaga Desa
    if (lower.includes('bpd')) return { text: "Membuka menu **BPD**. [NAVIGATE:/app/bpd]", actionPath: '/app/bpd' };
    if (lower.includes('lpm')) return { text: "Membuka menu **LPM**. [NAVIGATE:/app/lpm]", actionPath: '/app/lpm' };
    if (lower.includes('pkk')) return { text: "Membuka menu **PKK**. [NAVIGATE:/app/pkk]", actionPath: '/app/pkk' };
    if (lower.includes('karang taruna')) return { text: "Membuka menu **Karang Taruna**. [NAVIGATE:/app/karang-taruna]", actionPath: '/app/karang-taruna' };
    
    // 7. Kependudukan
    if (lower.includes('rt') || lower.includes('rw') || lower.includes('penduduk')) {
        return { text: "Menuju data **RT/RW & Kependudukan**. [NAVIGATE:/app/rt-rw]", actionPath: '/app/rt-rw' };
    }

    // 8. Laporan
    if (lower.includes('laporan') || lower.includes('rekap')) {
        return { text: "Membuka pusat **Laporan**. [NAVIGATE:/app/laporan]", actionPath: '/app/laporan' };
    }

    // Jika kata perintah ada tapi tujuannya tidak dikenali
    if (isNavigationRequest) {
        return { 
            text: "Saya mengerti Anda ingin navigasi, tapi saya belum paham tujuannya. Coba katakan 'Buka Keuangan' atau 'Lihat Aset'.",
            actionPath: null 
        };
    }

    // Tidak ada match lokal -> Lempar ke AI API
    return null;
};