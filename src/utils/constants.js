export const DESA_LIST = [ 
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

// --- Konfigurasi untuk setiap Modul Organisasi ---

export const BPD_CONFIG = {
    collectionName: 'bpd',
    title: 'Anggota BPD',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'select', options: ["Ketua", "Wakil Ketua", "Sekretaris", "Anggota"], required: true },
        { name: 'periode', label: 'Periode', type: 'text', placeholder: 'Contoh: 2024-2029' },
        { name: 'no_sk_bupati', label: 'No. SK Bupati', type: 'text' },
        { name: 'tgl_sk_bupati', label: 'Tanggal SK Bupati', type: 'date' },
        { name: 'tgl_pelantikan', label: 'Tanggal Pelantikan', type: 'date' },
        { name: 'nik', label: 'NIK', type: 'number' },
        { name: 'tempat_lahir', label: 'Tempat Lahir', type: 'text' },
        { name: 'tgl_lahir', label: 'Tanggal Lahir', type: 'date' },
        { name: 'pendidikan', label: 'Pendidikan Terakhir', type: 'select', options: ["SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"] },
    ]
};

export const LPM_CONFIG = {
    collectionName: 'lpm',
    title: 'Pengurus LPM',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'text', placeholder: 'Contoh: Ketua, Sekretaris, Anggota', required: true },
        { name: 'periode', label: 'Periode Jabatan', type: 'text', placeholder: 'Contoh: 2024-2029' },
        { name: 'no_sk', label: 'Nomor SK', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ]
};

export const PKK_CONFIG = {
    collectionName: 'pkk',
    title: 'Pengurus PKK',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'text', placeholder: 'Contoh: Ketua, Bendahara, Anggota Pokja 1', required: true },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_sk', label: 'Nomor SK', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
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
        { name: 'waktu', label: 'Waktu Pelaksanaan', type: 'text', placeholder: 'Contoh: Setiap Bulan, Triwulan' },
    ]
};

export const KARANG_TARUNA_CONFIG = {
    collectionName: 'karang_taruna',
    title: 'Pengurus Karang Taruna',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'text', placeholder: 'Contoh: Ketua, Sekretaris, Sie Olahraga', required: true },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
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
    ]
};

export const RT_RW_CONFIG = {
    collectionName: 'rt_rw',
    title: 'Pengurus RT/RW',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap Ketua', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'select', options: ["Ketua RT", "Ketua RW"], required: true },
        { name: 'nomor', label: 'Nomor RT/RW', type: 'text', placeholder: 'Contoh: 001/003', required: true },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_sk', label: 'Nomor SK', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ]
};
