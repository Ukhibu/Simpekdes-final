import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
// PERBAIKAN: Mengimpor RT_RW_CONFIG secara spesifik
import { RT_RW_CONFIG } from '../utils/constants';

const RtRwPage = () => {
    // PERBAIKAN: Menggunakan RT_RW_CONFIG sebagai prop
    return <OrganisasiCrudPage config={RT_RW_CONFIG} />;
};

export default RtRwPage;

