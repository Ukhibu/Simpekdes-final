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
import { LPM_CONFIG, DESA_LIST, JENIS_KELAMIN_LIST, PENDIDIKAN_LIST } from '../utils/constants';
import { generateLpmXLSX } from '../utils/generateLpmXLSX';
import { createNotificationForAdmins } from '../utils/notificationService';
import * as XLSX from 'xlsx';

// Ikon
import { FiEdit, FiSearch, FiUpload, FiDownload, FiPlus, FiEye, FiTrash2 } from 'react-icons/fi';

const LPMPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);

    // State untuk data pendukung (perangkat & konfigurasi ekspor)
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [exportConfig, setExportConfig] = useState(null);
    const [loadingExtras, setLoadingExtras] = useState(true);

    // State untuk Modal & Form
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // State untuk Konfirmasi Hapus
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // State untuk Filter & Pencarian
    const [searchTerm, setSearchTerm] = useState('');
    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);
    const [searchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);

    // Mengambil data utama (LPM) dari Firestore
    useEffect(() => {
        const q = query(collection(db, LPM_CONFIG.collectionName));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDataList(list);
            setLoading(false);
        }, (error) => {
            console.error(`Error fetching ${LPM_CONFIG.collectionName}:`, error);
            showNotification(`Gagal memuat data: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [showNotification]);

    // Mengambil data pendukung untuk ekspor
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

    // Efek untuk menangani highlighting dari URL
    useEffect(() => {
        const editId = searchParams.get('edit');
        const highlightId = searchParams.get('highlight') || editId;

        if (highlightId) {
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

    // Logika untuk filter data yang ditampilkan
    const filteredData = useMemo(() => {
        let data = dataList;
        if (currentUser.role === 'admin_kecamatan') {
            data = data.filter(item => item.desa === currentDesa);
        } else {
             data = data.filter(item => item.desa === currentUser.desa);
        }
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(item => (item.nama || '').toLowerCase().includes(searchLower) || (item.jabatan || '').toLowerCase().includes(searchLower));
        }
        return data;
    }, [dataList, searchTerm, currentDesa, currentUser]);

    // Handler untuk membuka modal
    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
        setFormData(item ? { ...item } : { desa: initialDesa });
        setIsModalOpen(true);
    };

    // Handler untuk menutup modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedItem(null);
        setFormData({});
    };

    // Handler untuk perubahan form
    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Handler untuk submit form (tambah/edit)
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (selectedItem) {
                await updateDoc(doc(db, LPM_CONFIG.collectionName, selectedItem.id), formData);
                showNotification('Data LPM berhasil diperbarui.', 'success');
            } else {
                const newDocRef = await addDoc(collection(db, LPM_CONFIG.collectionName), formData);
                showNotification('Data LPM berhasil ditambahkan.', 'success');
                if (currentUser.role === 'admin_desa') {
                    const message = `Admin Desa ${currentUser.desa} telah menambahkan data LPM baru: "${formData.nama}".`;
                    const link = `/app/lpm/data?desa=${currentUser.desa}&highlight=${newDocRef.id}`;
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
    
    // Handler untuk menghapus data
    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, LPM_CONFIG.collectionName, itemToDelete.id));
            showNotification('Data berhasil dihapus.', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    // [BARU] Logika impor data dari Excel seperti di Perangkat.js
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                const jsonDataWithHeaders = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 2 });
                if (jsonDataWithHeaders.length < 1) throw new Error("Format file tidak sesuai. Header tidak ditemukan di baris ke-3.");
                
                const headerRow = jsonDataWithHeaders[0];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 3, header: headerRow });

                if (jsonData.length === 0) throw new Error("File Excel tidak berisi data.");

                const batch = writeBatch(db);
                let newEntriesCount = 0;
                let skippedCount = 0;

                const parseAndFormatDate = (value) => {
                    if (!value) return null;
                    if (value instanceof Date) {
                        const userTimezoneOffset = value.getTimezoneOffset() * 60000;
                        return new Date(value.getTime() + userTimezoneOffset).toISOString().split('T')[0];
                    }
                    if (typeof value === 'number') {
                        const date = XLSX.SSF.parse_date_code(value);
                        return new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
                    }
                    try {
                        const date = new Date(value);
                        if (!isNaN(date.getTime())) {
                            const userTimezoneOffset = date.getTimezoneOffset() * 60000;
                            return new Date(date.getTime() + userTimezoneOffset).toISOString().split('T')[0];
                        }
                    } catch (e) { /* ignore */ }
                    return null;
                };

                jsonData.forEach(row => {
                    const newDoc = {};

                    newDoc.desa = row['DESA'] ? String(row['DESA']).trim() : null;

                    if (!newDoc.desa) {
                        skippedCount++;
                        return; 
                    }
                    if (currentUser.role === 'admin_desa' && newDoc.desa.toUpperCase() !== currentUser.desa.toUpperCase()) {
                        skippedCount++;
                        return;
                    }
                    
                    newDoc.nama = row['N A M A'] ? String(row['N A M A']).trim() : null;
                    newDoc.jabatan = row['JABATAN'] ? String(row['JABATAN']).trim() : null;
                    newDoc.jenis_kelamin = row['L'] == 1 ? 'L' : (row['P'] == 1 ? 'P' : null);
                    newDoc.tempat_lahir = row['TEMPAT LAHIR'] || null;
                    newDoc.tgl_lahir = parseAndFormatDate(row['TANGGAL LAHIR']);
                    
                    const pendidikanMap = { 'SD': 'SD', 'SLTP': 'SLTP', 'SLTA': 'SLTA', 'D1': 'D1', 'D2': 'D2', 'D3': 'D3', 'S1': 'S1', 'S2': 'S2', 'S3': 'S3' };
                    newDoc.pendidikan = null;
                    for (const key in pendidikanMap) {
                      if (row[key] == 1) { 
                        newDoc.pendidikan = pendidikanMap[key];
                        break; 
                      }
                    }

                    newDoc.no_sk = row['NO SK'] || null;
                    newDoc.tgl_pelantikan = parseAndFormatDate(row['TANGGAL PELANTIKAN']);
                    newDoc.akhir_jabatan = parseAndFormatDate(row['AKHIR MASA JABATAN']);
                    newDoc.no_hp = row['No. HP / WA'] ? String(row['No. HP / WA']) : null;
                    newDoc.masa_bakti = row['Masa Bakti (Tahun)'] || null;

                    if (newDoc.nama && newDoc.jabatan && newDoc.desa) {
                        const newDocRef = doc(collection(db, LPM_CONFIG.collectionName));
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
    
    // Handler untuk ekspor ke XLSX
    const handleExportXLSX = () => {
        if (filteredData.length === 0) {
            showNotification("Tidak ada data untuk diekspor.", "warning");
            return;
        }
        const exportDetails = { dataToExport: filteredData, role: currentUser.role, desa: currentDesa, exportConfig, allPerangkat };
        generateLpmXLSX(exportDetails);
    };

    if (loading || loadingExtras) return <SkeletonLoader columns={5} />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h1 className="text-xl font-bold mb-4">Manajemen Pengurus LPM</h1>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <InputField type="text" placeholder="Cari nama atau jabatan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                <div className="flex gap-2">
                    {/* [BARU] Tombol Impor Data */}
                    <label className="btn btn-warning cursor-pointer">
                        <FiUpload className="mr-2"/>
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={isUploading}/>
                        {isUploading ? 'Mengimpor...' : 'Impor Data'}
                    </label>
                    <Button onClick={handleExportXLSX} variant="success"><FiDownload className="mr-2"/> Ekspor</Button>
                    <Button onClick={() => handleOpenModal('add')} variant="primary"><FiPlus className="mr-2"/> Tambah</Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Nama</th>
                            <th className="px-6 py-3">Jabatan</th>
                            <th className="px-6 py-3">Pendidikan</th>
                            <th className="px-6 py-3">No SK</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map(item => (
                            <tr key={item.id} className={`border-b dark:border-gray-700 ${highlightedRow === item.id ? 'highlight-row' : ''}`}>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.nama}</td>
                                <td className="px-6 py-4">{item.jabatan}</td>
                                <td className="px-6 py-4">{item.pendidikan}</td>
                                <td className="px-6 py-4">{item.no_sk}</td>
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
            
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Detail Pengurus LPM' : `${selectedItem ? 'Edit' : 'Tambah'} Pengurus LPM`}>
                {modalMode === 'view' ? <OrganisasiDetailView data={selectedItem} config={LPM_CONFIG} /> : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Nama Lengkap" name="nama" value={formData.nama || ''} onChange={handleFormChange} required />
                            <InputField label="Jabatan" name="jabatan" value={formData.jabatan || ''} onChange={handleFormChange} required />
                            <InputField label="Jenis Kelamin" name="jenis_kelamin" type="select" value={formData.jenis_kelamin || ''} onChange={handleFormChange}>
                                <option value="">Pilih</option>
                                {JENIS_KELAMIN_LIST.map(jk => <option key={jk} value={jk}>{jk}</option>)}
                            </InputField>
                            <InputField label="Pendidikan" name="pendidikan" type="select" value={formData.pendidikan || ''} onChange={handleFormChange}>
                                <option value="">Pilih</option>
                                {PENDIDIKAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                            </InputField>
                            <InputField label="Tempat Lahir" name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleFormChange} />
                            <InputField label="Tanggal Lahir" name="tgl_lahir" type="date" value={formData.tgl_lahir || ''} onChange={handleFormChange} />
                            <InputField label="Nomor SK" name="no_sk" value={formData.no_sk || ''} onChange={handleFormChange} />
                            <InputField label="Tanggal Pelantikan" name="tgl_pelantikan" type="date" value={formData.tgl_pelantikan || ''} onChange={handleFormChange} />
                            <InputField label="Masa Bakti (Tahun)" name="masa_bakti" type="number" value={formData.masa_bakti || ''} onChange={handleFormChange} />
                            <InputField label="Akhir Jabatan" name="akhir_jabatan" type="date" value={formData.akhir_jabatan || ''} onChange={handleFormChange} />
                            <InputField label="No. HP" name="no_hp" value={formData.no_hp || ''} onChange={handleFormChange} />
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

export default LPMPage;
