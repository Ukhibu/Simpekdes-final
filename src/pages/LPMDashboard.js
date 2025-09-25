import React from 'react';
import { useNavigate } from 'react-router-dom';

// Komponen kartu navigasi internal
const DashboardCard = ({ title, description, to }) => {
    const navigate = useNavigate();
    return (
        <div 
            onClick={() => navigate(to)} 
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 cursor-pointer"
        >
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        </div>
    );
};

const LPMDashboard = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard Lembaga Pemberdayaan Masyarakat (LPM)</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <DashboardCard 
                    title="Manajemen Pengurus"
                    description="Kelola data pengurus LPM."
                    to="/app/lpm/data"
                />
                {/* Anda dapat menambahkan kartu lain di sini untuk fitur LPM selanjutnya */}
            </div>
        </div>
    );
};

export default LPMDashboard;
