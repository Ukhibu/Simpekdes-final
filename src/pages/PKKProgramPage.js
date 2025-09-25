import React from 'react';
import OrganisasiCrudPage from '../components/common/OrganisasiCrudPage';
import { PKK_PROGRAM_CONFIG } from '../utils/constants';

const PKKProgramPage = () => {
  return (
    <OrganisasiCrudPage config={PKK_PROGRAM_CONFIG} />
  );
};

export default PKKProgramPage;
