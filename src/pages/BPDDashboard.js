import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { FiUsers, FiCheckCircle, FiAlertCircle, FiEdit, FiAward, FiPieChart, FiBarChart2 } from 'react-icons/fi';

ChartJS.register(ArcElement, Tooltip, Legend);

// Kartu Statistik Modern
const StatCard = ({ icon, title, value, color, delay }) => {
    const colorStyles = {
        indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
        green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
        red: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
        purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    };

    const activeStyle = colorStyles[color] || colorStyles.indigo;

    return (
        <div 
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group"
            style={{ animation: `fadeInUp 0.5s ease-out ${delay}s backwards` }}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{title}</p>
                    <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${activeStyle} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    {icon}
                </div>
            </div>
            {/* Decorative Element */}
            <div className={`h-1 w-full mt-4 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden`}>
                <div className={`h-full ${color === 'red' ? 'bg-rose-500' : color === 'green' ? 'bg-emerald-500' : color === 'purple' ? 'bg-purple-500' : 'bg-indigo-500'} w-2/3 rounded-full opacity-50`}></div>
            </div>
        </div>
    );
};

// Fungsi untuk menentukan apakah data BPD sudah lengkap
const isDataLengkapBPD = (bpd) => {
    const requiredFields = [
        'nama', 'nik', 'jabatan', 'desa', 'periode', 
        'tgl_sk_bupati', 'tgl_pelantikan', 'tempat_lahir', 'tgl_lahir','pekerjaan'
    ];
    return requiredFields.every(field => bpd[field] && String(bpd[field]).trim() !== '');
};

