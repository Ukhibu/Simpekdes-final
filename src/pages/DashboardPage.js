import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
    FiUsers, FiCheckCircle, FiAlertCircle, FiEdit, FiMapPin, 
    FiCalendar, FiBriefcase, FiActivity, FiArrowUpRight
} from 'react-icons/fi';
import PerangkatDesaChart from '../components/dashboard/PerangkatDesaChart';

// --- CSS Animation Styles ---
const dashboardStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.3);
    border-radius: 20px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(107, 114, 128, 0.6);
  }
`;

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

// --- Komponen Internal ---

const StatCard = ({ icon, title, value, color, index }) => {
    const styles = {
        purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-100 dark:border-purple-800', ring: 'group-hover:ring-purple-200 dark:group-hover:ring-purple-800' },
        blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-100 dark:border-blue-800', ring: 'group-hover:ring-blue-200 dark:group-hover:ring-blue-800' },
        sky:    { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-100 dark:border-sky-800', ring: 'group-hover:ring-sky-200 dark:group-hover:ring-sky-800' },
        green:  { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-800', ring: 'group-hover:ring-emerald-200 dark:group-hover:ring-emerald-800' },
        red:    { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-100 dark:border-rose-800', ring: 'group-hover:ring-rose-200 dark:group-hover:ring-rose-800' },
    };
    
    const activeStyle = styles[color] || styles.blue;

    return (
        <div 
            className={`bg-white dark:bg-gray-800 p-5 rounded-2xl border ${activeStyle.border} shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden group hover:-translate-y-1`}
            style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.1}s backwards` }}
        >
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                    <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{value}</h3>
                </div>
                <div className={`p-3 rounded-2xl ${activeStyle.bg} ${activeStyle.text} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                    {icon}
                </div>
            </div>
            
            <div className="mt-4 flex items-center text-xs font-medium text-gray-400 dark:text-gray-500">
                <span className="flex items-center text-green-500 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md mr-2">
                    <FiArrowUpRight className="mr-0.5" /> Aktif
                </span>
                <span>Update Real-time</span>
            </div>

            {/* Decorative Background Blob */}
            <div className={`absolute -bottom-6 -right-6 w-32 h-32 rounded-full ${activeStyle.bg} opacity-50 blur-3xl group-hover:opacity-70 transition-opacity duration-500`}></div>
        </div>
    );
};

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div className="relative z-50 p-3 bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-100 dark:border-gray-700 text-sm animate-fade-in">
                <p className="font-bold text-gray-900 dark:text-white mb-1 border-b border-gray-100 dark:border-gray-700 pb-1">{payload[0].name}</p>
                <div className="flex items-center gap-2 pt-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill }}></span>
                    <p className="text-gray-700 dark:text-gray-200 font-medium">
                        {`${payload[0].value} Orang`} 
                        <span className="text-gray-400 ml-1 text-xs">({(payload[0].percent * 100).toFixed(1)}%)</span>
                    </p>
                </div>
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
        if (sortedJabatan.length > 6) {
            const topJabatan = sortedJabatan.slice(0, 6);
            const otherJabatanCount = sortedJabatan.slice(6).reduce((acc, curr) => acc + curr[1], 0);
            const finalData = topJabatan.map(([name, value]) => ({ name, value }));
            if (otherJabatanCount > 0) finalData.push({ name: 'Lainnya', value: otherJabatanCount });
            return finalData;
        }
        return sortedJabatan.map(([name, value]) => ({ name, value }));
    }, [data]);
    
    const COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#14B8A6', '#F43F5E'];

    if (chartData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-full mb-3 animate-pulse">
                    <FiUsers size={32} />
                </div>
                <h3 className="font-semibold text-sm">Belum ada data</h3>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col relative">
            <div className="flex justify-between items-center mb-4 px-1">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Komposisi Jabatan</h2>
            </div>
            <div className="flex-grow min-h-[300px] w-full overflow-hidden relative">
                <ResponsiveContainer width="99%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            nameKey="name"
                            stroke="none"
                            cornerRadius={4}
                        >
                            {chartData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={COLORS[index % COLORS.length]} 
                                    className="hover:opacity-80 transition-opacity duration-300 outline-none cursor-pointer"
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ zIndex: 100 }} />
                        <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            iconType="circle"
                            iconSize={8}
                            formatter={(value) => <span className="text-gray-600 dark:text-gray-300 text-xs font-medium ml-1">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Text Overlay */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none z-0">
                    <span className="text-2xl font-bold text-gray-800 dark:text-white animate-fade-in">{data.length}</span>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Total</p>
                </div>
            </div>
        </div>
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

    // Efek untuk mengambil data
    useEffect(() => {
        if (!currentUser || (currentUser.role === 'admin_desa' && !currentUser.desa)) {
            setLoading(false);
            return;
        }

        const perangkatCollection = collection(db, 'perangkat');
        let perangkatQuery = currentUser.role === 'admin_kecamatan'
            ? query(perangkatCollection)
            : query(perangkatCollection, where("desa", "==", currentUser.desa));

        if (dateRange.start) perangkatQuery = query(perangkatQuery, where("tgl_pelantikan", ">=", dateRange.start));
        if (dateRange.end) perangkatQuery = query(perangkatQuery, where("tgl_pelantikan", "<=", dateRange.end));

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
            await new Promise(resolve => setTimeout(resolve, 800)); // Sedikit delay agar transisi lebih halus
            setLoading(false);
        };
        checkLoading();

        return () => {
            unsubscribePerangkat();
            unsubscribeBpd();
        };
    }, [currentUser, dateRange]);

    const memoizedData = useMemo(() => {
        if (!currentUser) return { stats: {}, incompleteList: [], kelengkapanChartData: { datasets: [] }, ageChartData: { datasets: [] }, rekapPerDesa: [], pendidikanDoughnutData: { datasets: [] } };

        const totalPerangkat = perangkatData.length;
        const lengkap = perangkatData.filter(isDataLengkap).length;
        const belumLengkap = totalPerangkat - lengkap;
        const listBelumLengkap = perangkatData.filter(p => !isDataLengkap(p));
        const totalBpd = bpdData.length;

        const rekapData = [];
        let kelengkapanData = {};

        if (currentUser.role === 'admin_kecamatan') {
            const dataLengkapPerDesa = DESA_LIST.map(desa => perangkatData.filter(p => p.desa === desa && isDataLengkap(p)).length);
            const dataBelumLengkapPerDesa = DESA_LIST.map(desa => perangkatData.filter(p => p.desa === desa && !isDataLengkap(p)).length);
            kelengkapanData = {
                labels: DESA_LIST,
                datasets: [
                    { label: 'Data Lengkap', data: dataLengkapPerDesa, backgroundColor: '#10B981', borderRadius: 4, barPercentage: 0.6 },
                    { label: 'Belum Lengkap', data: dataBelumLengkapPerDesa, backgroundColor: '#F43F5E', borderRadius: 4, barPercentage: 0.6 }
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

        const pendidikanDoughnutData = {
             labels: [...pendidikanMap.keys()],
             datasets: [{
                label: 'Jumlah Aparatur',
                data: [...pendidikanMap.values()],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'],
                borderWidth: 0,
                hoverOffset: 15
             }]
        }
        
        const ageGroups = { '< 30': 0, '30-40': 0, '41-50': 0, '> 50': 0 };
        perangkatData.forEach(p => {
            const age = getAge(p.tgl_lahir);
            if (age !== null) {
                if (age < 30) ageGroups['< 30']++;
                else if (age <= 40) ageGroups['30-40']++;
                else if (age <= 50) ageGroups['41-50']++;
                else ageGroups['> 50']++;
            }
        });

        const ageData = {
            labels: Object.keys(ageGroups),
            datasets: [{
                label: 'Jumlah Perangkat',
                data: Object.values(ageGroups),
                backgroundColor: '#6366F1',
                borderRadius: 8,
                barThickness: 40,
                hoverBackgroundColor: '#4F46E5'
            }]
        };

        return {
            stats: { totalPerangkat, totalBpd, lengkap, belumLengkap },
            kelengkapanChartData: kelengkapanData,
            ageChartData: ageData,
            incompleteList: listBelumLengkap,
            rekapPerDesa: rekapData,
            pendidikanDoughnutData: pendidikanDoughnutData
        };
    }, [perangkatData, bpdData, currentUser]);
    
    const handleDateChange = (e) => {
        setDateRange({ ...dateRange, [e.target.name]: e.target.value });
    };

    // --- LOGIKA NAVIGASI UPDATE DATA ---
    const handleEditClick = (perangkat) => {
        // Encode nama desa untuk keamanan URL
        const targetDesa = encodeURIComponent(perangkat.desa);
        
        // Navigasi dengan Query Params:
        // 1. desa = filter desa otomatis
        // 2. edit = ID perangkat yang akan diedit (memicu modal popup)
        navigate(`/app/perangkat?desa=${targetDesa}&edit=${perangkat.id}`);
    };

    if (loading) return <div className="min-h-[80vh] flex items-center justify-center"><Spinner size="lg" /></div>;

    // --- TAMPILAN UTAMA ---
    return (
        <div className="space-y-8 pb-20 p-1 animate-fade-in-up">
            <style>{dashboardStyles}</style>

            {/* Header Filter Section - Static (Bukan Sticky) untuk menghindari tabrakan dengan Header Utama */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-md">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30">
                        <FiCalendar size={22}/>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">Filter Data</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sesuaikan rentang waktu data yang ditampilkan</p>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative group">
                        <input 
                            type="date" name="start" value={dateRange.start} onChange={handleDateChange} 
                            className="w-full sm:w-auto pl-4 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all hover:bg-white dark:hover:bg-gray-700 shadow-sm"
                        />
                        <span className="absolute -top-2.5 left-3 bg-white dark:bg-gray-800 px-1 text-[10px] font-bold text-gray-400">DARI</span>
                    </div>
                    <div className="relative group">
                        <input 
                            type="date" name="end" value={dateRange.end} onChange={handleDateChange} 
                            className="w-full sm:w-auto pl-4 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all hover:bg-white dark:hover:bg-gray-700 shadow-sm"
                        />
                        <span className="absolute -top-2.5 left-3 bg-white dark:bg-gray-800 px-1 text-[10px] font-bold text-gray-400">SAMPAI</span>
                    </div>
                </div>
            </div>

            {/* Stat Cards Grid */}
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {currentUser?.role === 'admin_kecamatan' && (
                     <StatCard icon={<FiMapPin size={24} />} title="Total Desa" value={DESA_LIST.length} color="purple" index={0} />
                )}
                <StatCard icon={<FiUsers size={24} />} title="Aparatur Desa" value={memoizedData.stats.totalPerangkat} color="blue" index={1} />
                <StatCard icon={<FiBriefcase size={24} />} title="Anggota BPD" value={memoizedData.stats.totalBpd} color="sky" index={2} />
                <StatCard icon={<FiCheckCircle size={24} />} title="Data Lengkap" value={memoizedData.stats.lengkap} color="green" index={3} />
                <StatCard icon={<FiAlertCircle size={24} />} title="Belum Lengkap" value={memoizedData.stats.belumLengkap} color="red" index={4} />
            </div>
            
            {/* Dashboard Content Based on Role */}
            {currentUser.role === 'admin_kecamatan' ? (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Grafik Utama */}
                        <div className="xl:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-[450px] overflow-hidden flex flex-col animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                             {/* Responsive Wrapper with overflow hidden */}
                            <div className="flex-1 w-full min-w-0 min-h-0">
                                <PerangkatDesaChart data={memoizedData.rekapPerDesa} loading={loading} />
                            </div>
                        </div>
                        {/* Grafik Jabatan */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-[450px] overflow-hidden animate-fade-in-up" style={{animationDelay: '0.3s'}}>
                            <JabatanChart data={perangkatData} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                         <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[400px] overflow-hidden flex flex-col animate-fade-in-up" style={{animationDelay: '0.4s'}}>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Demografi Usia</h2>
                                <FiActivity className="text-indigo-500" />
                            </div>
                            <div className="flex-1 h-80 w-full min-w-0">
                                <Bar 
                                    options={{ 
                                        responsive: true, 
                                        maintainAspectRatio: false, 
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            y: { grid: { color: document.documentElement.classList.contains('dark') ? '#374151' : '#F3F4F6' }, border: { display: false } },
                                            x: { grid: { display: false }, border: { display: false } }
                                        }
                                    }} 
                                    data={memoizedData.ageChartData} 
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[400px] overflow-hidden flex flex-col animate-fade-in-up" style={{animationDelay: '0.5s'}}>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Tingkat Pendidikan</h2>
                            </div>
                            <div className="flex-1 relative h-80 flex items-center justify-center w-full min-w-0">
                                <Doughnut 
                                    data={memoizedData.pendidikanDoughnutData} 
                                    options={{ 
                                        responsive: true, 
                                        maintainAspectRatio: false, 
                                        layout: { padding: 20 },
                                        plugins: { 
                                            legend: { position: 'right', labels: { boxWidth: 10, color: '#9CA3AF', font: { size: 11 } } } 
                                        },
                                        cutout: '70%',
                                        elements: { arc: { borderWidth: 0 } }
                                    }} 
                                />
                                <div className="absolute text-center pointer-events-none">
                                    <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600">{memoizedData.stats.totalPerangkat}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Total Staff</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up" style={{animationDelay: '0.6s'}}>
                        <div className="mb-6 flex items-center gap-3">
                            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-500">
                                <FiActivity />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Analisis Kelengkapan Data</h2>
                                <p className="text-xs text-gray-500">Monitoring real-time status administrasi</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                           <div className="relative h-[350px] w-full min-w-0">
                                <h3 className="text-xs font-bold text-center mb-4 text-gray-400 uppercase tracking-widest">Komparasi Data</h3>
                                <Bar 
                                    options={{ 
                                        responsive: true, 
                                        maintainAspectRatio: false, 
                                        scales: { 
                                            x: { stacked: true, grid: { display: false }, ticks: { color: '#9CA3AF', font: {size: 10}} }, 
                                            y: { stacked: true, beginAtZero: true, grid: { color: document.documentElement.classList.contains('dark') ? '#374151' : '#F3F4F6' }, ticks: { color: '#9CA3AF'} } 
                                        }, 
                                        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: {size: 11} } } } 
                                    }} 
                                    data={memoizedData.kelengkapanChartData} 
                                />
                           </div>
                           <div className="relative h-[350px] w-full min-w-0">
                                <h3 className="text-xs font-bold text-center mb-4 text-gray-400 uppercase tracking-widest">Tren & Fluktuasi</h3>
                                <Line
                                    options={{ 
                                        responsive: true, 
                                        maintainAspectRatio: false, 
                                        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: {size: 11} } } }, 
                                        scales: { 
                                            y: { beginAtZero: true, grid: { color: document.documentElement.classList.contains('dark') ? '#374151' : '#F3F4F6' }, ticks: { color: '#9CA3AF'} }, 
                                            x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: {size: 10}} } 
                                        },
                                        elements: {
                                            line: { tension: 0.4, borderWidth: 3 },
                                            point: { radius: 0, hoverRadius: 6 }
                                        }
                                    }}
                                    data={memoizedData.kelengkapanChartData}
                                />
                           </div>
                        </div>
                    </div>
                </>
            ) : (
                // --- ADMIN DESA VIEW ---
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[400px] overflow-hidden">
                            <JabatanChart data={perangkatData} />
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[400px] overflow-hidden flex flex-col">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Tingkat Pendidikan</h2>
                            <div className="flex-1 relative h-80 flex items-center justify-center w-full min-w-0">
                                <Doughnut 
                                    data={memoizedData.pendidikanDoughnutData} 
                                    options={{ 
                                        responsive: true, 
                                        maintainAspectRatio: false, 
                                        layout: { padding: 20 },
                                        plugins: { 
                                            legend: { position: 'right', labels: { boxWidth: 10, color: '#9CA3AF' } } 
                                        },
                                        cutout: '70%',
                                        elements: { arc: { borderWidth: 0 } }
                                    }} 
                                />
                                <div className="absolute text-center pointer-events-none">
                                    <p className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600">{memoizedData.stats.totalPerangkat}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Total Staff</p>
                                </div>
                            </div>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[400px] overflow-hidden flex flex-col">
                             <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Demografi Usia Aparatur</h2>
                             <div className="flex-1 h-80 w-full min-w-0">
                                <Bar 
                                    options={{ 
                                        responsive: true, 
                                        maintainAspectRatio: false, 
                                        plugins: { legend: { display: false } },
                                        scales: {
                                            y: { grid: { color: document.documentElement.classList.contains('dark') ? '#374151' : '#F3F4F6' }, border: {display: false} },
                                            x: { grid: { display: false }, border: {display: false} }
                                        }
                                    }} 
                                    data={memoizedData.ageChartData} 
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Incomplete Data Table Section - SCROLL ISOLATION FIXED */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up" style={{animationDelay: '0.7s'}}>
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500">
                                <FiAlertCircle />
                            </span>
                            Data Belum Lengkap
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-10">
                            Daftar aparatur yang perlu melengkapi administrasi
                        </p>
                    </div>
                    {memoizedData.incompleteList.length > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-800/30 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            {memoizedData.incompleteList.length} Aparatur Perlu Tindakan
                        </div>
                    )}
                </div>

                {/* Container tabel dengan scroll terisolasi max-height 500px */}
                {memoizedData.incompleteList.length > 0 ? (
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar relative">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            {/* Sticky Header menempel pada container ini, bukan window */}
                            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4 font-extrabold tracking-wider bg-gray-50 dark:bg-gray-700">Nama Lengkap</th>
                                    {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-4 font-extrabold tracking-wider bg-gray-50 dark:bg-gray-700">Desa</th>}
                                    <th className="px-6 py-4 font-extrabold tracking-wider bg-gray-50 dark:bg-gray-700">Jabatan</th>
                                    <th className="px-6 py-4 font-extrabold tracking-wider text-center bg-gray-50 dark:bg-gray-700">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {memoizedData.incompleteList.map((p, index) => (
                                    <tr 
                                        key={p.id} 
                                        className="bg-white dark:bg-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-200 group"
                                        style={{ animation: `fadeIn 0.5s ease-out ${index * 0.05}s backwards` }}
                                    >
                                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {p.nama}
                                        </td>
                                        {currentUser.role === 'admin_kecamatan' && (
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                    {p.desa}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                            {p.jabatan}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleEditClick(p)} 
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:hover:bg-blue-500 dark:hover:border-blue-500 rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 active:scale-95"
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
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50">
                        <div className="p-5 bg-green-50 dark:bg-green-900/20 rounded-full mb-4 ring-8 ring-green-50/50 dark:ring-green-900/10 animate-bounce" style={{ animationDuration: '3s' }}>
                            <FiCheckCircle className="text-green-500 w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Semua Data Lengkap!</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto text-sm leading-relaxed">
                            Tidak ada data aparatur yang perlu dilengkapi saat ini. Administrasi desa berjalan dengan sangat baik.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;