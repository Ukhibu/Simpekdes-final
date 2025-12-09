import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Spinner from '../components/common/Spinner';
import { DESA_LIST, SK_CONFIG } from '../utils/constants';
import { Bar } from 'react-chartjs-2';
import {
    FiFileText, FiFolder, FiCheckSquare, FiClock, FiArrowRight, FiFilter,
    FiUsers, FiBriefcase, FiAward, FiHeart, FiHome, FiActivity, FiPieChart
} from 'react-icons/fi';
import Button from '../components/common/Button';

// --- Komponen Internal Modern ---

const StatCard = ({ icon, title, value, colorClass, gradientFrom, gradientTo }) => (
    <div className="relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300 group">
        <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 bg-gradient-to-br ${gradientFrom} ${gradientTo} blur-2xl transition-transform group-hover:scale-150 duration-700`}></div>
        <div className="flex items-center justify-between relative z-10">
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</h3>
            </div>
            <div className={`p-3.5 rounded-xl text-white shadow-lg bg-gradient-to-br ${gradientFrom} ${gradientTo}`}>
                {icon}
            </div>
        </div>
    </div>
);

const QuickAccessCard = ({ icon, title, path, count, colorClass, gradientClass }) => {
    const navigate = useNavigate();
    return (
        <div 
            onClick={() => navigate(path)}
            className="group relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-lg transition-all duration-300 cursor-pointer"
        >
            <div className={`absolute top-0 right-0 w-20 h-20 -mr-5 -mt-5 rounded-full opacity-5 ${colorClass} group-hover:scale-150 transition-transform duration-500`}></div>
            
            <div className="flex flex-col h-full justify-between relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${gradientClass} text-white shadow-md transform group-hover:scale-110 transition-transform duration-300`}>
                        {icon}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 px-2.5 py-1 rounded-full text-xs font-medium text-gray-500 dark:text-gray-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {count} File
                    </div>
                </div>
                
                <div>
                    <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1">{title}</h4>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 font-medium opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <span>Kelola Dokumen</span>
                        <FiArrowRight className="ml-1 w-3 h-3" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Komponen Utama ---

