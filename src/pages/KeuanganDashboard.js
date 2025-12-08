import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, collectionGroup, Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Spinner from '../components/common/Spinner';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiPieChart, FiActivity, FiFilter } from 'react-icons/fi';
import { DESA_LIST } from '../utils/constants';
import InputField from '../components/common/InputField';

// Register ChartJS Components including Filler for Area Charts
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// --- KOMPONEN STAT CARD MODERN (SINKRON DENGAN ASET DASHBOARD) ---
const StatCard = ({ title, value, icon, colorClass, isCurrency = false, subTitle, trend }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-start space-x-4 transition-all hover:scale-[1.02] hover:shadow-md h-full">
        <div className={`p-3 md:p-4 rounded-xl text-white shadow-lg shrink-0 ${colorClass}`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-gray-500 dark:text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider truncate" title={title}>{title}</p>
            <h3 className="text-lg md:text-xl lg:text-2xl font-extrabold text-gray-800 dark:text-white mt-1 break-words leading-tight">
                {isCurrency 
                    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) 
                    : value.toLocaleString('id-ID')}
            </h3>
            <div className="flex items-center mt-1">
                {subTitle && <p className="text-[10px] md:text-xs text-gray-400 font-medium truncate mr-2">{subTitle}</p>}
                {trend}
            </div>
        </div>
    </div>
);

