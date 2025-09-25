import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
// PERBAIKAN: Mengimpor PKK_CONFIG secara spesifik
import { PKK_CONFIG } from '../utils/constants';

const PKKPage = () => {
    // PERBAIKAN: Menggunakan PKK_CONFIG sebagai prop
    return <OrganisasiCrudPage config={PKK_CONFIG} />;
};

export default PKKPage;

