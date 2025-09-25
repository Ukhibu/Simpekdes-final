import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
import { KARANG_TARUNA_KEGIATAN_CONFIG } from '../utils/constants';

const KarangTarunaKegiatanPage = () => {
  return (
    <OrganisasiCrudPage config={KARANG_TARUNA_KEGIATAN_CONFIG} />
  );
};

export default KarangTarunaKegiatanPage;
