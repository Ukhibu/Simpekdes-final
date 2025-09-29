import React from 'react';
import OrganisasiDashboard from '../components/dashboard/OrganisasiDashboard';
import { PKK_CONFIG } from '../utils/constants';
import { FiHeart } from 'react-icons/fi';

const PKKDashboard = () => {
    // Menambahkan ikon ke config sebelum di-pass
    const configWithIcon = {
        ...PKK_CONFIG,
        icon: <FiHeart size={28} />
    };
    
    return <OrganisasiDashboard config={configWithIcon} />;
};

export default PKKDashboard;
