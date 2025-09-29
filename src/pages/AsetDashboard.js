import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import { Pie, Bar } from 'react-chartjs-2';
import { FiArchive, FiDollarSign, FiBox, FiTool, FiFilter } from 'react-icons/fi';
import { DESA_LIST, KATEGORI_ASET } from '../utils/constants';
import InputField from '../components/common/InputField';

const StatCard = ({ title, value, icon, colorClass, isCurrency = false }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-start">
        <div className={`p-3 rounded-full mr-4 ${colorClass}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                {isCurrency ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value) : value}
            </p>
        </div>
    </div>
);

const AsetDashboard = () => {
    const { currentUser } = useAuth();
    const [asetData, setAsetData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [filterDesa, setFilterDesa] = useState('all');

    useEffect(() => {
        if (currentUser && currentUser.role === 'admin_desa') {
            setFilterDesa(currentUser.desa);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        let q = collection(db, 'aset');
        let constraints = [];
        
        if (currentUser.role === 'admin_desa') {
            constraints.push(where("desa", "==", currentUser.desa));
        } else if (filterDesa !== 'all') {
            constraints.push(where("desa", "==", filterDesa));
        }

        // Filter berdasarkan tahun perolehan
        if (filterTahun) {
            const startDate = `${filterTahun}-01-01`;
            const endDate = `${filterTahun}-12-31`;
            constraints.push(where("tanggalPerolehan", ">=", startDate));
            constraints.push(where("tanggalPerolehan", "<=", endDate));
        }
        
        q = query(q, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAsetData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, filterTahun, filterDesa]);

    const { stats, kategoriChartData, kondisiChartData } = useMemo(() => {
        const totalAset = asetData.reduce((sum, aset) => sum + (Number(aset.jumlah) || 1), 0);
        const totalNilai = asetData.reduce((sum, aset) => sum + (Number(aset.nilaiPerolehan) || 0) * (Number(aset.jumlah) || 1), 0);
        
        const kategoriCount = KATEGORI_ASET.reduce((acc, kategori) => {
            acc[kategori] = asetData.filter(a => a.kategori === kategori).reduce((sum, a) => sum + (Number(a.jumlah) || 1), 0);
            return acc;
        }, {});

        const kategoriData = {
            labels: Object.keys(kategoriCount),
            datasets: [{
                data: Object.values(kategoriCount),
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'],
            }]
        };

        const kondisiCount = { 'Baik': 0, 'Rusak Ringan': 0, 'Rusak Berat': 0 };
        asetData.forEach(aset => {
            if (kondisiCount[aset.kondisi] !== undefined) {
                kondisiCount[aset.kondisi] += (Number(aset.jumlah) || 1);
            }
        });

        const kondisiData = {
            labels: Object.keys(kondisiCount),
            datasets: [{
                label: 'Jumlah Aset',
                data: Object.values(kondisiCount),
                backgroundColor: ['#22C55E', '#FBBF24', '#EF4444'],
            }]
        };

        return { 
            stats: { totalAset, totalNilai }, 
            kategoriChartData: kategoriData, 
            kondisiChartData: kondisiData 
        };
    }, [asetData]);

    if (loading) return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6">
             <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center gap-4">
                <FiFilter className="text-gray-600 dark:text-gray-300" />
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">Filter Data:</h3>
                <InputField label="Tahun Perolehan" type="number" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} />
                {currentUser.role === 'admin_kecamatan' && (
                    <InputField label="Desa" type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)}>
                        <option value="all">Semua Desa</option>
                        {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                    </InputField>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                 <StatCard title="Total Unit Aset" value={stats.totalAset} icon={<FiBox size={24} className="text-blue-500" />} colorClass="bg-blue-100 dark:bg-blue-900/50" />
                 <StatCard title="Total Nilai Aset" value={stats.totalNilai} icon={<FiDollarSign size={24} className="text-green-500" />} colorClass="bg-green-100 dark:bg-green-900/50" isCurrency={true}/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                     <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Distribusi Aset per Kategori</h2>
                     <div className="h-80 mx-auto flex justify-center">
                        <Pie 
                            data={kategoriChartData}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }}
                        />
                     </div>
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                     <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Kondisi Aset</h2>
                     <div className="h-80 mx-auto flex justify-center">
                        <Bar 
                            data={kondisiChartData}
                            options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }}
                        />
                     </div>
                </div>
            </div>
        </div>
    );
};

export default AsetDashboard;
