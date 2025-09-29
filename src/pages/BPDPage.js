import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, writeBatch, getDoc, doc, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import { FiEdit, FiTrash2, FiSearch, FiFilter, FiPlus, FiUpload, FiDownload, FiEye } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { generateBpdXLSX } from '../utils/generateBpdXLSX';
import InputField from '../components/common/InputField';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useNotification } from '../context/NotificationContext';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { DESA_LIST } from '../utils/constants';
import Pagination from '../components/common/Pagination';

// Daftar statis & Komponen Detail tetap sama
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

    // --- State Baru untuk data tambahan ---
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

    useEffect(() => {
        if (currentUser && currentUser.role === 'admin_desa') {
            setCurrentDesa(currentUser.desa);
        }
    }, [currentUser]);

    // --- useEffect BARU untuk mengambil data Perangkat dan Konfigurasi Ekspor ---
    useEffect(() => {
        const fetchExtraData = async () => {
            setLoadingExtras(true);
            try {
                // Fetch export config for Camat's signature
                const exportRef = doc(db, 'settings', 'exportConfig');
                const exportSnap = await getDoc(exportRef);
                if (exportSnap.exists()) {
                    setExportConfig(exportSnap.data());
                }

                // Fetch all 'perangkat' data to find Kepala Desa
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
        if (editId && allBpd.length > 0) {
            const bpdToEdit = allBpd.find(b => b.id === editId);
            if (bpdToEdit) {
                handleOpenModal(bpdToEdit, 'edit');
                setSearchParams({}, { replace: true });
            }
        }
    }, [allBpd, searchParams, setSearchParams]);
    
    const handleOpenModal = (bpd = null, mode = 'add') => {
        setModalMode(mode);
        setSelectedBpd(bpd);
        if (mode === 'add') {
            const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
            setFormData({ desa: initialDesa, rt: '', rw: '' });
        } else {
            setFormData(bpd);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setModalMode(null);
        setSelectedBpd(null);
        setFormData({});
    };

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
            if (selectedBpd) {
                await updateItem(selectedBpd.id, formData);
            } else {
                await addItem(formData);
            }
            handleCloseModal();
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = (bpd) => {
        setBpdToDelete(bpd);
        setIsDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!bpdToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteItem(bpdToDelete.id);
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setBpdToDelete(null);
        }
    };

   const handleFileUpload = (e) => {
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
                const existingDataCheck = new Set(allBpd.map(b => `${String(b.nama || '').toLowerCase().trim()}_${String(b.no_sk_bupati || '').toString().trim()}`));
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {raw: false});
                if (jsonData.length === 0) throw new Error('File Excel kosong.');

                const batch = writeBatch(db);
                const duplicates = [];
                let newEntriesCount = 0;
                const reverseUploadConfig = {};
                for (const key in uploadConfig) {
                    if (uploadConfig[key]) reverseUploadConfig[uploadConfig[key]] = key;
                }

                jsonData.forEach(row => {
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
                    if (!nama || !noSkBupati) return;

                    const uniqueKey = `${nama}_${noSkBupati}`;
                    if (existingDataCheck.has(uniqueKey)) {
                        duplicates.push(newDoc.nama);
                    } else {
                        const newDocRef = doc(collection(db, 'bpd'));
                        batch.set(newDocRef, newDoc);
                        existingDataCheck.add(uniqueKey);
                        newEntriesCount++;
                    }
                });

                if (newEntriesCount > 0) await batch.commit();
                let notificationMessage = `${newEntriesCount} data baru berhasil diimpor.`;
                if (duplicates.length > 0) {
                    notificationMessage += `\n\n${duplicates.length} data duplikat tidak diimpor: ${duplicates.join(', ')}`;
                }
                showNotification(notificationMessage, 'info', 10000);
            } catch (error) {
                showNotification(`Gagal memproses file: ${error.message}`, 'error');
            } finally {
                setIsUploading(false);
                e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const filteredBpd = useMemo(() => {
        if (!currentUser) return [];
        let data = allBpd;

        const desaToFilter = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
        data = data.filter(b => b.desa === desaToFilter);
        
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
    
    // --- FUNGSI EKSPOR DIPERBARUI ---
    const handleExportXLSX = () => {
        const dataToExport = currentUser.role === 'admin_kecamatan' ? allBpd : filteredBpd;
        if (dataToExport.length === 0) {
            showNotification("Tidak ada data untuk diekspor.", "warning");
            return;
        }
        
        const exportDetails = {
            bpdData: dataToExport,
            role: currentUser.role,
            desa: currentUser.role === 'admin_desa' ? currentUser.desa : 'all',
            periodeFilter: periodeFilter,
            exportConfig: exportConfig,
            allPerangkat: allPerangkat
        };

        generateBpdXLSX(exportDetails);
    };
    
    const getModalTitle = () => {
        if (modalMode === 'view') return 'Detail Data Anggota BPD';
        if (modalMode === 'edit') return 'Edit Data BPD';
        return 'Tambah Data BPD';
    };

    if (loading || loadingExtras) return <Spinner size="lg" />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <InputField type="text" placeholder={`Cari di Desa ${currentDesa}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                <InputField type="text" placeholder="Filter periode (cth: 2019-2025)" value={periodeFilter} onChange={(e) => setPeriodeFilter(e.target.value)} icon={<FiFilter />} />
            </div>
            <div className="flex flex-wrap justify-end gap-2 mb-4">
                <label className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 cursor-pointer flex items-center gap-2">
                    <FiUpload/> {isUploading ? 'Mengimpor...' : 'Impor Data'}
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={isUploading}/>
                </label>
                <button onClick={handleExportXLSX} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"><FiDownload/> Ekspor XLSX</button>
                <button onClick={() => handleOpenModal(null, 'add')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><FiPlus/> Tambah Data</button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Nama</th>
                            <th className="px-6 py-3">Jabatan</th>
                            <th className="px-6 py-3">Periode</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBpd.length > 0 ? (
                            filteredBpd.map((p) => (
                                <tr key={p.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                        <p className="font-semibold">{p.nama}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No. SK: {p.no_sk_bupati || 'N/A'}</p>
                                    </td>
                                    <td className="px-6 py-4">{p.jabatan}</td>
                                    <td className="px-6 py-4">{p.periode}</td>
                                    <td className="px-6 py-4 flex space-x-3">
                                        <button onClick={() => handleOpenModal(p, 'view')} className="text-gray-500 hover:text-gray-700"><FiEye /></button>
                                        <button onClick={() => handleOpenModal(p, 'edit')} className="text-blue-600 hover:text-blue-800"><FiEdit /></button>
                                        <button onClick={() => confirmDelete(p)} className="text-red-600 hover:text-red-800"><FiTrash2 /></button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="text-center py-10 text-gray-500 dark:text-gray-400">
                                    Tidak ada data untuk ditampilkan di Desa {currentDesa}.
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
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md mr-2" disabled={isSubmitting}>Tutup</button>
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
                title="Konfirmasi Hapus Anggota BPD"
                message={`Apakah Anda yakin ingin menghapus data anggota BPD "${bpdToDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.`}
            />
        </div>
    );
};

export default BPDPage;
