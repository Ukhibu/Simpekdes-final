import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { deleteFileFromGithub } from '../utils/githubService';

import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { 
  FiFileText, 
  FiSearch, 
  FiFilter, 
  FiEye, 
  FiDownload, 
  FiTrash2, 
  FiCheckSquare,
  FiUser,
  FiInbox
} from 'react-icons/fi';
import { DESA_LIST } from '../utils/constants';
import { createNotificationForDesaAdmins } from '../utils/notificationService';

// Konfigurasi untuk setiap tipe SK
const SK_CONFIG = {
    perangkat: { label: "Perangkat Desa", collectionName: "perangkat", color: "blue" },
    bpd: { label: "BPD", collectionName: "bpd", color: "purple" },
    lpm: { label: "LPM", collectionName: "lpm", color: "orange" },
    pkk: { label: "PKK", collectionName: "pkk", color: "pink" },
    karang_taruna: { label: "Karang Taruna", collectionName: "karang_taruna", color: "red" },
    rt_rw: { label: "RT/RW", collectionName: "rt_rw", color: "green" },
};

const DataSK = () => {
    const { skType } = useParams();
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [searchParams, setSearchParams] = useSearchParams();

    const [skDocs, setSkDocs] = useState([]);
    const [enrichedSkDocs, setEnrichedSkDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState(currentUser?.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [skDocToDelete, setSkDocToDelete] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [highlightedRow, setHighlightedRow] = useState(null);

    const config = useMemo(() => SK_CONFIG[skType] || { label: 'Tidak Dikenal', collectionName: null, color: 'gray' }, [skType]);

    useEffect(() => {
        const highlightId = searchParams.get('highlight');
        if (highlightId) {
            setHighlightedRow(highlightId);
            const timer = setTimeout(() => {
                setHighlightedRow(null);
                searchParams.delete('highlight');
                setSearchParams(searchParams, { replace: true });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, setSearchParams]);

    // Effect pertama: Memuat data dasar SK dari koleksi 'efile'
    useEffect(() => {
        if (!currentUser || !config.collectionName) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(collection(db, "efile"), where("skType", "==", skType));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSkDocs(docs);
        }, (error) => {
            console.error("Gagal memuat data SK:", error);
            showNotification('Gagal memuat data SK.', 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, skType, config.collectionName, showNotification]);

    // Effect kedua: "Memperkaya" data SK dengan mengambil jabatan & FOTO dari koleksi aslinya
    useEffect(() => {
        const enrichData = async () => {
            if (skDocs.length === 0) {
                setEnrichedSkDocs([]);
                setLoading(false);
                return;
            }

            const enrichedPromises = skDocs.map(async (sk) => {
                let additionalData = { jabatan: '-', foto_url: null };
                
                if (sk.entityId && config.collectionName) {
                    try {
                        const entityRef = doc(db, config.collectionName, sk.entityId);
                        const entitySnap = await getDoc(entityRef);
                        if (entitySnap.exists()) {
                            const data = entitySnap.data();
                            additionalData.jabatan = data.jabatan || 'Tidak ada jabatan';
                            
                            // Khusus Perangkat Desa (atau koleksi lain jika punya field foto_url), ambil fotonya
                            if (data.foto_url) {
                                additionalData.foto_url = data.foto_url;
                            }
                        } else {
                            additionalData.jabatan = 'Data asli tidak ditemukan';
                        }
                    } catch (e) {
                        console.error("Gagal mengambil data entitas:", e);
                        additionalData.jabatan = 'Gagal memuat info';
                    }
                }
                return { ...sk, ...additionalData };
            });

            const resolvedData = await Promise.all(enrichedPromises);
            setEnrichedSkDocs(resolvedData);
            setLoading(false);
        };

        enrichData();
    }, [skDocs, config.collectionName]);

    const filteredSkDocuments = useMemo(() => {
        let data = enrichedSkDocs;
        if (currentUser.role === 'admin_kecamatan' && filterDesa !== 'all') {
            data = data.filter(doc => doc.desa === filterDesa);
        } else if (currentUser.role === 'admin_desa') {
            data = data.filter(doc => doc.desa === currentUser.desa);
        }

        const search = searchTerm.toLowerCase();
        if (search) {
            data = data.filter(doc =>
                (doc.entityName || '').toLowerCase().includes(search) ||
                (doc.fileName || '').toLowerCase().includes(search) ||
                (doc.jabatan || '').toLowerCase().includes(search)
            );
        }
        return data;
    }, [enrichedSkDocs, searchTerm, filterDesa, currentUser.role, currentUser.desa]);
    
    const openPdfPreview = (url) => {
        if (!url) {
            showNotification('URL file tidak valid.', 'error');
            return;
        }
        showNotification('Mempersiapkan pratinjau dokumen...', 'info', 2000);
        const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
        setPreviewUrl(viewerUrl);
        setIsModalOpen(true);
    };
    
    const handleDownload = async (fileUrl, fileName) => {
        showNotification(`Mengunduh "${fileName}"...`, 'info', 3000);
        try {
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error('Gagal mengambil file dari server.');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            showNotification(`"${fileName}" berhasil diunduh.`, 'success');
        } catch (error) {
            console.error('Error downloading file:', error);
            showNotification(`Gagal mengunduh file: ${error.message}`, 'error');
        }
    };

    const confirmDelete = (skDoc) => {
        setSkDocToDelete(skDoc);
        setIsDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!skDocToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteFileFromGithub(skDocToDelete.githubPath, skDocToDelete.githubSha);
            const docRef = doc(db, 'efile', skDocToDelete.id);
            await deleteDoc(docRef);
            showNotification('Dokumen SK dan file terkait berhasil dihapus.', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus file: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setSkDocToDelete(null);
        }
    };
    
    const handleVerify = async (skDoc) => {
        const docRef = doc(db, 'efile', skDoc.id);
        try {
            await updateDoc(docRef, { status: 'terverifikasi' });
            showNotification('Dokumen berhasil diverifikasi.', 'success');
            const message = `SK untuk "${skDoc.entityName}" telah diverifikasi oleh Admin Kecamatan.`;
            const link = `/app/data-sk/${skType}`;
            await createNotificationForDesaAdmins(skDoc.desa, message, link);
        } catch (error) {
            showNotification('Gagal memverifikasi dokumen.', 'error');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                        <span className={`p-2 rounded-lg bg-${config.color}-100 text-${config.color}-600 dark:bg-${config.color}-900/30 dark:text-${config.color}-400 mr-3`}>
                            <FiFileText className="w-6 h-6" />
                        </span>
                        Data SK {config.label}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ml-12">
                        Kelola arsip Surat Keputusan untuk {config.label}
                    </p>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className={`col-span-1 ${currentUser.role === 'admin_kecamatan' ? 'md:col-span-8' : 'md:col-span-12'}`}>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiSearch className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Cari nama, jabatan, atau file..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm dark:text-white dark:placeholder-gray-500"
                        />
                    </div>
                </div>

                {currentUser.role === 'admin_kecamatan' && (
                    <div className="col-span-1 md:col-span-4">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FiFilter className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <select 
                                value={filterDesa} 
                                onChange={(e) => setFilterDesa(e.target.value)} 
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm dark:text-white cursor-pointer"
                            >
                                <option value="all">Semua Desa</option>
                                {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center items-center">
                        <Spinner />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400 border-b dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Personel / Lembaga</th>
                                    <th className="px-6 py-4 font-semibold">Jabatan</th>
                                    {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-4 font-semibold">Desa</th>}
                                    <th className="px-6 py-4 font-semibold">File SK</th>
                                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                                    <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredSkDocuments.length > 0 ? filteredSkDocuments.map((sk) => (
                                    <tr 
                                        key={sk.id} 
                                        className={`group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200 ${highlightedRow === sk.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                {/* Logic Foto Profil Diperbarui */}
                                                <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                                                    <img 
                                                        src={sk.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sk.entityName || '?')}&background=random&color=fff`} 
                                                        alt={sk.entityName} 
                                                        className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                                        onError={(e) => {
                                                            e.target.onerror = null; 
                                                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sk.entityName || '?')}&background=random&color=fff`;
                                                        }}
                                                    />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                        {sk.entityName}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-0.5">
                                                        <FiUser className="mr-1 w-3 h-3" />
                                                        {config.label}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                            {sk.jabatan}
                                        </td>
                                        {currentUser.role === 'admin_kecamatan' && (
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                    {sk.desa}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center text-gray-600 dark:text-gray-300 max-w-xs truncate" title={sk.fileName}>
                                                <FiFileText className="mr-2 text-gray-400 flex-shrink-0" />
                                                <span className="truncate">{sk.fileName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                                                sk.status === 'terverifikasi' 
                                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' 
                                                : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                                                    sk.status === 'terverifikasi' ? 'bg-green-500' : 'bg-yellow-500'
                                                }`}></span>
                                                {sk.status === 'terverifikasi' ? 'Terverifikasi' : 'Menunggu'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button 
                                                    onClick={() => openPdfPreview(sk.fileUrl)} 
                                                    className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
                                                    title="Pratinjau"
                                                >
                                                    <FiEye className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDownload(sk.fileUrl, sk.fileName)} 
                                                    className="p-2 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition-colors"
                                                    title="Unduh"
                                                >
                                                    <FiDownload className="w-4 h-4" />
                                                </button>
                                                
                                                {currentUser.role === 'admin_kecamatan' && sk.status !== 'terverifikasi' && (
                                                    <button 
                                                        onClick={() => handleVerify(sk)} 
                                                        className="p-2 text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50 transition-colors"
                                                        title="Verifikasi"
                                                    >
                                                        <FiCheckSquare className="w-4 h-4" />
                                                    </button>
                                                )}
                                                
                                                <button 
                                                    onClick={() => confirmDelete(sk)} 
                                                    className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                                                    title="Hapus"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={currentUser.role === 'admin_kecamatan' ? 6 : 5} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                                                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-full mb-3">
                                                    <FiInbox className="w-8 h-8" />
                                                </div>
                                                <p className="text-base font-medium text-gray-900 dark:text-gray-300">Tidak ada data ditemukan</p>
                                                <p className="text-sm mt-1">Coba sesuaikan filter pencarian Anda atau tambahkan data baru.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Pratinjau Dokumen SK" size="5xl">
                <div className="w-full h-[80vh] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                    {previewUrl ? (
                        <iframe src={previewUrl} width="100%" height="100%" title="Pratinjau PDF" frameBorder="0" className="w-full h-full"></iframe>
                    ) : (
                        <div className="flex items-center justify-center h-full"><Spinner /></div>
                    )}
                </div>
            </Modal>

            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen} 
                onClose={() => setIsDeleteConfirmOpen(false)} 
                onConfirm={executeDelete} 
                isLoading={isSubmitting}
                title="Konfirmasi Hapus" 
                message={`Apakah Anda yakin ingin menghapus SK untuk "${skDocToDelete?.entityName}"? Tindakan ini akan menghapus file dari server secara permanen dan tidak dapat dibatalkan.`}
            />
        </div>
    );
};

export default DataSK;