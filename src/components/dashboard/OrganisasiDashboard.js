import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFirestoreCollection } from '../../hooks/useFirestoreCollection';
import { useNavigate } from 'react-router-dom';
import Spinner from '../common/Spinner';
import { FiUsers, FiCheckCircle, FiAlertCircle, FiEdit } from 'react-icons/fi';
import InputField from '../common/InputField';
import { DESA_LIST } from '../../utils/constants';
import StrukturOrganisasiChart from './StrukturOrganisasiChart';

const StatCard = ({ icon, title, value, colorClass }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center space-x-4 transition-transform hover:scale-105 duration-300">
        <div className={`p-3 rounded-full text-white ${colorClass}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        </div>
    </div>
);

const OrganisasiDashboard = ({ config }) => {
    const { currentUser } = useAuth();
    const { data: allData, loading } = useFirestoreCollection(config.collectionName);
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
    const navigate = useNavigate();

    const { stats, incompleteList, dataForChart } = useMemo(() => {
        const dataForCurrentView = filterDesa === 'all'
            ? allData
            : allData.filter(item => item.desa === filterDesa);

        const isDataLengkap = (item) => {
            if (!config.completenessCriteria || config.completenessCriteria.length === 0) {
                return true;
            }
            return config.completenessCriteria.every(field => item[field] && String(item[field]).trim() !== '');
        };

        const totalAnggota = dataForCurrentView.length;
        const lengkap = dataForCurrentView.filter(isDataLengkap).length;
        const belumLengkap = totalAnggota - lengkap;
        const listBelumLengkap = dataForCurrentView.filter(item => !isDataLengkap(item));
        
        return {
            stats: { totalAnggota, lengkap, belumLengkap },
            incompleteList: listBelumLengkap,
            dataForChart: dataForCurrentView // Gunakan data yang sama untuk bagan
        };

    }, [allData, filterDesa, config]);

    if (loading) return <Spinner size="lg" />;

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{config.title} Dashboard</h1>
            
            {currentUser.role === 'admin_kecamatan' && (
                 <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                     <InputField label="Filter Desa" type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)}>
                         <option value="all">Tampilkan Ringkasan Kecamatan</option>
                         {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                     </InputField>
                 </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    icon={<FiUsers className="w-6 h-6" />}
                    title="Total Anggota"
                    value={stats.totalAnggota}
                    colorClass="bg-blue-500"
                />
                 <StatCard 
                    icon={<FiCheckCircle className="w-6 h-6" />}
                    title="Data Lengkap"
                    value={stats.lengkap}
                    colorClass="bg-green-500"
                />
                 <StatCard 
                    icon={<FiAlertCircle className="w-6 h-6" />}
                    title="Belum Lengkap"
                    value={stats.belumLengkap}
                    colorClass="bg-red-500"
                />
            </div>

            <div className="grid grid-cols-1 gap-8">
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Struktur Organisasi {filterDesa !== 'all' ? `Desa ${filterDesa}` : ''}</h2>
                    {currentUser.role === 'admin_desa' || (currentUser.role === 'admin_kecamatan' && filterDesa !== 'all') ? (
                        <StrukturOrganisasiChart data={dataForChart} hierarchy={config.hierarchy} />
                    ) : (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-10">Pilih salah satu desa untuk melihat struktur organisasinya.</p>
                    )}
                 </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                    <FiAlertCircle className="text-yellow-500" />
                    Anggota dengan Data Belum Lengkap {filterDesa !== 'all' ? `di Desa ${filterDesa}` : ''}
                </h2>
                {incompleteList.length > 0 ? (
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                           <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Nama</th>
                                    <th className="px-6 py-3">Jabatan</th>
                                    {filterDesa === 'all' && <th className="px-6 py-3">Desa</th>}
                                    <th className="px-6 py-3">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incompleteList.map((item) => (
                                    <tr key={item.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.nama}</td>
                                        <td className="px-6 py-4">{item.jabatan}</td>
                                        {filterDesa === 'all' && <td className="px-6 py-4">{item.desa}</td>}
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => navigate(`/app/${config.collectionName}/data?edit=${item.id}`)} 
                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                                <FiEdit size={14}/> Lengkapi Data
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center py-4 text-gray-500 dark:text-gray-400">Semua data anggota sudah lengkap. Kerja bagus!</p>
                )}
            </div>
        </div>
    );
};

export default OrganisasiDashboard;

