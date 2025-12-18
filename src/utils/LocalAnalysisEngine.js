/**
 * LocalAnalysisEngine.js
 * Menangani analisis data lokal untuk prediksi, pencarian cerdas, DAN navigasi cepat (Offline).
 */

export const analyzeLocalIntent = (text, contextData = {}) => {
    const lowerText = text.toLowerCase().trim();
  
    // --- FITUR 0: FAST NAVIGATION (OFFLINE & CEPAT) ---
    // Logika ini dipindahkan dari AIAssistant.js agar terpusat di sini
    const actionWords = ['buka', 'lihat', 'pergi', 'tuju', 'akses', 'menu', 'tampilkan', 'ke'];
    // Cek apakah ada kata kerja aksi ATAU kalimat sangat pendek (biasanya perintah navigasi)
    const hasAction = actionWords.some(w => lowerText.includes(w));
    const isShortCommand = lowerText.split(' ').length <= 4; 

    if (hasAction || isShortCommand) {
        // 1. Dashboard Utama
        if (lowerText.includes('dashboard') || lowerText.includes('home') || lowerText.includes('beranda') || (lowerText.includes('halaman') && lowerText.includes('utama'))) {
            return { text: "Siap, kembali ke Dashboard Utama.", actionPath: '/app' };
        }
        
        // 2. Keuangan
        if (lowerText.includes('keuangan') || lowerText.includes('anggaran') || lowerText.includes('apbdes') || lowerText.includes('bku') || lowerText.includes('kas')) {
            return { text: "Baik, saya bukakan modul **Keuangan Desa**.", actionPath: '/app/keuangan' };
        }
        
        // 3. Aset
        if (lowerText.includes('aset') || lowerText.includes('inventaris') || lowerText.includes('barang') || lowerText.includes('kib')) {
            return { text: "Siap, menuju menu **Aset & Inventaris**.", actionPath: '/app/aset' };
        }
        
        // 4. Perangkat Desa
        if (lowerText.includes('perangkat') || lowerText.includes('staf') || lowerText.includes('pegawai') || lowerText.includes('aparatur')) {
            return { text: "Membuka data **Perangkat Desa**.", actionPath: '/app/perangkat' };
        }
        
        // 5. Surat / SK / Arsip
        if (lowerText.includes('surat') || lowerText.includes('sk') || lowerText.includes('arsip') || lowerText.includes('dokumen')) {
            return { text: "Membuka manajemen **Surat & SK**.", actionPath: '/app/manajemen-sk' };
        }
        
        // 6. Lembaga Desa
        if (lowerText.includes('bpd')) return { text: "Membuka menu **BPD**.", actionPath: '/app/bpd' };
        if (lowerText.includes('lpm')) return { text: "Membuka menu **LPM**.", actionPath: '/app/lpm' };
        if (lowerText.includes('pkk')) return { text: "Membuka menu **PKK**.", actionPath: '/app/pkk' };
        if (lowerText.includes('karang taruna') || lowerText.includes('pemuda')) return { text: "Membuka menu **Karang Taruna**.", actionPath: '/app/karang-taruna' };
        
        // 7. Kependudukan (RT/RW)
        if (lowerText.includes('rt') || lowerText.includes('rw') || lowerText.includes('penduduk') || lowerText.includes('warga')) {
            return { text: "Menuju data **RT/RW & Kependudukan**.", actionPath: '/app/rt-rw' };
        }
        
        // 8. Laporan
        if (lowerText.includes('laporan') || lowerText.includes('rekap')) {
            return { text: "Membuka pusat **Laporan**.", actionPath: '/app/laporan' };
        }
        
        // 9. Pengaturan
        if (lowerText.includes('pengaturan') || lowerText.includes('setting') || lowerText.includes('konfigurasi')) {
            return { text: "Membuka halaman **Pengaturan Aplikasi**.", actionPath: '/app/pengaturan' };
        }
        
        // 10. Kalender
        if (lowerText.includes('kalender') || lowerText.includes('agenda') || lowerText.includes('jadwal')) {
            return { text: "Membuka **Kalender Kegiatan**.", actionPath: '/app/kalender-kegiatan' };
        }
    }

    // --- FITUR 1: PREDICTIVE ANALYTICS (ANGGARAN & PENDUDUK) ---
    if (lowerText.includes('prediksi') || lowerText.includes('tren') || lowerText.includes('proyeksi')) {
        
        if (lowerText.includes('penduduk') || lowerText.includes('populasi') || lowerText.includes('warga')) {
            // Simulasi Data Historis Penduduk
            // Data ini statis untuk demo, idealnya diambil dari database real-time
            const currentYear = new Date().getFullYear();
            const nextYearVal = currentYear + 1;
            const twoYearsVal = currentYear + 2;
            
            const growthRate = 50; // Asumsi kenaikan per tahun
            const basePop = 1450;
            const nextPop = basePop + growthRate;

            return {
                type: 'prediction',
                text: `Berdasarkan data demografi, tren pertumbuhan penduduk desa menunjukkan kenaikan rata-rata **${growthRate} jiwa/tahun**. \n\n**Proyeksi:**\n- ${nextYearVal}: ±${nextPop} jiwa\n- ${twoYearsVal}: ±${nextPop + growthRate} jiwa. \n\nDisarankan untuk memprioritaskan anggaran layanan dasar.`,
                chartData: {
                    labels: ['2020', '2021', '2022', '2023', '2024', `${nextYearVal} (Est)`],
                    datasets: [{
                        label: 'Total Penduduk',
                        data: [1200, 1250, 1320, 1380, 1450, nextPop],
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        tension: 0.4,
                        fill: true
                    }]
                }
            };
        }

        if (lowerText.includes('anggaran') || lowerText.includes('dana') || lowerText.includes('keuangan')) {
             // Simulasi Data Anggaran
             const inflationRate = 0.05; // 5% inflasi
             const currentBudget = 1500000000; // 1.5 Milyar
             const projectedBudget = currentBudget * (1 + inflationRate);

             return {
                type: 'prediction',
                text: `Untuk mempertahankan kualitas layanan desa tahun depan dengan asumsi inflasi 5%, estimasi kebutuhan anggaran adalah **Rp ${(projectedBudget/1000000000).toFixed(2)} Milyar**.`,
                chartData: {
                    type: 'bar',
                    labels: ['2023', '2024', '2025 (Est)'],
                    datasets: [{
                        label: 'Kebutuhan Anggaran (Milyar)',
                        data: [1.3, 1.5, projectedBudget/1000000000],
                        backgroundColor: ['#94a3b8', '#6366f1', '#10b981'],
                        borderRadius: 6
                    }]
                }
             };
        }
    }

    // --- FITUR 2: VOICE SEARCH INTENT (PENCARIAN DATA) ---
    // Pola: "Cari [data] [nama] di [lokasi]"
    if (lowerText.startsWith('cari') || lowerText.startsWith('temukan')) {
        const nameMatch = lowerText.match(/bernama\s+(\w+)/i) || lowerText.match(/cari\s+(\w+)/i);
        const locationMatch = lowerText.match(/di\s+(rt\s*\d+|rw\s*\d+)/i);

        if (nameMatch) {
            const name = nameMatch[1];
            const location = locationMatch ? locationMatch[1].toUpperCase() : 'Desa';
            
            return {
                type: 'search',
                text: `🔍 **Pencarian Cepat:**\nSedang mencari data warga bernama **"${name}"** di wilayah **${location}**...\n\n*[Sistem akan menampilkan hasil pencarian di halaman Kependudukan]*`,
                actionPath: '/app/rt-rw/rt', // Arahkan ke halaman terkait
                isSearchAction: true
            };
        }
    }

    return null; // Tidak ada match lokal, lempar ke AI LLM
};