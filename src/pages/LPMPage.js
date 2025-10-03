import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
import { LPM_CONFIG } from '../utils/constants';
import { generateLpmXLSX } from '../utils/generateLpmXLSX';

/**
 * Halaman untuk Manajemen Pengurus LPM.
 *
 * Halaman ini bertindak sebagai "penghubung" atau wrapper. Ia menggunakan
 * komponen generik `OrganisasiCrudPage` untuk menampilkan seluruh antarmuka
 * CRUD (Create, Read, Update, Delete).
 *
 * Konfigurasi spesifik untuk LPM, termasuk field form dan kolom tabel,
 * diambil dari `LPM_CONFIG`.
 *
 * Fungsi ekspor kustom `generateLpmXLSX` juga diteruskan ke komponen
 * untuk menangani pembuatan laporan Excel yang sesuai format standar.
 */
const LPMPage = () => {
    return (
        <OrganisasiCrudPage 
            config={LPM_CONFIG} 
            customExportFunction={generateLpmXLSX} 
        />
    );
};

export default LPMPage;

