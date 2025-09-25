import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
// PERBAIKAN: Mengimpor KARANG_TARUNA_CONFIG secara spesifik
import { KARANG_TARUNA_CONFIG } from '../utils/constants';

const KarangTarunaPage = () => {
    // PERBAIKAN: Menggunakan KARANG_TARUNA_CONFIG sebagai prop
    return <OrganisasiCrudPage config={KARANG_TARUNA_CONFIG} />;
};

export default KarangTarunaPage;

