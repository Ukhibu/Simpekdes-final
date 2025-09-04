import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import { FiFile, FiFolder, FiCheckSquare, FiFileText, FiArrowRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

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


const EFileDashboard = () => {
    const { currentUser } = useAuth();
    const [skDocs, setSkDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        };

        let q;
        const collectionRef = collection(db, "efile"); 
        
        if (currentUser.role === 'admin_kecamatan') {
            q = query(collectionRef);
        } else if (currentUser.role === 'admin_desa' && currentUser.desa) {
            q = query(collectionRef, where("desa", "==", currentUser.desa));
        } else {
            setLoading(false);
            setError("Tidak dapat memuat data karena peran atau data desa tidak valid.");
            return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSkDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
            setError('');
        }, (err) => {
            console.error("Firebase Snapshot Error:", err);
            setError("Gagal memuat data. Periksa koneksi atau hak akses Anda.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const stats = useMemo(() => {
        const totalDokumen = skDocs.length;
        // --- FIX: Mengganti placeholder dengan kalkulasi dinamis ---
        const dokumenTerverifikasi = skDocs.filter(doc => doc.status === 'terverifikasi').length;
        
        const folderDigunakan = currentUser.role === 'admin_kecamatan' 
            ? new Set(skDocs.map(doc => doc.desa)).size
            : (totalDokumen > 0 ? 1 : 0);

        return { totalDokumen, dokumenTerverifikasi, folderDigunakan };
    }, [skDocs, currentUser.role]);
    
    const handleNavigateToManage = () => {
        navigate('/app/efile/manage');
    };

    if (loading) return <Spinner />;

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard E-File</h1>
            
            {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>}

            {/* Kartu Statistik */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    icon={<FiFile className="w-6 h-6 text-white" />}
                    title="Total Dokumen SK"
                    value={stats.totalDokumen}
                    colorClass="bg-blue-500"
                />
                <StatCard 
                    icon={<FiCheckSquare className="w-6 h-6 text-white" />}
                    title="Dokumen Terverifikasi"
                    value={stats.dokumenTerverifikasi}
                    colorClass="bg-green-500"
                />
                 {currentUser.role === 'admin_kecamatan' && (
                    <StatCard 
                        icon={<FiFolder className="w-6 h-6 text-white" />}
                        title="Desa dengan Dokumen"
                        value={stats.folderDigunakan}
                        colorClass="bg-yellow-500"
                    />
                 )}
            </div>

            {/* Kartu Navigasi ke Manajemen SK */}
            <div 
              onClick={handleNavigateToManage}
              className="group bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-all duration-300 cursor-pointer"
            >
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-800/50 rounded-full">
                            <FiFileText className="w-7 h-7 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Manajemen SK</h2>
                            <p className="text-gray-600 dark:text-gray-300">
                                Lihat, unggah, dan kelola semua dokumen Surat Keputusan.
                            </p>
                        </div>
                    </div>
                    <FiArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                </div>
            </div>

        </div>
    );
};

export default EFileDashboard;

