export const DESA_LIST = [ 
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

// --- Kategori Keuangan ---
export const BIDANG_BELANJA = [
    "Penyelenggaraan Pemerintahan Desa",
    "Pelaksanaan Pembangunan Desa",
    "Pembinaan Kemasyarakatan Desa",
    "Pemberdayaan Masyarakat Desa",
    "Belanja Tak Terduga"
];

// --- [DIPERBARUI] Menambahkan Kode Rekening ---
export const KATEGORI_PENDAPATAN = [
    { bidang: "Pendapatan Asli Desa (PAD)", nama: "Hasil Usaha Desa", kode_rekening: "4.1.1" },
    { bidang: "Pendapatan Asli Desa (PAD)", nama: "Hasil Aset Desa", kode_rekening: "4.1.2" },
    { bidang: "Pendapatan Asli Desa (PAD)", nama: "Swadaya, Partisipasi, dan Gotong Royong", kode_rekening: "4.1.3" },
    { bidang: "Pendapatan Asli Desa (PAD)", nama: "Lain-lain PAD yang Sah", kode_rekening: "4.1.4" },
    { bidang: "Dana Transfer", nama: "Dana Desa (DD)", kode_rekening: "4.2.1" },
    { bidang: "Dana Transfer", nama: "Bagi Hasil Pajak dan Retribusi (BHPR)", kode_rekening: "4.2.2" },
    { bidang: "Dana Transfer", nama: "Alokasi Dana Desa (ADD)", kode_rekening: "4.2.3" },
    { bidang: "Dana Transfer", nama: "Bantuan Keuangan Provinsi", kode_rekening: "4.2.4" },
    { bidang: "Dana Transfer", nama: "Bantuan Keuangan Kabupaten/Kota", kode_rekening: "4.2.5" },
    { bidang: "Pendapatan Lain-lain", nama: "Hibah dan Sumbangan Pihak Ketiga", kode_rekening: "4.3.1" },
    { bidang: "Pendapatan Lain-lain", nama: "Lain-lain Pendapatan Desa yang Sah", kode_rekening: "4.3.2" },
];

export const KATEGORI_BELANJA = [
    { bidang: "Penyelenggaraan Pemerintahan Desa", nama: "Penghasilan Tetap dan Tunjangan", kode_rekening: "5.1.1" },
    { bidang: "Penyelenggaraan Pemerintahan Desa", nama: "Operasional Perkantoran", kode_rekening: "5.1.2" },
    { bidang: "Penyelenggaraan Pemerintahan Desa", nama: "Operasional BPD", kode_rekening: "5.1.3" },
    { bidang: "Penyelenggaraan Pemerintahan Desa", nama: "Operasional RT/RW", kode_rekening: "5.1.4" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Pembangunan/Rehab/Peningkatan Jalan Desa", kode_rekening: "5.2.1" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Pembangunan/Rehab/Peningkatan Jembatan Desa", kode_rekening: "5.2.2" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Pembangunan/Rehab/Peningkatan Prasarana Air Bersih", kode_rekening: "5.2.3" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Pembangunan/Rehab/Peningkatan Sanitasi", kode_rekening: "5.2.4" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Sarana dan Prasarana Kesehatan", kode_rekening: "5.2.5" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Sarana dan Prasarana Pendidikan", kode_rekening: "5.2.6" },
    { bidang: "Pembinaan Kemasyarakatan Desa", nama: "Pembinaan Ketentraman dan Ketertiban", kode_rekening: "5.3.1" },
    { bidang: "Pembinaan Kemasyarakatan Desa", nama: "Pembinaan Kerukunan Umat Beragama", kode_rekening: "5.3.2" },
    { bidang: "Pembinaan Kemasyarakatan Desa", nama: "Pembinaan Kepemudaan dan Olahraga", kode_rekening: "5.3.3" },
    { bidang: "Pembinaan Kemasyarakatan Desa", nama: "Pembinaan Lembaga Adat", kode_rekening: "5.3.4" },
    { bidang: "Pemberdayaan Masyarakat Desa", nama: "Peningkatan Kapasitas Aparatur Desa", kode_rekening: "5.4.1" },
    { bidang: "Pemberdayaan Masyarakat Desa", nama: "Pemberdayaan Kesejahteraan Keluarga (PKK)", kode_rekening: "5.4.2" },
    { bidang: "Pemberdayaan Masyarakat Desa", nama: "Pengembangan Usaha Ekonomi Produktif (BUMDes)", kode_rekening: "5.4.3" },
    { bidang: "Belanja Tak Terduga", nama: "Keadaan Darurat", kode_rekening: "5.5.1" },
    { bidang: "Belanja Tak Terduga", nama: "Bencana Alam", kode_rekening: "5.5.2" },
    { bidang: "Belanja Tak Terduga", nama: "Bencana Sosial", kode_rekening: "5.5.3" },
];


// --- Kategori Aset ---
export const KATEGORI_ASET = [
    "Tanah", 
    "Peralatan dan Mesin", 
    "Gedung dan Bangunan", 
    "Jalan, Jaringan, dan Irigasi", 
    "Aset Tetap Lainnya", 
    "Konstruksi Dalam Pengerjaan"
];
export const KONDISI_ASET = ["Baik", "Rusak Ringan", "Rusak Berat"];


// --- Konfigurasi untuk setiap Modul Organisasi ---

export const BPD_CONFIG = {
    collectionName: 'bpd',
    title: 'Anggota BPD',
    subModule: 'bpd',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'select', options: ["Ketua", "Wakil Ketua", "Sekretaris", "Anggota"], required: true },
        { name: 'periode', label: 'Periode', type: 'text', placeholder: 'Contoh: 2024-2029' },
        { name: 'no_sk_bupati', label: 'No. SK Bupati', type: 'text' },
    ],
    tableColumns: ['nama', 'jabatan', 'periode', 'no_sk_bupati'],
    completenessCriteria: ['nama', 'jabatan', 'periode', 'no_sk_bupati', 'tgl_sk_bupati', 'tgl_pelantikan'],
    hierarchy: [
        { title: 'Pimpinan', keywords: ['Ketua', 'Wakil Ketua'] },
        { title: 'Sekretaris', keywords: ['Sekretaris'] },
        { title: 'Anggota', keywords: ['Anggota'] },
    ]
};