const EFileDashboard = () => {
    const { currentUser } = useAuth();
    const { data: skDocs, loading } = useFirestoreCollection('efile');
    const navigate = useNavigate();
    
    const [filterDesa, setFilterDesa] = useState(currentUser?.role === 'admin_kecamatan' ? 'all' : currentUser.desa);

    const { stats, chartData, pendingDocs, skCounts } = useMemo(() => {
        const data = currentUser.role === 'admin_desa' 
            ? skDocs.filter(doc => doc.desa === currentUser.desa)
            : (filterDesa === 'all' ? skDocs : skDocs.filter(doc => doc.desa === filterDesa));

        const totalDokumen = data.length;
        const dokumenTerverifikasi = data.filter(doc => doc.status === 'terverifikasi').length;
        const dokumenMenunggu = totalDokumen - dokumenTerverifikasi;
        
        const totalDesa = currentUser.role === 'admin_kecamatan' 
            ? new Set(data.map(doc => doc.desa)).size
            : (totalDokumen > 0 ? 1 : 0);

        const counts = Object.keys(SK_CONFIG).reduce((acc, key) => {
            acc[key] = data.filter(d => d.skType === key).length;
            return acc;
        }, {});

        const chartLabels = Object.keys(SK_CONFIG).map(key => SK_CONFIG[key].label);
        const chartValues = Object.keys(SK_CONFIG).map(key => counts[key] || 0);

        // Warna chart yang lebih modern
        const chartColors = [
            'rgba(59, 130, 246, 0.8)',   // Blue
            'rgba(139, 92, 246, 0.8)',   // Purple
            'rgba(249, 115, 22, 0.8)',   // Orange
            'rgba(236, 72, 153, 0.8)',   // Pink
            'rgba(239, 68, 68, 0.8)',    // Red
            'rgba(16, 185, 129, 0.8)',   // Green
        ];

        const chart = {
            labels: chartLabels,
            datasets: [
                {
                    label: 'Jumlah Dokumen',
                    data: chartValues,
                    backgroundColor: chartColors,
                    borderRadius: 6,
                    borderWidth: 0,
                    barThickness: 20,
                },
            ],
        };
        
        const pending = data
            .filter(doc => doc.status === 'menunggu_verifikasi')
            .sort((a, b) => b.uploadedAt?.toDate() - a.uploadedAt?.toDate())
            .slice(0, 5); // Ambil 5 terbaru

        return { 
            stats: { totalDokumen, dokumenTerverifikasi, dokumenMenunggu, totalDesa },
            chartData: chart,
            pendingDocs: pending,
            skCounts: counts
        };
    }, [skDocs, currentUser, filterDesa]);

    if (loading) return <div className="flex justify-center items-center h-full min-h-[400px]"><Spinner size="lg"/></div>;

    const quickAccessItems = [
        { icon: <FiUsers className="w-5 h-5" />, title: "SK Perangkat Desa", path: "/app/data-sk/perangkat", skType: 'perangkat', color: "bg-blue-500", gradient: "bg-gradient-to-br from-blue-500 to-blue-600" },
        { icon: <FiBriefcase className="w-5 h-5" />, title: "SK BPD", path: "/app/data-sk/bpd", skType: 'bpd', color: "bg-purple-500", gradient: "bg-gradient-to-br from-purple-500 to-indigo-600" },
        { icon: <FiAward className="w-5 h-5" />, title: "SK LPM", path: "/app/data-sk/lpm", skType: 'lpm', color: "bg-orange-500", gradient: "bg-gradient-to-br from-orange-500 to-amber-600" },
        { icon: <FiHeart className="w-5 h-5" />, title: "SK PKK", path: "/app/data-sk/pkk", skType: 'pkk', color: "bg-pink-500", gradient: "bg-gradient-to-br from-pink-500 to-rose-600" },
        { icon: <FiUsers className="w-5 h-5" />, title: "SK Karang Taruna", path: "/app/data-sk/karang_taruna", skType: 'karang_taruna', color: "bg-red-500", gradient: "bg-gradient-to-br from-red-500 to-red-600" },
        { icon: <FiHome className="w-5 h-5" />, title: "SK RT/RW", path: "/app/data-sk/rt_rw", skType: 'rt_rw', color: "bg-green-500", gradient: "bg-gradient-to-br from-green-500 to-emerald-600" },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white tracking-tight">Dashboard Arsip Digital</h1>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">Ringkasan data dan status verifikasi dokumen SK Desa.</p>
                </div>
                {currentUser.role === 'admin_kecamatan' && (
                    <div className="w-full md:w-64">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FiFilter className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <select 
                                value={filterDesa} 
                                onChange={(e) => setFilterDesa(e.target.value)} 
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm dark:text-white cursor-pointer hover:border-gray-300 dark:hover:border-gray-600"
                            >
                                <option value="all">Semua Desa</option>
                                {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    icon={<FiFileText className="w-6 h-6" />} 
                    title="Total Dokumen" 
                    value={stats.totalDokumen} 
                    colorClass="bg-blue-500" 
                    gradientFrom="from-blue-500"
                    gradientTo="to-blue-600"
                />
                <StatCard 
                    icon={<FiCheckSquare className="w-6 h-6" />} 
                    title="Terverifikasi" 
                    value={stats.dokumenTerverifikasi} 
                    colorClass="bg-green-500" 
                    gradientFrom="from-green-500"
                    gradientTo="to-emerald-600"
                />
                <StatCard 
                    icon={<FiClock className="w-6 h-6" />} 
                    title="Menunggu" 
                    value={stats.dokumenMenunggu} 
                    colorClass="bg-yellow-500" 
                    gradientFrom="from-yellow-500"
                    gradientTo="to-amber-500"
                />
                {currentUser.role === 'admin_kecamatan' && (
                    <StatCard 
                        icon={<FiFolder className="w-6 h-6" />} 
                        title="Desa Terdata" 
                        value={stats.totalDesa} 
                        colorClass="bg-purple-500" 
                        gradientFrom="from-purple-500"
                        gradientTo="to-indigo-600"
                    />
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                <FiPieChart className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Distribusi Dokumen</h2>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <Bar 
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: false, 
                                indexAxis: 'y', 
                                plugins: { legend: { display: false } },
                                scales: {
                                    x: {
                                        grid: { display: false, drawBorder: false },
                                        ticks: { color: '#9CA3AF' }
                                    },
                                    y: {
                                        grid: { color: 'rgba(243, 244, 246, 0.1)', drawBorder: false },
                                        ticks: { color: '#6B7280', font: { weight: '500' } }
                                    }
                                }
                            }} 
                            data={chartData} 
                        />
                    </div>
                </div>

                {/* Pending Verification Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-600 dark:text-yellow-400">
                                <FiActivity className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Perlu Verifikasi</h2>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300">
                            {pendingDocs.length} Terbaru
                        </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                        {pendingDocs.length > 0 ? pendingDocs.map(doc => (
                            <div key={doc.id} className="group p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/10 border border-transparent hover:border-blue-100 dark:hover:border-blue-800 transition-all duration-200">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${SK_CONFIG[doc.skType] ? `bg-${SK_CONFIG[doc.skType].color}-100 text-${SK_CONFIG[doc.skType].color}-700 dark:bg-${SK_CONFIG[doc.skType].color}-900/30 dark:text-${SK_CONFIG[doc.skType].color}-300` : 'bg-gray-100 text-gray-600'}`}>
                                        {SK_CONFIG[doc.skType]?.label || doc.skType}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {doc.uploadedAt?.toDate ? doc.uploadedAt.toDate().toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '-'}
                                    </span>
                                </div>
                                <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1 truncate">{doc.entityName}</h5>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{doc.desa}</p>
                                <button 
                                    onClick={() => navigate(`/app/data-sk/${doc.skType}?highlight=${doc.id}`)}
                                    className="w-full flex items-center justify-center space-x-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors shadow-sm"
                                >
                                    <span>Tinjau</span>
                                    <FiArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400 dark:text-gray-500">
                                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-full mb-3">
                                    <FiCheckSquare className="w-6 h-6" />
                                </div>
                                <p className="text-sm">Semua dokumen aman.</p>
                                <p className="text-xs mt-1 opacity-75">Tidak ada yang perlu diverifikasi.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Access Grid */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                    <span className="w-1 h-6 bg-blue-500 rounded-full mr-3"></span>
                    Akses Cepat Data
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quickAccessItems.map(item => (
                        <QuickAccessCard 
                            key={item.path}
                            icon={item.icon}
                            title={item.title}
                            path={item.path}
                            count={skCounts[item.skType]}
                            colorClass={item.color}
                            gradientClass={item.gradient}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EFileDashboard;