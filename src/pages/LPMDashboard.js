import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Spinner from '../components/common/Spinner';
import StrukturOrganisasiChart from '../components/dashboard/StrukturOrganisasiChart';
import { LPM_CONFIG } from '../utils/constants';
import { FiUsers, FiClock, FiTrendingUp, FiBarChart2, FiPieChart } from 'react-icons/fi';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

// Registrasi komponen Chart.js yang akan digunakan
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// Komponen Kartu Statistik
const StatCard = ({ icon, title, value, colorClass }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center space-x-4 transition-transform hover:scale-105 duration-300">
        <div className={`p-3 rounded-full text-white ${colorClass}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        </div>
    </div>
);

// Helper function untuk menghitung umur
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

const LPMDashboard = () => {
    const { currentUser } = useAuth();
    // Mengambil data LPM menggunakan hook yang ada
    const { data: allData, loading } = useFirestoreCollection(LPM_CONFIG.collectionName);

    const { stats, ageChartData, educationChartData } = useMemo(() => {
        if (!allData) return { stats: {}, ageChartData: { datasets: [] }, educationChartData: { datasets: [] } };

        const dataForCurrentView = currentUser.role === 'admin_kecamatan'
            ? allData
            : allData.filter(item => item.desa === currentUser.desa);

        const now = new Date();
        const activeMembers = dataForCurrentView.filter(m => {
            if (!m.akhir_jabatan) return true; // Anggap aktif jika tidak ada tanggal akhir
            const akhirJabatan = m.akhir_jabatan.toDate ? m.akhir_jabatan.toDate() : new Date(m.akhir_jabatan);
            return akhirJabatan >= now;
        });
        const purnaTugasMembers = dataForCurrentView.length - activeMembers.length;

        // Kalkulasi Rata-rata Usia
        const ages = activeMembers.map(m => getAge(m.tgl_lahir)).filter(age => age !== null);
        const averageAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 'N/A';
        
        // Data untuk Grafik Komposisi Usia
        const ageGroups = { '< 30': 0, '30-40': 0, '41-50': 0, '> 50': 0 };
        ages.forEach(age => {
            if (age < 30) ageGroups['< 30']++;
            else if (age <= 40) ageGroups['30-40']++;
            else if (age <= 50) ageGroups['41-50']++;
            else ageGroups['> 50']++;
        });
        const ageData = {
            labels: Object.keys(ageGroups),
            datasets: [{
                label: 'Jumlah Anggota',
                data: Object.values(ageGroups),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
            }],
        };

        // Data untuk Grafik Pendidikan
        const educationMap = new Map();
        activeMembers.forEach(m => {
            const education = m.pendidikan || 'Lainnya';
            educationMap.set(education, (educationMap.get(education) || 0) + 1);
        });
        const educationData = {
            labels: [...educationMap.keys()],
            datasets: [{
                data: [...educationMap.values()],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'],
            }]
        };

        return {
            stats: {
                totalAktif: activeMembers.length,
                totalPurna: purnaTugasMembers,
                rataRataUsia: averageAge,
            },
            ageChartData: ageData,
            educationChartData: educationData,
        };
    }, [allData, currentUser]);
    
    // Gunakan data mentah untuk struktur organisasi, sesuai permintaan
    const dataForHierarchy = useMemo(() => {
        return currentUser.role === 'admin_kecamatan'
            ? allData
            : allData.filter(item => item.desa === currentUser.desa);
    }, [allData, currentUser]);


    if (loading) return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-8">
            {/* Kartu Statistik Baru */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    icon={<FiUsers className="w-6 h-6" />}
                    title="Anggota Aktif"
                    value={stats.totalAktif}
                    colorClass="bg-green-500"
                />
                 <StatCard 
                    icon={<FiClock className="w-6 h-6" />}
                    title="Purna Tugas"
                    value={stats.totalPurna}
                    colorClass="bg-gray-500"
                />
                 <StatCard 
                    icon={<FiTrendingUp className="w-6 h-6" />}
                    title="Rata-rata Usia"
                    value={stats.rataRataUsia !== 'N/A' ? `${stats.rataRataUsia} Tahun` : 'N/A'}
                    colorClass="bg-yellow-500"
                />
            </div>
            
            {/* Struktur Organisasi (Tetap Ada) */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Struktur Hierarki Organisasi LPM</h2>
                <StrukturOrganisasiChart data={dataForHierarchy} hierarchy={LPM_CONFIG.hierarchy} />
            </div>

            {/* Grafik Baru */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                   <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><FiBarChart2/> Komposisi Usia Anggota</h2>
                   <div className="h-80">
                       <Bar 
                           data={ageChartData} 
                           options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} 
                        />
                   </div>
                </div>
                 <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                   <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><FiPieChart/> Tingkat Pendidikan</h2>
                   <div className="h-80 mx-auto flex justify-center">
                       <Doughnut 
                           data={educationChartData} 
                           options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }}
                        />
                   </div>
                </div>
            </div>
        </div>
    );
};

export default LPMDashboard;
