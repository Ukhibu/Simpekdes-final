import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { FiUsers, FiCheckCircle, FiAlertCircle, FiEdit, FiMapPin, FiCalendar, FiBriefcase } from 'react-icons/fi';

// Mengimpor komponen-komponen baru untuk dashboard
import StatCard from '../components/dashboard/StatCard';
import PerangkatDesaChart from '../components/dashboard/PerangkatDesaChart';
import JabatanChart from '../components/dashboard/JabatanChart';

// --- Logika dari DashboardContent.js yang lama dipertahankan ---

const isDataLengkap = (perangkat) => {
    const requiredFields = [
        'nama', 'jabatan', 'nik', 'tempat_lahir', 'tgl_lahir', 
        'pendidikan', 'no_sk', 'tgl_sk', 'tgl_pelantikan', 
        'foto_url', 'ktp_url'
    ];
    return requiredFields.every(field => perangkat[field] && String(perangkat[field]).trim() !== '');
};

const DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

const getAge = (dateString) => {
    if (!dateString) return null;
    const birthDate = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

const DashboardPage = () => {
    const { currentUser } = useAuth();
    const [perangkatData, setPerangkatData] = useState([]);
    const [bpdData, setBpdData] = useState([]); // State baru untuk data BPD
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser || (currentUser.role === 'admin_desa' && !currentUser.desa)) {
            setLoading(false);
            return;
        }

        // Kueri untuk data Perangkat Desa (dari DashboardContent)
        const perangkatCollection = collection(db, 'perangkat');
        let perangkatQuery;
        if (currentUser.role === 'admin_kecamatan') {
            perangkatQuery = query(perangkatCollection);
        } else {
            perangkatQuery = query(perangkatCollection, where("desa", "==", currentUser.desa));
        }
        if (dateRange.start) {
            perangkatQuery = query(perangkatQuery, where("tgl_pelantikan", ">=", dateRange.start));
        }
        if (dateRange.end) {
            perangkatQuery = query(perangkatQuery, where("tgl_pelantikan", "<=", dateRange.end));
        }
        const unsubscribePerangkat = onSnapshot(perangkatQuery, (snapshot) => {
            setPerangkatData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching perangkat data:", error));

        // Kueri untuk data BPD (Tambahan Baru)
        const bpdCollection = collection(db, 'bpd');
        let bpdQuery;
        if (currentUser.role === 'admin_kecamatan') {
            bpdQuery = query(bpdCollection);
        } else {
            bpdQuery = query(bpdCollection, where("desa", "==", currentUser.desa));
        }
        const unsubscribeBpd = onSnapshot(bpdQuery, (snapshot) => {
            setBpdData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching BPD data:", error));


        // Hentikan loading setelah kedua data selesai diambil
        Promise.all([new Promise(res => onSnapshot(perangkatQuery, res)), new Promise(res => onSnapshot(bpdQuery, res))])
            .finally(() => setLoading(false));

        return () => {
            unsubscribePerangkat();
            unsubscribeBpd();
        };
    }, [currentUser, dateRange]);

    const { stats, barChartData, doughnutChartData, ageChartData, incompleteList } = useMemo(() => {
        if (!currentUser) return { stats: {}, incompleteList: [] };

        // Kalkulasi dari DashboardContent
        const totalPerangkat = perangkatData.length;
        const lengkap = perangkatData.filter(isDataLengkap).length;
        const belumLengkap = totalPerangkat - lengkap;
        const listBelumLengkap = perangkatData.filter(p => !isDataLengkap(p));
        
        // Kalkulasi baru untuk BPD
        const totalBpd = bpdData.length;

        // --- Logika Grafik dari DashboardContent dipertahankan ---
        let barData = null;
        if (currentUser.role === 'admin_kecamatan') {
            const dataLengkapPerDesa = DESA_LIST.map(desa => perangkatData.filter(p => p.desa === desa && isDataLengkap(p)).length);
            const dataBelumLengkapPerDesa = DESA_LIST.map(desa => perangkatData.filter(p => p.desa === desa && !isDataLengkap(p)).length);
            barData = {
                labels: DESA_LIST,
                datasets: [
                    { label: 'Data Lengkap', data: dataLengkapPerDesa, backgroundColor: 'rgba(34, 197, 94, 0.8)', borderColor: 'rgba(34, 197, 94, 1)' },
                    { label: 'Belum Lengkap', data: dataBelumLengkapPerDesa, backgroundColor: 'rgba(239, 68, 68, 0.8)', borderColor: 'rgba(239, 68, 68, 1)' }
                ]
            };
        }
        const pendidikanMap = new Map();
        perangkatData.forEach(p => {
            const pendidikan = p.pendidikan || 'Belum Diisi';
            pendidikanMap.set(pendidikan, (pendidikanMap.get(pendidikan) || 0) + 1);
        });
        const doughnutData = {
            labels: [...pendidikanMap.keys()],
            datasets: [{
                label: 'Jumlah Perangkat',
                data: [...pendidikanMap.values()],
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'], hoverOffset: 4
            }]
        };
        const ageGroups = { '< 30': 0, '30-40': 0, '41-50': 0, '> 50': 0, 'N/A': 0 };
        perangkatData.forEach(p => {
            const age = getAge(p.tgl_lahir);
            if (age === null) ageGroups['N/A']++;
            else if (age < 30) ageGroups['< 30']++;
            else if (age <= 40) ageGroups['30-40']++;
            else if (age <= 50) ageGroups['41-50']++;
            else ageGroups['> 50']++;
        });
        const ageData = {
            labels: Object.keys(ageGroups),
            datasets: [{ label: 'Jumlah Perangkat per Kelompok Usia', data: Object.values(ageGroups), backgroundColor: 'rgba(75, 192, 192, 0.6)' }]
        };

        return {
            stats: { totalPerangkat, totalBpd, lengkap, belumLengkap },
            barChartData: barData,
            doughnutChartData: doughnutData,
            ageChartData: ageData,
            incompleteList: listBelumLengkap
        };
    }, [perangkatData, bpdData, currentUser]);
    
    const handleDateChange = (e) => {
        setDateRange({ ...dateRange, [e.target.name]: e.target.value });
    };

    if (loading) return <Spinner />;

    return (
        <div className="space-y-8">
             {/* Filter Tanggal (dari DashboardContent) */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                <div className="flex flex-wrap items-center gap-4">
                    <FiCalendar className="text-gray-600 dark:text-gray-300"/>
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200">Filter Data Berdasarkan Tanggal Pelantikan:</h3>
                    <div>
                        <label htmlFor="start-date" className="text-sm mr-2 dark:text-gray-400">Dari:</label>
                        <input type="date" name="start" value={dateRange.start} onChange={handleDateChange} className="p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                    </div>
                     <div>
                        <label htmlFor="end-date" className="text-sm mr-2 dark:text-gray-400">Sampai:</label>
                        <input type="date" name="end" value={dateRange.end} onChange={handleDateChange} className="p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                    </div>
                </div>
            </div>

            {/* Kartu Statistik Gabungan */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {currentUser?.role === 'admin_kecamatan' && (
                     <StatCard icon={<FiMapPin size={24} />} title="Total Desa" value={DESA_LIST.length} color="purple" />
                )}
                <StatCard icon={<FiUsers size={24} />} title="Aparatur Desa" value={stats.totalPerangkat} color="blue" />
                <StatCard icon={<FiBriefcase size={24} />} title="Anggota BPD" value={stats.totalBpd} color="indigo" />
                <StatCard icon={<FiCheckCircle size={24} />} title="Data Lengkap" value={stats.lengkap} color="green" />
                <StatCard icon={<FiAlertCircle size={24} />} title="Belum Lengkap" value={stats.belumLengkap} color="red" />
            </div>

            {/* Area Grafik Gabungan */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {currentUser?.role === 'admin_kecamatan' && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                        <PerangkatDesaChart data={perangkatData} />
                    </div>
                )}
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <JabatanChart data={perangkatData} />
                 </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Demografi Usia Perangkat</h2>
                     <Bar options={{ responsive: true, plugins: { legend: { display: false } } }} data={ageChartData} />
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Statistik Pendidikan Perangkat</h2>
                    <div className="max-h-80 mx-auto flex justify-center">
                        <Doughnut data={doughnutChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#9CA3AF' } } } }} />
                    </div>
                </div>
            </div>

            {currentUser?.role === 'admin_kecamatan' && barChartData && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Rekapitulasi Kelengkapan Data (Diagram Garis)</h2>
                    <Line options={{ responsive: true, plugins: { legend: { position: 'top', labels: { color: '#9CA3AF' } } }, scales: { y: { beginAtZero: true, ticks: { color: '#9CA3AF'} }, x: { ticks: { color: '#9CA3AF'} } } }} data={barChartData} />
                </div>
            )}

            {/* Tabel Data Belum Lengkap (dari DashboardContent) */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                    <FiAlertCircle className="text-yellow-500" /> Perangkat dengan Data Belum Lengkap
                </h2>
                {incompleteList.length > 0 ? (
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Nama Lengkap</th>
                                    {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                                    <th className="px-6 py-3">Jabatan</th>
                                    <th className="px-6 py-3">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incompleteList.map((p) => (
                                    <tr key={p.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{p.nama}</td>
                                        {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{p.desa}</td>}
                                        <td className="px-6 py-4">{p.jabatan}</td>
                                        <td className="px-6 py-4">
                                            <button onClick={() => navigate(`/app/perangkat?edit=${p.id}`)} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                                <FiEdit size={14}/> Update
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center py-4 text-gray-500 dark:text-gray-400">Semua data perangkat sudah lengkap. Kerja bagus!</p>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;

