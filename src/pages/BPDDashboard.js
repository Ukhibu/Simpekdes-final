import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import { FiUsers, FiAward } from 'react-icons/fi';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// Kartu Statistik (Helper Component)
const StatCard = ({ icon, title, value, colorClass }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center space-x-4">
        <div className={`p-3 rounded-full ${colorClass}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        </div>
    </div>
);

const BPDDashboard = () => {
    const { currentUser } = useAuth();
    const [bpdData, setBpdData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        let q;
        if (currentUser.role === 'admin_kecamatan') {
            q = query(collection(db, "bpd"));
        } else if (currentUser.role === 'admin_desa') {
            q = query(collection(db, "bpd"), where("desa", "==", currentUser.desa));
        }

        if (!q) {
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setBpdData(snapshot.docs.map(doc => doc.data()));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching BPD data: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Kalkulasi data untuk statistik dan grafik
    const { stats, doughnutChartData } = useMemo(() => {
        const totalAnggota = bpdData.length;
        
        const jabatanMap = new Map();
        bpdData.forEach(p => {
            const jabatan = p.jabatan || 'Belum Diisi';
            jabatanMap.set(jabatan, (jabatanMap.get(jabatan) || 0) + 1);
        });

        const doughnutLabels = [...jabatanMap.keys()];
        const doughnutCounts = [...jabatanMap.values()];

        const doughnutData = {
            labels: doughnutLabels,
            datasets: [{
                label: 'Jumlah Anggota',
                data: doughnutCounts,
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
                hoverOffset: 4,
                borderColor: 'transparent'
            }]
        };
        
        const totalDesa = currentUser.role === 'admin_kecamatan' 
            ? new Set(bpdData.map(doc => doc.desa)).size
            : (bpdData.length > 0 ? 1 : 0);

        return {
            stats: { totalAnggota, totalDesa },
            doughnutChartData: doughnutData
        };
    }, [bpdData, currentUser.role]);

    if (loading) return <Spinner />;

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard BPD</h1>
            
            {/* Kartu Statistik */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    icon={<FiUsers className="w-6 h-6 text-white" />}
                    title="Total Anggota BPD"
                    value={stats.totalAnggota}
                    colorClass="bg-indigo-500"
                />
                {currentUser.role === 'admin_kecamatan' && (
                    <StatCard 
                        icon={<FiAward className="w-6 h-6 text-white" />}
                        title="Desa Terdata"
                        value={stats.totalDesa}
                        colorClass="bg-purple-500"
                    />
                )}
            </div>

            {/* Area Grafik dan Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                     <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Struktur Jabatan BPD</h2>
                     <div className="h-80 mx-auto flex justify-center">
                        <Doughnut 
                            data={doughnutChartData} 
                            options={{ 
                                responsive: true, 
                                maintainAspectRatio: false, 
                                plugins: { 
                                    legend: { position: 'top', labels: { color: '#9CA3AF' } } 
                                } 
                            }} 
                        />
                     </div>
                </div>
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                     <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Selamat Datang di Modul BPD</h2>
                     <p className="text-gray-600 dark:text-gray-300">
                        Selamat datang di modul Manajemen Badan Permusyawaratan Desa (BPD). Gunakan menu di samping untuk mengelola data anggota BPD.
                     </p>
                </div>
            </div>
        </div>
    );
};

export default BPDDashboard;
