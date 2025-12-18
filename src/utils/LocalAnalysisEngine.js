/**
 * LocalAnalysisEngine.js
 * "Otak" lokal untuk analisis data statistik tanpa API eksternal.
 * Menggunakan algoritma rule-based untuk menghasilkan insight.
 */

// --- MOCK DATA GENERATOR (Simulasi Data) ---
const generateMockKeuangan = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];
    return months.map(m => ({
        name: m,
        pendapatan: Math.floor(Math.random() * (500 - 300) + 300), // Juta
        pengeluaran: Math.floor(Math.random() * (400 - 200) + 200) // Juta
    }));
};

const generateMockPenduduk = () => [
    { name: 'Anak-anak', value: 350, fill: '#8884d8' },
    { name: 'Remaja', value: 420, fill: '#82ca9d' },
    { name: 'Dewasa', value: 850, fill: '#ffc658' },
    { name: 'Lansia', value: 210, fill: '#ff8042' },
];

// --- LOGIC UTAMA ---

export const analyzeLocalRequest = (text) => {
    if (!text) return null;
    const lower = text.toLowerCase();

    // 1. ANALISIS KEUANGAN
    if (lower.includes('analisis') && (lower.includes('keuangan') || lower.includes('anggaran') || lower.includes('belanja'))) {
        const data = generateMockKeuangan();
        
        // Hitung Insight Sederhana
        const totalPendapatan = data.reduce((acc, curr) => acc + curr.pendapatan, 0);
        const totalPengeluaran = data.reduce((acc, curr) => acc + curr.pengeluaran, 0);
        const surplus = totalPendapatan - totalPengeluaran;
        const status = surplus >= 0 ? "Surplus" : "Defisit";
        const trend = data[data.length-1].pengeluaran > data[0].pengeluaran ? "Meningkat" : "Menurun";

        const insightText = `
### 📊 Analisis Keuangan Desa (Semester 1)

Berdasarkan data realisasi anggaran terbaru:
- **Total Pendapatan:** Rp ${totalPendapatan} Juta
- **Total Belanja:** Rp ${totalPengeluaran} Juta
- **Status Anggaran:** **${status}** sebesar Rp ${Math.abs(surplus)} Juta

**Kesimpulan AI:**
Tren pengeluaran desa cenderung **${trend}** dalam 6 bulan terakhir. Kesehatan keuangan desa berada dalam kondisi **${surplus > 0 ? 'Baik (Aman)' : 'Perlu Perhatian'}**.
        `;

        return {
            type: 'chart_bar',
            text: insightText.trim(),
            chartData: data,
            chartConfig: { x: 'name', bar1: 'pendapatan', bar2: 'pengeluaran' }
        };
    }

    // 2. ANALISIS KEPENDUDUKAN (DEMOGRAFI)
    if (lower.includes('analisis') && (lower.includes('penduduk') || lower.includes('demografi') || lower.includes('warga'))) {
        const data = generateMockPenduduk();
        
        // Hitung Insight
        const totalWarga = data.reduce((acc, curr) => acc + curr.value, 0);
        const sorted = [...data].sort((a, b) => b.value - a.value);
        const dominan = sorted[0];

        const insightText = `
### 👥 Analisis Demografi Penduduk

Data kependudukan terkini menunjukkan:
- **Total Populasi:** ${totalWarga} Jiwa
- **Kelompok Dominan:** **${dominan.name}** (${Math.round((dominan.value/totalWarga)*100)}%)

**Kesimpulan AI:**
Desa memiliki bonus demografi yang ${dominan.name === 'Dewasa' || dominan.name === 'Remaja' ? 'kuat (Usia Produktif)' : 'menantang'}. Disarankan untuk memprioritaskan program pemberdayaan bagi kelompok **${dominan.name}**.
        `;

        return {
            type: 'chart_pie',
            text: insightText.trim(),
            chartData: data
        };
    }

    return null; // Bukan request analisis
};