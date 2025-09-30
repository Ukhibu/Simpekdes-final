import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, storage } from '../firebase';
import { collection, doc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useNotification } from '../context/NotificationContext';

import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import ConfirmationModal from '../components/common/ConfirmationModal';
import MapPicker from '../components/aset/MapPicker';
import { FiEdit, FiTrash2, FiSearch, FiFilter, FiPlus, FiUpload, FiDownload, FiEye, FiMapPin } from 'react-icons/fi';
import { KATEGORI_ASET, KONDISI_ASET, DESA_LIST } from '../utils/constants';

const AsetDetailView = ({ aset }) => {
    if (!aset) return null;
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('id-ID');
    };
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{aset.namaAset}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p><strong className="font-semibold">Kategori:</strong> {aset.kategori}</p>
                <p><strong className="font-semibold">Kode Barang:</strong> {aset.kodeBarang}</p>
                <p><strong className="font-semibold">Tanggal Perolehan:</strong> {formatDate(aset.tanggalPerolehan)}</p>
                <p><strong className="font-semibold">Nilai Aset (Rp):</strong> {Number(aset.nilaiAset).toLocaleString('id-ID')}</p>
                <p><strong className="font-semibold">Kondisi:</strong> {aset.kondisi}</p>
                <p><strong className="font-semibold">Lokasi Fisik:</strong> {aset.lokasiFisik}</p>
            </div>
            {aset.latitude && aset.longitude && (
                <div>
                    <h4 className="font-semibold mb-2">Lokasi di Peta</h4>
                    <div className="h-48 rounded-lg overflow-hidden">
                       <MapPicker initialPosition={[aset.latitude, aset.longitude]} viewOnly={true} />
                    </div>
                </div>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 pt-2 border-t dark:border-gray-700">
                <strong className="font-semibold">Keterangan:</strong> {aset.keterangan || '-'}
            </p>
        </div>
    );
};

