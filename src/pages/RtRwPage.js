import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, getDocs, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSearchParams } from 'react-router-dom';

// Komponen UI
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import SkeletonLoader from '../components/common/SkeletonLoader';
import InputField from '../components/common/InputField';
import OrganisasiDetailView from '../components/common/OrganisasiDetailView';
import Pagination from '../components/common/Pagination';

// Utilitas & Konfigurasi
import { RT_RW_CONFIG, DESA_LIST } from '../utils/constants';
import { generateRtRwXLSX } from '../utils/generateRtRwXLSX'; 
import { createNotificationForAdmins } from '../utils/notificationService';

// Ikon
import { FiEdit, FiSearch, FiDownload, FiPlus, FiEye, FiTrash2 } from 'react-icons/fi';

const RtRwPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);

    const [allPerangkat, setAllPerangkat] = useState([]);
    const [exportConfig, setExportConfig] = useState(null);
    const [loadingExtras, setLoadingExtras] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);
    const [searchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);

    useEffect(() => {
        const q = query(collection(db, RT_RW_CONFIG.collectionName));
        const unsubscribe = onSnapshot(q, snapshot => {
            setDataList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        const fetchExtraData = async () => {
            try {
                const exportRef = doc(db, 'settings', 'exportConfig');
                const exportSnap = await getDoc(exportRef);
                if (exportSnap.exists()) setExportConfig(exportSnap.data());

                const perangkatQuery = query(collection(db, 'perangkat'));
                const perangkatSnapshot = await getDocs(perangkatQuery);
                setAllPerangkat(perangkatSnapshot.docs.map(doc => doc.data()));
            } catch (error) {
                console.error("Error fetching extra data:", error);
            } finally {
                setLoadingExtras(false);
            }
        };
        fetchExtraData();
    }, []);

    useEffect(() => {
        const highlightId = searchParams.get('highlight');
        if (highlightId) {
            setHighlightedRow(highlightId);
            const timer = setTimeout(() => setHighlightedRow(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    const filteredData = useMemo(() => {
        let data = dataList;
        if (currentUser.role === 'admin_kecamatan') {
            data = data.filter(item => item.desa === currentDesa);
        } else {
             data = data.filter(item => item.desa === currentUser.desa);
        }
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(item => 
                (item.nama || '').toLowerCase().includes(searchLower) ||
                (item.nomor || '').toLowerCase().includes(searchLower) ||
                (item.dusun || '').toLowerCase().includes(searchLower)
            );
        }
        return data;
    }, [dataList, searchTerm, currentDesa, currentUser]);

    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
        setFormData(item ? { ...item } : { desa: initialDesa, jabatan: 'Ketua RT' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedItem(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (selectedItem) {
                await updateDoc(doc(db, RT_RW_CONFIG.collectionName, selectedItem.id), formData);
                showNotification('Data RT/RW berhasil diperbarui.', 'success');
            } else {
                const newDocRef = await addDoc(collection(db, RT_RW_CONFIG.collectionName), formData);
                showNotification('Data RT/RW berhasil ditambahkan.', 'success');
                 if (currentUser.role === 'admin_desa') {
                    const message = `Admin Desa ${currentUser.desa} telah menambahkan data RT/RW baru: "${formData.nama}".`;
                    const link = `/app/rt-rw/data?desa=${currentUser.desa}&highlight=${newDocRef.id}`;
                    await createNotificationForAdmins(message, link, currentUser);
                }
            }
            handleCloseModal();
        } catch (error) {
            showNotification(`Gagal menyimpan data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, RT_RW_CONFIG.collectionName, itemToDelete.id));
            showNotification('Data berhasil dihapus.', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };
    
    const handleExportXLSX = () => {
        if (filteredData.length === 0) {
            showNotification("Tidak ada data untuk diekspor.", "warning");
            return;
        }
        const exportDetails = { dataToExport: filteredData, role: currentUser.role, desa: currentDesa, exportConfig, allPerangkat };
        generateRtRwXLSX(exportDetails);
    };
    
    if (loading || loadingExtras) return <SkeletonLoader columns={5} />;
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h1 className="text-xl font-bold mb-4">Manajemen Pengurus RT/RW</h1>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <InputField type="text" placeholder="Cari nama, nomor, atau dusun..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                <div className="flex gap-2">
                    <Button onClick={handleExportXLSX} variant="success"><FiDownload className="mr-2"/> Ekspor</Button>
                    <Button onClick={() => handleOpenModal('add')} variant="primary"><FiPlus className="mr-2"/> Tambah</Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Nama Ketua</th>
                            <th className="px-6 py-3">Jabatan</th>
                            <th className="px-6 py-3">Nomor</th>
                            <th className="px-6 py-3">Dusun/Dukuh</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map(item => (
                            <tr key={item.id} className={`border-b dark:border-gray-700 ${highlightedRow === item.id ? 'highlight-row' : ''}`}>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.nama}</td>
                                <td className="px-6 py-4">{item.jabatan}</td>
                                <td className="px-6 py-4">{item.nomor}</td>
                                <td className="px-6 py-4">{item.dusun}</td>
                                <td className="px-6 py-4 flex space-x-3">
                                    <button onClick={() => handleOpenModal('view', item)}><FiEye /></button>
                                    <button onClick={() => handleOpenModal('edit', item)}><FiEdit /></button>
                                    <button onClick={() => { setItemToDelete(item); setIsDeleteConfirmOpen(true); }}><FiTrash2 /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {currentUser.role === 'admin_kecamatan' && (
                <Pagination desaList={DESA_LIST} currentDesa={currentDesa} onPageChange={setCurrentDesa} />
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Detail Pengurus RT/RW' : `${selectedItem ? 'Edit' : 'Tambah'} Pengurus RT/RW`}>
                {modalMode === 'view' ? <OrganisasiDetailView data={selectedItem} config={RT_RW_CONFIG} /> : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Nama Lengkap Ketua" name="nama" value={formData.nama || ''} onChange={handleFormChange} required />
                             <InputField label="Jabatan" name="jabatan" type="select" value={formData.jabatan || ''} onChange={handleFormChange} required>
                                 <option value="Ketua RT">Ketua RT</option>
                                 <option value="Ketua RW">Ketua RW</option>
                             </InputField>
                            <InputField label="Nomor RT/RW" name="nomor" value={formData.nomor || ''} onChange={handleFormChange} placeholder="Contoh: 001/003" required />
                            <InputField label="Dusun / Dukuh" name="dusun" value={formData.dusun || ''} onChange={handleFormChange} placeholder="Contoh: Krajan" />
                            <InputField label="Periode" name="periode" value={formData.periode || ''} onChange={handleFormChange} placeholder="Contoh: 2024-2029" />
                         </div>
                        <div className="flex justify-end pt-4">
                            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                            <Button type="submit" variant="primary" isLoading={isSubmitting} className="ml-2">Simpan</Button>
                        </div>
                    </form>
                )}
            </Modal>
            
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDelete} isLoading={isSubmitting} />
        </div>
    );
};

export default RtRwPage;

