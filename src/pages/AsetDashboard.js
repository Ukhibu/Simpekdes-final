import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection'; 
import Spinner from '../components/common/Spinner';
import { Pie, Bar, Doughnut } from 'react-chartjs-2';
import { 
    Chart as ChartJS, 
    ArcElement, 
    Tooltip, 
    Legend, 
    CategoryScale, 
    LinearScale, 
    BarElement, 
    Title 
} from 'chart.js';
import { FiArchive, FiDollarSign, FiBox, FiFilter, FiActivity, FiPieChart } from 'react-icons/fi';
import { DESA_LIST, KATEGORI_ASET } from '../utils/constants';
import InputField from '../components/common/InputField';

// Register ChartJS Components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// --- KOMPONEN STAT CARD MODERN (FIXED OVERFLOW & RESPONSIVE) ---
const StatCard = ({ title, value, icon, colorClass, isCurrency = false, subTitle }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-start space-x-4 transition-all hover:scale-[1.02] hover:shadow-md h-full">
        {/* Icon wrapper dengan shrink-0 agar tidak gepeng */}
        <div className={`p-3 md:p-4 rounded-xl text-white shadow-lg shrink-0 ${colorClass}`}>
            {icon}
        </div>
        {/* min-w-0 penting agar text truncation/wrapping berfungsi dalam flex container */}
        <div className="flex-1 min-w-0">
            <p className="text-gray-500 dark:text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider truncate" title={title}>{title}</p>
            <h3 className="text-lg md:text-xl lg:text-2xl font-extrabold text-gray-800 dark:text-white mt-1 break-words leading-tight">
                {isCurrency 
                    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) 
                    : value.toLocaleString('id-ID')}
            </h3>
            {subTitle && <p className="text-[10px] md:text-xs text-gray-400 mt-1 font-medium truncate">{subTitle}</p>}
        </div>
    </div>
);

