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
import { FiFileText, FiSearch, FiFilter, FiEye, FiDownload, FiTrash2, FiCheckSquare } from 'react-icons/fi';
import { DESA_LIST } from '../utils/constants';
import { createNotificationForDesaAdmins } from '../utils/notificationService';

// Konfigurasi untuk setiap tipe SK
const SK_CONFIG = {
    perangkat: { label: "Perangkat Desa", collectionName: "perangkat" },
    bpd: { label: "BPD", collectionName: "bpd" },
    lpm: { label: "LPM", collectionName: "lpm" },
    pkk: { label: "PKK", collectionName: "pkk" },
    karang_taruna: { label: "Karang Taruna", collectionName: "karang_taruna" },
    rt_rw: { label: "RT/RW", collectionName: "rt_rw" },
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

    const config = useMemo(() => SK_CONFIG[skType] || { label: 'Tidak Dikenal', collectionName: null }, [skType]);

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

    // Effect kedua: "Memperkaya" data SK dengan mengambil jabatan dari koleksi aslinya
    useEffect(() => {
        const enrichData = async () => {
            if (skDocs.length === 0) {
                setEnrichedSkDocs([]);
                setLoading(false);
                return;
            }

            const enrichedPromises = skDocs.map(async (sk) => {
                let jabatan = '-';
                if (sk.entityId && config.collectionName) {
                    try {
                        const entityRef = doc(db, config.collectionName, sk.entityId);
                        const entitySnap = await getDoc(entityRef);
                        if (entitySnap.exists()) {
                            jabatan = entitySnap.data().jabatan || 'Tidak ada jabatan';
                        } else {
                            jabatan = 'Data asli tidak ditemukan';
                        }
                    } catch (e) {
                        console.error("Gagal mengambil data entitas:", e);
                        jabatan = 'Gagal memuat jabatan';
                    }
                }
                return { ...sk, jabatan };
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
    }, [enrichedSkDocs, searchTerm, filterDesa, currentUser.role]);
    
    // [DIUBAH] Menambahkan notifikasi saat pratinjau dibuka
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
    
    // [DIUBAH] Menambahkan notifikasi untuk proses unduh
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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                <FiFileText className="inline-block mr-3 text-blue-500" />
                Data SK {config.label}
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div className="relative lg:col-span-2">
                   <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                   <input 
                       type="text" 
                       placeholder="Cari berdasarkan nama, jabatan, atau nama file..." 
                       value={searchTerm} 
                       onChange={(e) => setSearchTerm(e.target.value)} 
                       className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                   />
                </div>
                {currentUser.role === 'admin_kecamatan' && (
                    <div className="relative">
                         <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                         <select value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg appearance-none bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                             <option value="all">Semua Desa</option>
                             {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                         </select>
                    </div>
                )}
           </div>

            {loading ? <Spinner /> : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3">Nama Personel/Lembaga</th>
                                <th className="px-6 py-3">Jabatan</th>
                                {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                                <th className="px-6 py-3">Nama File</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSkDocuments.length > 0 ? filteredSkDocuments.map((sk) => (
                                <tr key={sk.id} className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${highlightedRow === sk.id ? 'highlight-row' : ''}`}>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{sk.entityName}</td>
                                    <td className="px-6 py-4">{sk.jabatan}</td>
                                    {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{sk.desa}</td>}
                                    <td className="px-6 py-4">{sk.fileName}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${sk.status === 'terverifikasi' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                                            {sk.status === 'terverifikasi' ? 'Terverifikasi' : 'Menunggu'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 flex items-center space-x-4">
                                        <button onClick={() => openPdfPreview(sk.fileUrl)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Lihat/Pratinjau"><FiEye /></button>
                                        <button onClick={() => handleDownload(sk.fileUrl, sk.fileName)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" title="Unduh"><FiDownload /></button>
                                        {currentUser.role === 'admin_kecamatan' && sk.status !== 'terverifikasi' && (
                                            <button onClick={() => handleVerify(sk)} className="text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300" title="Verifikasi"><FiCheckSquare /></button>
                                        )}
                                        <button onClick={() => confirmDelete(sk)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Hapus"><FiTrash2 /></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={currentUser.role === 'admin_kecamatan' ? 6 : 5} className="text-center py-10 text-gray-500">Tidak ada data SK yang ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Pratinjau Dokumen SK" size="5xl">
                <div className="w-full h-[80vh]">
                    {previewUrl ? (
                        <iframe src={previewUrl} width="100%" height="100%" title="Pratinjau PDF" frameBorder="0"></iframe>
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
                message={`Apakah Anda yakin ingin menghapus SK untuk "${skDocToDelete?.entityName}"? Tindakan ini akan menghapus file dari server secara permanen.`}
            />
        </div>
    );
};

export default DataSK;
