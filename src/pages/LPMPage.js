import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
import { LPM_CONFIG } from '../utils/constants';
import { generateLpmXLSX } from '../utils/generateLpmXLSX';

const LPMPage = () => {
  // PERBAIKAN: Menambahkan properti 'subModule' ke dalam konfigurasi
  // untuk memperbaiki galat saat membuat link notifikasi.
  const lpmConfigWithSubmodule = {
    ...LPM_CONFIG,
    subModule: 'lpm', // Properti 'subModule' ini diperlukan oleh OrganisasiCrudPage
  };

  return (
    <OrganisasiCrudPage 
      config={lpmConfigWithSubmodule} 
      customExportFunction={generateLpmXLSX}
    />
  );
};

export default LPMPage;

