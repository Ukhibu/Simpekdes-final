import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, writeBatch, getDoc, getDocs } from 'firebase/firestore';
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
import { RT_RW_CONFIG, DESA_LIST } from '../utils/constants'; // PERBAIKAN DI SINI
import { generateRtRwXLSX } from '../utils/generateRtRwXLSX';
import { createNotificationForAdmins } from '../utils/notificationService';
import * as XLSX from 'xlsx';

// Ikon
import { FiEdit, FiSearch, FiUpload, FiDownload, FiPlus, FiEye, FiTrash2 } from 'react-icons/fi';

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
    const [isUploading, setIsUploading] = useState(false);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);
    const [searchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);

    useEffect(() => {
        const q = query(collection(db, RT_RW_CONFIG.collectionName)); // PERBAIKAN DI SINI
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDataList(list);
            setLoading(false);
        }, (error) => {
            console.error(`Error fetching ${RT_RW_CONFIG.collectionName}:`, error); // PERBAIKAN DI SINI
            showNotification(`Gagal memuat data: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [showNotification]);

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
                console.error("Error fetching extra data for export:", error);
            } finally {
                setLoadingExtras(false);
            }
        };
        fetchExtraData();
    }, []);

    useEffect(() => {
        const editId = searchParams.get('edit');
        const highlightId = searchParams.get('highlight') || editId;
        if (highlightId && dataList.length > 0) {
            const item = dataList.find(d => d.id === highlightId);
            if (item) {
                if (currentUser.role === 'admin_kecamatan') {
                    setCurrentDesa(item.desa);
                }
                setHighlightedRow(highlightId);
                const timer = setTimeout(() => setHighlightedRow(null), 3000);
                if (editId) handleOpenModal('edit', item);
                return () => clearTimeout(timer);
            }
        }
    }, [searchParams, dataList, currentUser.role]);

    const filteredData = useMemo(() => {
        let data = dataList;
        if (currentUser.role === 'admin_kecamatan') {
            data = data.filter(item => item.desa === currentDesa);
        } else {
            data = data.filter(item => item.desa === currentUser.desa);
        }
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(item => (item.nama || '').toLowerCase().includes(searchLower) || (item.jabatan || '').toLowerCase().includes(searchLower) || (item.dusun || '').toLowerCase().includes(searchLower));
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
            const dataToSave = { ...formData };
            if (dataToSave.jabatan === 'Ketua RW') {
                dataToSave.no_rt = ''; // Kosongkan no_rt jika jabatannya Ketua RW
            }

            if (selectedItem) {
                await updateDoc(doc(db, RT_RW_CONFIG.collectionName, selectedItem.id), dataToSave); // PERBAIKAN DI SINI
                showNotification('Data RT/RW berhasil diperbarui.', 'success');
            } else {
                const newDocRef = await addDoc(collection(db, RT_RW_CONFIG.collectionName), dataToSave); // PERBAIKAN DI SINI
                showNotification('Data RT/RW berhasil ditambahkan.', 'success');
                 if (currentUser.role === 'admin_desa') {
                    const message = `Admin Desa ${currentUser.desa} telah menambahkan data RT/RW baru: "${dataToSave.nama}".`;
                    const link = `/app/rtrw/data?desa=${currentUser.desa}&highlight=${newDocRef.id}`;
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
            await deleteDoc(doc(db, RT_RW_CONFIG.collectionName, itemToDelete.id)); // PERBAIKAN DI SINI
            showNotification('Data berhasil dihapus.', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 2 });

                if (jsonData.length === 0) throw new Error("File Excel tidak berisi data.");

                const batch = writeBatch(db);
                let newEntriesCount = 0;
                let skippedCount = 0;

                jsonData.forEach(row => {
                    const newDoc = {};
                    
                    newDoc.desa = row['Desa'] ? String(row['Desa']).trim() : null;
                    if (!newDoc.desa) {
                        skippedCount++;
                        return;
                    }

                    if (currentUser.role === 'admin_desa' && newDoc.desa.toUpperCase() !== currentUser.desa.toUpperCase()) {
                        skippedCount++;
                        return;
                    }

                    newDoc.nama = row['NAMA'] ? String(row['NAMA']).trim() : null;
                    newDoc.jabatan = row['Jabatan'] ? String(row['Jabatan']).trim() : 'Ketua RT';
                    newDoc.periode = row['Priode Jabatan'] ? String(row['Priode Jabatan']).trim() : null;
                    newDoc.dusun = row['Dusun'] ? String(row['Dusun']).trim() : null;
                    newDoc.dukuh = row['Dukuh'] ? String(row['Dukuh']).trim() : null;
                    newDoc.no_hp = row['No Wa/Hp'] ? String(row['No Wa/Hp']).trim() : null;
                    newDoc.nik = row['NIK'] ? String(row['NIK']).trim() : null;

                    const noRtRw = row['No RT/RW'] ? String(row['No RT/RW']).trim() : '';
                    if (newDoc.jabatan.toUpperCase().includes('RT')) {
                        newDoc.jabatan = 'Ketua RT';
                        newDoc.no_rt = noRtRw;
                        newDoc.no_rw = null;
                    } else if (newDoc.jabatan.toUpperCase().includes('RW')) {
                        newDoc.jabatan = 'Ketua RW';
                        newDoc.no_rw = noRtRw;
                        newDoc.no_rt = null;
                    } else {
                         skippedCount++;
                         return;
                    }

                    if (newDoc.nama && newDoc.desa) {
                        const newDocRef = doc(collection(db, RT_RW_CONFIG.collectionName)); // PERBAIKAN DI SINI
                        batch.set(newDocRef, newDoc);
                        newEntriesCount++;
                    } else {
                        skippedCount++;
                    }
                });

                if (newEntriesCount > 0) {
                    await batch.commit();
                    showNotification(`${newEntriesCount} data baru berhasil diimpor. ${skippedCount > 0 ? `${skippedCount} baris dilewati.` : ''}`, 'success');
                } else {
                    showNotification(`Tidak ada data baru yang valid untuk diimpor. ${skippedCount > 0 ? `${skippedCount} baris dilewati.` : ''}`, 'info');
                }
            } catch (error) {
                console.error("Error processing file:", error);
                showNotification(`Gagal memproses file: ${error.message}`, 'error');
            } finally {
                setIsUploading(false);
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExportXLSX = () => {
        if (loadingExtras) {
            showNotification("Data pendukung masih dimuat, coba lagi sebentar.", "info");
            return;
        }
         const dataForExport = currentUser.role === 'admin_kecamatan' ? dataList : filteredData;
         const exportDetails = {
            dataToExport: dataForExport,
            role: currentUser.role,
            desa: currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa,
            exportConfig,
            allPerangkat,
        };
        generateRtRwXLSX(exportDetails);
    };

    if (loading || loadingExtras) return <SkeletonLoader columns={6} />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h1 className="text-xl font-bold mb-4">Manajemen Pengurus RT / RW</h1>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <InputField type="text" placeholder="Cari nama atau dusun..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                <div className="flex gap-2">
                    <label className="btn btn-warning cursor-pointer">
                        <FiUpload className="mr-2"/>
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={isUploading}/>
                        {isUploading ? 'Mengimpor...' : 'Impor Data'}
                    </label>
                    <Button onClick={handleExportXLSX} variant="success"><FiDownload className="mr-2"/> Ekspor Rekap</Button>
                    <Button onClick={() => handleOpenModal('add')} variant="primary"><FiPlus className="mr-2"/> Tambah</Button>
                </div>
            </div>
            {currentUser.role === 'admin_kecamatan' && (
                <Pagination desaList={DESA_LIST} currentDesa={currentDesa} onPageChange={setCurrentDesa} />
            )}
            <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Nama</th>
                            <th className="px-6 py-3">Jabatan</th>
                            <th className="px-6 py-3">No RT</th>
                            <th className="px-6 py-3">No RW</th>
                            <th className="px-6 py-3">Dusun</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map(item => (
                            <tr key={item.id} className={`border-b dark:border-gray-700 ${highlightedRow === item.id ? 'highlight-row' : ''}`}>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.nama}</td>
                                <td className="px-6 py-4">{item.jabatan}</td>
                                <td className="px-6 py-4">{item.no_rt}</td>
                                <td className="px-6 py-4">{item.no_rw}</td>
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

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Detail Pengurus' : `${selectedItem ? 'Edit' : 'Tambah'} Pengurus RT/RW`}>
                {modalMode === 'view' ? <OrganisasiDetailView data={selectedItem} config={RT_RW_CONFIG} /> : ( // PERBAIKAN DI SINI
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Nama Lengkap" name="nama" value={formData.nama || ''} onChange={handleFormChange} required />
                            <InputField label="Jabatan" name="jabatan" type="select" value={formData.jabatan || ''} onChange={handleFormChange}>
                                <option value="Ketua RT">Ketua RT</option>
                                <option value="Ketua RW">Ketua RW</option>
                            </InputField>
                            {formData.jabatan === 'Ketua RT' && (
                                <InputField label="Nomor RT" name="no_rt" value={formData.no_rt || ''} onChange={handleFormChange} required />
                            )}
                            <InputField label="Nomor RW" name="no_rw" value={formData.no_rw || ''} onChange={handleFormChange} required />
                            <InputField label="Dusun" name="dusun" value={formData.dusun || ''} onChange={handleFormChange} />
                            <InputField label="Dukuh" name="dukuh" value={formData.dukuh || ''} onChange={handleFormChange} />
                            <InputField label="Periode Jabatan" name="periode" value={formData.periode || ''} onChange={handleFormChange} />
                            <InputField label="No. HP" name="no_hp" value={formData.no_hp || ''} onChange={handleFormChange} />
                             <InputField label="NIK" name="nik" value={formData.nik || ''} onChange={handleFormChange} />
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