const BPDDashboard = () => {
    const { currentUser } = useAuth();
    const [bpdData, setBpdData] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser) return;

        let q;
        if (currentUser.role === 'admin_kecamatan') {
            q = query(collection(db, "bpd"));
        } else if (currentUser.role === 'admin_desa') {
            q = query(collection(db, "bpd"), where("desa", "==", currentUser.desa));
        }

        if (!q) {
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setBpdData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching BPD data: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Kalkulasi data untuk statistik dan grafik
    const { stats, doughnutChartData, completenessChartData, incompleteList } = useMemo(() => {
        const totalAnggota = bpdData.length;
        const lengkap = bpdData.filter(isDataLengkapBPD).length;
        const belumLengkap = totalAnggota - lengkap;
        const listBelumLengkap = bpdData.filter(p => !isDataLengkapBPD(p));
        
        const jabatanMap = new Map();
        bpdData.forEach(p => {
            const jabatan = p.jabatan || 'Belum Diisi';
            jabatanMap.set(jabatan, (jabatanMap.get(jabatan) || 0) + 1);
        });

        const doughnutData = {
            labels: [...jabatanMap.keys()],
            datasets: [{
                label: 'Jumlah Anggota',
                data: [...jabatanMap.values()],
                backgroundColor: ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'],
                hoverOffset: 10,
                borderWidth: 0,
            }]
        };
        
        const completenessData = {
            labels: ['Lengkap', 'Belum Lengkap'],
            datasets: [{
                data: [lengkap, belumLengkap],
                backgroundColor: ['#10B981', '#F43F5E'], // Emerald, Rose
                hoverOffset: 10,
                borderWidth: 0,
            }]
        };
        
        const totalDesa = currentUser.role === 'admin_kecamatan' 
            ? new Set(bpdData.map(doc => doc.desa)).size
            : (bpdData.length > 0 ? 1 : 0);

        return {
            stats: { totalAnggota, totalDesa, lengkap, belumLengkap },
            doughnutChartData: doughnutData,
            completenessChartData: completenessData,
            incompleteList: listBelumLengkap
        };
    }, [bpdData, currentUser.role]);

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <Spinner />
        </div>
    );

    return (
        <div className="space-y-8 pb-12 animate-fade-in">
            {/* CSS Animation */}
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fadeInUp 0.5s ease-out forwards; }
            `}</style>

            {/* Kartu Statistik */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    icon={<FiUsers size={24} />}
                    title="Total Anggota BPD"
                    value={stats.totalAnggota}
                    color="indigo"
                    delay={0.1}
                />
                <StatCard 
                    icon={<FiCheckCircle size={24} />}
                    title="Data Lengkap"
                    value={stats.lengkap}
                    color="green"
                    delay={0.2}
                />
                <StatCard 
                    icon={<FiAlertCircle size={24} />}
                    title="Belum Lengkap"
                    value={stats.belumLengkap}
                    color="red"
                    delay={0.3}
                />
                {currentUser.role === 'admin_kecamatan' && (
                    <StatCard 
                        icon={<FiAward size={24} />}
                        title="Desa Terdata"
                        value={stats.totalDesa}
                        color="purple"
                        delay={0.4}
                    />
                )}
            </div>

            {/* Area Grafik */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Grafik Jabatan */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col" style={{ animation: 'fadeInUp 0.6s ease-out 0.5s backwards' }}>
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                            <FiPieChart size={20} />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Struktur Jabatan BPD</h2>
                    </div>
                    <div className="flex-grow flex items-center justify-center relative min-h-[300px]">
                        {stats.totalAnggota > 0 ? (
                            <Doughnut 
                                data={doughnutChartData} 
                                options={{ 
                                    responsive: true, 
                                    maintainAspectRatio: false, 
                                    plugins: { 
                                        legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 }, color: '#9CA3AF' } } 
                                    },
                                    cutout: '65%'
                                }} 
                            />
                        ) : (
                            <p className="text-gray-400 text-sm">Belum ada data</p>
                        )}
                        {/* Center Text Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-extrabold text-gray-800 dark:text-white">{stats.totalAnggota}</span>
                            <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">Total</span>
                        </div>
                    </div>
                </div>

                {/* Grafik Kelengkapan */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col" style={{ animation: 'fadeInUp 0.6s ease-out 0.6s backwards' }}>
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <FiBarChart2 size={20} />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Status Kelengkapan Data</h2>
                    </div>
                    <div className="flex-grow flex items-center justify-center relative min-h-[300px]">
                        {stats.totalAnggota > 0 ? (
                            <Doughnut 
                                data={completenessChartData} 
                                options={{ 
                                    responsive: true, 
                                    maintainAspectRatio: false, 
                                    plugins: { 
                                        legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, font: { size: 11 }, color: '#9CA3AF' } } 
                                    },
                                    cutout: '65%'
                                }}
                            />
                        ) : (
                            <p className="text-gray-400 text-sm">Belum ada data</p>
                        )}
                         <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-extrabold text-gray-800 dark:text-white">
                                {stats.totalAnggota > 0 ? Math.round((stats.lengkap / stats.totalAnggota) * 100) : 0}%
                            </span>
                            <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">Lengkap</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Tabel Data Belum Lengkap */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden" style={{ animation: 'fadeInUp 0.6s ease-out 0.7s backwards' }}>
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-600 dark:text-yellow-500">
                            <FiAlertCircle size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Perlu Tindakan</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Daftar anggota BPD yang datanya belum lengkap</p>
                        </div>
                    </div>
                    {incompleteList.length > 0 && (
                        <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full border border-red-200 dark:border-red-800 animate-pulse">
                            {incompleteList.length} Anggota
                        </span>
                    )}
                </div>

                {incompleteList.length > 0 ? (
                    <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="px-6 py-4 font-bold tracking-wider">Nama Lengkap</th>
                                    {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-4 font-bold tracking-wider">Desa</th>}
                                    <th className="px-6 py-4 font-bold tracking-wider">Jabatan</th>
                                    <th className="px-6 py-4 font-bold tracking-wider text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {incompleteList.map((bpd, index) => (
                                    <tr 
                                        key={bpd.id} 
                                        className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                                        style={{ animation: `fadeInUp 0.3s ease-out ${index * 0.05}s backwards` }}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900 dark:text-white">{bpd.nama}</div>
                                            <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">{bpd.nik || 'NIK: -'}</div>
                                        </td>
                                        {currentUser.role === 'admin_kecamatan' && (
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                    {bpd.desa}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{bpd.jabatan}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => navigate(`/app/bpd/data?edit=${bpd.id}`)} 
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-xs font-bold transition-all transform hover:-translate-y-0.5 active:scale-95 shadow-sm"
                                            >
                                                <FiEdit size={14}/> <span>Lengkapi</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-full mb-3 ring-4 ring-green-50 dark:ring-green-900/10">
                            <FiCheckCircle size={32} className="text-green-500 dark:text-green-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Luar Biasa!</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs mx-auto">
                            Semua data anggota BPD sudah lengkap. Pertahankan kinerja administrasi yang baik ini.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BPDDashboard;