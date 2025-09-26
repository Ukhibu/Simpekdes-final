import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, writeBatch, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import { FiEdit, FiTrash2, FiSearch, FiFilter, FiPlus, FiUpload, FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { generateBpdXLSX } from '../utils/generateBpdXLSX';
import InputField from '../components/common/InputField';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useNotification } from '../context/NotificationContext';
import ConfirmationModal from '../components/common/ConfirmationModal';

const DESA_LIST = [ "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga" ];
const JABATAN_BPD_LIST = ["Ketua", "Wakil Ketua", "Sekretaris", "Anggota"];
const PENDIDIKAN_LIST = ["SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"];
const AGAMA_LIST = ["Islam", "Kristen", "Katolik", "Hindu", "Budha", "Konghucu"];
const JENIS_KELAMIN_LIST = ["Laki-laki", "Perempuan"];

const BPDPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const { data: allBpd, loading, addItem, updateItem, deleteItem } = useFirestoreCollection('bpd');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBpd, setSelectedBpd] = useState(null);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState('all');
    const [periodeFilter, setPeriodeFilter] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadConfig, setUploadConfig] = useState(null);
    
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [bpdToDelete, setBpdToDelete] = useState(null);

    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const fetchUploadConfig = async () => {
            const docRef = doc(db, 'settings', 'bpdUploadConfig');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setUploadConfig(docSnap.data());
            } else {
                setUploadConfig({}); 
            }
        };
        fetchUploadConfig();
    }, []);

    useEffect(() => {
        const editId = searchParams.get('edit');
        if (editId && allBpd.length > 0) {
            const bpdToEdit = allBpd.find(b => b.id === editId);
            if (bpdToEdit) {
                handleOpenModal(bpdToEdit);
                setSearchParams({}, { replace: true });
            }
        }
    }, [allBpd, searchParams, setSearchParams]);
    
    const handleOpenModal = (bpd = null) => {
        setSelectedBpd(bpd);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : (bpd ? bpd.desa : '');
        setFormData(bpd ? { ...bpd } : { desa: initialDesa, rt: '', rw: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
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
        } catch (error) {
            // Error notification is handled by the hook
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
        } catch (error) {
            // Error notification is handled by the hook
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
            showNotification("Pengaturan format upload belum diatur. Silakan atur di halaman Setelan BPD.", "warning");
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
                
                const namaHeader = uploadConfig.nama;
                if (!namaHeader) throw new Error("Format upload tidak valid: Header untuk 'nama' tidak diatur.");
                
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {raw: false});
                
                if (jsonData.length === 0) throw new Error('File Excel kosong atau format tidak sesuai.');

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

                let notificationMessage = `${newEntriesCount} data BPD baru berhasil diimpor.`;
                if (duplicates.length > 0) {
                    notificationMessage += `\n\n${duplicates.length} data tidak diimpor karena duplikat:\n- ${duplicates.join('\n- ')}`;
                }
                showNotification(notificationMessage, 'info', 10000);

            } catch (error) {
                console.error("Error processing file:", error);
                showNotification(`Gagal memproses file: ${error.message}`, 'error');
            } finally {
                setIsUploading(false);
                e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const filteredBpd = useMemo(() => {
        // PERBAIKAN: Tambahkan pemeriksaan untuk currentUser sebelum mengakses propertinya
        if (!currentUser) return [];
        return allBpd.filter(b => {
            const filterByDesaCond = currentUser.role === 'admin_kecamatan' && filterDesa !== 'all' ? b.desa === filterDesa : true;
            const searchLower = searchTerm.toLowerCase();
            const filterBySearchCond = !searchTerm ||
                (b.nama && b.nama.toLowerCase().includes(searchLower)) ||
                (b.jabatan && b.jabatan.toLowerCase().includes(searchLower));
            const filterByPeriodeCond = !periodeFilter || (b.periode && b.periode.includes(periodeFilter));
            return filterByDesaCond && filterBySearchCond && filterByPeriodeCond;
        });
    }, [allBpd, searchTerm, filterDesa, currentUser, periodeFilter]); // PERBAIKAN: Ubah dependensi ke objek currentUser
    
    const handleExportXLSX = () => {
        const dataToExport = filteredBpd.length > 0 ? filteredBpd : allBpd;
         if (dataToExport.length === 0) {
            showNotification("Tidak ada data untuk diekspor.", "warning");
            return;
         }
        const groupedData = dataToExport.reduce((acc, p) => {
            const desa = p.desa || 'Lainnya';
            (acc[desa] = acc[desa] || []).push(p);
            return acc;
        }, {});
        generateBpdXLSX(groupedData, periodeFilter);
    };

    if (loading) return <Spinner size="lg" />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <InputField type="text" placeholder="Cari nama atau jabatan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                <InputField type="text" placeholder="Filter periode (cth: 2020-2025)" value={periodeFilter} onChange={(e) => setPeriodeFilter(e.target.value)} icon={<FiFilter />} />
                {currentUser.role === 'admin_kecamatan' && (
                    <InputField type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} icon={<FiFilter />}>
                        <option value="all">Semua Desa</option>
                        {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                    </InputField>
                )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 mb-4">
                <label className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 cursor-pointer flex items-center gap-2">
                    <FiUpload/> {isUploading ? 'Mengimpor...' : 'Impor Data'}
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={isUploading}/>
                </label>
                <button onClick={handleExportXLSX} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"><FiDownload/> Ekspor XLSX</button>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><FiPlus/> Tambah Data</button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Nama</th>
                            <th className="px-6 py-3">Jabatan</th>
                            {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                            <th className="px-6 py-3">Periode</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBpd.map((p) => (
                            <tr key={p.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                    <p className="font-semibold">{p.nama}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">No. SK: {p.no_sk_bupati || 'N/A'}</p>
                                </td>
                                <td className="px-6 py-4">{p.jabatan}</td>
                                {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{p.desa}</td>}
                                <td className="px-6 py-4">{p.periode}</td>
                                <td className="px-6 py-4 flex space-x-3">
                                    <button onClick={() => handleOpenModal(p)} className="text-blue-600 hover:text-blue-800"><FiEdit /></button>
                                    <button onClick={() => confirmDelete(p)} className="text-red-600 hover:text-red-800"><FiTrash2 /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedBpd ? 'Edit Data BPD' : 'Tambah Data BPD'}>
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

