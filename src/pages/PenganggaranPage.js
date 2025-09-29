import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import { DESA_LIST, BIDANG_BELANJA, KATEGORI_PENDAPATAN } from '../utils/constants';

const PenganggaranPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [anggaranList, setAnggaranList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAnggaran, setSelectedAnggaran] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());

    useEffect(() => {
        if (!currentUser || !currentUser.desa) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "anggaran"),
            where("desa", "==", currentUser.desa),
            where("tahunAnggaran", "==", Number(filterTahun))
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAnggaranList(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, filterTahun]);

    const { pendapatan, belanja } = useMemo(() => {
        const pendapatan = anggaranList.filter(a => a.jenis === 'Pendapatan');
        const belanja = BIDANG_BELANJA.map(bidangInfo => ({
            ...bidangInfo,
            items: anggaranList.filter(a => a.jenis === 'Belanja' && a.bidang === bidangInfo.bidang)
        }));
        return { pendapatan, belanja };
    }, [anggaranList]);

    const handleOpenModal = (item = null) => {
        setSelectedAnggaran(item);
        if (item) {
            setFormData(item);
        } else {
            setFormData({
                jenis: 'Belanja',
                desa: currentUser.desa,
                tahunAnggaran: filterTahun,
                jumlah: 0
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setSelectedAnggaran(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        let updatedFormData = { ...formData, [name]: value };

        if (name === 'jenis') {
            updatedFormData.kategori = '';
            updatedFormData.bidang = '';
        }
        
        if (name === 'kategori' && formData.jenis === 'Belanja') {
            const selectedBidang = BIDANG_BELANJA.find(b => b.nama === value);
            updatedFormData.bidang = selectedBidang ? selectedBidang.bidang : '';
        }

        setFormData(updatedFormData);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSave = {
                ...formData,
                jumlah: Number(formData.jumlah),
                tahunAnggaran: Number(filterTahun)
            };

            if (selectedAnggaran) {
                await updateDoc(doc(db, 'anggaran', selectedAnggaran.id), dataToSave);
                showNotification('Anggaran berhasil diperbarui', 'success');
            } else {
                await addDoc(collection(db, 'anggaran'), dataToSave);
                showNotification('Anggaran berhasil ditambahkan', 'success');
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
            await deleteDoc(doc(db, 'anggaran', itemToDelete.id));
            showNotification('Anggaran berhasil dihapus', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };


    const renderTable = (title, data, isBelanja = false) => (
        <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                        <tr>
                            <th className="px-6 py-3">Kategori / Nama Anggaran</th>
                            <th className="px-6 py-3 text-right">Jumlah (Rp)</th>
                            <th className="px-6 py-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isBelanja ? (
                            data.map((bidang, idx) => (
                                <React.Fragment key={idx}>
                                    <tr className="bg-gray-50 dark:bg-gray-700 font-bold">
                                        <td colSpan="3" className="px-4 py-2 text-gray-800 dark:text-gray-200">{bidang.bidang}</td>
                                    </tr>
                                    {bidang.items.length > 0 ? bidang.items.map(item => (
                                         <tr key={item.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                             <td className="px-6 py-4 pl-8">{item.kategori}</td>
                                             <td className="px-6 py-4 text-right">{Number(item.jumlah).toLocaleString('id-ID')}</td>
                                             <td className="px-6 py-4 text-center flex justify-center gap-4">
                                                 <button onClick={() => handleOpenModal(item)} className="text-blue-500 hover:text-blue-700"><FiEdit /></button>
                                                 <button onClick={() => confirmDelete(item)} className="text-red-500 hover:text-red-700"><FiTrash2 /></button>
                                             </td>
                                         </tr>
                                    )) : (
                                        <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500 italic">Belum ada anggaran untuk bidang ini.</td></tr>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                             data.length > 0 ? data.map(item => (
                                <tr key={item.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <td className="px-6 py-4">{item.kategori}</td>
                                    <td className="px-6 py-4 text-right">{Number(item.jumlah).toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4 text-center flex justify-center gap-4">
                                        <button onClick={() => handleOpenModal(item)} className="text-blue-500 hover:text-blue-700"><FiEdit /></button>
                                        <button onClick={() => confirmDelete(item)} className="text-red-500 hover:text-red-700"><FiTrash2 /></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-500 italic">Belum ada anggaran.</td></tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Penganggaran APBDes</h1>
                <div className="flex items-center gap-4">
                    <InputField label="Tahun Anggaran" type="number" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} />
                    <Button onClick={() => handleOpenModal()} variant="primary" className="self-end"><FiPlus/> Tambah Anggaran</Button>
                </div>
            </div>
            
            {loading ? <Spinner /> : (
                <div className="space-y-6">
                    {renderTable("Anggaran Pendapatan", pendapatan)}
                    {renderTable("Anggaran Belanja", belanja, true)}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedAnggaran ? "Edit Anggaran" : "Tambah Anggaran"}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <InputField label="Jenis" name="jenis" type="select" value={formData.jenis || 'Belanja'} onChange={handleFormChange}>
                        <option value="Pendapatan">Pendapatan</option>
                        <option value="Belanja">Belanja</option>
                    </InputField>

                    {formData.jenis === 'Pendapatan' ? (
                        <InputField key="pendapatan-select" label="Kategori Pendapatan" name="kategori" type="select" value={formData.kategori || ''} onChange={handleFormChange} required>
                            <option value="">Pilih Kategori</option>
                            {KATEGORI_PENDAPATAN.map(k => <option key={k} value={k}>{k}</option>)}
                        </InputField>
                    ) : (
                         <InputField key="belanja-select" label="Kategori Belanja" name="kategori" type="select" value={formData.kategori || ''} onChange={handleFormChange} required>
                            <option value="">Pilih Kategori Belanja</option>
                            {BIDANG_BELANJA.map((item, index) => (
                                <option key={index} value={item.nama}>
                                    {item.nama}
                                </option>
                            ))}
                        </InputField>
                    )}
                    
                    <InputField label="Jumlah (Rp)" name="jumlah" type="number" value={formData.jumlah || ''} onChange={handleFormChange} required />

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <Button type="button" variant="secondary" onClick={handleCloseModal} className="mr-2">Batal</Button>
                        <Button type="submit" isLoading={isSubmitting}>{selectedAnggaran ? "Simpan Perubahan" : "Simpan"}</Button>
                    </div>
                </form>
            </Modal>
            
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={executeDelete}
                isLoading={isSubmitting}
                title="Konfirmasi Hapus Anggaran"
                message={`Anda yakin ingin menghapus anggaran "${itemToDelete?.kategori}"?`}
            />

        </div>
    );
};

export default PenganggaranPage;