const AsetDashboard = () => {
    const { currentUser } = useAuth();
    
    // Menggunakan hook standar
    const { data: asetData, loading } = useFirestoreCollection('aset');
    
    // State Filter
    const [filterTahun, setFilterTahun] = useState('');
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);

    // --- LOGIKA FILTER & KALKULASI ---
    const { 
        stats, 
        grandTotalNilai, 
        kategoriChartData, 
        kondisiChartData,
        asetPerDesaChartData 
    } = useMemo(() => {
        // 1. Data yang dapat diakses (Sesuai Role)
        const accessibleData = currentUser.role === 'admin_kecamatan' && filterDesa === 'all'
            ? asetData 
            : asetData.filter(a => a.desa === (currentUser.role === 'admin_desa' ? currentUser.desa : filterDesa));

        // Total Kekayaan (Semua Tahun)
        const grandTotal = accessibleData.reduce((sum, aset) => {
            const val = parseFloat(aset.nilaiAset) || 0;
            return sum + val;
        }, 0);

        // 2. Filter Data (Tahun)
        const filteredData = accessibleData.filter(aset => {
            if (!filterTahun) return true;
            if (!aset.tanggalPerolehan) return false;
            try {
                const dateVal = aset.tanggalPerolehan.toDate ? aset.tanggalPerolehan.toDate() : new Date(aset.tanggalPerolehan);
                return dateVal.getFullYear() === parseInt(filterTahun);
            } catch (e) {
                return false;
            }
        });

        // 3. Statistik Dasar
        const totalAset = filteredData.length;
        const totalNilai = filteredData.reduce((sum, aset) => sum + (parseFloat(aset.nilaiAset) || 0), 0);
        const totalBaik = filteredData.filter(a => a.kondisi === 'Baik').length;
        const totalRusak = filteredData.filter(a => a.kondisi === 'Rusak Berat' || a.kondisi === 'Rusak Ringan').length;

        // 4. Data Chart Kategori
        const kategoriCount = {};
        KATEGORI_ASET.forEach(k => kategoriCount[k] = 0);
        filteredData.forEach(a => {
            if (kategoriCount[a.kategori] !== undefined) kategoriCount[a.kategori]++;
            else kategoriCount['Lainnya'] = (kategoriCount['Lainnya'] || 0) + 1;
        });

        const kategoriData = {
            labels: Object.keys(kategoriCount),
            datasets: [{
                data: Object.values(kategoriCount),
                backgroundColor: [
                    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'
                ],
                borderWidth: 0,
                hoverOffset: 10
            }]
        };

        // 5. Data Chart Kondisi
        const kondisiCount = { 'Baik': 0, 'Rusak Ringan': 0, 'Rusak Berat': 0 };
        filteredData.forEach(a => {
            if (kondisiCount[a.kondisi] !== undefined) kondisiCount[a.kondisi]++;
        });

        const kondisiData = {
            labels: Object.keys(kondisiCount),
            datasets: [{
                label: 'Jumlah Aset',
                data: Object.values(kondisiCount),
                backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                borderWidth: 0,
                cutout: '70%',
            }]
        };

        // 6. Data Chart Aset per Desa (Khusus Admin Kecamatan)
        // Kita hitung JUMLAH UNIT dan TOTAL NILAI per desa
        let desaData = null;
        if (currentUser.role === 'admin_kecamatan' && filterDesa === 'all') {
            const desaCount = {};
            const desaValue = {}; // Menyimpan total nilai per desa
            
            DESA_LIST.forEach(d => { 
                desaCount[d] = 0; 
                desaValue[d] = 0; 
            });

            filteredData.forEach(a => {
                if (desaCount[a.desa] !== undefined) {
                    desaCount[a.desa]++;
                    desaValue[a.desa] += (parseFloat(a.nilaiAset) || 0);
                }
            });
            
            desaData = {
                labels: Object.keys(desaCount),
                datasets: [{
                    label: 'Jumlah Aset',
                    data: Object.values(desaCount),
                    // KITA SIMPAN DATA NILAI RUPIAH DI SINI AGAR BISA DIAKSES TOOLTIP
                    extraValues: Object.values(desaValue), 
                    backgroundColor: '#3B82F6',
                    borderRadius: 4,
                    hoverBackgroundColor: '#2563EB'
                }]
            };
        }

        return { 
            stats: { totalAset, totalNilai, totalBaik, totalRusak },
            grandTotalNilai: grandTotal,
            kategoriChartData: kategoriData, 
            kondisiChartData: kondisiData,
            asetPerDesaChartData: desaData
        };
    }, [asetData, filterTahun, filterDesa, currentUser]);

    if (loading) return <div className="flex justify-center items-center h-96"><Spinner size="lg" /></div>;

    const filterTitle = filterTahun ? `Tahun ${filterTahun}` : 'Semua Waktu';

    // --- Opsi Chart Bar dengan Tooltip Kustom ---
    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { 
                beginAtZero: true, 
                grid: { display: false, drawBorder: false },
                ticks: { font: { size: 10 } }
            },
            x: { 
                grid: { display: false, drawBorder: false },
                ticks: { autoSkip: false, maxRotation: 90, minRotation: 0, font: { size: 10 } }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.9)', // Dark background
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    // Kustomisasi Label Tooltip
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y + ' Unit';
                        }
                        return label;
                    },
                    // Menambahkan Baris Baru untuk Nominal Rupiah
                    afterLabel: function(context) {
                        // Mengambil data nilai rupiah dari properti 'extraValues' yang kita buat tadi
                        const rawValue = context.dataset.extraValues[context.dataIndex];
                        const formattedValue = new Intl.NumberFormat('id-ID', { 
                            style: 'currency', 
                            currency: 'IDR', 
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0 
                        }).format(rawValue);
                        return `Total Nilai: ${formattedValue}`;
                    }
                }
            }
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* --- FILTER SECTION --- */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FiPieChart className="text-blue-600"/> Dashboard Aset Desa
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ringkasan data inventaris dan kekayaan desa.</p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="w-full md:w-48">
                         <InputField 
                            type="number" 
                            value={filterTahun} 
                            onChange={(e) => setFilterTahun(e.target.value)} 
                            placeholder="Filter Tahun..."
                            className="bg-gray-50 dark:bg-gray-700 border-none"
                         />
                    </div>
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="w-full md:w-64">
                             <select 
                                value={filterDesa} 
                                onChange={(e) => setFilterDesa(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                             >
                                <option value="all">Semua Desa</option>
                                {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                             </select>
                        </div>
                    )}
                </div>
            </div>

            {/* --- STAT CARDS (Responsive & Anti-Overflow) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard 
                    title="Total Aset" 
                    subTitle={filterTitle}
                    value={stats.totalAset} 
                    icon={<FiBox size={24} />} 
                    colorClass="bg-gradient-to-r from-blue-500 to-indigo-600" 
                 />
                 <StatCard 
                    title="Nilai Aset" 
                    subTitle={filterTitle}
                    value={stats.totalNilai} 
                    icon={<FiDollarSign size={24} />} 
                    colorClass="bg-gradient-to-r from-emerald-500 to-green-600" 
                    isCurrency={true}
                 />
                 <StatCard 
                    title="Kondisi Baik" 
                    subTitle={`${((stats.totalBaik / (stats.totalAset || 1)) * 100).toFixed(0)}% dari total`}
                    value={stats.totalBaik} 
                    icon={<FiActivity size={24} />} 
                    colorClass="bg-gradient-to-r from-cyan-500 to-blue-500" 
                 />
                 <StatCard 
                    title="Total Kekayaan" 
                    subTitle="Akumulasi Seluruh Waktu"
                    value={grandTotalNilai} 
                    icon={<FiArchive size={24} />} 
                    colorClass="bg-gradient-to-r from-purple-500 to-violet-600" 
                    isCurrency={true}
                 />
            </div>

            {/* --- CHARTS SECTION --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Chart Kategori */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100">Distribusi Kategori {filterTitle}</h3>
                        <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">Pie Chart</span>
                     </div>
                     <div className="h-72 w-full flex justify-center">
                        <Pie 
                            data={kategoriChartData}
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: false, 
                                plugins: { 
                                    legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 10 } } 
                                } 
                            }}
                        />
                     </div>
                </div>

                {/* Chart Kondisi */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100">Kondisi Fisik</h3>
                        <span className="text-xs font-medium px-2 py-1 bg-green-50 text-green-600 rounded-lg">Status</span>
                     </div>
                     <div className="h-64 w-full flex justify-center relative">
                        <Doughnut 
                            data={kondisiChartData}
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: false, 
                                plugins: { legend: { position: 'bottom' } },
                                cutout: '75%'
                            }}
                        />
                        {/* Center Text Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-gray-800 dark:text-white">{stats.totalAset}</span>
                            <span className="text-xs text-gray-500 uppercase">Unit</span>
                        </div>
                     </div>
                </div>

                {/* Chart Per Desa (Hanya untuk Admin Kecamatan) */}
                {asetPerDesaChartData && (
                    <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                         <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100">Sebaran Aset & Nilai Kekayaan per Desa</h3>
                            <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">Kecamatan View</span>
                         </div>
                         <div className="h-80 w-full">
                            <Bar 
                                data={asetPerDesaChartData}
                                options={barChartOptions} // MENGGUNAKAN OPSI BARU DENGAN TOOLTIP KUSTOM
                            />
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AsetDashboard;