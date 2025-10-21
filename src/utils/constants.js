export const DESA_LIST = [ 
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];
export const KODE_DESA_MAP = {
    "Sambong": "01", "Tribuana": "02", "Sawangan": "03", "Sidarata": "04",
    "Badakarya": "05", "Bondolharjo": "06", "Punggelan": "07", "Karangsari": "08",
    "Kecepit": "09", "Danakerta": "10", "Klapa": "11", "Jembangan": "12",
    "Purwasana": "13", "Petuguran": "14", "Tanjungtirta": "15", "Tlaga": "16",
    "Mlaya": "17"
};

// --- Daftar Bersama ---
export const PENDIDIKAN_LIST = ["SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"];
export const JENIS_KELAMIN_LIST = ['Laki-Laki', 'Perempuan'];
export const JABATAN_RT_LIST = ['Ketua', 'Sekretaris', 'Bendahara'];
export const JABATAN_RW_LIST = ["Ketua"];
// --- Kategori Keuangan ---
export const BIDANG_BELANJA = [
    "Penyelenggaraan Pemerintahan Desa",
    "Pelaksanaan Pembangunan Desa",
    "Pembinaan Kemasyarakatan Desa",
    "Pemberdayaan Masyarakat Desa",
    "Belanja Tak Terduga"
];

export const KATEGORI_PENDAPATAN = [
    { bidang: "Pendapatan Asli Desa (PAD)", nama: "Hasil Usaha Desa", jenis: "Pendapatan", kode_rekening: "4.1.1" },
    { bidang: "Pendapatan Asli Desa (PAD)", nama: "Hasil Aset Desa", jenis: "Pendapatan", kode_rekening: "4.1.2" },
    { bidang: "Pendapatan Asli Desa (PAD)", nama: "Swadaya, Partisipasi, dan Gotong Royong", jenis: "Pendapatan", kode_rekening: "4.1.3" },
    { bidang: "Pendapatan Asli Desa (PAD)", nama: "Lain-lain PAD yang Sah", jenis: "Pendapatan", kode_rekening: "4.1.4" },
    { bidang: "Dana Transfer", nama: "Dana Desa (DD)", jenis: "Pendapatan", kode_rekening: "4.2.1" },
    { bidang: "Dana Transfer", nama: "Bagi Hasil Pajak dan Retribusi (BHPR)", jenis: "Pendapatan", kode_rekening: "4.2.2" },
    { bidang: "Dana Transfer", nama: "Alokasi Dana Desa (ADD)", jenis: "Pendapatan", kode_rekening: "4.2.3" },
    { bidang: "Dana Transfer", nama: "Bantuan Keuangan Provinsi", jenis: "Pendapatan", kode_rekening: "4.2.4" },
    { bidang: "Dana Transfer", nama: "Bantuan Keuangan Kabupaten/Kota", jenis: "Pendapatan", kode_rekening: "4.2.5" },
    { bidang: "Pendapatan Lain-lain", nama: "Hibah dan Sumbangan Pihak Ketiga", jenis: "Pendapatan", kode_rekening: "4.3.1" },
    { bidang: "Pendapatan Lain-lain", nama: "Lain-lain Pendapatan Desa yang Sah", jenis: "Pendapatan", kode_rekening: "4.3.9" },
];