// Komponen Progress Bar untuk Realisasi
const RealizationProgress = ({ label, percentage, color }) => (
    <div className="mb-4">
        <div className="flex justify-between items-end mb-1">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</span>
            <span className={`text-xs font-bold ${color.text}`}>{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${color.bg}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
        </div>
    </div>
);

const KeuanganDashboard = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [anggaranList, setAnggaranList] = useState([]);
    const [realisasiList, setRealisasiList] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // State Filter
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);

    // --- DATA FETCHING (SINKRON DENGAN HALAMAN LAIN) ---
    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        // 1. Kueri Anggaran (Hanya Status DISAHKAN / PERUBAHAN - Sinkron dengan PenganggaranPage)
        let anggaranConstraints = [
            where("tahun", "==", Number(filterTahun)),
            where("status", "in", ["Disahkan", "Perubahan"]) 
        ];

        if (currentUser.role === 'admin_desa') {
            anggaranConstraints.push(where("desa", "==", currentUser.desa));
        } else if (filterDesa !== 'all') {
            anggaranConstraints.push(where("desa", "==", filterDesa));
        }
        
        const anggaranQuery = query(collection(db, 'anggaran_tahunan'), ...anggaranConstraints);

        // 2. Kueri Realisasi (Menggunakan parentDesa - Sinkron dengan PenatausahaanPage)
        const startDate = Timestamp.fromDate(new Date(Number(filterTahun), 0, 1));
        const endDate = Timestamp.fromDate(new Date(Number(filterTahun), 11, 31, 23, 59, 59));
        
        let realisasiQuery;
        let queryPath = collectionGroup(db, 'realisasi');
        
        if (currentUser.role === 'admin_desa') {
            realisasiQuery = query(queryPath, where("parentDesa", "==", currentUser.desa), where('tanggal', '>=', startDate), where('tanggal', '<=', endDate));
        } else if (filterDesa !== 'all') {
            realisasiQuery = query(queryPath, where("parentDesa", "==", filterDesa), where('tanggal', '>=', startDate), where('tanggal', '<=', endDate));
        } else {
            // Admin Kecamatan 'all' - Ambil semua realisasi di rentang tanggal
            realisasiQuery = query(queryPath, where('tanggal', '>=', startDate), where('tanggal', '<=', endDate));
        }

        const unsubAnggaran = onSnapshot(anggaranQuery, (snapshot) => {
            setAnggaranList(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
        }, (err) => console.error("Error anggaran:", err));

        const unsubRealisasi = onSnapshot(realisasiQuery, (snapshot) => {
            setRealisasiList(snapshot.docs.map(doc => doc.data()));
            setLoading(false);
        }, (err) => {
            console.error("Error realisasi:", err);
            // Handle error index missing secara gracefull
            if(err.code === 'failed-precondition') {
                 showNotification("Index Firestore diperlukan. Hubungi pengembang.", "error");
            }
            setLoading(false);
        });

        return () => {
            unsubAnggaran();
            unsubRealisasi();
        };
    }, [currentUser, filterDesa, filterTahun, showNotification]);
    
    // --- KALKULASI DATA DASHBOARD ---
    const dashboardData = useMemo(() => {
        // Fungsi Format Angka Pendek (1M, 200Jt)
        const formatRupiahKompak = (value) => {
            const num = Number(value);
            if (isNaN(num)) return 'Rp 0';
            if (Math.abs(num) >= 1e12) return `Rp ${(num / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T`;
            if (Math.abs(num) >= 1e9) return `Rp ${(num / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
            if (Math.abs(num) >= 1e6) return `Rp ${(num / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 0 })} Jt`;
            return `Rp ${num.toLocaleString('id-ID')}`;
        };

        const totalAnggaranPendapatan = anggaranList.filter(a => a.jenis === 'Pendapatan').reduce((sum, a) => sum + (Number(a.jumlah) || 0), 0);
        const totalAnggaranBelanja = anggaranList.filter(a => a.jenis === 'Belanja').reduce((sum, a) => sum + (Number(a.jumlah) || 0), 0);
        
        // Mapping Realisasi ke Anggaran (untuk memastikan jenisnya benar)
        // Kita buat Map dari ID Anggaran -> Jenis (Pendapatan/Belanja)
        const anggaranTypeMap = new Map();
        anggaranList.forEach(a => anggaranTypeMap.set(a.id, a.jenis));

        let totalRealisasiPendapatan = 0;
        let totalRealisasiBelanja = 0;
        const monthlyData = Array(12).fill(0).map(() => ({ pendapatan: 0, belanja: 0 }));

        realisasiList.forEach(r => {
            // Cek jenis berdasarkan parentAnggaranId. 
            // Jika parentAnggaran tidak ada di list (misal karena filter desa/tahun beda), abaikan atau handle sebagai unknown.
            // Di sini kita asumsikan sinkron karena filter query sama.
            const jenis = anggaranTypeMap.get(r.parentAnggaranId);
            
            if (jenis === 'Pendapatan') {
                totalRealisasiPendapatan += (Number(r.jumlah) || 0);
            } else if (jenis === 'Belanja') {
                totalRealisasiBelanja += (Number(r.jumlah) || 0);
            }

            // Data Bulanan
            if (r.tanggal?.toDate) {
                const month = r.tanggal.toDate().getMonth();
                if (jenis === 'Pendapatan') monthlyData[month].pendapatan += (Number(r.jumlah) || 0);
                else if (jenis === 'Belanja') monthlyData[month].belanja += (Number(r.jumlah) || 0);
            }
        });
        
        // Persentase
        const persenPendapatan = totalAnggaranPendapatan > 0 ? ((totalRealisasiPendapatan / totalAnggaranPendapatan) * 100).toFixed(1) : 0;
        const persenBelanja = totalAnggaranBelanja > 0 ? ((totalRealisasiBelanja / totalAnggaranBelanja) * 100).toFixed(1) : 0;

        // Surplus/Defisit Realisasi
        const surplusDefisit = totalRealisasiPendapatan - totalRealisasiBelanja;

        // Chart Data: Perbandingan Target vs Realisasi
        const comparisonChartData = {
            labels: ['Pendapatan', 'Belanja'],
            datasets: [
                {
                    label: 'Target Anggaran',
                    data: [totalAnggaranPendapatan, totalAnggaranBelanja],
                    backgroundColor: 'rgba(229, 231, 235, 0.5)', // Gray
                    borderColor: 'rgba(156, 163, 175, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                {
                    label: 'Realisasi',
                    data: [totalRealisasiPendapatan, totalRealisasiBelanja],
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.7)', // Green for Pendapatan
                        'rgba(239, 68, 68, 0.7)'  // Red for Belanja
                    ],
                    borderColor: [
                        'rgba(22, 163, 74, 1)',
                        'rgba(220, 38, 38, 1)'
                    ],
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ],
        };

        // Chart Data: Arus Kas Bulanan (Area Chart)
        const arusKasChartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [
                {
                    label: 'Penerimaan (Masuk)',
                    data: monthlyData.map(d => d.pendapatan),
                    borderColor: '#10B981', // Emerald 500
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Pengeluaran (Keluar)',
                    data: monthlyData.map(d => d.belanja),
                    borderColor: '#EF4444', // Red 500
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ],
        };

        return {
            stats: {
                anggaranPendapatan: formatRupiahKompak(totalAnggaranPendapatan),
                realisasiPendapatan: formatRupiahKompak(totalRealisasiPendapatan),
                anggaranBelanja: formatRupiahKompak(totalAnggaranBelanja),
                realisasiBelanja: formatRupiahKompak(totalRealisasiBelanja),
                persenPendapatan,
                persenBelanja
            },
            surplusDefisit,
            comparisonChartData,
            arusKasChartData,
        };
    }, [anggaranList, realisasiList]);
    
    const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
    
    // Konfigurasi Chart agar Tooltip menampilkan Rupiah
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                ticks: {
                    callback: function(value) {
                        return new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short" }).format(value);
                    }
                }
            }
        }
    };

    if (loading) return <div className="flex justify-center items-center h-96"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6 pb-12">
            {/* --- FILTER SECTION --- */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FiPieChart className="text-blue-600"/> Dashboard Keuangan
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Monitoring APBDes & Realisasi Anggaran Tahun {filterTahun}.</p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="w-full md:w-48">
                         <InputField 
                            type="select" 
                            value={filterTahun} 
                            onChange={(e) => setFilterTahun(e.target.value)} 
                            className="bg-gray-50 dark:bg-gray-700 border-none"
                         >
                             {tahunOptions.map(th => <option key={th} value={th}>{th}</option>)}
                         </InputField>
                    </div>
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="w-full md:w-64">
                             <select 
                                value={filterDesa} 
                                onChange={(e) => setFilterDesa(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                             >
                                <option value="all">Rekap Kecamatan (Semua)</option>
                                {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                             </select>
                        </div>
                    )}
                </div>
            </div>

            {/* --- STAT CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Anggaran Pendapatan" 
                    value={dashboardData.stats.anggaranPendapatan} 
                    icon={<FiTrendingUp size={24} />} 
                    colorClass="bg-gradient-to-r from-emerald-400 to-green-600"
                    subTitle="Target Tahunan"
                />
                <StatCard 
                    title="Realisasi Pendapatan" 
                    value={dashboardData.stats.realisasiPendapatan} 
                    icon={<FiDollarSign size={24} />} 
                    colorClass="bg-gradient-to-r from-emerald-500 to-teal-600"
                    subTitle={`${dashboardData.stats.persenPendapatan}% Tercapai`}
                />
                <StatCard 
                    title="Anggaran Belanja" 
                    value={dashboardData.stats.anggaranBelanja} 
                    icon={<FiTrendingDown size={24} />} 
                    colorClass="bg-gradient-to-r from-rose-400 to-red-600"
                    subTitle="Pagu Tahunan"
                />
                <StatCard 
                    title="Realisasi Belanja" 
                    value={dashboardData.stats.realisasiBelanja} 
                    icon={<FiActivity size={24} />} 
                    colorClass="bg-gradient-to-r from-orange-400 to-red-500"
                    subTitle={`${dashboardData.stats.persenBelanja}% Terserap`}
                />
            </div>

            {/* --- CHARTS & SUMMARY --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Kolom Kiri: Progress & Surplus */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Kartu Surplus/Defisit */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                        <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Sisa Lebih/Kurang (SiLPA)</p>
                        <h3 className={`text-2xl md:text-3xl font-extrabold mt-2 ${dashboardData.surplusDefisit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(dashboardData.surplusDefisit)}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">Selisih Realisasi Pendapatan & Belanja</p>
                    </div>

                    {/* Kartu Progress Bar */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <FiActivity className="text-blue-500"/> Capaian Anggaran
                        </h3>
                        <RealizationProgress 
                            label="Realisasi Pendapatan" 
                            percentage={dashboardData.stats.persenPendapatan} 
                            color={{ text: 'text-green-600', bg: 'bg-green-500' }} 
                        />
                        <RealizationProgress 
                            label="Penyerapan Belanja" 
                            percentage={dashboardData.stats.persenBelanja} 
                            color={{ text: 'text-red-600', bg: 'bg-red-500' }} 
                        />
                    </div>
                </div>

                {/* Kolom Tengah & Kanan: Grafik */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Grafik Perbandingan */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                         <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100">Target vs Realisasi</h3>
                         </div>
                         <div className="h-64 w-full">
                            <Bar data={dashboardData.comparisonChartData} options={chartOptions} />
                         </div>
                    </div>

                    {/* Grafik Tren Bulanan */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                         <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100">Tren Arus Kas Bulanan</h3>
                         </div>
                         <div className="h-64 w-full">
                            <Line data={dashboardData.arusKasChartData} options={chartOptions} />
                         </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default KeuanganDashboard;