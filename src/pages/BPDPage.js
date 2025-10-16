import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, writeBatch, getDoc, doc, getDocs, onSnapshot, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

// Komponen UI
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Pagination from '../components/common/Pagination';
import Button from '../components/common/Button';

// Hook & Utilitas
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useNotification } from '../context/NotificationContext';
import { generateBpdXLSX } from '../utils/generateBpdXLSX';
import { DESA_LIST } from '../utils/constants';
import { createNotificationForAdmins, createNotificationForDesaAdmins } from '../utils/notificationService';

// Ikon
import { FiEdit, FiTrash2, FiSearch, FiFilter, FiPlus, FiUpload, FiDownload, FiEye } from 'react-icons/fi';


// Daftar statis & Komponen Detail
const JABATAN_BPD_LIST = ["Ketua", "Wakil Ketua", "Sekretaris", "Anggota"];
const PENDIDIKAN_LIST = ["SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"];
const AGAMA_LIST = ["Islam", "Kristen", "Katolik", "Hindu", "Budha", "Konghucu"];
const JENIS_KELAMIN_LIST = ["Laki-laki", "Perempuan"];

const BpdDetailView = ({ bpd }) => {
    if (!bpd) return null;

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const DetailItem = ({ label, value }) => (
        <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{label}</p>
            <p className="text-gray-800 dark:text-gray-200">{value || '-'}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{bpd.nama}</h3>
                <p className="text-gray-600 dark:text-gray-300">{bpd.jabatan} - Desa {bpd.desa}</p>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-1">Periode {bpd.periode || 'N/A'}</p>
            </div>

            <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 mb-3">Informasi Keanggotaan</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailItem label="No. SK Bupati" value={bpd.no_sk_bupati} />
                    <DetailItem label="Tanggal SK Bupati" value={formatDate(bpd.tgl_sk_bupati)} />
                    <DetailItem label="Tanggal Pelantikan" value={formatDate(bpd.tgl_pelantikan)} />
                    <DetailItem label="Wilayah Pemilihan" value={bpd.wil_pmlhn} />
                </div>
            </div>

            <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 mb-3">Data Pribadi</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailItem label="Jenis Kelamin" value={bpd.jenis_kelamin} />
                    <DetailItem label="Tempat, Tanggal Lahir" value={`${bpd.tempat_lahir || ''}, ${formatDate(bpd.tgl_lahir)}`} />
                    <DetailItem label="Pendidikan Terakhir" value={bpd.pendidikan} />
                    <DetailItem label="Pekerjaan" value={bpd.pekerjaan} />
                    <DetailItem label="Agama" value={bpd.agama} />
                    <DetailItem label="No. HP / WA" value={bpd.no_hp} />
                </div>
            </div>
             <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 mb-3">Alamat</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <DetailItem label="Desa" value={bpd.desa} />
                     <DetailItem label="RT" value={bpd.rt} />
                     <DetailItem label="RW" value={bpd.rw} />
                </div>
            </div>
        </div>
    );
};


const BPDPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const { data: allBpd, loading, addItem, updateItem, deleteItem } = useFirestoreCollection('bpd');

    const [allPerangkat, setAllPerangkat] = useState([]);
    const [exportConfig, setExportConfig] = useState(null);
    const [loadingExtras, setLoadingExtras] = useState(true);

    const [modalMode, setModalMode] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBpd, setSelectedBpd] = useState(null);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [periodeFilter, setPeriodeFilter] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadConfig, setUploadConfig] = useState(null);
    
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [bpdToDelete, setBpdToDelete] = useState(null);
    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const navigate = useNavigate();
    const [highlightedRow, setHighlightedRow] = useState(null);
    const [selectedRows, setSelectedRows] = useState(new Set());

    // --- DEKLARASI FUNGSI ---
    const handleOpenModal = useCallback((bpd = null, mode = 'add') => {
        setModalMode(mode);
        setSelectedBpd(bpd);
        if (mode === 'add') {
            const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
            setFormData({ desa: initialDesa, rt: '', rw: '' });
        } else {
            setFormData(bpd);
        }
        setIsModalOpen(true);
    }, [currentUser, currentDesa]);

    const handleCloseModal = useCallback(() => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setModalMode(null);
        setSelectedBpd(null);
        setFormData({});
    }, [isSubmitting]);

    // --- EFEK SAMPING & LOGIKA ---
    useEffect(() => {
        if (currentUser && currentUser.role === 'admin_desa') {
            setCurrentDesa(currentUser.desa);
        }
    }, [currentUser]);

    useEffect(() => {
        const fetchExtraData = async () => {
            setLoadingExtras(true);
            try {
                const exportRef = doc(db, 'settings', 'exportConfig');
                const exportSnap = await getDoc(exportRef);
                if (exportSnap.exists()) {
                    setExportConfig(exportSnap.data());
                }

                const perangkatQuery = query(collection(db, 'perangkat'));
                const perangkatSnapshot = await getDocs(perangkatQuery);
                const perangkatList = perangkatSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllPerangkat(perangkatList);

            } catch (error) {
                console.error("Error fetching extra data for export:", error);
                showNotification("Gagal memuat data pendukung untuk ekspor.", "error");
            } finally {
                setLoadingExtras(false);
            }
        };

        fetchExtraData();
    }, [showNotification]);


    useEffect(() => {
        const fetchUploadConfig = async () => {
            const docRef = doc(db, 'settings', 'bpdUploadConfig');
            const docSnap = await getDoc(docRef);
            setUploadConfig(docSnap.exists() ? docSnap.data() : {});
        };
        fetchUploadConfig();
    }, []);

    useEffect(() => {
        const editId = searchParams.get('edit');
        const viewId = searchParams.get('view');
        const highlightId = searchParams.get('highlight');
        const targetDesa = searchParams.get('desa');
    
        if (currentUser.role === 'admin_kecamatan' && targetDesa && targetDesa !== currentDesa) {
            setCurrentDesa(targetDesa);
        }
    
        if (highlightId) {
            setHighlightedRow(highlightId);
            const timer = setTimeout(() => {
                setHighlightedRow(null);
                searchParams.delete('highlight');
                searchParams.delete('desa');
                setSearchParams(searchParams, { replace: true });
            }, 3000);
            return () => clearTimeout(timer);
        }
    
        if ((editId || viewId) && allBpd.length > 0) {
            const bpdToShow = allBpd.find(b => b.id === (editId || viewId));
            if (bpdToShow) {
                handleOpenModal(bpdToShow, editId ? 'edit' : 'view');
                searchParams.delete('edit');
                searchParams.delete('view');
                setSearchParams(searchParams, { replace: true });
            }
        }
    }, [allBpd, searchParams, currentUser.role, currentDesa, handleOpenModal, setSearchParams]);
    
    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.desa) {
            showNotification("Desa wajib diisi!", 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            let docId = selectedBpd ? selectedBpd.id : null;
            if (selectedBpd) {
                await updateItem(selectedBpd.id, formData);
                showNotification("Data BPD berhasil diperbarui.", "success");
                
                if (currentUser.role === 'admin_kecamatan') {
                    const message = `Admin Kecamatan telah memperbarui data BPD untuk "${formData.nama}".`;
                    const link = `/app/bpd/data?view=${selectedBpd.id}`;
                    await createNotificationForDesaAdmins(selectedBpd.desa, message, link);
                }
            } else {
                const newDocRef = await addItem(formData);
                docId = newDocRef.id;
                showNotification("Data BPD baru berhasil ditambahkan.", "success");

                if (currentUser.role === 'admin_desa' && docId) {
                    const message = `Admin Desa ${currentUser.desa} telah menambahkan data BPD baru: "${formData.nama}".`;
                    const link = `/app/bpd/data?view=${docId}&desa=${currentUser.desa}`;
                    await createNotificationForAdmins(message, link, currentUser);
                }
            }
            handleCloseModal();
        } catch(error){
            showNotification(`Gagal menyimpan data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = (bpd) => {
        setBpdToDelete(bpd);
        setSelectedRows(new Set()); // Kosongkan pilihan massal saat hapus tunggal
        setIsDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        setIsSubmitting(true);
        try {
            if (bpdToDelete) { // Hapus satu data
                await deleteItem(bpdToDelete.id);
                showNotification(`Data BPD "${bpdToDelete.nama}" berhasil dihapus.`, 'success');
            } else if (selectedRows.size > 0) { // Hapus data massal
                const batch = writeBatch(db);
                selectedRows.forEach(id => {
                    batch.delete(doc(db, 'bpd', id));
                });
                await batch.commit();
                showNotification(`${selectedRows.size} data BPD berhasil dihapus.`, 'success');
                setSelectedRows(new Set());
            }
        } catch (error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setBpdToDelete(null);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!uploadConfig || Object.values(uploadConfig).every(v => !v)) {
            showNotification("Pengaturan format upload belum diatur.", "warning");
            e.target.value = null;
            return;
        }
        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const existingDataMap = new Map(allBpd.map(b => [
                    `${String(b.nama || '').toLowerCase().trim()}_${String(b.no_sk_bupati || '').toString().trim()}`,
                    b.id
                ]));
    
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {raw: false});
                if (jsonData.length === 0) throw new Error('File Excel kosong.');
    
                const batch = writeBatch(db);
                let newEntriesCount = 0;
                let updatedEntriesCount = 0;
    
                const reverseUploadConfig = {};
                for (const key in uploadConfig) {
                    if (uploadConfig[key]) reverseUploadConfig[uploadConfig[key]] = key;
                }
    
                for (const row of jsonData) {
                    const newDoc = {};
                    for (const excelHeader in row) {
                        const firestoreField = reverseUploadConfig[excelHeader.trim()];
                        if (firestoreField) {
                            let value = row[excelHeader];
                            if (value instanceof Date) {
                                const userTimezoneOffset = value.getTimezoneOffset() * 60000;
                                value = new Date(value.getTime() - userTimezoneOffset).toISOString().split('T')[0];
                            }
                            newDoc[firestoreField] = value;
                        }
                    }
                    if (currentUser.role === 'admin_desa') newDoc.desa = currentUser.desa;
                    const nama = String(newDoc.nama || '').toLowerCase().trim();
                    const noSkBupati = String(newDoc.no_sk_bupati || '').toString().trim();
                    if (!nama || !noSkBupati || !newDoc.desa) continue;
    
                    const uniqueKey = `${nama}_${noSkBupati}`;
                    
                    if (existingDataMap.has(uniqueKey)) {
                        const docId = existingDataMap.get(uniqueKey);
                        const docRef = doc(db, 'bpd', docId);
                        batch.update(docRef, newDoc);
                        updatedEntriesCount++;
                    } else {
                        const newDocRef = doc(collection(db, 'bpd'));
                        batch.set(newDocRef, newDoc);
                        existingDataMap.set(uniqueKey, newDocRef.id);
                        newEntriesCount++;
                    }
                }
    
                if (newEntriesCount > 0 || updatedEntriesCount > 0) {
                    await batch.commit();
                    
                    if (currentUser.role === 'admin_desa') {
                        const message = `Impor BPD Desa ${currentUser.desa}: ${newEntriesCount} data ditambah, ${updatedEntriesCount} data diperbarui.`;
                        const link = `/app/bpd/data?desa=${currentUser.desa}`;
                        await createNotificationForAdmins(message, link, currentUser);
                    }
                }
    
                let notificationMessage = "";
                if (newEntriesCount > 0) notificationMessage += `${newEntriesCount} data baru berhasil diimpor. `;
                if (updatedEntriesCount > 0) notificationMessage += `${updatedEntriesCount} data berhasil diperbarui.`;
                if (!notificationMessage) notificationMessage = "Tidak ada data baru atau yang perlu diperbarui dari file.";
                
                showNotification(notificationMessage, 'success', 8000);
    
            } catch (error) {
                showNotification(`Gagal memproses file: ${error.message}`, 'error');
            } finally {
                setIsUploading(false);
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    const filteredBpd = useMemo(() => {
        if (!currentUser) return [];
        let data = allBpd;

        if (currentUser.role === 'admin_kecamatan') {
            if (currentDesa !== 'all') {
                data = data.filter(b => b.desa === currentDesa);
            }
        } else {
            data = data.filter(b => b.desa === currentUser.desa);
        }
        
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(b =>
                (b.nama && b.nama.toLowerCase().includes(searchLower)) ||
                (b.jabatan && b.jabatan.toLowerCase().includes(searchLower))
            );
        }
        if (periodeFilter) {
            data = data.filter(b => b.periode && b.periode.includes(periodeFilter));
        }
        return data;
    }, [allBpd, searchTerm, currentUser, currentDesa, periodeFilter]);
    
    const handleExportXLSX = useCallback((scope) => {
        setIsExportModalOpen(false);
        let dataToExport;

        if (scope === 'all') {
            dataToExport = allBpd;
        } else { 
            dataToExport = filteredBpd;
        }

        if (dataToExport.length === 0) {
            showNotification("Tidak ada data untuk diekspor.", "warning");
            return;
        }
        
        const exportDetails = {
            bpdData: dataToExport,
            role: currentUser.role,
            desa: scope === 'all' ? 'all' : (currentUser.desa || currentDesa),
            periodeFilter: periodeFilter,
            exportConfig: exportConfig,
            allPerangkat: allPerangkat
        };

        generateBpdXLSX(exportDetails);
    }, [allBpd, filteredBpd, currentUser, currentDesa, periodeFilter, exportConfig, allPerangkat, showNotification]);

    const handleExportClick = useCallback(() => {
        if (currentUser.role === 'admin_kecamatan') {
            setIsExportModalOpen(true);
        } else {
            handleExportXLSX('current');
        }
    }, [currentUser, handleExportXLSX]);

    const handleSelectRow = (id) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedRows.size === filteredBpd.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(filteredBpd.map(p => p.id)));
        }
    };

    const confirmDeleteSelected = () => {
        if (selectedRows.size === 0) return;
        setBpdToDelete(null); // Pastikan hapus tunggal tidak aktif
        setIsDeleteConfirmOpen(true);
    };
    
    const getModalTitle = () => {
        if (modalMode === 'view') return 'Detail Data Anggota BPD';
        if (modalMode === 'edit') return 'Edit Data BPD';
        return 'Tambah Data BPD';
    };
    
    const highlightClass = (id) => highlightedRow === id ? 'highlight-row' : '';

    if (loading || loadingExtras) return <Spinner size="lg" />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <InputField type="text" placeholder={`Cari nama atau jabatan...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                <InputField type="text" placeholder="Filter periode (cth: 2019-2025)" value={periodeFilter} onChange={(e) => setPeriodeFilter(e.target.value)} icon={<FiFilter />} />
            </div>
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <div>
                    {selectedRows.size > 0 && (
                        <Button onClick={confirmDeleteSelected} variant="danger">
                            <FiTrash2 className="mr-2"/> Hapus ({selectedRows.size}) Terpilih
                        </Button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <label className="btn btn-warning cursor-pointer"><FiUpload className="mr-2"/> 
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={isUploading}/>
                        {isUploading ? 'Mengimpor...' : 'Impor Data'}
                    </label>
                    <Button onClick={handleExportClick} variant="success"><FiDownload className="mr-2"/> Ekspor XLSX</Button>
                    <Button onClick={() => handleOpenModal(null, 'add')} variant="primary"><FiPlus className="mr-2"/> Tambah Data</Button>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-4">
                                <input
                                    type="checkbox"
                                    className="form-checkbox"
                                    onChange={handleSelectAll}
                                    checked={selectedRows.size > 0 && selectedRows.size === filteredBpd.length}
                                    indeterminate={selectedRows.size > 0 && selectedRows.size < filteredBpd.length}
                                />
                            </th>
                            <th className="px-6 py-3">Nama</th>
                            {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                            <th className="px-6 py-3">Jabatan</th>
                            <th className="px-6 py-3">Periode</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBpd.length > 0 ? (
                            filteredBpd.map((p) => (
                                <tr key={p.id} className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${highlightClass(p.id)} ${selectedRows.has(p.id) ? 'bg-blue-50 dark:bg-gray-700' : ''}`}>
                                    <td className="p-4">
                                        <input
                                            type="checkbox"
                                            className="form-checkbox"
                                            checked={selectedRows.has(p.id)}
                                            onChange={() => handleSelectRow(p.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                        <p className="font-semibold">{p.nama}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No. SK: {p.no_sk_bupati || 'N/A'}</p>
                                    </td>
                                    {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{p.desa}</td>}
                                    <td className="px-6 py-4">{p.jabatan}</td>
                                    <td className="px-6 py-4">{p.periode}</td>
                                    <td className="px-6 py-4 flex space-x-3">
                                        <button onClick={() => handleOpenModal(p, 'view')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Lihat Detail"><FiEye /></button>
                                        <button onClick={() => handleOpenModal(p, 'edit')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Edit"><FiEdit /></button>
                                        <button onClick={() => confirmDelete(p)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Hapus"><FiTrash2 /></button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={currentUser.role === 'admin_kecamatan' ? 6 : 5} className="text-center py-10 text-gray-500 dark:text-gray-400">
                                    Tidak ada data untuk ditampilkan.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {currentUser?.role === 'admin_kecamatan' && (
                <Pagination
                    desaList={DESA_LIST}
                    currentDesa={currentDesa}
                    onPageChange={setCurrentDesa}
                />
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={getModalTitle()}>
                {modalMode === 'view' ? (
                    <BpdDetailView bpd={selectedBpd} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-6">
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Informasi Keanggotaan</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <InputField label="Jabatan" name="jabatan" value={formData.jabatan || ''} onChange={handleFormChange} type="select" required>
                                    <option value="">Pilih Jabatan</option>
                                    {JABATAN_BPD_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                                </InputField>
                                 <InputField label="Periode" name="periode" value={formData.periode || ''} onChange={handleFormChange} placeholder="Contoh: 2019-2025" />
                                <InputField label="No. SK Bupati" name="no_sk_bupati" value={formData.no_sk_bupati || ''} onChange={handleFormChange} />
                                <InputField label="Tgl. SK Bupati" name="tgl_sk_bupati" value={formData.tgl_sk_bupati || ''} onChange={handleFormChange} type="date" />
                                <InputField label="Tgl Pelantikan" name="tgl_pelantikan" value={formData.tgl_pelantikan || ''} onChange={handleFormChange} type="date" />
                                <InputField label="Wilayah Pemilihan" name="wil_pmlhn" value={formData.wil_pmlhn || ''} onChange={handleFormChange} />
                            </div>
                        </div>
                        
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Data Pribadi</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                 <InputField label="Nama Lengkap" name="nama" value={formData.nama || ''} onChange={handleFormChange} required />
                                 <InputField label="Jenis Kelamin" name="jenis_kelamin" value={formData.jenis_kelamin || ''} onChange={handleFormChange} type="select">
                                    <option value="">Pilih Jenis Kelamin</option>
                                    {JENIS_KELAMIN_LIST.map(jk => <option key={jk} value={jk}>{jk}</option>)}
                                 </InputField>
                                 <InputField label="Tempat Lahir" name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleFormChange} />
                                 <InputField label="Tgl Lahir" name="tgl_lahir" value={formData.tgl_lahir || ''} onChange={handleFormChange} type="date" />
                                 <InputField label="Pekerjaan" name="pekerjaan" value={formData.pekerjaan || ''} onChange={handleFormChange} />
                                 <InputField label="Pendidikan" name="pendidikan" value={formData.pendidikan || ''} onChange={handleFormChange} type="select">
                                    <option value="">Pilih Pendidikan</option>
                                    {PENDIDIKAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                                 </InputField>
                                 <InputField label="Agama" name="agama" value={formData.agama || ''} onChange={handleFormChange} type="select">
                                    <option value="">Pilih Agama</option>
                                    {AGAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                                 </InputField>
                                 <InputField label="No. HP / WA" name="no_hp" value={formData.no_hp || ''} onChange={handleFormChange} />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Alamat</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                <InputField label="Desa" name="desa" value={formData.desa || ''} onChange={handleFormChange} type="select" required disabled={currentUser.role === 'admin_desa'}>
                                    <option value="">Pilih Desa</option>
                                    {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                                </InputField>
                                <InputField label="RT" name="rt" value={formData.rt || ''} onChange={handleFormChange} placeholder="001" />
                                <InputField label="RW" name="rw" value={formData.rw || ''} onChange={handleFormChange} placeholder="001" />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md mr-2" disabled={isSubmitting}>Batal</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center" disabled={isSubmitting}>
                                {isSubmitting && <Spinner size="sm" />}
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
            
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={executeDelete}
                isLoading={isSubmitting}
                title={bpdToDelete ? "Konfirmasi Hapus Anggota BPD" : "Konfirmasi Hapus Data Terpilih"}
                message={
                    bpdToDelete
                        ? `Apakah Anda yakin ingin menghapus data anggota BPD "${bpdToDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.`
                        : `Apakah Anda yakin ingin menghapus ${selectedRows.size} data BPD yang dipilih? Tindakan ini tidak dapat dibatalkan.`
                }
            />

            {currentUser.role === 'admin_kecamatan' && (
                 <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Pilih Opsi Ekspor Data BPD">
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Pilih data BPD yang ingin Anda ekspor ke dalam file XLSX.</p>
                    <div className="flex flex-col md:flex-row justify-center gap-4">
                        <Button onClick={() => handleExportXLSX('current')} variant="secondary" className="w-full md:w-auto">
                            Hanya Desa {currentDesa}
                        </Button>
                        <Button onClick={() => handleExportXLSX('all')} variant="primary" className="w-full md:w-auto">
                            Semua Desa (Rekap Kecamatan)
                        </Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default BPDPage;

