import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import Spinner from './Spinner';
import InputField from './InputField';
import Button from './Button';
import OrganisasiDetailView from './OrganisasiDetailView';
import { FiSearch, FiFilter, FiPlus, FiEdit, FiTrash2, FiEye, FiUpload, FiDownload } from 'react-icons/fi';
import { DESA_LIST } from '../../utils/constants';
import * as XLSX from 'xlsx';
import { generateOrganisasiXLSX } from '../../utils/generateOrganisasiXLSX';
import { createNotificationForAdmins } from '../../utils/notificationService';
import { useSearchParams } from 'react-router-dom';

const OrganisasiCrudPage = ({ config, allPerangkat = [] }) => {
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
    const [exportConfig, setExportConfig] = useState(null);
    const [searchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);

    useEffect(() => {
        const highlightId = searchParams.get('highlight');
        if (highlightId) {
            setHighlightedRow(highlightId);
            const timer = setTimeout(() => setHighlightedRow(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    useEffect(() => {
        if (currentUser) {
            setFilterDesa(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
        }
    }, [currentUser]);

    useEffect(() => {
        const fetchExportConfig = async () => {
             const { getDoc } = await import('firebase/firestore');
             const docRef = doc(db, 'settings', 'exportConfig');
             const docSnap = await getDoc(docRef);
             if (docSnap.exists()) setExportConfig(docSnap.data());
        };
        fetchExportConfig();
    }, []);

    useEffect(() => {
        if (!currentUser || !config.collectionName) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const dataCollection = collection(db, config.collectionName);
        let q = query(dataCollection);
        if (currentUser.role === 'admin_desa') {
            q = query(dataCollection, where("desa", "==", currentUser.desa));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDataList(list);
            setLoading(false);
        }, (error) => {
            console.error(`Error fetching ${config.collectionName}:`, error);
            showNotification(`Gagal memuat data: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, config.collectionName, showNotification]);

    const filteredData = useMemo(() => {
        let data = dataList;
        if (currentUser.role === 'admin_kecamatan' && filterDesa !== 'all') {
            data = data.filter(item => item.desa === filterDesa);
        }
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(item => (item.nama || '').toLowerCase().includes(searchLower));
        }
        return data;
    }, [dataList, searchTerm, filterDesa, currentUser.role]);
    
    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : '';
        const initialDate = config.formFields.some(f => f.type === 'date') ? { [config.formFields.find(f => f.type ==='date').name] : new Date().toISOString().split('T')[0] } : {};
        setFormData(item ? { ...item } : { desa: initialDesa, ...initialDate });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setSelectedItem(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        const { name, value, type } = e.target;
        setFormData({ ...formData, [name]: type === 'number' ? Number(value) : value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.desa) {
            showNotification("Desa wajib diisi!", 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            let docId = selectedItem ? selectedItem.id : null;
            if (selectedItem) {
                const docRef = doc(db, config.collectionName, selectedItem.id);
                await updateDoc(docRef, formData);
                showNotification(`${config.title} berhasil diperbarui!`, 'success');
            } else {
                const newDocRef = await addDoc(collection(db, config.collectionName), formData);
                docId = newDocRef.id;
                showNotification(`${config.title} berhasil ditambahkan!`, 'success');
            }

            if (currentUser.role === 'admin_desa' && docId) {
                const action = selectedItem ? 'memperbarui' : 'menambahkan';
                const message = `Admin Desa ${currentUser.desa} telah ${action} data ${config.title}: "${formData.nama}".`;
                const link = `/app/${config.subModule}/data?desa=${currentUser.desa}&highlight=${docId}`;
                await createNotificationForAdmins(message, link);
            }

            handleCloseModal();
        } catch (error) {
            console.error(`Error saving ${config.title}:`, error);
            showNotification(`Gagal menyimpan ${config.title}.`, 'error');
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
            showNotification('Data berhasil dihapus.', 'success');
        } catch(error) {
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
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonDataWithHeaders = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 2 });
                if (jsonDataWithHeaders.length < 2) throw new Error("Format file tidak sesuai.");
                const header = jsonDataWithHeaders[0];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 3, header: header });
                if (jsonData.length === 0) throw new Error("File Excel tidak berisi data.");
                const batch = writeBatch(db);
                let newEntriesCount = 0;
                jsonData.forEach(row => {
                    const newDoc = {};
                    config.formFields.forEach(field => {
                        if (row[field.label] !== undefined) {
                            let value = row[field.label];
                            if (field.type === 'date' && value instanceof Date) {
                                const userTimezoneOffset = value.getTimezoneOffset() * 60000;
                                value = new Date(value.getTime() - userTimezoneOffset).toISOString().split('T')[0];
                            }
                            newDoc[field.name] = value;
                        }
                    });
                    if (currentUser.role === 'admin_desa') {
                        newDoc.desa = currentUser.desa;
                    } else if (row['Desa']) {
                        newDoc.desa = row['Desa'];
                    } else { return; }
                    if (newDoc.nama && newDoc.jabatan && newDoc.desa) {
                        const newDocRef = doc(collection(db, config.collectionName));
                        batch.set(newDocRef, newDoc);
                        newEntriesCount++;
                    }
                });
                if (newEntriesCount > 0) {
                    await batch.commit();
                    showNotification(`${newEntriesCount} data baru berhasil diimpor.`, 'success');
                } else {
                    showNotification("Tidak ada data baru yang valid untuk diimpor.", 'info');
                }
            } catch (error) {
                showNotification(`Gagal memproses file: ${error.message}`, 'error');
            } finally {
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExportXLSX = () => {
        if (filteredData.length === 0) {
            showNotification("Tidak ada data untuk diekspor.", "warning");
            return;
        }
        
        const exportDetails = {
            config,
            dataToExport: filteredData,
            role: currentUser.role,
            desa: currentUser.role === 'admin_desa' ? currentUser.desa : filterDesa,
            exportConfig,
            allPerangkat,
        };
        
        generateOrganisasiXLSX(exportDetails);
    };
    
    const getModalTitle = () => {
        if (modalMode === 'view') return `Detail ${config.title}`;
        if (modalMode === 'edit') return `Edit ${config.title}`;
        return `Tambah ${config.title}`;
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <InputField type="text" placeholder={`Cari nama...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} icon={<FiFilter />}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                </div>
                 <div className="flex flex-wrap gap-2">
                    <label className="btn btn-warning cursor-pointer">
                        <FiUpload className="mr-2"/> Impor Data
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls"/>
                    </label>
                    <Button onClick={handleExportXLSX} variant="success"><FiDownload className="mr-2"/> Ekspor Data</Button>
                    <Button onClick={() => handleOpenModal('add')} variant="primary"><FiPlus className="mr-2"/> Tambah Data</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                            <tr>
                                {(config.tableColumns || config.formFields.slice(0, 4).map(f => f.name)).map(fieldName => {
                                    const field = config.formFields.find(f => f.name === fieldName);
                                    return field ? <th key={field.name} className="px-6 py-3">{field.label}</th> : null;
                                })}
                                <th className="px-6 py-3">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-4"><Spinner /></td></tr>
                            ) : filteredData.length > 0 ? filteredData.map(item => (
                                <tr key={item.id} className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${highlightedRow === item.id ? 'highlight-row' : ''}`}>
                                    {(config.tableColumns || config.formFields.slice(0, 4).map(f => f.name)).map(fieldName => (
                                        <td key={fieldName} className="px-6 py-4">{item[fieldName] || '-'}</td>
                                    ))}
                                    <td className="px-6 py-4 flex items-center space-x-3">
                                        <button onClick={() => handleOpenModal('view', item)} className="text-green-500 hover:text-green-700" title="Lihat Detail"><FiEye /></button>
                                        <button onClick={() => handleOpenModal('edit', item)} className="text-blue-500 hover:text-blue-700" title="Edit"><FiEdit /></button>
                                        <button onClick={() => openDeleteConfirm(item)} className="text-red-500 hover:text-red-700" title="Hapus"><FiTrash2 /></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={(config.tableColumns || config.formFields.slice(0, 4)).length + 1} className="text-center py-10 text-gray-500">Data tidak ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
            
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={getModalTitle()}>
                {modalMode === 'view' ? (
                    <OrganisasiDetailView data={selectedItem} config={config} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        {config.formFields.map(field => (
                            <InputField key={field.name} label={field.label} name={field.name} type={field.type} value={formData[field.name] || ''} onChange={handleFormChange} required={field.required} placeholder={field.placeholder}>
                                {field.type === 'select' && (
                                    <>
                                        <option value="">-- Pilih {field.label} --</option>
                                        {field.options && field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </>
                                )}
                            </InputField>
                        ))}
                        {currentUser.role === 'admin_kecamatan' && (
                             <InputField label="Desa" name="desa" type="select" value={formData.desa} onChange={handleFormChange} required>
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

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                isLoading={isSubmitting}
                title={`Hapus Data ${config.title}`}
                message={`Apakah Anda yakin ingin menghapus data "${itemToDelete?.nama}"?`}
            />
        </div>
    );
};

export default OrganisasiCrudPage;