export const KATEGORI_BELANJA = [
    { bidang: "Penyelenggaraan Pemerintahan Desa", nama: "Penghasilan Tetap dan Tunjangan", jenis: "Belanja", kode_rekening: "5.1.1" },
    { bidang: "Penyelenggaraan Pemerintahan Desa", nama: "Operasional Perkantoran", jenis: "Belanja", kode_rekening: "5.1.2" },
    { bidang: "Penyelenggaraan Pemerintahan Desa", nama: "Operasional BPD", jenis: "Belanja", kode_rekening: "5.1.3" },
    { bidang: "Penyelenggaraan Pemerintahan Desa", nama: "Operasional RT/RW", jenis: "Belanja", kode_rekening: "5.1.4" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Pembangunan/Rehab/Peningkatan Jalan Desa", jenis: "Belanja", kode_rekening: "5.2.1" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Pembangunan/Rehab/Peningkatan Jembatan Desa", jenis: "Belanja", kode_rekening: "5.2.2" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Pembangunan/Rehab/Peningkatan Prasarana Air Bersih", jenis: "Belanja", kode_rekening: "5.2.3" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Pembangunan/Rehab/Peningkatan Sanitasi", jenis: "Belanja", kode_rekening: "5.2.4" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Sarana dan Prasarana Kesehatan", jenis: "Belanja", kode_rekening: "5.2.5" },
    { bidang: "Pelaksanaan Pembangunan Desa", nama: "Sarana dan Prasarana Pendidikan", jenis: "Belanja", kode_rekening: "5.2.6" },
    { bidang: "Pembinaan Kemasyarakatan Desa", nama: "Pembinaan Ketentraman dan Ketertiban", jenis: "Belanja", kode_rekening: "5.3.1" },
    { bidang: "Pembinaan Kemasyarakatan Desa", nama: "Pembinaan Kerukunan Umat Beragama", jenis: "Belanja", kode_rekening: "5.3.2" },
    { bidang: "Pembinaan Kemasyarakatan Desa", nama: "Pembinaan Kepemudaan dan Olahraga", jenis: "Belanja", kode_rekening: "5.3.3" },
    { bidang: "Pembinaan Kemasyarakatan Desa", nama: "Pembinaan Lembaga Adat", jenis: "Belanja", kode_rekening: "5.3.4" },
    { bidang: "Pemberdayaan Masyarakat Desa", nama: "Peningkatan Kapasitas Aparatur Desa", jenis: "Belanja", kode_rekening: "5.4.1" },
    { bidang: "Pemberdayaan Masyarakat Desa", nama: "Pemberdayaan Kesejahteraan Keluarga (PKK)", jenis: "Belanja", kode_rekening: "5.4.2" },
    { bidang: "Pemberdayaan Masyarakat Desa", nama: "Pengembangan Usaha Ekonomi Produktif (BUMDes)", jenis: "Belanja", kode_rekening: "5.4.3" },
    { bidang: "Belanja Tak Terduga", nama: "Keadaan Darurat", jenis: "Belanja", kode_rekening: "5.5.1" },
    { bidang: "Belanja Tak Terduga", nama: "Bencana Alam", jenis: "Belanja", kode_rekening: "5.5.2" },
    { bidang: "Belanja Tak Terduga", nama: "Bencana Sosial", jenis: "Belanja", kode_rekening: "5.5.3" },
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

// --- Kode Rekening (sample minimal set) ---
export const KODE_REKENING = [
    { kode: '1.01.01', uraian: 'Pendapatan Asli Desa', jenis: 'Pendapatan' },
    { kode: '1.01.02', uraian: 'Hasil Aset Desa', jenis: 'Pendapatan' },
    { kode: '2.01.01', uraian: 'Belanja Operasional Pemerintahan', jenis: 'Belanja' },
    { kode: '2.01.02', uraian: 'Belanja Pembangunan Desa', jenis: 'Belanja' },
    // Tambahkan kode rekening lebih lengkap sesuai kebutuhan
];


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

// [PEMBARUAN] Konfigurasi LPM disesuaikan dengan Ide 1
export const LPM_CONFIG = {
    collectionName: 'lpm',
    title: 'Pengurus LPM',
    subModule: 'lpm',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: JENIS_KELAMIN_LIST },
        { name: 'jabatan', label: 'Jabatan', type: 'text', placeholder: 'Contoh: Ketua, Sekretaris, Anggota', required: true },
        { name: 'tempat_lahir', label: 'Tempat Lahir', type: 'text' },
        { name: 'tgl_lahir', label: 'Tanggal Lahir', type: 'date' },
        { name: 'pendidikan', label: 'Pendidikan Terakhir', type: 'select', options: PENDIDIKAN_LIST },
        { name: 'no_sk', label: 'Nomor SK', type: 'text' },
        { name: 'tgl_pelantikan', label: 'Tanggal Pelantikan', type: 'date' },
        { name: 'masa_bakti', label: 'Masa Bakti (Tahun)', type: 'number' },
        { name: 'akhir_jabatan', label: 'Akhir Jabatan', type: 'date' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ],
    tableColumns: ['nama', 'jabatan', 'periode', 'no_sk'], // Ini bisa disesuaikan, OrganisasiCrudPage tidak menggunakannya lagi
    completenessCriteria: ['nama', 'jabatan', 'periode', 'no_sk', 'tgl_pelantikan'],
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

export const RT_CONFIG = {
    collectionName: 'rt_rw',
    title: 'Ketua RT',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'no_rt', label: 'Nomor RT', type: 'text', required: true },
        { name: 'no_rw', label: 'Nomor RW Induk', type: 'text' },
        { name: 'dusun', label: 'Dusun', type: 'text' },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ],
    tableColumns: ['nama', 'no_rt', 'no_rw', 'dusun', 'periode', 'no_hp'],
    completenessCriteria: ['nama', 'no_rt', 'desa'],
};

