import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Spinner from '../components/common/Spinner';
import StrukturOrganisasiChart from '../components/dashboard/StrukturOrganisasiChart';
import { PKK_CONFIG } from '../utils/constants';
import { 
    FiUsers, FiClock, FiTrendingUp, FiBarChart2, FiPieChart, 
    FiCheckCircle, FiAlertCircle, FiFileText, FiArrowRight, FiHeart 
} from 'react-icons/fi';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';

// Registrasi komponen Chart.js
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// Komponen Kartu Statistik Modern
const StatCard = ({ icon, title, value, colorClass, subTitle }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-start space-x-4 transition-all hover:shadow-md duration-300 relative overflow-hidden group">
        <div className={`p-3 rounded-xl text-white shadow-lg ${colorClass} transform group-hover:scale-110 transition-transform duration-300`}>
            {icon}
        </div>
        <div className="flex-1 z-10">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</h3>
            {subTitle && <p className="text-xs text-gray-400 mt-1">{subTitle}</p>}
        </div>
        {/* Dekorasi background */}
        <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 ${colorClass}`}></div>
    </div>
);

// Helper: Hitung Umur
const getAge = (dateString) => {
    if (!dateString) return null;
    const birthDate = typeof dateString.toDate === 'function' ? dateString.toDate() : new Date(dateString);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
};

// Helper: Cek Kelengkapan Data (Sesuai PKKPage.js)
const checkCompleteness = (item) => {
    const requiredFields = ['nama', 'jabatan', 'no_sk', 'tgl_lahir', 'jenis_kelamin', 'no_hp'];
    return requiredFields.every(field => item[field] && String(item[field]).trim() !== '');
};

const PKKDashboard = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate(); 
    
    // Gunakan config name 'pkk' atau dari konstanta jika ada
    const collectionName = PKK_CONFIG?.collectionName || 'pkk';
    const { data: allData, loading } = useFirestoreCollection(collectionName);

    const { stats, ageChartData, educationChartData, completenessList, dataForHierarchy } = useMemo(() => {
        if (!allData) return { 
            stats: {}, 
            ageChartData: { datasets: [] }, 
            educationChartData: { datasets: [] }, 
            completenessList: [],
            dataForHierarchy: []
        };

        const dataForCurrentView = currentUser.role === 'admin_kecamatan'
            ? allData
            : allData.filter(item => item.desa === currentUser.desa);

        const now = new Date();
        let activeCount = 0;
        let purnaCount = 0;
        let completeCount = 0;
        let incompleteCount = 0;

        // Proses Data
        const processedList = dataForCurrentView.map(m => {
            // Cek Aktif/Purna
            let isActive = true;
            if (m.akhir_jabatan) {
                const akhir = m.akhir_jabatan.toDate ? m.akhir_jabatan.toDate() : new Date(m.akhir_jabatan);
                if (akhir < now) isActive = false;
            }
            if (isActive) activeCount++; else purnaCount++;

            // Cek Kelengkapan
            const isComplete = checkCompleteness(m);
            if (isComplete) completeCount++; else incompleteCount++;

            return { ...m, isComplete, isActive };
        });

        // Filter untuk tabel monitoring: Hanya yang BELUM lengkap
        const incompleteList = processedList.filter(item => !item.isComplete);

        // Kalkulasi Rata-rata Usia
        const ages = processedList.filter(m => m.isActive).map(m => getAge(m.tgl_lahir)).filter(age => age !== null);
        const averageAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 'N/A';
        
        // Chart Usia
        const ageGroups = { '< 30': 0, '30-40': 0, '41-50': 0, '> 50': 0 };
        ages.forEach(age => {
            if (age < 30) ageGroups['< 30']++;
            else if (age <= 40) ageGroups['30-40']++;
            else if (age <= 50) ageGroups['41-50']++;
            else ageGroups['> 50']++;
        });

        // Chart Pendidikan
        const educationMap = new Map();
        processedList.filter(m => m.isActive).forEach(m => {
            const education = m.pendidikan || 'Tidak Diketahui';
            educationMap.set(education, (educationMap.get(education) || 0) + 1);
        });

        return {
            stats: {
                totalAktif: activeCount,
                totalPurna: purnaCount,
                rataRataUsia: averageAge,
                totalLengkap: completeCount,
                totalBelum: incompleteCount,
                totalData: dataForCurrentView.length
            },
            ageChartData: {
                labels: Object.keys(ageGroups),
                datasets: [{
                    label: 'Anggota',
                    data: Object.values(ageGroups),
                    backgroundColor: 'rgba(236, 72, 153, 0.8)', // Pink color for PKK
                    borderRadius: 4,
                }],
            },
            educationChartData: {
                labels: [...educationMap.keys()],
                datasets: [{
                    data: [...educationMap.values()],
                    backgroundColor: ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#3B82F6', '#6B7280'],
                    borderWidth: 0,
                }]
            },
            completenessList: incompleteList,
            dataForHierarchy: dataForCurrentView
        };
    }, [allData, currentUser]);

    // Handler Klik Baris -> Navigasi ke Edit di PKKPage
    const handleRowClick = (id) => {
        navigate(`/app/pkk/data?edit=${id}`);
    };

    if (loading) return <div className="flex justify-center items-center h-96"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-8 pb-10">
            {/* 1. Kartu Statistik Utama */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard 
                    icon={<FiCheckCircle className="w-6 h-6" />}
                    title="Data Lengkap"
                    value={stats.totalLengkap}
                    subTitle={`${((stats.totalLengkap / stats.totalData) * 100 || 0).toFixed(1)}% dari total`}
                    colorClass="bg-gradient-to-r from-green-500 to-emerald-600"
                />
                 <StatCard 
                    icon={<FiAlertCircle className="w-6 h-6" />}
                    title="Belum Lengkap"
                    value={stats.totalBelum}
                    subTitle="Perlu dilengkapi"
                    colorClass="bg-gradient-to-r from-yellow-500 to-orange-600"
                />
                <StatCard 
                    icon={<FiUsers className="w-6 h-6" />}
                    title="Anggota Aktif"
                    value={stats.totalAktif}
                    colorClass="bg-gradient-to-r from-pink-500 to-rose-600"
                />
                 <StatCard 
                    icon={<FiClock className="w-6 h-6" />}
                    title="Purna Tugas"
                    value={stats.totalPurna}
                    colorClass="bg-gradient-to-r from-gray-500 to-slate-600"
                />
            </div>
            
            {/* 2. Grafik & Visualisasi */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Struktur Organisasi (Lebar 2/3) */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <FiHeart className="text-pink-500"/> Struktur Organisasi PKK
                    </h2>
                    <div className="h-[400px] overflow-auto custom-scrollbar border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 p-4">
                        <StrukturOrganisasiChart data={dataForHierarchy} hierarchy={PKK_CONFIG.hierarchy} />
                    </div>
                </div>

                {/* Grafik Pie Pendidikan (Lebar 1/3) */}
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <FiPieChart className="text-purple-500"/> Pendidikan
                    </h2>
                    <div className="flex-1 flex justify-center items-center relative" style={{ minHeight: '300px' }}>
                        <Doughnut 
                            data={educationChartData} 
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: false, 
                                plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF', usePointStyle: true } } },
                                layout: { padding: 20 }
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* 3. Grafik Bar Usia */}
             <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FiBarChart2 className="text-pink-500"/> Komposisi Usia Anggota
                    </h2>
                    <div className="px-3 py-1 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full text-sm font-medium">
                        Rata-rata: {stats.rataRataUsia} Tahun
                    </div>
                </div>
                <div className="h-64">
                    <Bar 
                        data={ageChartData} 
                        options={{ 
                            responsive: true, 
                            maintainAspectRatio: false, 
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9CA3AF' } },
                                x: { grid: { display: false }, ticks: { color: '#9CA3AF' } }
                            }
                        }} 
                     />
                </div>
            </div>

            {/* 4. Tabel Monitoring Kelengkapan Data (HANYA YANG BELUM LENGKAP) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <FiFileText className="text-orange-500"/> Daftar Data Belum Lengkap
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Data berikut memerlukan pembaruan agar status menjadi Lengkap.
                        </p>
                    </div>
                    <div className="text-xs font-medium px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
                        {completenessList.length} Data Perlu Dilengkapi
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Nama Pengurus</th>
                                <th className="px-6 py-4">Jabatan</th>
                                <th className="px-6 py-4">Desa</th>
                                <th className="px-6 py-4 text-center">Status Kelengkapan</th>
                                <th className="px-6 py-4 text-center">Status Jabatan</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {completenessList.slice(0, 10).map((item) => (
                                <tr 
                                    key={item.id} 
                                    onClick={() => handleRowClick(item.id)}
                                    className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                        {item.nama || <span className="text-red-400 italic">Belum diisi</span>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                        {item.jabatan}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                        {item.desa}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse">
                                            <FiAlertCircle/> Belum Lengkap
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {item.isActive ? (
                                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Aktif</span>
                                        ) : (
                                            <span className="text-xs text-gray-400 font-medium">Purna Tugas</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-xs flex items-center justify-center gap-1 mx-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                            Lengkapi <FiArrowRight/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {completenessList.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        <div className="flex flex-col items-center">
                                            <FiCheckCircle className="w-10 h-10 text-green-500 mb-2 opacity-50" />
                                            <p>Semua data sudah lengkap!</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {completenessList.length > 10 && (
                    <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 text-center text-xs text-gray-500">
                        Menampilkan 10 data teratas dari {completenessList.length} data yang belum lengkap. Gunakan menu Data PKK untuk melihat semua.
                    </div>
                )}
            </div>
        </div>
    );
};

export default PKKDashboard;