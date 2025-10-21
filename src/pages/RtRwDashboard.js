import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/dashboard/StatCard';
import Spinner from '../components/common/Spinner';
import { FiUsers, FiCheckCircle, FiArrowRight, FiPieChart } from 'react-icons/fi';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PENDIDIKAN_LIST, DESA_LIST } from '../utils/constants';

// Kriteria kelengkapan data disalin di sini agar komponen tetap mandiri
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
            
            const rts = allData.filter(item => item.no_rt && !item.no_rw);
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

        rtData.forEach(item => {
            const isComplete = RT_COMPLETENESS_CRITERIA.every(field => item[field]);
            if (isComplete) completedCount++;
            else incompleteData.push({ ...item, type: 'RT' });
        });

        rwData.forEach(item => {
            const isComplete = RW_COMPLETENESS_CRITERIA.every(field => item[field]);
            if (isComplete) completedCount++;
            else incompleteData.push({ ...item, type: 'RW' });
        });
        
        const completenessPercentage = Math.round((completedCount / combinedData.length) * 100);

        const educationCounts = PENDIDIKAN_LIST.reduce((acc, level) => ({ ...acc, [level]: 0 }), {});
        const genderCounts = { 'Laki-Laki': 0, 'Perempuan': 0, 'Tidak Disebutkan': 0 };

        combinedData.forEach(item => {
            if (item.pendidikan && educationCounts.hasOwnProperty(item.pendidikan)) {
                educationCounts[item.pendidikan]++;
            }
            if (item.jenis_kelamin && genderCounts.hasOwnProperty(item.jenis_kelamin)) {
                genderCounts[item.jenis_kelamin]++;
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
    
    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard RT & RW</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<FiUsers />} title="Total Ketua RT" value={stats.totalRt} />
                <StatCard icon={<FiUsers />} title="Total Ketua RW" value={stats.totalRw} />
                <StatCard icon={<FiCheckCircle />} title="Kelengkapan Data" value={`${stats.completenessPercentage}%`} />
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col justify-center items-center text-center">
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">Akses Cepat</h3>
                    <div className="flex gap-2">
                        <button onClick={() => navigate('/app/rt-rw/rt')} className="btn btn-sm btn-primary">Data RT</button>
                        <button onClick={() => navigate('/app/rt-rw/rw')} className="btn btn-sm btn-secondary">Data RW</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                    <h3 className="font-bold text-lg mb-4 flex items-center"><FiPieChart className="mr-2"/> Demografi Pendidikan</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={stats.educationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                {stats.educationData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                    <h3 className="font-bold text-lg mb-4 flex items-center"><FiPieChart className="mr-2"/> Komposisi Jenis Kelamin</h3>
                     <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={stats.genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                               {stats.genderData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28'][index]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {stats.incompleteData.length > 0 && (
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                    <h3 className="font-bold text-lg mb-4">Data Perorangan Belum Lengkap</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                                <tr>
                                    <th className="px-4 py-3">Nama</th>
                                    <th className="px-4 py-3">Jabatan</th>
                                    {currentUser.role !== 'admin_desa' && <th className="px-4 py-3">Desa</th>}
                                    <th className="px-4 py-3">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.incompleteData.map(item => (
                                    <tr key={item.id} className="border-b dark:border-gray-700">
                                        <td className="px-4 py-3 font-medium">{item.nama}</td>
                                        <td className="px-4 py-3">{item.type === 'RT' ? `Ketua RT ${item.no_rt}` : `Ketua RW ${item.no_rw}`}</td>
                                         {currentUser.role !== 'admin_desa' && <td className="px-4 py-3">{item.desa}</td>}
                                        <td className="px-4 py-3">
                                            <button 
                                                onClick={() => navigate(`/app/rt-rw/${item.type.toLowerCase()}?edit=${item.id}`)}
                                                className="btn btn-xs btn-outline btn-primary">
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

