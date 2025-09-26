import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FiUsers, FiCheckCircle, FiAlertCircle, FiEdit, FiMapPin, FiCalendar, FiBriefcase } from 'react-icons/fi';

// Komponen Chart yang sudah ada tetap digunakan
import PerangkatDesaChart from '../components/dashboard/PerangkatDesaChart';

// --- Helper Functions ---

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

// --- Komponen Internal Halaman Dashboard ---

const StatCard = ({ icon, title, value, color }) => {
    const colorClasses = {
        purple: 'bg-purple-500',
        blue: 'bg-blue-500',
        sky: 'bg-sky-500',
        green: 'bg-green-500',
        red: 'bg-red-500',
    };
    const selectedColor = colorClasses[color] || colorClasses.blue;

    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-lg shadow-md flex items-center space-x-4 transition-transform hover:scale-105 duration-300">
            <div className={`p-4 rounded-full text-white ${selectedColor}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
};

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 bg-gray-700 bg-opacity-90 text-white rounded-md border border-gray-600 text-sm">
                <p>{`${payload[0].name}: ${payload[0].value} orang (${(payload[0].percent * 100).toFixed(0)}%)`}</p>
            </div>
        );
    }
    return null;
};

const JabatanChart = ({ data }) => {
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const jabatanMap = new Map();
        data.forEach(p => {
            const jabatan = p.jabatan || 'Belum Diisi';
            jabatanMap.set(jabatan, (jabatanMap.get(jabatan) || 0) + 1);
        });

        const sortedJabatan = Array.from(jabatanMap.entries()).sort((a, b) => b[1] - a[1]);

        if (sortedJabatan.length > 7) {
            const topJabatan = sortedJabatan.slice(0, 7);
            const otherJabatanCount = sortedJabatan.slice(7).reduce((acc, curr) => acc + curr[1], 0);
            
            const finalData = topJabatan.map(([name, value]) => ({ name, value }));
            if (otherJabatanCount > 0) {
                finalData.push({ name: 'Lainnya', value: otherJabatanCount });
            }
            return finalData;
        }

        return sortedJabatan.map(([name, value]) => ({ name, value }));
    }, [data]);
    
    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280', '#F97316', '#6366F1'];

    if (chartData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <FiUsers size={48} className="mb-4" />
                <h3 className="font-bold text-lg">Data Jabatan Kosong</h3>
                <p className="text-sm">Tidak ada data aparatur yang tersedia.</p>
            </div>
        );
    }

    return (
        <>
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">
                Komposisi Jabatan Aparatur
            </h2>
            <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconSize={12} wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                </PieChart>
            </ResponsiveContainer>
        </>
    );
};

// --- Komponen Utama Dashboard ---
const DashboardPage = () => {
    const { currentUser } = useAuth();
    const [perangkatData, setPerangkatData] = useState([]);
    const [bpdData, setBpdData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser || (currentUser.role === 'admin_desa' && !currentUser.desa)) {
            setLoading(false);
            return;
        }

        const perangkatCollection = collection(db, 'perangkat');
        let perangkatQuery = currentUser.role === 'admin_kecamatan'
            ? query(perangkatCollection)
            : query(perangkatCollection, where("desa", "==", currentUser.desa));

        if (dateRange.start) {
            perangkatQuery = query(perangkatQuery, where("tgl_pelantikan", ">=", dateRange.start));
        }
        if (dateRange.end) {
            perangkatQuery = query(perangkatQuery, where("tgl_pelantikan", "<=", dateRange.end));
        }

        const bpdCollection = collection(db, 'bpd');
        const bpdQuery = currentUser.role === 'admin_kecamatan'
            ? query(bpdCollection)
            : query(bpdCollection, where("desa", "==", currentUser.desa));

        const unsubscribePerangkat = onSnapshot(perangkatQuery, (snapshot) => {
            setPerangkatData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching perangkat data:", error));

        const unsubscribeBpd = onSnapshot(bpdQuery, (snapshot) => {
            setBpdData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching BPD data:", error));

        const checkLoading = async () => {
            await new Promise(resolve => setTimeout(resolve, 500));
            setLoading(false);
        };
        checkLoading();

        return () => {
            unsubscribePerangkat();
            unsubscribeBpd();
        };
    }, [currentUser, dateRange]);

    const memoizedData = useMemo(() => {
        if (!currentUser) return { stats: {}, incompleteList: [], barChartData: null, doughnutChartData: { datasets: [] }, ageChartData: { datasets: [] }, rekapPerDesa: [] };

        const totalPerangkat = perangkatData.length;
        const lengkap = perangkatData.filter(isDataLengkap).length;
        const belumLengkap = totalPerangkat - lengkap;
        const listBelumLengkap = perangkatData.filter(p => !isDataLengkap(p));
        const totalBpd = bpdData.length;

        let barData = null;
        const rekapData = [];

        if (currentUser.role === 'admin_kecamatan') {
            const dataLengkapPerDesa = DESA_LIST.map(desa => perangkatData.filter(p => p.desa === desa && isDataLengkap(p)).length);
            const dataBelumLengkapPerDesa = DESA_LIST.map(desa => perangkatData.filter(p => p.desa === desa && !isDataLengkap(p)).length);
            barData = {
                labels: DESA_LIST,
                datasets: [
                    { label: 'Data Lengkap', data: dataLengkapPerDesa, backgroundColor: '#22C55E', borderColor: '#16A34A' },
                    { label: 'Belum Lengkap', data: dataBelumLengkapPerDesa, backgroundColor: '#EF4444', borderColor: '#DC2626' }
                ]
            };
            DESA_LIST.forEach(desa => {
                rekapData.push({
                    desa,
                    jumlah: perangkatData.filter(p => p.desa === desa).length
                });
            });
        }
        
        const pendidikanMap = new Map();
        perangkatData.forEach(p => {
            const pendidikan = p.pendidikan || 'Belum Diisi';
            pendidikanMap.set(pendidikan, (pendidikanMap.get(pendidikan) || 0) + 1);
        });

        const doughnutData = {
            labels: [...pendidikanMap.keys()],
            datasets: [{
                data: [...pendidikanMap.values()],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'],
                hoverOffset: 4
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
            datasets: [{
                label: 'Jumlah Perangkat',
                data: Object.values(ageGroups),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        };

        return {
            stats: { totalPerangkat, totalBpd, lengkap, belumLengkap },
            barChartData: barData,
            doughnutChartData: doughnutData,
            ageChartData: ageData,
            incompleteList: listBelumLengkap,
            rekapPerDesa: rekapData
        };
    }, [perangkatData, bpdData, currentUser]);
    
    const handleDateChange = (e) => {
        setDateRange({ ...dateRange, [e.target.name]: e.target.value });
    };

    if (loading) return <div className="min-h-[80vh] flex items-center justify-center"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Dashboard Utama</h1>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                <div className="flex flex-wrap items-center gap-4">
                    <FiCalendar className="text-gray-600 dark:text-gray-300"/>
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200">Filter Pelantikan Aparatur:</h3>
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

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {currentUser?.role === 'admin_kecamatan' && (
                     <StatCard icon={<FiMapPin size={28} />} title="Total Desa" value={DESA_LIST.length} color="purple" />
                )}
                <StatCard icon={<FiUsers size={28} />} title="Aparatur Desa" value={memoizedData.stats.totalPerangkat} color="blue" />
                <StatCard icon={<FiBriefcase size={28} />} title="Anggota BPD" value={memoizedData.stats.totalBpd} color="sky" />
                <StatCard icon={<FiCheckCircle size={28} />} title="Data Lengkap" value={memoizedData.stats.lengkap} color="green" />
                <StatCard icon={<FiAlertCircle size={28} />} title="Belum Lengkap" value={memoizedData.stats.belumLengkap} color="red" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    {currentUser?.role === 'admin_kecamatan' ? (
                        <PerangkatDesaChart data={memoizedData.rekapPerDesa} />
                    ) : (
                        <JabatanChart data={perangkatData} />
                    )}
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                     <JabatanChart data={perangkatData} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Demografi Usia Aparatur</h2>
                     <Bar options={{ responsive: true, plugins: { legend: { display: false } } }} data={memoizedData.ageChartData} />
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col">
                    <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Statistik Pendidikan</h2>
                    <div className="flex-grow flex items-center justify-center h-80">
                        <Doughnut data={memoizedData.doughnutChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#4B5563' } } } }} />
                    </div>
                </div>
            </div>

            {currentUser?.role === 'admin_kecamatan' && memoizedData.barChartData && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Rekapitulasi Kelengkapan Data per Desa</h2>
                    <Line options={{ responsive: true, plugins: { legend: { position: 'top', labels: { color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#4B5563' } } }, scales: { y: { beginAtZero: true, ticks: { color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#4B5563'} }, x: { ticks: { color: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#4B5563'} } } }} data={memoizedData.barChartData} />
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                    <FiAlertCircle className="text-yellow-500" /> Perangkat dengan Data Belum Lengkap
                </h2>
                {memoizedData.incompleteList.length > 0 ? (
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
                                {memoizedData.incompleteList.map((p) => (
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

