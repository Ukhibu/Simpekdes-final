import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
import { LPM_PROGRAM_CONFIG } from '../utils/constants';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Spinner from '../components/common/Spinner';

// Halaman baru untuk mengelola Program Kerja LPM.
// Halaman ini menggunakan kembali komponen OrganisasiCrudPage yang sudah ada
// dengan konfigurasi yang spesifik untuk program kerja LPM.
const LPMProgramPage = () => {
    // Memastikan semua perangkat dimuat jika diperlukan untuk fitur mendatang (misal: dropdown penanggung jawab)
    const { loading: perangkatLoading } = useFirestoreCollection('perangkat');
    
    if (perangkatLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }
    
    return <OrganisasiCrudPage config={LPM_PROGRAM_CONFIG} />;
};

export default LPMProgramPage;