export const RW_CONFIG = {
    collectionName: 'rt_rw',
    title: 'Ketua RW',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'no_rw', label: 'Nomor RW', type: 'text', required: true },
        { name: 'dusun', label: 'Dusun', type: 'text' },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ],
    tableColumns: ['nama', 'no_rw', 'dusun', 'periode', 'no_hp'],
    completenessCriteria: ['nama', 'no_rw', 'desa'],
};
// [PENAMBAHAN] Konfigurasi untuk Program Kerja LPM
export const LPM_PROGRAM_CONFIG = {
    collectionName: 'lpm_program',
    title: 'Program Kerja LPM',
    subModule: 'lpm', // Untuk navigasi
    formFields: [
        { name: 'nama_program', label: 'Nama Program/Kegiatan', type: 'text', required: true },
        { name: 'seksi', label: 'Seksi Penanggung Jawab', type: 'text', required: true, placeholder: 'cth: Seksi Pembangunan' },
        { name: 'tgl_mulai', label: 'Tanggal Mulai', type: 'date' },
        { name: 'tgl_selesai', label: 'Tanggal Selesai', type: 'date' },
        { name: 'sumber_dana', label: 'Sumber Dana', type: 'text', placeholder: 'cth: Dana Desa, Swadaya' },
        { name: 'perkiraan_anggaran', label: 'Perkiraan Anggaran (Rp)', type: 'number' },
        { name: 'realisasi_anggaran', label: 'Realisasi Anggaran (Rp)', type: 'number' },
        { name: 'status', label: 'Status', type: 'select', options: ['Direncanakan', 'Berjalan', 'Selesai', 'Dibatalkan'], required: true },
        { name: 'keterangan', label: 'Catatan/Keterangan', type: 'textarea' },
    ],
    tableColumns: ['nama_program', 'seksi', 'tgl_mulai', 'status'], // Kolom yang ditampilkan di tabel utama
};

export const SK_CONFIG = {
    perangkat: { label: "Perangkat Desa", collectionName: "perangkat", folder: "sk_perangkat" },
    bpd: { label: "BPD", collectionName: "bpd", folder: "sk_bpd" },
    lpm: { label: "LPM", collectionName: "lpm", folder: "sk_lpm" },
    pkk: { label: "PKK", collectionName: "pkk", folder: "sk_pkk" },
    karang_taruna: { label: "Karang Taruna", collectionName: "karang_taruna", folder: "sk_karang_taruna" },
    rt_rw: { label: "RT/RW", collectionName: "rt_rw", folder: "sk_rt_rw" },
};
