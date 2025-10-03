import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { DESA_LIST, SK_CONFIG } from '../utils/constants';
import { Bar } from 'react-chartjs-2';
import {
    FiFileText, FiFolder, FiCheckSquare, FiClock, FiArrowRight, FiFilter,
    FiUsers, FiBriefcase, FiAward, FiHeart, FiHome
} from 'react-icons/fi';
import Button from '../components/common/Button';

// --- Komponen Internal ---

const StatCard = ({ icon, title, value, colorClass }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md flex items-center gap-4 transition-transform hover:scale-105 duration-300">
        <div className={`p-4 rounded-full text-white ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    </div>
);

const QuickAccessCard = ({ icon, title, path, count, colorClass }) => {
    const navigate = useNavigate();
    return (
        <div 
            onClick={() => navigate(path)}
            className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 border border-transparent transition-all duration-300 cursor-pointer flex justify-between items-center"
        >
            <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-lg ${colorClass}`}>
                    {icon}
                </div>
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100">{title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{count} dokumen</p>
                </div>
            </div>
            <FiArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
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

        const chart = {
            labels: chartLabels,
            datasets: [
                {
                    label: 'Jumlah Dokumen',
                    data: chartValues,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                },
            ],
        };
        
        const pending = data
            .filter(doc => doc.status === 'menunggu_verifikasi')
            .sort((a, b) => b.uploadedAt.toDate() - a.uploadedAt.toDate())
            .slice(0, 5); // Ambil 5 terbaru

        return { 
            stats: { totalDokumen, dokumenTerverifikasi, dokumenMenunggu, totalDesa },
            chartData: chart,
            pendingDocs: pending,
            skCounts: counts
        };
    }, [skDocs, currentUser, filterDesa]);

    if (loading) return <div className="flex justify-center items-center h-full"><Spinner size="lg"/></div>;

    const quickAccessItems = [
        { icon: <FiUsers className="w-5 h-5 text-white" />, title: "SK Perangkat Desa", path: "/app/data-sk/perangkat", skType: 'perangkat', color: "bg-blue-500" },
        { icon: <FiBriefcase className="w-5 h-5 text-white" />, title: "SK BPD", path: "/app/data-sk/bpd", skType: 'bpd', color: "bg-green-500" },
        { icon: <FiAward className="w-5 h-5 text-white" />, title: "SK LPM", path: "/app/data-sk/lpm", skType: 'lpm', color: "bg-indigo-500" },
        { icon: <FiHeart className="w-5 h-5 text-white" />, title: "SK PKK", path: "/app/data-sk/pkk", skType: 'pkk', color: "bg-pink-500" },
        { icon: <FiUsers className="w-5 h-5 text-white" />, title: "SK Karang Taruna", path: "/app/data-sk/karang_taruna", skType: 'karang_taruna', color: "bg-purple-500" },
        { icon: <FiHome className="w-5 h-5 text-white" />, title: "SK RT/RW", path: "/app/data-sk/rt_rw", skType: 'rt_rw', color: "bg-yellow-500" },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Dashboard Arsip Digital</h1>
                {currentUser.role === 'admin_kecamatan' && (
                    <div className="w-full md:w-auto md:max-w-xs">
                        <InputField label="" type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} icon={<FiFilter />}>
                            <option value="all">Tampilkan Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<FiFileText className="w-6 h-6" />} title="Total Dokumen SK" value={stats.totalDokumen} colorClass="bg-blue-500" />
                <StatCard icon={<FiCheckSquare className="w-6 h-6" />} title="Terverifikasi" value={stats.dokumenTerverifikasi} colorClass="bg-green-500" />
                <StatCard icon={<FiClock className="w-6 h-6" />} title="Menunggu Verifikasi" value={stats.dokumenMenunggu} colorClass="bg-yellow-500" />
                {currentUser.role === 'admin_kecamatan' && <StatCard icon={<FiFolder className="w-6 h-6" />} title="Desa Terdata" value={stats.totalDesa} colorClass="bg-purple-500" />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Distribusi Dokumen SK</h2>
                    <div className="h-80">
                        <Bar options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }} data={chartData} />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Menunggu Verifikasi</h2>
                    <div className="space-y-3">
                        {pendingDocs.length > 0 ? pendingDocs.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div>
                                    <p className="font-semibold text-sm">{doc.entityName}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{doc.desa} - {doc.uploadedAt?.toDate().toLocaleDateString('id-ID')}</p>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => navigate(`/app/data-sk/${doc.skType}?highlight=${doc.id}`)}>
                                    <FiArrowRight />
                                </Button>
                            </div>
                        )) : (
                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">Tidak ada dokumen yang menunggu verifikasi.</p>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Akses Cepat Data SK</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {quickAccessItems.map(item => (
                        <QuickAccessCard 
                            key={item.path}
                            icon={item.icon}
                            title={item.title}
                            path={item.path}
                            count={skCounts[item.skType]}
                            colorClass={item.color}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EFileDashboard;

