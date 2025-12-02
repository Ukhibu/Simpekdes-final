import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/dashboard/StatCard';
import Spinner from '../components/common/Spinner';
import { FiUsers, FiCheckCircle, FiPieChart, FiAlertCircle } from 'react-icons/fi';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PENDIDIKAN_LIST } from '../utils/constants';

// Kriteria kelengkapan data
const RT_COMPLETENESS_CRITERIA = ['nama', 'jabatan', 'no_rt', 'desa', 'jenis_kelamin', 'pendidikan'];
const RW_COMPLETENESS_CRITERIA = ['nama', 'jabatan', 'no_rw', 'desa', 'jenis_kelamin', 'pendidikan'];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1943', '#19B2FF', '#0E663D'];

const RtRwDashboard = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [rtData, setRtData] = useState([]);
    const [rwData, setRwData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        setLoading(true);
        let q = collection(db, 'rt_rw');
        
        // Filter berdasarkan desa untuk admin desa
        if (currentUser.role === 'admin_desa') {
            q = query(q, where("desa", "==", currentUser.desa));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filter RT: Punya no_rt dan bukan rw-only
            const rts = allData.filter(item => item.no_rt && !item.no_rw_only);
            
            // Filter RW: Punya no_rw dan tidak punya no_rt
            const rws = allData.filter(item => item.no_rw && !item.no_rt);

            setRtData(rts);
            setRwData(rws);
            setLoading(false);
        }, (error) => {
            console.error("Gagal memuat data RT/RW:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const stats = useMemo(() => {
        const combinedData = [...rtData, ...rwData];
        if (combinedData.length === 0) {
            return {
                totalRt: 0,
                totalRw: 0,
                completenessPercentage: 0,
                incompleteData: [],
                educationData: [],
                genderData: []
            };
        }

        let completedCount = 0;
        const incompleteData = [];

        // Cek RT
        rtData.forEach(item => {
            const isComplete = RT_COMPLETENESS_CRITERIA.every(field => item[field]);
            if (isComplete) completedCount++;
            else incompleteData.push({ ...item, type: 'RT' }); // Type RT
        });

        // Cek RW
        rwData.forEach(item => {
            const isComplete = RW_COMPLETENESS_CRITERIA.every(field => item[field]);
            if (isComplete) completedCount++;
            else incompleteData.push({ ...item, type: 'RW' }); // Type RW
        });
        
        const completenessPercentage = Math.round((completedCount / combinedData.length) * 100);

        const educationCounts = PENDIDIKAN_LIST.reduce((acc, level) => ({ ...acc, [level]: 0 }), {});
        const genderCounts = { 'Laki-Laki': 0, 'Perempuan': 0, 'Tidak Disebutkan': 0 };

        combinedData.forEach(item => {
            if (item.pendidikan && educationCounts.hasOwnProperty(item.pendidikan)) {
                educationCounts[item.pendidikan]++;
            }
            const jk = item.jenis_kelamin ? item.jenis_kelamin.toLowerCase() : '';
            if (jk.includes('laki') || jk === 'l') {
                genderCounts['Laki-Laki']++;
            } else if (jk.includes('perempuan') || jk === 'p') {
                genderCounts['Perempuan']++;
            } else {
                genderCounts['Tidak Disebutkan']++;
            }
        });

        const educationData = Object.entries(educationCounts)
            .map(([name, value]) => ({ name, value }))
            .filter(e => e.value > 0);
            
        const genderData = Object.entries(genderCounts)
            .map(([name, value]) => ({ name, value }))
            .filter(g => g.value > 0);

        return {
            totalRt: rtData.length,
            totalRw: rwData.length,
            completenessPercentage,
            incompleteData,
            educationData,
            genderData
        };
    }, [rtData, rwData]);
    
    // Fungsi Navigasi Langsung
    const handleNavigateToEdit = (type, id) => {
        // Pastikan path target benar (rt atau rw)
        const targetPath = type.toLowerCase() === 'rt' ? 'rt' : 'rw';
        // Navigasi dengan query param ?edit=ID agar modal langsung terbuka di halaman tujuan
        navigate(`/app/rt-rw/${targetPath}?edit=${id}`);
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard RT & RW</h1>
            
            {/* Kartu Statistik Utama */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<FiUsers />} title="Total Pengurus RT" value={stats.totalRt} color="bg-blue-500" />
                <StatCard icon={<FiUsers />} title="Total Pengurus RW" value={stats.totalRw} color="bg-green-500" />
                <StatCard icon={<FiCheckCircle />} title="Kelengkapan Data" value={`${stats.completenessPercentage}%`} color="bg-purple-500" />
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col justify-center items-center text-center border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-3">Akses Data</h3>
                    <div className="flex gap-2 w-full">
                        <button onClick={() => navigate('/app/rt-rw/rt')} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors shadow-sm">
                            Data RT
                        </button>
                        <button onClick={() => navigate('/app/rt-rw/rw')} className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors shadow-sm">
                            Data RW
                        </button>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-800 dark:text-white">
                        <FiPieChart className="mr-2"/> Demografi Pendidikan
                    </h3>
                    <div className="h-[300px] w-full">
                        {stats.educationData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={stats.educationData} 
                                        dataKey="value" 
                                        nameKey="name" 
                                        cx="50%" 
                                        cy="50%" 
                                        outerRadius={80} 
                                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {stats.educationData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">Belum ada data pendidikan</div>
                        )}
                    </div>
                </div>

                 <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-4 flex items-center text-gray-800 dark:text-white">
                        <FiPieChart className="mr-2"/> Komposisi Jenis Kelamin
                    </h3>
                     <div className="h-[300px] w-full">
                        {stats.genderData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={stats.genderData} 
                                        dataKey="value" 
                                        nameKey="name" 
                                        cx="50%" 
                                        cy="50%" 
                                        outerRadius={80} 
                                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                       {stats.genderData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#0088FE', '#FF8042', '#999999'][index % 3]} />
                                       ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">Belum ada data jenis kelamin</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabel Data Tidak Lengkap */}
            {stats.incompleteData.length > 0 && (
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-red-500 flex items-center">
                            <FiAlertCircle className="mr-2"/> Data Perlu Dilengkapi ({stats.incompleteData.length})
                        </h3>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Nama</th>
                                    <th className="px-4 py-3">Jabatan</th>
                                    {currentUser.role !== 'admin_desa' && <th className="px-4 py-3">Desa</th>}
                                    <th className="px-4 py-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.incompleteData.map(item => (
                                    <tr key={item.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.nama}</td>
                                        <td className="px-4 py-3">
                                            {item.type === 'RT' ? `Ketua RT ${item.no_rt}` : `Ketua RW ${item.no_rw}`}
                                        </td>
                                        {currentUser.role !== 'admin_desa' && <td className="px-4 py-3">{item.desa}</td>}
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Mencegah event bubbling
                                                    handleNavigateToEdit(item.type, item.id);
                                                }}
                                                className="btn btn-xs btn-outline btn-primary"
                                                title="Lengkapi Data"
                                            >
                                                Update Data
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RtRwDashboard;