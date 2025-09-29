import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
import { LPM_CONFIG } from '../utils/constants';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Spinner from '../components/common/Spinner';

const LPMPage = () => {
    // Ambil data perangkat untuk tanda tangan Kepala Desa saat ekspor
    const { data: allPerangkat, loading: perangkatLoading } = useFirestoreCollection('perangkat');
    
    if (perangkatLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    return <OrganisasiCrudPage config={LPM_CONFIG} allPerangkat={allPerangkat} />;
};

export default LPMPage;
