import React, { useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import { FiFile, FiFolder, FiCheckSquare, FiArrowRight, FiUsers, FiBriefcase, FiAward, FiHeart, FiHome } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

// Komponen Kartu Statistik
const StatCard = ({ icon, title, value, colorClass }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center space-x-4">
        <div className={`p-3 rounded-full ${colorClass}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        </div>
    </div>
);

// [BARU] Komponen Kartu Akses Cepat
const QuickAccessCard = ({ icon, title, path, count, colorClass }) => {
    const navigate = useNavigate();
    return (
        <div 
            onClick={() => navigate(path)}
            className="group bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 border border-transparent transition-all duration-300 cursor-pointer flex justify-between items-center"
        >
            <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-full ${colorClass}`}>
                    {icon}
                </div>
                <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100">{title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{count} dokumen</p>
                </div>
            </div>
            <FiArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 transition-colors" />
        </div>
    );
};


const EFileDashboard = () => {
    const { currentUser } = useAuth();
    // Menggunakan custom hook untuk mengambil data
    const { data: skDocs, loading } = useFirestoreCollection('efile');
    const navigate = useNavigate();

    // Kalkulasi statistik dan data untuk kartu
    const { stats, skCounts } = useMemo(() => {
        const data = currentUser.role === 'admin_desa' 
            ? skDocs.filter(doc => doc.desa === currentUser.desa)
            : skDocs;

        const totalDokumen = data.length;
        const dokumenTerverifikasi = data.filter(doc => doc.status === 'terverifikasi').length;
        
        const folderDigunakan = currentUser.role === 'admin_kecamatan' 
            ? new Set(data.map(doc => doc.desa)).size
            : (totalDokumen > 0 ? 1 : 0);

        // [BARU] Menghitung jumlah SK per tipe
        const counts = {
            perangkat: data.filter(d => d.skType === 'perangkat').length,
            bpd: data.filter(d => d.skType === 'bpd').length,
            lpm: data.filter(d => d.skType === 'lpm').length,
            pkk: data.filter(d => d.skType === 'pkk').length,
            karang_taruna: data.filter(d => d.skType === 'karang_taruna').length,
            rt_rw: data.filter(d => d.skType === 'rt_rw').length,
        };

        return { 
            stats: { totalDokumen, dokumenTerverifikasi, folderDigunakan },
            skCounts: counts
        };
    }, [skDocs, currentUser]);

    if (loading) return <Spinner />;

    // [BARU] Daftar untuk kartu akses cepat
    const quickAccessItems = [
        { icon: <FiUsers className="w-5 h-5 text-white" />, title: "SK Perangkat Desa", path: "/app/data-sk/perangkat", count: skCounts.perangkat, color: "bg-blue-500" },
        { icon: <FiBriefcase className="w-5 h-5 text-white" />, title: "SK BPD", path: "/app/data-sk/bpd", count: skCounts.bpd, color: "bg-green-500" },
        { icon: <FiAward className="w-5 h-5 text-white" />, title: "SK LPM", path: "/app/data-sk/lpm", count: skCounts.lpm, color: "bg-indigo-500" },
        { icon: <FiHeart className="w-5 h-5 text-white" />, title: "SK PKK", path: "/app/data-sk/pkk", count: skCounts.pkk, color: "bg-pink-500" },
        { icon: <FiUsers className="w-5 h-5 text-white" />, title: "SK Karang Taruna", path: "/app/data-sk/karang_taruna", count: skCounts.karang_taruna, color: "bg-purple-500" },
        { icon: <FiHome className="w-5 h-5 text-white" />, title: "SK RT/RW", path: "/app/data-sk/rt_rw", count: skCounts.rt_rw, color: "bg-yellow-500" },
    ];

    return (
        <div className="space-y-8">
            
            {/* Kartu Statistik */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    icon={<FiFile className="w-6 h-6 text-white" />}
                    title="Total Dokumen SK"
                    value={stats.totalDokumen}
                    colorClass="bg-blue-500"
                />
                <StatCard 
                    icon={<FiCheckSquare className="w-6 h-6 text-white" />}
                    title="Dokumen Terverifikasi"
                    value={stats.dokumenTerverifikasi}
                    colorClass="bg-green-500"
                />
                 {currentUser.role === 'admin_kecamatan' && (
                    <StatCard 
                        icon={<FiFolder className="w-6 h-6 text-white" />}
                        title="Desa dengan Dokumen"
                        value={stats.folderDigunakan}
                        colorClass="bg-yellow-500"
                    />
                 )}
            </div>

            {/* [PERBAIKAN] Kartu navigasi diganti dengan grid akses cepat */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Akses Cepat Data SK</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {quickAccessItems.map(item => (
                        <QuickAccessCard 
                            key={item.path}
                            icon={item.icon}
                            title={item.title}
                            path={item.path}
                            count={item.count}
                            colorClass={item.color}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EFileDashboard;
