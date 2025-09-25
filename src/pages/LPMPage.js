import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
// PERBAIKAN: Mengimpor LPM_CONFIG secara spesifik
import { LPM_CONFIG } from '../utils/constants';

const LPMPage = () => {
    // PERBAIKAN: Menggunakan LPM_CONFIG sebagai prop
    return <OrganisasiCrudPage config={LPM_CONFIG} />;
};

export default LPMPage;

