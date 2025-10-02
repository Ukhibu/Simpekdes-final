import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, collectionGroup } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Spinner from '../components/common/Spinner';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiFilter } from 'react-icons/fi';
import { DESA_LIST } from '../utils/constants';
import InputField from '../components/common/InputField';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

// Komponen Kartu Statistik
const StatCard = ({ title, value, icon, colorClass }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md flex items-center gap-4">
        <div className={`p-3 rounded-full text-white ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    </div>
);

const KeuanganDashboard = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [anggaranList, setAnggaranList] = useState([]);
    const [realisasiList, setRealisasiList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);

    // [PERBAIKAN TOTAL] Logika pengambilan data diperbaiki agar sesuai struktur baru
    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        // --- Kueri untuk Anggaran ---
        let anggaranConstraints = [where("tahun", "==", Number(filterTahun))];
        if (currentUser.role === 'admin_desa') {
            anggaranConstraints.push(where("desa", "==", currentUser.desa));
        } else if (filterDesa !== 'all') {
            anggaranConstraints.push(where("desa", "==", filterDesa));
        }
        const anggaranQuery = query(collection(db, 'anggaran_tahunan'), ...anggaranConstraints);

        // --- Kueri untuk Realisasi ---
        const startDate = new Date(Number(filterTahun), 0, 1);
        const endDate = new Date(Number(filterTahun), 11, 31, 23, 59, 59);
        
        let realisasiQuery;
        if (filterDesa === 'all' && currentUser.role === 'admin_kecamatan') {
            // Untuk admin kecamatan 'Semua Desa', filter hanya berdasarkan tahun
            realisasiQuery = query(
                collectionGroup(db, 'realisasi'),
                where('tanggal', '>=', startDate),
                where('tanggal', '<=', endDate)
            );
        } else {
            // Untuk admin desa atau admin kecamatan yang memilih desa spesifik
            const desaToFilter = currentUser.role === 'admin_desa' ? currentUser.desa : filterDesa;
            realisasiQuery = query(
                collectionGroup(db, 'realisasi'),
                where('parentDesa', '==', desaToFilter),
                where('tanggal', '>=', startDate),
                where('tanggal', '<=', endDate)
            );
        }

        const unsubAnggaran = onSnapshot(anggaranQuery, (snapshot) => {
            setAnggaranList(snapshot.docs.map(doc => doc.data()));
        }, (err) => {
            console.error("Error fetching anggaran:", err);
            showNotification('Gagal memuat data anggaran.', 'error');
        });

        const unsubRealisasi = onSnapshot(realisasiQuery, (snapshot) => {
            setRealisasiList(snapshot.docs.map(doc => doc.data()));
            setLoading(false);
        }, (err) => {
            console.error("Error fetching realisasi:", err);
            showNotification('Gagal memuat data realisasi. Pastikan indeks Firestore sudah di-deploy.', 'error');
            setLoading(false);
        });

        return () => {
            unsubAnggaran();
            unsubRealisasi();
        };
    }, [currentUser, filterDesa, filterTahun, showNotification]);

    // Logika kalkulasi disesuaikan dengan data yang baru
    const dashboardData = useMemo(() => {
        const totalAnggaranPendapatan = anggaranList.filter(a => a.jenis === 'Pendapatan' && (a.status === 'Disahkan' || a.status === 'Perubahan')).reduce((sum, a) => sum + a.jumlah, 0);
        const totalAnggaranBelanja = anggaranList.filter(a => a.jenis === 'Belanja' && (a.status === 'Disahkan' || a.status === 'Perubahan')).reduce((sum, a) => sum + a.jumlah, 0);
        
        // [PERBAIKAN] Menggunakan jenis dari data anggaran yang cocok, bukan dari data realisasi
        const allRealisasi = realisasiList.map(t => {
            const parentAnggaran = anggaranList.find(a => a.id === t.parentAnggaranId);
            return {
                ...t,
                jenis: parentAnggaran ? parentAnggaran.jenis : 'Tidak Diketahui'
            };
        });

        const totalRealisasiPendapatan = allRealisasi.filter(t => t.jenis === 'Pendapatan').reduce((sum, t) => sum + t.jumlah, 0);
        const totalRealisasiBelanja = allRealisasi.filter(t => t.jenis === 'Belanja').reduce((sum, t) => sum + t.jumlah, 0);

        const formatRupiah = (val) => `Rp ${val.toLocaleString('id-ID')}`;

        const realisasiChartData = {
            labels: ['Pendapatan', 'Belanja'],
            datasets: [
                {
                    label: 'Anggaran',
                    data: [totalAnggaranPendapatan, totalAnggaranBelanja],
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                },
                {
                    label: 'Realisasi',
                    data: [totalRealisasiPendapatan, totalRealisasiBelanja],
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                },
            ],
        };

        // Mengelompokkan realisasi per bulan untuk grafik arus kas
        const monthlyData = Array(12).fill(0).map(() => ({ pendapatan: 0, belanja: 0 }));
        allRealisasi.forEach(t => {
            if (t.tanggal && t.tanggal.toDate) { // Pemeriksaan keamanan
                const month = t.tanggal.toDate().getMonth();
                if (t.jenis === 'Pendapatan') {
                    monthlyData[month].pendapatan += t.jumlah;
                } else if (t.jenis === 'Belanja') {
                    monthlyData[month].belanja += t.jumlah;
                }
            }
        });

        const arusKasChartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [
                {
                    label: 'Pendapatan Masuk',
                    data: monthlyData.map(d => d.pendapatan),
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    tension: 0.1
                },
                {
                    label: 'Belanja Keluar',
                    data: monthlyData.map(d => d.belanja),
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    tension: 0.1
                },
            ],
        };

        return {
            stats: {
                anggaranPendapatan: formatRupiah(totalAnggaranPendapatan),
                realisasiPendapatan: formatRupiah(totalRealisasiPendapatan),
                anggaranBelanja: formatRupiah(totalAnggaranBelanja),
                realisasiBelanja: formatRupiah(totalRealisasiBelanja),
            },
            realisasiChartData,
            arusKasChartData,
        };
    }, [anggaranList, realisasiList]);
    
    const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
    
    if (loading) return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center gap-4">
                 <InputField label="Tahun Anggaran" type="select" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}>
                    {tahunOptions.map(th => <option key={th} value={th}>{th}</option>)}
                 </InputField>
                 {currentUser.role === 'admin_kecamatan' && (
                    <InputField label="Filter Desa" type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)}>
                        <option value="all">Semua Desa</option>
                        {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                    </InputField>
                 )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Anggaran Pendapatan" value={dashboardData.stats.anggaranPendapatan} icon={<FiTrendingUp />} colorClass="bg-green-500" />
                <StatCard title="Realisasi Pendapatan" value={dashboardData.stats.realisasiPendapatan} icon={<FiTrendingUp />} colorClass="bg-green-600" />
                <StatCard title="Anggaran Belanja" value={dashboardData.stats.anggaranBelanja} icon={<FiTrendingDown />} colorClass="bg-red-500" />
                <StatCard title="Realisasi Belanja" value={dashboardData.stats.realisasiBelanja} icon={<FiTrendingDown />} colorClass="bg-red-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Realisasi Anggaran</h2>
                    <div className="h-80">
                        <Bar options={{ responsive: true, maintainAspectRatio: false }} data={dashboardData.realisasiChartData} />
                    </div>
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                     <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Grafik Arus Kas Bulanan</h2>
                     <div className="h-80">
                         <Line options={{ responsive: true, maintainAspectRatio: false }} data={dashboardData.arusKasChartData} />
                     </div>
                </div>
            </div>
        </div>
    );
};

export default KeuanganDashboard;

