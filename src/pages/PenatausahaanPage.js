import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { FiPlus, FiEdit, FiTrash2, FiFilter, FiSearch } from 'react-icons/fi';
import { DESA_LIST, KATEGORI_PENDAPATAN, KATEGORI_BELANJA } from '../utils/constants';
import '../styles/AnimatedDeleteButton.css'; // Impor CSS untuk tombol animasi

const PenatausahaanPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [transaksiList, setTransaksiList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTransaksi, setSelectedTransaksi] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
    const [searchTerm, setSearchTerm] = useState('');
    const [animatingDeleteId, setAnimatingDeleteId] = useState(null);

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        let q = collection(db, 'keuangan');
        let constraints = [];
        
        if (currentUser.role === 'admin_desa') {
            constraints.push(where("desa", "==", currentUser.desa));
        } else if (filterDesa !== 'all') {
            constraints.push(where("desa", "==", filterDesa));
        }

        if (filterTahun) {
            constraints.push(where("tahunAnggaran", "==", Number(filterTahun)));
        }
        
        q = query(q, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransaksiList(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, filterDesa, filterTahun]);
    
    const filteredTransaksi = useMemo(() => {
        return transaksiList.filter(t => (t.uraian || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }, [transaksiList, searchTerm]);

    const handleOpenModal = (transaksi = null) => {
        setSelectedTransaksi(transaksi);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : '';
        setFormData(transaksi ? {...transaksi} : { jenis: 'Belanja', desa: initialDesa, tahunAnggaran: filterTahun, tanggal: new Date().toISOString().split('T')[0] });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setSelectedTransaksi(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        const newFormData = { ...formData, [name]: value };

        if (name === 'jenis') {
            newFormData.kategori = '';
            newFormData.bidang = '';
        }

        if (name === 'kategori') {
            const allKategori = [...KATEGORI_PENDAPATAN, ...KATEGORI_BELANJA];
            const selectedKat = allKategori.find(k => k.nama === value);
            if (selectedKat) {
                newFormData.bidang = selectedKat.bidang;
            }
        }
        setFormData(newFormData);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSave = { 
                ...formData, 
                jumlah: Number(formData.jumlah), 
                tahunAnggaran: Number(formData.tahunAnggaran) 
            };
            if (selectedTransaksi) {
                const docRef = doc(db, 'keuangan', selectedTransaksi.id);
                await updateDoc(docRef, dataToSave);
                showNotification('Transaksi berhasil diperbarui!', 'success');
            } else {
                await addDoc(collection(db, 'keuangan'), dataToSave);
                showNotification('Transaksi berhasil ditambahkan!', 'success');
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving transaction: ", error);
            showNotification(`Gagal menyimpan transaksi: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = (transaksi) => {
        setTransactionToDelete(transaksi);
        setIsDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!transactionToDelete) return;

        setIsSubmitting(true);
        setIsDeleteConfirmOpen(false);
        setAnimatingDeleteId(transactionToDelete.id);

        // Tunggu animasi selesai sebagian sebelum menghapus data
        setTimeout(async () => {
            try {
                await deleteDoc(doc(db, 'keuangan', transactionToDelete.id));
                showNotification("Transaksi berhasil dihapus.", 'success');
            } catch (error) {
                showNotification(`Gagal menghapus transaksi: ${error.message}`, 'error');
            } finally {
                // Beri waktu untuk animasi checkmark selesai
                setTimeout(() => {
                    setIsSubmitting(false);
                    setTransactionToDelete(null);
                    setAnimatingDeleteId(null);
                }, 1800);
            }
        }, 1500);
    };
    
    const kategoriOptions = formData.jenis === 'Pendapatan' ? KATEGORI_PENDAPATAN : KATEGORI_BELANJA;

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <InputField label="Tahun" type="number" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} />
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField label="Desa" type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                    <div className="pt-6">
                        <InputField type="text" placeholder="Cari uraian..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                    </div>
                </div>
                {currentUser.role === 'admin_desa' && (
                    <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <FiPlus /> Tambah Transaksi
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3">Tanggal</th>
                                <th className="px-6 py-3">Uraian</th>
                                {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                                <th className="px-6 py-3">Jenis</th>
                                <th className="px-6 py-3 text-right">Jumlah (Rp)</th>
                                <th className="px-6 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="6" className="text-center py-4"><Spinner /></td></tr> : 
                             filteredTransaksi.map(t => (
                                <tr key={t.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <td className="px-6 py-4">{t.tanggal}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{t.uraian}</td>
                                    {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{t.desa}</td>}
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.jenis === 'Pendapatan' ? 'bg-green-100 text-green-800 dark:bg-green-900/50' : 'bg-red-100 text-red-800 dark:bg-red-900/50'}`}>
                                            {t.jenis}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-right">{Number(t.jumlah).toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center space-x-2">
                                            {currentUser.role === 'admin_desa' && (
                                                <button onClick={() => handleOpenModal(t)} className="text-blue-500 hover:text-blue-700" title="Edit">
                                                    <FiEdit />
                                                </button>
                                            )}
                                            {(currentUser.role === 'admin_desa' || currentUser.role === 'admin_kecamatan') && (
                                                <button 
                                                    className={`button ${animatingDeleteId === t.id ? 'delete' : ''}`}
                                                    onClick={() => confirmDelete(t)}
                                                    disabled={isSubmitting}
                                                    title="Hapus"
                                                >
                                                    <div className="trash">
                                                        <div className="top">
                                                            <div className="paper"></div>
                                                        </div>
                                                        <div className="box"></div>
                                                        <div className="check">
                                                            <svg viewBox="0 0 8 6">
                                                                <polyline points="1 3.4 2.71428571 5 7 1"></polyline>
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedTransaksi ? "Edit Transaksi" : "Tambah Transaksi"}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <InputField label="Jenis Transaksi" name="jenis" type="select" value={formData.jenis} onChange={handleFormChange}>
                        <option value="Belanja">Belanja</option>
                        <option value="Pendapatan">Pendapatan</option>
                    </InputField>
                    <InputField label="Kategori" name="kategori" type="select" value={formData.kategori || ''} onChange={handleFormChange} required>
                        <option value="">-- Pilih Kategori --</option>
                        {kategoriOptions.map(k => <option key={k.nama} value={k.nama}>{k.nama}</option>)}
                    </InputField>
                    <InputField label="Uraian" name="uraian" type="text" value={formData.uraian || ''} onChange={handleFormChange} required />
                    <InputField label="Jumlah (Rp)" name="jumlah" type="number" value={formData.jumlah || ''} onChange={handleFormChange} required />
                    <InputField label="Tanggal Transaksi" name="tanggal" type="date" value={formData.tanggal || ''} onChange={handleFormChange} required />
                    <InputField label="Tahun Anggaran" name="tahunAnggaran" type="number" value={formData.tahunAnggaran || ''} onChange={handleFormChange} required />
                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 mr-2 bg-gray-300 dark:bg-gray-600 rounded-lg">Batal</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg" disabled={isSubmitting}>{isSubmitting ? <Spinner size="sm"/> : "Simpan"}</button>
                    </div>
                </form>
            </Modal>
            
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={executeDelete}
                isLoading={isSubmitting}
                title="Konfirmasi Hapus Transaksi"
                message={`Apakah Anda yakin ingin menghapus transaksi "${transactionToDelete?.uraian}"? Tindakan ini tidak dapat dibatalkan.`}
            />
        </div>
    );
};

export default PenatausahaanPage;

