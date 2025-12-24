/**
 * DATABASE PENGETAHUAN LOKAL SIMPEKDES
 * Berisi FAQ dan Panduan Aplikasi.
 */

export const SIMPEKDES_KNOWLEDGE = [
    {
        id: 1,
        label: "Apa itu Simpekdes?",
        keywords: ["apa itu simpekdes", "fungsi aplikasi", "tentang aplikasi", "kegunaan"],
        answer: "**Simpekdes** (Sistem Informasi Manajemen Kepegawaian dan Desa) adalah platform digital terintegrasi untuk mempermudah administrasi pemerintah desa, mulai dari kependudukan, aset, hingga keuangan."
    },
    {
        id: 2,
        label: "Cara Login Aplikasi",
        keywords: ["cara login", "masuk aplikasi", "login", "sign in"],
        answer: "Untuk masuk, gunakan **Email** dan **Password** yang telah didaftarkan oleh Admin Kecamatan, lalu masukkan Email dan Password Anda."
    },
    {
        id: 3,
        label: "Lupa Password",
        keywords: ["lupa password", "ganti sandi", "reset password", "ubah kata sandi"],
        answer: "Jika lupa password, silakan hubungi **Admin Utama** di kantor desa/kecamatan."
    },
    {
        id: 4,
        label: "Tambah Penduduk",
        keywords: ["tambah penduduk", "input warga", "data baru", "tambah warga"],
        answer: "Masuk ke menu **Kependudukan (RT/RW)** -> Pilih RT/RW -> Klik tombol **+ Tambah Data**. Isi formulir dengan lengkap lalu Simpan."
    },
    {
        id: 5,
        label: "Buat Surat Keterangan",
        keywords: ["surat keterangan", "buat surat", "cetak sk", "layanan surat"],
        answer: "Buka menu **Manajemen SK/Surat**. Pilih jenis surat (Misal: Domisili, SKTM), cari nama warga, isi keperluan, dan klik **Cetak PDF**."
    },
    {
        id: 6,
        label: "Input Data Aset",
        keywords: ["input aset", "tambah aset", "data barang", "inventaris"],
        answer: "Pergi ke menu **Aset Desa** -> **Manajemen Aset**. Klik Tambah, pilih kategori (Tanah/Bangunan/Peralatan), dan isi detail serta lokasi koordinatnya."
    },
    {
        id: 7,
        label: "Laporan Keuangan",
        keywords: ["laporan keuangan", "realisasi anggaran", "apbdes", "transparansi"],
        answer: "Grafik realisasi bisa dilihat di **Dashboard Keuangan**. Untuk cetak laporan detail, masuk ke menu **Keuangan** -> **Laporan Realisasi**."
    },
    {
        id: 8,
        label: "Data Perangkat Desa",
        keywords: ["perangkat desa", "staf desa", "data pegawai", "aparatur"],
        answer: "Data perangkat dikelola di menu **Pemerintahan** -> **Data Perangkat**. Anda bisa melihat masa jabatan, SK, dan status aktif/purna tugas."
    },
    {
        id: 9,
        label: "Menu BPD",
        keywords: ["bpd", "badan permusyawaratan desa", "data bpd"],
        answer: "Modul BPD digunakan untuk mencatat data anggota dan **Berita Acara** musyawarah. Akses melalui menu **Lembaga Desa** -> **BPD**."
    },
    {
        id: 10,
        label: "Kegiatan PKK",
        keywords: ["pkk", "kegiatan pkk", "program pkk", "ibu pkk"],
        answer: "Program kerja dan kepengurusan PKK dapat diinput di menu **Lembaga Desa** -> **PKK**. Terdapat fitur upload dokumentasi kegiatan juga."
    },
    {
        id: 11,
        label: "Karang Taruna",
        keywords: ["karang taruna", "pemuda", "katar", "organisasi pemuda"],
        answer: "Manajemen Karang Taruna mencakup data pengurus dan agenda kegiatan kepemudaan. Akses di menu **Lembaga Desa** -> **Karang Taruna**."
    },
    {
        id: 12,
        label: "Arsip Digital (E-File)",
        keywords: ["efile", "e-file", "arsip", "dokumen", "upload sk"],
        answer: "Gunakan menu **E-File** atau **Manajemen SK** untuk mengunggah pindaian (scan) dokumen penting agar tersimpan aman di server dan mudah dicari."
    },
    {
        id: 13,
        label: "Export Data Excel",
        keywords: ["export excel", "download data", "unduh data", "rekap excel"],
        answer: "Hampir semua tabel data (Penduduk, Aset, Surat) memiliki tombol **Export Excel** di pojok kanan atas tabel. Klik untuk mengunduh laporan."
    },
    {
        id: 14,
        label: "Ubah Foto Profil",
        keywords: ["foto profil", "ganti foto", "ubah gambar", "picture"],
        answer: "Klik nama/foto Anda di **Header** (pojok kanan atas), pilih **Profil Saya**, lalu klik ikon kamera pada foto untuk menggantinya."
    },
    {
        id: 15,
        label: "Lapor Error/Bug",
        keywords: ["error", "bug", "tidak bisa", "rusak", "macet"],
        answer: "Jika aplikasi mengalami kendala, silakan screenshot pesan errornya dan kirim ke WhatsApp Tim Developer atau menu Bantuan. Untuk langsung menghubungi Tim Developer, [klik di sini](https://api.whatsapp.com/send?phone=6283846644286&text=Halo%20Tim%20Developer%20Simpekdes%2C%20saya%20ingin%20melaporkan%20error%20pada%20aplikasi.%20Berikut%20detail%3A%20) untuk membuka chat WhatsApp ke Tim Developer."
    }
];

// Fungsi mencari jawaban
export const findLocalKnowledge = (text) => {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    const found = SIMPEKDES_KNOWLEDGE.find(item => item.keywords.some(k => lowerText.includes(k)));
    return found ? found.answer : null;
};

// Fungsi mendapatkan saran acak (Shuffle)
export const getRandomSuggestions = (count = 3) => {
    const shuffled = [...SIMPEKDES_KNOWLEDGE].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};