import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { FiDollarSign, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { DESA_LIST } from '../utils/constants';
import InputField from '../components/common/InputField';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const StatCard = ({ title, value, icon, colorClass }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4">
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
    const [transaksiList, setTransaksiList] = useState([]);
    const [anggaranList, setAnggaranList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        const buildQuery = (collectionName) => {
            let q = collection(db, collectionName);
            let constraints = [where("tahunAnggaran", "==", Number(filterTahun))];
            if (currentUser.role === 'admin_desa') {
                constraints.push(where("desa", "==", currentUser.desa));
            } else if (filterDesa !== 'all') {
                constraints.push(where("desa", "==", filterDesa));
            }
            return query(q, ...constraints);
        };

        const unsubTransaksi = onSnapshot(buildQuery('keuangan'), (snapshot) => {
            setTransaksiList(snapshot.docs.map(doc => doc.data()));
        });

        const unsubAnggaran = onSnapshot(buildQuery('anggaran'), (snapshot) => {
            setAnggaranList(snapshot.docs.map(doc => doc.data()));
        });
        
        // Simulasikan loading selesai setelah kedua listener aktif
        const timer = setTimeout(() => setLoading(false), 1000);

        return () => {
            unsubTransaksi();
            unsubAnggaran();
            clearTimeout(timer);
        };
    }, [currentUser, filterDesa, filterTahun]);

    const dashboardData = useMemo(() => {
        const totalAnggaranPendapatan = anggaranList.filter(a => a.jenis === 'Pendapatan').reduce((sum, a) => sum + a.jumlah, 0);
        const totalAnggaranBelanja = anggaranList.filter(a => a.jenis === 'Belanja').reduce((sum, a) => sum + a.jumlah, 0);
        
        const totalRealisasiPendapatan = transaksiList.filter(t => t.jenis === 'Pendapatan').reduce((sum, t) => sum + t.jumlah, 0);
        const totalRealisasiBelanja = transaksiList.filter(t => t.jenis === 'Belanja').reduce((sum, t) => sum + t.jumlah, 0);

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

        // Data untuk Line Chart Arus Kas (Contoh: per bulan)
        const monthlyData = { labels: [], pendapatan: [], belanja: [] };
        // Logika ini perlu disesuaikan jika ingin data bulanan yang sebenarnya
        for (let i = 1; i <= 12; i++) {
             monthlyData.labels.push(`Bulan ${i}`);
             monthlyData.pendapatan.push(Math.random() * (totalRealisasiPendapatan / 5));
             monthlyData.belanja.push(Math.random() * (totalRealisasiBelanja / 5));
        }

        const arusKasChartData = {
            labels: monthlyData.labels,
            datasets: [
                {
                    label: 'Pendapatan Masuk',
                    data: monthlyData.pendapatan,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                },
                {
                    label: 'Belanja Keluar',
                    data: monthlyData.belanja,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
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
    }, [transaksiList, anggaranList]);

    if (loading) return <Spinner size="lg" />;

    return (
        <div className="space-y-6">
            
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center gap-4">
                 <InputField label="Tahun Anggaran" type="number" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} />
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Realisasi Anggaran</h2>
                    <div className="h-80">
                        <Bar options={{ responsive: true, maintainAspectRatio: false }} data={dashboardData.realisasiChartData} />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                     <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Grafik Arus Kas</h2>
                     <div className="h-80">
                         <Line options={{ responsive: true, maintainAspectRatio: false }} data={dashboardData.arusKasChartData} />
                     </div>
                </div>
            </div>
        </div>
    );
};

export default KeuanganDashboard;