export const LPM_CONFIG = {
    collectionName: 'lpm',
    title: 'Pengurus LPM',
    subModule: 'lpm',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'text', placeholder: 'Contoh: Ketua, Sekretaris, Anggota', required: true },
        { name: 'periode', label: 'Periode Jabatan', type: 'text', placeholder: 'Contoh: 2024-2029' },
        { name: 'no_sk', label: 'Nomor SK', type: 'text' },
    ],
    tableColumns: ['nama', 'jabatan', 'periode', 'no_sk'],
    completenessCriteria: ['nama', 'jabatan', 'periode', 'no_sk'],
    hierarchy: [
        { title: 'Pimpinan', keywords: ['Ketua', 'Wakil Ketua'] },
        { title: 'Sekretaris & Bendahara', keywords: ['Sekretaris', 'Bendahara'] },
        { title: 'Seksi', keywords: ['Seksi', 'Sie'] },
        { title: 'Anggota', keywords: ['Anggota'] },
    ]
};

export const PKK_CONFIG = {
    collectionName: 'pkk',
    title: 'Pengurus PKK',
    subModule: 'pkk',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'text', placeholder: 'Contoh: Ketua, Bendahara, Anggota Pokja 1', required: true },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_sk', label: 'Nomor SK', type: 'text' },
    ],
    tableColumns: ['nama', 'jabatan', 'periode', 'no_sk'],
    completenessCriteria: ['nama', 'jabatan', 'periode'],
    hierarchy: [
        { title: 'Pimpinan', keywords: ['Ketua', 'Wakil Ketua'] },
        { title: 'Sekretaris & Bendahara', keywords: ['Sekretaris', 'Bendahara'] },
        { title: 'Ketua POKJA', keywords: ['POKJA'] },
        { title: 'Anggota', keywords: ['Anggota'] },
    ]
};

export const PKK_PROGRAM_CONFIG = {
    collectionName: 'pkk_program',
    title: 'Program Kerja PKK',
    formFields: [
        { name: 'nama_program', label: 'Nama Program/Kegiatan', type: 'text', required: true },
        { name: 'pokja', label: 'POKJA', type: 'select', options: ["POKJA I", "POKJA II", "POKJA III", "POKJA IV", "Sekretariat"], required: true },
        { name: 'tujuan', label: 'Tujuan Kegiatan', type: 'textarea' },
        { name: 'sasaran', label: 'Sasaran', type: 'text' },
    ],
    tableColumns: ['nama_program', 'pokja', 'tujuan', 'sasaran'],
};

export const KARANG_TARUNA_CONFIG = {
    collectionName: 'karang_taruna',
    title: 'Pengurus Karang Taruna',
    subModule: 'karang-taruna',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'text', placeholder: 'Contoh: Ketua, Sekretaris, Sie Olahraga', required: true },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ],
    tableColumns: ['nama', 'jabatan', 'periode', 'no_hp'],
    completenessCriteria: ['nama', 'jabatan', 'periode'],
    hierarchy: [
        { title: 'Pimpinan', keywords: ['Ketua', 'Wakil Ketua'] },
        { title: 'Sekretaris & Bendahara', keywords: ['Sekretaris', 'Bendahara'] },
        { title: 'Seksi', keywords: ['Seksi', 'Sie'] },
        { title: 'Anggota', keywords: ['Anggota'] },
    ]
};

export const KARANG_TARUNA_KEGIATAN_CONFIG = {
    collectionName: 'karang_taruna_kegiatan',
    title: 'Kegiatan Karang Taruna',
    formFields: [
        { name: 'nama_kegiatan', label: 'Nama Kegiatan', type: 'text', required: true },
        { name: 'tanggal', label: 'Tanggal Pelaksanaan', type: 'date' },
        { name: 'deskripsi', label: 'Deskripsi Singkat', type: 'textarea' },
        { name: 'penanggung_jawab', label: 'Penanggung Jawab', type: 'text' },
    ],
    tableColumns: ['nama_kegiatan', 'tanggal', 'penanggung_jawab'],
};

export const RT_RW_CONFIG = {
    collectionName: 'rt_rw',
    title: 'Pengurus RT/RW',
    subModule: 'rt-rw',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap Ketua', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'select', options: ["Ketua RT", "Ketua RW"], required: true },
        { name: 'nomor', label: 'Nomor RT/RW', type: 'text', placeholder: 'Contoh: 001/003', required: true },
        { name: 'dusun', label: 'Dusun / Dukuh', type: 'text', placeholder: 'Contoh: Krajan' },
        { name: 'periode', label: 'Periode', type: 'text' },
    ],
    tableColumns: ['nama', 'jabatan', 'nomor', 'dusun'],
    completenessCriteria: ['nama', 'jabatan', 'nomor', 'periode', 'no_sk'],
    hierarchy: [
        { title: 'Ketua RW', keywords: ['Ketua RW'] },
        { title: 'Ketua RT', keywords: ['Ketua RT'] },
    ]
};

