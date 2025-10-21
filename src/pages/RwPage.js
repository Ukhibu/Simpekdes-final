import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import OrganisasiDetailView from '../components/common/OrganisasiDetailView';
import { FiSearch, FiFilter, FiPlus, FiEdit, FiTrash2, FiEye, FiUpload, FiDownload } from 'react-icons/fi';
import { DESA_LIST, PENDIDIKAN_LIST, JENIS_KELAMIN_LIST, JABATAN_RW_LIST } from '../utils/constants';
import * as XLSX from 'xlsx';
import { generateRwXLSX } from '../utils/generateRwXLSX'; 
import { createNotificationForAdmins } from '../utils/notificationService';
import { useSearchParams } from 'react-router-dom';

// Konfigurasi RW yang telah disesuaikan
const RW_CONFIG = {
    collectionName: 'rt_rw',
    title: 'Data Pengurus RW',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'select', options: JABATAN_RW_LIST, required: true },
        { name: 'no_rw', label: 'Nomor RW', type: 'text', required: true },
        { name: 'dusun', label: 'Dusun', type: 'text' },
        { name: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: JENIS_KELAMIN_LIST },
        { name: 'tempat_lahir', label: 'Tempat Lahir', type: 'text' },
        { name: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
        { name: 'pendidikan', label: 'Pendidikan Terakhir', type: 'select', options: PENDIDIKAN_LIST },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ],
    tableColumns: ['nama', 'jabatan', 'no_rw', 'dusun', 'jenis_kelamin', 'pendidikan'],
    completenessCriteria: ['nama', 'jabatan', 'no_rw', 'desa', 'jenis_kelamin', 'pendidikan'],
};

// Helper function untuk mem-parsing tanggal dari Excel
const parseExcelDate = (excelDate) => {
    if (!excelDate) return "";
    let date;
    if (typeof excelDate === 'number') {
        date = new Date((excelDate - 25569) * 86400 * 1000);
    } else {
        date = new Date(excelDate);
    }
    if (isNaN(date.getTime())) return "";
    
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - tzoffset);

    return localDate.toISOString().split('T')[0];
};

const RwPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState('all');
    const [searchParams, setSearchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);
    const [hasOpenedModalFromQuery, setHasOpenedModalFromQuery] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);

    const config = RW_CONFIG;

    useEffect(() => {
        const editId = searchParams.get('edit');
        if (editId && dataList.length > 0 && !hasOpenedModalFromQuery) {
            const itemToEdit = dataList.find(item => item.id === editId);
            if (itemToEdit) {
                setHighlightedRow(editId);
                handleOpenModal('edit', itemToEdit);
                setHasOpenedModalFromQuery(true);
                const newSearchParams = new URLSearchParams(searchParams);
                newSearchParams.delete('edit');
                setSearchParams(newSearchParams, { replace: true });
                const timer = setTimeout(() => setHighlightedRow(null), 3000);
                return () => clearTimeout(timer);
            }
        }
    }, [searchParams, dataList, hasOpenedModalFromQuery, setSearchParams]);

    useEffect(() => {
        if (currentUser) {
            setFilterDesa(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return setLoading(false);
        setLoading(true);
        const q = query(collection(db, config.collectionName), where("no_rw", ">", ""));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDataList(list);
            setLoading(false);
        }, (error) => {
            showNotification(`Gagal memuat data RW: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, showNotification, config.collectionName]);

    const filteredData = useMemo(() => {
        let data = dataList;
        if (currentUser.role === 'admin_kecamatan' && filterDesa !== 'all') {
            data = data.filter(item => item.desa === filterDesa);
        } else if (currentUser.role === 'admin_desa') {
            data = data.filter(item => item.desa === currentUser.desa);
        }
        if (searchTerm) {
            data = data.filter(item => (item.nama || '').toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return data;
    }, [dataList, searchTerm, filterDesa, currentUser]);

    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : '';
        setFormData(item ? { ...item } : { desa: initialDesa, jabatan: 'Ketua' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => !isSubmitting && setIsModalOpen(false);

    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.desa) return showNotification("Desa wajib diisi!", 'error');
        setIsSubmitting(true);
        try {
            const dataToSave = { ...formData, no_rt: "" };
            let docId = selectedItem?.id;
            if (selectedItem) {
                await updateDoc(doc(db, config.collectionName, docId), dataToSave);
                showNotification('Data RW berhasil diperbarui!', 'success');
            } else {
                const newDocRef = await addDoc(collection(db, config.collectionName), dataToSave);
                docId = newDocRef.id;
                showNotification('Data RW berhasil ditambahkan!', 'success');
            }
            if (currentUser.role === 'admin_desa' && docId) {
                const action = selectedItem ? 'memperbarui' : 'menambahkan';
                const message = `Admin Desa ${currentUser.desa} telah ${action} data Pengurus RW: "${formData.nama}".`;
                await createNotificationForAdmins(message, `/app/rt-rw/rw?edit=${docId}`, currentUser);
            }
            handleCloseModal();
        } catch (error) {
            showNotification(`Gagal menyimpan data RW: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openDeleteConfirm = (item) => {
        setItemToDelete(item);
        setIsDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, config.collectionName, itemToDelete.id));
            showNotification('Data RW berhasil dihapus.', 'success');
        } catch(error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                if (jsonData.length === 0) throw new Error("File kosong.");

                const existingDataMap = new Map(
                    dataList.map(item => [item.nama.trim().toLowerCase(), item])
                );

                const batch = writeBatch(db);
                let addedCount = 0;
                let updatedCount = 0;
                let duplicatesInFile = 0;
                const processedNames = new Set();

                jsonData.forEach(row => {
                    const nama = String(row['N A M A'] || '').trim();
                    if (!nama) return;

                    const normalizedName = nama.toLowerCase();
                    if (processedNames.has(normalizedName)) {
                        duplicatesInFile++;
                        return;
                    }
                    processedNames.add(normalizedName);

                    let jenisKelamin = '';
                    if (String(row['L']).trim().toUpperCase() === 'L') jenisKelamin = 'Laki-Laki';
                    else if (String(row['P']).trim().toUpperCase() === 'P') jenisKelamin = 'Perempuan';

                    let pendidikan = '';
                    for (const level of PENDIDIKAN_LIST) {
                        if (String(row[level]).trim() === '1') {
                            pendidikan = level;
                            break;
                        }
                    }
                    
                    const formattedDate = parseExcelDate(row['TANGGAL LAHIR']);

                    const newDoc = {
                        desa: currentUser.role === 'admin_desa' ? currentUser.desa : String(row['DESA'] || ''),
                        nama: nama,
                        jenis_kelamin: jenisKelamin,
                        jabatan: String(row['JABATAN'] || 'Ketua'),
                        tempat_lahir: String(row['TEMPAT LAHIR'] || ''),
                        tanggal_lahir: formattedDate,
                        pendidikan: pendidikan,
                        periode: String(row['PRIODE'] || ''),
                        no_rw: String(row['NO RW'] || ''),
                        dusun: String(row['DUSUN'] || ''),
                        no_hp: String(row['No. HP / WA'] || ''),
                        no_rt: "",
                    };
                    
                    if (newDoc.nama && newDoc.desa && newDoc.jabatan && newDoc.no_rw) {
                        const existingDoc = existingDataMap.get(normalizedName);
                        if (existingDoc) {
                            batch.update(doc(db, config.collectionName, existingDoc.id), newDoc);
                            updatedCount++;
                        } else {
                            batch.set(doc(collection(db, config.collectionName)), newDoc);
                            addedCount++;
                        }
                    }
                });

                if (addedCount > 0 || updatedCount > 0) {
                    await batch.commit();
                    let msg = `Impor berhasil: ${addedCount} data ditambahkan, ${updatedCount} data diperbarui.`;
                    if (duplicatesInFile > 0) {
                        msg += ` ${duplicatesInFile} duplikat dalam file diabaikan.`
                    }
                    showNotification(msg, 'success');
                } else {
                    showNotification("Tidak ada data valid untuk diimpor atau diperbarui.", 'warning');
                }
            } catch (error) {
                showNotification(`Gagal impor: ${error.message}`, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };
    
    const handleExportXLSX = async () => {
        if (filteredData.length === 0) {
            showNotification("Tidak ada data untuk diekspor.", "warning");
            return;
        }
        try {
            await generateRwXLSX(filteredData, db);
        } catch (error) {
            showNotification(`Gagal mengekspor data: ${error.message}`, 'error');
        }
    };
    
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(filteredData.map(item => item.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const openDeleteSelectedConfirm = () => {
        setIsDeleteSelectedConfirmOpen(true);
    };

    const handleDeleteSelected = async () => {
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, config.collectionName, id));
            });
            await batch.commit();
            showNotification(`${selectedIds.length} data RW berhasil dihapus.`, 'success');
            setSelectedIds([]);
        } catch (error) {
            showNotification(`Gagal menghapus data terpilih: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteSelectedConfirmOpen(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <InputField type="text" placeholder="Cari nama..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} icon={<FiFilter />}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                </div>
                 <div className="flex flex-wrap gap-2">
                    {selectedIds.length > 0 && (
                         <Button onClick={openDeleteSelectedConfirm} variant="danger">
                             <FiTrash2 className="mr-2"/> Hapus ({selectedIds.length})
                         </Button>
                    )}
                    <label className="btn btn-warning cursor-pointer"><FiUpload className="mr-2"/> Impor Data<input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv"/></label>
                    <Button onClick={handleExportXLSX} variant="success"><FiDownload className="mr-2"/> Ekspor Data</Button>
                    <Button onClick={() => handleOpenModal('add')} variant="primary"><FiPlus className="mr-2"/> Tambah Data</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                            <tr>
                                <th scope="col" className="p-4">
                                    <div className="flex items-center">
                                        <input id="checkbox-all" type="checkbox" onChange={handleSelectAll} checked={filteredData.length > 0 && selectedIds.length === filteredData.length} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                                        <label htmlFor="checkbox-all" className="sr-only">checkbox</label>
                                    </div>
                                </th>
                                {config.tableColumns.map(col => <th key={col} className="px-6 py-3">{config.formFields.find(f=>f.name===col)?.label}</th>)}
                                <th className="px-6 py-3">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={config.tableColumns.length + 2} className="text-center py-4"><Spinner /></td></tr>
                            ) : filteredData.length > 0 ? filteredData.map(item => (
                                <tr key={item.id} className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${highlightedRow === item.id ? 'highlight-row' : ''}`}>
                                    <td className="w-4 p-4">
                                        <div className="flex items-center">
                                            <input id={`checkbox-${item.id}`} type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => handleSelectOne(item.id)} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                                            <label htmlFor={`checkbox-${item.id}`} className="sr-only">checkbox</label>
                                        </div>
                                    </td>
                                    {config.tableColumns.map(col => <td key={col} className="px-6 py-4">{item[col] || '-'}</td>)}
                                    <td className="px-6 py-4 flex items-center space-x-3">
                                        <button onClick={() => handleOpenModal('view', item)} className="text-green-500 hover:text-green-700" title="Lihat"><FiEye /></button>
                                        <button onClick={() => handleOpenModal('edit', item)} className="text-blue-500 hover:text-blue-700" title="Edit"><FiEdit /></button>
                                        <button onClick={() => openDeleteConfirm(item)} className="text-red-500 hover:text-red-700" title="Hapus"><FiTrash2 /></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={config.tableColumns.length + 2} className="text-center py-10">Data tidak ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
            
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? `Detail ${config.title}` : modalMode === 'edit' ? `Edit ${config.title}` : `Tambah ${config.title}`}>
                {modalMode === 'view' ? <OrganisasiDetailView data={selectedItem} config={config} /> : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        {config.formFields.map(field => {
                             if (field.type === 'select') {
                                return (
                                    <InputField
                                        key={field.name}
                                        label={field.label}
                                        name={field.name}
                                        type="select"
                                        value={formData[field.name] || ''}
                                        onChange={handleFormChange}
                                        required={field.required}
                                        disabled={field.name === 'jabatan'}
                                    >
                                        <option value="">Pilih {field.label}</option>
                                        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </InputField>
                                );
                            }
                            return (
                                <InputField
                                    key={field.name}
                                    {...field}
                                    value={formData[field.name] || ''}
                                    onChange={handleFormChange}
                                />
                            );
                        })}
                        {currentUser.role === 'admin_kecamatan' && (
                             <InputField label="Desa" name="desa" type="select" value={formData.desa || ''} onChange={handleFormChange} required>
                                <option value="">Pilih Desa</option>
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                             </InputField>
                        )}
                         <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                            <Button type="submit" variant="primary" isLoading={isSubmitting} className="ml-2">Simpan</Button>
                        </div>
                    </form>
                )}
            </Modal>

            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDelete} isLoading={isSubmitting} title={`Hapus Data ${config.title}`} message={`Yakin ingin menghapus data "${itemToDelete?.nama}"?`} />
            <ConfirmationModal isOpen={isDeleteSelectedConfirmOpen} onClose={() => setIsDeleteSelectedConfirmOpen(false)} onConfirm={handleDeleteSelected} isLoading={isSubmitting} title="Hapus Data Terpilih" message={`Yakin ingin menghapus ${selectedIds.length} data RW yang dipilih?`} />
        </div>
    );
};

export default RwPage;

