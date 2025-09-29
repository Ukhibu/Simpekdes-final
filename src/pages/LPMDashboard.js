import React from 'react';
import OrganisasiDashboard from '../components/dashboard/OrganisasiDashboard';
import { LPM_CONFIG } from '../utils/constants';
import { FiAward } from 'react-icons/fi';

const LPMDashboard = () => {
    // Menambahkan ikon ke config sebelum di-pass
    const configWithIcon = {
        ...LPM_CONFIG,
        icon: <FiAward size={28} />
    };

    return <OrganisasiDashboard config={configWithIcon} />;
};

export default LPMDashboard;
