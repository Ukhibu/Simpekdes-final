import React from 'react';
import OrganisasiDashboard from '../components/dashboard/OrganisasiDashboard';
import { RT_RW_CONFIG } from '../utils/constants';
import { FiHome } from 'react-icons/fi';

const RtRwDashboard = () => {
    // Menambahkan ikon ke config sebelum di-pass
    const configWithIcon = {
        ...RT_RW_CONFIG,
        icon: <FiHome size={28} />
    };

    return <OrganisasiDashboard config={configWithIcon} />;
};

export default RtRwDashboard;