const AsetDesa = () => {
    const { currentUser } = useAuth();
    const { data: allAset, loading, addItem, updateItem, deleteItem } = useFirestoreCollection('aset');
    const { showNotification } = useNotification();
    
    const [modalMode, setModalMode] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAset, setSelectedAset] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [filters, setFilters] = useState({ searchTerm: '', kategori: 'all', desa: 'all' });
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate(); // useNavigate ditambahkan

    useEffect(() => {
        if (currentUser.role === 'admin_desa') {
            setFilters(prev => ({ ...prev, desa: currentUser.desa }));
        }
    }, [currentUser]);

    // --- PERBAIKAN: Logika untuk menangani parameter URL 'view' dan 'edit' ---
    useEffect(() => {
        const viewId = searchParams.get('view');
        const editId = searchParams.get('edit');
        const assetId = viewId || editId;

        if (assetId && allAset.length > 0) {
            const asetToShow = allAset.find(a => a.id === assetId);
            if (asetToShow) {
                const mode = viewId ? 'view' : 'edit';
                handleOpenModal(asetToShow, mode);
                // Hapus parameter dari URL setelah modal dibuka
                setSearchParams({}, { replace: true });
            }
        }
    }, [allAset, searchParams, setSearchParams]);

    const handleOpenModal = (aset = null, mode = 'add') => {
        setModalMode(mode);
        setSelectedAset(aset);
        setFormData(aset || { desa: currentUser.desa, kondisi: 'Baik' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if(isSubmitting) return;
        setIsModalOpen(false);
        setSelectedAset(null);
        setFormData({});
    };
    
    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLocationChange = useCallback((location) => {
        setFormData(prev => ({
            ...prev,
            latitude: location.lat,
            longitude: location.lng
        }));
    }, []);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (selectedAset) {
                await updateItem(selectedAset.id, formData);
                showNotification('Aset berhasil diperbarui', 'success');
            } else {
                await addItem(formData);
                showNotification('Aset berhasil ditambahkan', 'success');
            }
            handleCloseModal();
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = (item) => {
        setItemToDelete(item);
        setIsDeleteConfirmOpen(true);
    };
    
    const executeDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteItem(itemToDelete.id);
            showNotification('Aset berhasil dihapus', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const filteredAset = useMemo(() => {
        return allAset.filter(aset => {
            const searchTermMatch = aset.namaAset.toLowerCase().includes(filters.searchTerm.toLowerCase());
            const kategoriMatch = filters.kategori === 'all' || aset.kategori === filters.kategori;
            const desaMatch = currentUser.role === 'admin_kecamatan'
                ? (filters.desa === 'all' || aset.desa === filters.desa)
                : aset.desa === currentUser.desa;
            return searchTermMatch && kategoriMatch && desaMatch;
        });
    }, [allAset, filters, currentUser]);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h1 className="text-2xl font-bold mb-4">Manajemen Aset Desa (KIB)</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <InputField name="searchTerm" placeholder="Cari nama aset..." value={filters.searchTerm} onChange={handleFilterChange} icon={<FiSearch />} />
                <InputField name="kategori" type="select" value={filters.kategori} onChange={handleFilterChange}>
                    <option value="all">Semua Kategori</option>
                    {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                </InputField>
                {currentUser.role === 'admin_kecamatan' && (
                    <InputField name="desa" type="select" value={filters.desa} onChange={handleFilterChange}>
                        <option value="all">Semua Desa</option>
                        {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                    </InputField>
                )}
                <button onClick={() => handleOpenModal(null, 'add')} className="w-full md:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                    <FiPlus /> Tambah Aset
                </button>
            </div>
            
            <div className="overflow-x-auto">
                {loading ? <Spinner /> : (
                    <table className="w-full text-sm">
                         <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3">Nama Aset</th>
                                <th className="px-6 py-3">Kategori</th>
                                {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                                <th className="px-6 py-3">Nilai (Rp)</th>
                                <th className="px-6 py-3">Kondisi</th>
                                <th className="px-6 py-3">Lokasi</th>
                                <th className="px-6 py-3">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAset.map(aset => (
                                <tr key={aset.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{aset.namaAset}</td>
                                    <td className="px-6 py-4">{aset.kategori}</td>
                                    {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{aset.desa}</td>}
                                    <td className="px-6 py-4 text-right">{Number(aset.nilaiAset).toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4">{aset.kondisi}</td>
                                    <td className="px-6 py-4 text-center">
                                        {aset.latitude && <FiMapPin className="text-green-500 mx-auto" title={`Lat: ${aset.latitude}, Lng: ${aset.longitude}`} />}
                                    </td>
                                    <td className="px-6 py-4 flex space-x-2">
                                        <button onClick={() => handleOpenModal(aset, 'view')} className="text-gray-500 hover:text-gray-700"><FiEye size={18} /></button>
                                        <button onClick={() => handleOpenModal(aset, 'edit')} className="text-blue-600 hover:text-blue-800"><FiEdit size={18} /></button>
                                        <button onClick={() => confirmDelete(aset)} className="text-red-600 hover:text-red-800"><FiTrash2 size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'add' ? 'Tambah Aset' : (modalMode === 'edit' ? 'Edit Aset' : 'Detail Aset')}>
                {modalMode === 'view' ? <AsetDetailView aset={selectedAset} /> : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Nama Aset" name="namaAset" value={formData.namaAset || ''} onChange={handleFormChange} required />
                            <InputField label="Kategori" name="kategori" type="select" value={formData.kategori || ''} onChange={handleFormChange} required>
                                <option value="">Pilih Kategori</option>
                                {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                            </InputField>
                            <InputField label="Kode Barang" name="kodeBarang" value={formData.kodeBarang || ''} onChange={handleFormChange} />
                            <InputField label="Tanggal Perolehan" name="tanggalPerolehan" type="date" value={formData.tanggalPerolehan || ''} onChange={handleFormChange} />
                            <InputField label="Nilai Aset (Rp)" name="nilaiAset" type="number" value={formData.nilaiAset || ''} onChange={handleFormChange} />
                            <InputField label="Kondisi" name="kondisi" type="select" value={formData.kondisi || ''} onChange={handleFormChange}>
                                {KONDISI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                            </InputField>
                            {currentUser.role === 'admin_kecamatan' && (
                                <InputField label="Desa" name="desa" type="select" value={formData.desa || ''} onChange={handleFormChange} required>
                                    <option value="">Pilih Desa</option>
                                    {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                                </InputField>
                            )}
                             <InputField label="Lokasi Fisik (Gedung/Ruangan)" name="lokasiFisik" value={formData.lokasiFisik || ''} onChange={handleFormChange} />
                        </div>
                        <InputField label="Keterangan" name="keterangan" type="textarea" value={formData.keterangan || ''} onChange={handleFormChange} />
                        
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi Aset di Peta</label>
                            <MapPicker
                                key={selectedAset ? selectedAset.id : 'new'}
                                initialPosition={
                                    formData.latitude && formData.longitude
                                        ? [formData.latitude, formData.longitude]
                                        : null
                                }
                                onLocationChange={handleLocationChange}
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md mr-2">Batal</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center">
                                {isSubmitting && <Spinner size="sm" />}
                                Simpan
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={executeDelete} isLoading={isSubmitting} title="Konfirmasi Hapus" message={`Yakin ingin menghapus aset ${itemToDelete?.namaAset}?`} />
        </div>
    );
};

export default AsetDesa;
