import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { FiUsers, FiCheckCircle, FiAlertCircle, FiEdit, FiAward } from 'react-icons/fi';

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

// Fungsi untuk menentukan apakah data BPD sudah lengkap
const isDataLengkapBPD = (bpd) => {
    const requiredFields = [
        'nama', 'nik', 'jabatan', 'desa', 'periode', 
        'tgl_sk_bupati', 'tgl_pelantikan', 'tempat_lahir', 'tgl_lahir','pekerjaan'
    ];
    return requiredFields.every(field => bpd[field] && String(bpd[field]).trim() !== '');
};

const BPDDashboard = () => {
    const { currentUser } = useAuth();
    const [bpdData, setBpdData] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

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
            setBpdData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching BPD data: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Kalkulasi data untuk statistik dan grafik
    const { stats, doughnutChartData, completenessChartData, incompleteList } = useMemo(() => {
        const totalAnggota = bpdData.length;
        const lengkap = bpdData.filter(isDataLengkapBPD).length;
        const belumLengkap = totalAnggota - lengkap;
        const listBelumLengkap = bpdData.filter(p => !isDataLengkapBPD(p));
        
        const jabatanMap = new Map();
        bpdData.forEach(p => {
            const jabatan = p.jabatan || 'Belum Diisi';
            jabatanMap.set(jabatan, (jabatanMap.get(jabatan) || 0) + 1);
        });

        const doughnutData = {
            labels: [...jabatanMap.keys()],
            datasets: [{
                label: 'Jumlah Anggota',
                data: [...jabatanMap.values()],
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
                hoverOffset: 4,
                borderColor: 'transparent'
            }]
        };
        
        const completenessData = {
            labels: ['Data Lengkap', 'Belum Lengkap'],
            datasets: [{
                data: [lengkap, belumLengkap],
                backgroundColor: ['#22C55E', '#EF4444'], // green, red
                hoverOffset: 4,
                borderColor: 'transparent'
            }]
        };
        
        const totalDesa = currentUser.role === 'admin_kecamatan' 
            ? new Set(bpdData.map(doc => doc.desa)).size
            : (bpdData.length > 0 ? 1 : 0);

        return {
            stats: { totalAnggota, totalDesa, lengkap, belumLengkap },
            doughnutChartData: doughnutData,
            completenessChartData: completenessData,
            incompleteList: listBelumLengkap
        };
    }, [bpdData, currentUser.role]);

    if (loading) return <Spinner />;

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard BPD</h1>
            
            {/* Kartu Statistik */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    icon={<FiUsers className="w-6 h-6 text-white" />}
                    title="Total Anggota BPD"
                    value={stats.totalAnggota}
                    colorClass="bg-indigo-500"
                />
                 <StatCard 
                    icon={<FiCheckCircle className="w-6 h-6 text-white" />}
                    title="Data Lengkap"
                    value={stats.lengkap}
                    colorClass="bg-green-500"
                />
                 <StatCard 
                    icon={<FiAlertCircle className="w-6 h-6 text-white" />}
                    title="Belum Lengkap"
                    value={stats.belumLengkap}
                    colorClass="bg-red-500"
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
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#9CA3AF' } } } }} 
                        />
                   </div>
                </div>
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                   <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Kelengkapan Data Anggota</h2>
                   <div className="h-80 mx-auto flex justify-center">
                       <Doughnut 
                           data={completenessChartData} 
                           options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#9CA3AF' } } } }}
                        />
                   </div>
                </div>
            </div>
            
            {/* Tabel Data Belum Lengkap Baru */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                    <FiAlertCircle className="text-yellow-500" />
                    Anggota BPD dengan Data Belum Lengkap
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
                                {incompleteList.map((bpd) => (
                                    <tr key={bpd.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{bpd.nama}</td>
                                        {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{bpd.desa}</td>}
                                        <td className="px-6 py-4">{bpd.jabatan}</td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => navigate(`/app/bpd/data?edit=${bpd.id}`)} 
                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                                <FiEdit size={14}/> Update
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center py-4 text-gray-500 dark:text-gray-400">Semua data anggota BPD sudah lengkap. Kerja bagus!</p>
                )}
            </div>
        </div>
    );
};

export default BPDDashboard;

