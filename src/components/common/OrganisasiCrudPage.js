import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import Spinner from './Spinner';
import InputField from './InputField';
import { FiSearch, FiFilter, FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import { DESA_LIST } from '../../utils/constants';

const OrganisasiCrudPage = ({ config }) => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    // PERBAIKAN: Inisialisasi state filter desa ke 'all' sebagai default yang aman.
    const [filterDesa, setFilterDesa] = useState('all');

    // PERBAIKAN: Menggunakan useEffect untuk mengatur filterDesa dengan aman setelah currentUser tersedia.
    // Ini mencegah kondisi di mana filter salah diterapkan pada render pertama.
    useEffect(() => {
        if (currentUser) {
            setFilterDesa(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser || !config.collectionName) {
            if (currentUser && currentUser.role === 'admin_desa' && filterDesa === 'all') {
                return;
            }
            setLoading(false);
            return;
        };
        setLoading(true);

        const dataCollection = collection(db, config.collectionName);
        let q;

        if (currentUser.role === 'admin_desa') {
            q = query(dataCollection, where("desa", "==", currentUser.desa));
        } else if (filterDesa !== 'all') {
            q = query(dataCollection, where("desa", "==", filterDesa));
        } else {
            q = query(dataCollection);
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
    }, [currentUser, config.collectionName, filterDesa, showNotification]);

    const filteredData = useMemo(() => {
        return dataList.filter(item => {
            const firstField = config.formFields[0]?.name;
            if (!firstField) return true;
            return (item[firstField] || '').toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [dataList, searchTerm, config.formFields]);
    
    const handleOpenModal = (item = null) => {
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
        if (!formData.desa && config.formFields.some(f => f.name === 'desa')) {
            showNotification("Desa wajib diisi!", 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            if (selectedItem) {
                const docRef = doc(db, config.collectionName, selectedItem.id);
                await updateDoc(docRef, formData);
                showNotification(`${config.title} berhasil diperbarui!`, 'success');
            } else {
                await addDoc(collection(db, config.collectionName), formData);
                showNotification(`${config.title} berhasil ditambahkan!`, 'success');
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

    const closeDeleteConfirm = () => {
        setItemToDelete(null);
        setIsDeleteConfirmOpen(false);
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
            closeDeleteConfirm();
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <InputField 
                        type="text" 
                        placeholder={`Cari ${config.formFields[0]?.label || 'data'}...`} 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        icon={<FiSearch />} 
                    />
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} icon={<FiFilter />}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                </div>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <FiPlus /> Tambah Data
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                            <tr>
                                {config.formFields.slice(0, 4).map(field => (
                                    <th key={field.name} className="px-6 py-3">{field.label}</th>
                                ))}
                                <th className="px-6 py-3">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-4"><Spinner /></td></tr>
                            ) : filteredData.map(item => (
                                <tr key={item.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    {config.formFields.slice(0, 4).map(field => (
                                        <td key={field.name} className="px-6 py-4">{item[field.name] || '-'}</td>
                                    ))}
                                    <td className="px-6 py-4 flex items-center space-x-2">
                                        <button onClick={() => handleOpenModal(item)} className="text-blue-500 hover:text-blue-700"><FiEdit /></button>
                                        <button onClick={() => openDeleteConfirm(item)} className="text-red-500 hover:text-red-700"><FiTrash2 /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
            
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedItem ? `Edit ${config.title}` : `Tambah ${config.title}`}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    {config.formFields.map(field => (
                        <InputField
                            key={field.name}
                            label={field.label}
                            name={field.name}
                            type={field.type}
                            value={formData[field.name] || ''}
                            onChange={handleFormChange}
                            required={field.required}
                            placeholder={field.placeholder}
                        >
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
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 mr-2 bg-gray-300 dark:bg-gray-600 rounded-lg">Batal</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg" disabled={isSubmitting}>{isSubmitting ? <Spinner size="sm"/> : "Simpan"}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={closeDeleteConfirm}
                onConfirm={handleDelete}
                isLoading={isSubmitting}
                title={`Hapus Data ${config.title}`}
                message={`Apakah Anda yakin ingin menghapus data "${itemToDelete ? itemToDelete[config.formFields[0]?.name] : ''}"?`}
            />
        </div>
    );
};

export default OrganisasiCrudPage;
