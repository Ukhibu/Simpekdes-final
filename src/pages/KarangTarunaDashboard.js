import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiActivity } from 'react-icons/fi';

const DashboardCard = ({ title, description, to, icon }) => {
    const navigate = useNavigate();
    return (
        <div 
            onClick={() => navigate(to)} 
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 cursor-pointer flex items-center gap-4"
        >
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg text-yellow-500 dark:text-yellow-400">
                {icon}
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            </div>
        </div>
    );
};

const KarangTarunaDashboard = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard Karang Taruna</h1>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <DashboardCard 
                    title="Manajemen Pengurus"
                    description="Kelola data pengurus Karang Taruna."
                    to="/app/karang-taruna/data"
                    icon={<FiUsers size={24} />}
                />
                 <DashboardCard 
                    title="Manajemen Kegiatan"
                    description="Catat dan kelola semua kegiatan."
                    to="/app/karang-taruna/kegiatan"
                    icon={<FiActivity size={24} />}
                />
            </div>
        </div>
    );
};

export default KarangTarunaDashboard;

