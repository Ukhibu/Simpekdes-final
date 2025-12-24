import { findLocalKnowledge } from './localKnowledgeBase';

/**
 * LOCAL INTENT SERVICE
 * Menggabungkan Navigasi Perintah & Database Pengetahuan Lokal
 */

export const checkLocalIntent = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase().trim();

    // 1. CEK DATABASE PENGETAHUAN (Q&A SIMPEKDES)
    // Ini prioritas agar pertanyaan tentang aplikasi dijawab cepat tanpa API
    const knowledgeAnswer = findLocalKnowledge(lower);
    if (knowledgeAnswer) {
        return {
            text: knowledgeAnswer,
            actionPath: null, // Biasanya Q&A tidak butuh navigasi, tapi bisa ditambahkan jika mau
            isKnowledge: true
        };
    }
    
    // 2. CEK SAPAAN DASAR
    if (['halo', 'hai', 'pagi', 'siang', 'sore', 'malam', 'tes'].includes(lower)) {
        return {
            text: "Halo! 👋 Saya siap membantu administrasi desa Anda. Tanyakan tentang fitur Simpekdes atau perintahkan saya untuk membuka menu.",
            actionPath: null
        };
    }

    // 3. LOGIKA NAVIGASI (Seperti Sebelumnya)
    // Dashboard & Umum
    if (lower.includes('dashboard') || lower.includes('beranda')) {
        return { text: "Siap, kembali ke **Dashboard Utama**. [NAVIGATE:/app]", actionPath: '/app' };
    }
    if (lower.includes('pengaturan') || lower.includes('setting')) {
        return { text: "Membuka halaman **Pengaturan Aplikasi**. [NAVIGATE:/app/pengaturan]", actionPath: '/app/pengaturan' };
    }
    
    // Keuangan
    if (lower.includes('keuangan') || lower.includes('anggaran')) {
        return { text: "Membuka modul **Keuangan Desa**. [NAVIGATE:/app/keuangan]", actionPath: '/app/keuangan' };
    }

    // Aset
    if (lower.includes('aset') || lower.includes('inventaris')) {
        if (lower.includes('peta')) return { text: "Membuka **Peta Aset**. [NAVIGATE:/app/aset/peta]", actionPath: '/app/aset/peta' };
        return { text: "Membuka menu **Aset & Inventaris**. [NAVIGATE:/app/aset]", actionPath: '/app/aset' };
    }

    // Surat
    if (lower.includes('surat') || lower.includes('sk')) {
        return { text: "Membuka manajemen **Surat & SK**. [NAVIGATE:/app/manajemen-sk]", actionPath: '/app/manajemen-sk' };
    }

    // RT/RW
    if (lower.includes('rt') || lower.includes('rw') || lower.includes('penduduk')) {
        return { text: "Menuju data **Kependudukan & Wilayah**. [NAVIGATE:/app/rt-rw]", actionPath: '/app/rt-rw' };
    }

    // Perangkat
    if (lower.includes('perangkat') || lower.includes('staf')) {
        return { text: "Membuka data **Perangkat Desa**. [NAVIGATE:/app/perangkat]", actionPath: '/app/perangkat' };
    }

    return null; // Tidak ada match lokal -> Lanjut ke AI Cloud
};