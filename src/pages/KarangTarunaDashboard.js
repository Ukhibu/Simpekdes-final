import React from 'react';
import OrganisasiDashboard from '../components/dashboard/OrganisasiDashboard';
import { KARANG_TARUNA_CONFIG } from '../utils/constants';
import { FiUsers } from 'react-icons/fi';

const KarangTarunaDashboard = () => {
    // Menambahkan ikon ke config sebelum di-pass
    const configWithIcon = {
        ...KARANG_TARUNA_CONFIG,
        icon: <FiUsers size={28} />
    };

    return <OrganisasiDashboard config={configWithIcon} />;
};

export default KarangTarunaDashboard;
