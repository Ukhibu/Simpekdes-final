import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
import { PKK_CONFIG } from '../utils/constants';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Spinner from '../components/common/Spinner';

const PKKPage = () => {
    const { data: allPerangkat, loading: perangkatLoading } = useFirestoreCollection('perangkat');
    
    if (perangkatLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    return <OrganisasiCrudPage config={PKK_CONFIG} allPerangkat={allPerangkat} />;
};

export default PKKPage;
