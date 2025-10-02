import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, collectionGroup } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiFilter } from 'react-icons/fi';
import { DESA_LIST } from '../utils/constants';

const PenatausahaanPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [realisasiList, setRealisasiList] = useState([]);
    const [anggaranSah, setAnggaranSah] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRealisasi, setSelectedRealisasi] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? DESA_LIST[0] : currentUser.desa);
    
    // [BARU] State untuk menyimpan info sisa anggaran
    const [selectedAnggaranInfo, setSelectedAnggaranInfo] = useState(null);

    const formatCurrency = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`;
    
    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        const fetchData = async () => {
            try {
                const anggaranQuery = query(
                    collection(db, 'anggaran_tahunan'),
                    where("desa", "==", filterDesa),
                    where("tahun", "==", Number(filterTahun)),
                    where("status", "in", ["Disahkan", "Perubahan"])
                );
                const anggaranSnapshot = await getDocs(anggaranQuery);
                const sahList = anggaranSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAnggaranSah(sahList);

                if (sahList.length === 0) {
                    setRealisasiList([]);
                    setLoading(false);
                    return;
                }

                const realisasiQuery = query(
                    collectionGroup(db, 'realisasi'),
                    where('parentDesa', '==', filterDesa)
                );

                const unsub = onSnapshot(realisasiQuery, (snapshot) => {
                    const allRealisasi = snapshot.docs.map(d => {
                        const data = d.data();
                        const parentAnggaran = sahList.find(a => a.id === data.parentAnggaranId);
                        return {
                            id: d.id,
                            ...data,
                            parentUraian: parentAnggaran?.uraian || 'N/A',
                            jenis: parentAnggaran?.jenis || 'N/A',
                        };
                    }).filter(r => r.parentAnggaranId); // Filter yang tidak punya parent (jaga-jaga)
                    
                    setRealisasiList(allRealisasi);
                    setLoading(false);
                });
                
                return unsub;

            } catch (error) {
                console.error("Error fetching data:", error);
                showNotification("Gagal memuat data penatausahaan.", 'error');
                setLoading(false);
            }
        };

        const unsubscribe = fetchData();

        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };

    }, [currentUser, filterTahun, filterDesa, showNotification]);
    
    const filteredRealisasi = useMemo(() => {
        return realisasiList.filter(t => (t.uraian || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }, [realisasiList, searchTerm]);

    const handleOpenModal = (item = null) => {
        setSelectedRealisasi(item);
        setSelectedAnggaranInfo(null);
        if (item) {
            const parentAnggaran = anggaranSah.find(a => a.id === item.parentAnggaranId);
            if (parentAnggaran) {
                const realisasiSaatIni = realisasiList
                    .filter(r => r.parentAnggaranId === item.parentAnggaranId && r.id !== item.id)
                    .reduce((sum, r) => sum + r.jumlah, 0);
                setSelectedAnggaranInfo({
                    total: parentAnggaran.jumlah,
                    terealisasi: realisasiSaatIni,
                    sisa: parentAnggaran.jumlah - realisasiSaatIni
                });
            }
            setFormData(item);
        } else {
            setFormData({ 
                tanggal: new Date().toISOString().split('T')[0],
                parentAnggaranId: '',
                jumlah: 0,
                uraian: '',
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if(isSubmitting) return;
        setIsModalOpen(false);
        setSelectedRealisasi(null);
    };

    const handleFormChange = e => {
        const { name, value } = e.target;
        const newFormData = { ...formData, [name]: value };

        if (name === 'parentAnggaranId') {
            const selected = anggaranSah.find(a => a.id === value);
            if (selected) {
                const realisasiSaatIni = realisasiList
                    .filter(r => r.parentAnggaranId === value)
                    .reduce((sum, r) => sum + r.jumlah, 0);
                
                setSelectedAnggaranInfo({
                    total: selected.jumlah,
                    terealisasi: realisasiSaatIni,
                    sisa: selected.jumlah - realisasiSaatIni
                });
                newFormData.uraian = selected.uraian;
            } else {
                setSelectedAnggaranInfo(null);
                newFormData.uraian = '';
            }
        }
        setFormData(newFormData);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        if (selectedAnggaranInfo && !selectedRealisasi) {
            if (Number(formData.jumlah) > selectedAnggaranInfo.sisa) {
                showNotification(`Jumlah realisasi melebihi sisa anggaran.`, 'error');
                return;
            }
        }
        
        setIsSubmitting(true);
        try {
            const { parentAnggaranId, ...realisasiData } = formData;
            const targetAnggaranId = selectedRealisasi ? selectedRealisasi.parentAnggaranId : parentAnggaranId;

            if (!targetAnggaranId) throw new Error("Mata Anggaran harus dipilih.");

            const dataToSave = {
                ...realisasiData,
                jumlah: Number(realisasiData.jumlah) || 0,
                tanggal: new Date(realisasiData.tanggal),
                parentDesa: filterDesa, // [BARU] untuk mempermudah query
                parentAnggaranId: targetAnggaranId,
            };

            if (selectedRealisasi) {
                await updateDoc(doc(db, `anggaran_tahunan/${targetAnggaranId}/realisasi`, selectedRealisasi.id), dataToSave);
                showNotification('Realisasi berhasil diperbarui!', 'success');
            } else {
                await addDoc(collection(db, `anggaran_tahunan/${targetAnggaranId}/realisasi`), dataToSave);
                showNotification('Realisasi berhasil ditambahkan!', 'success');
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
            await deleteDoc(doc(db, `anggaran_tahunan/${itemToDelete.parentAnggaranId}/realisasi`, itemToDelete.id));
            showNotification('Realisasi berhasil dihapus', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };
    
    const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex justify-between items-center">
                <div className="flex items-center gap-4 flex-wrap">
                    <InputField label="Tahun" type="select" value={filterTahun} onChange={e => setFilterTahun(e.target.value)}>
                         {tahunOptions.map(th => <option key={th} value={th}>{th}</option>)}
                    </InputField>
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField label="Desa" type="select" value={filterDesa} onChange={e => setFilterDesa(e.target.value)}>
                            {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                        </InputField>
                    )}
                </div>
                {currentUser.role === 'admin_desa' && (
                    <Button onClick={() => handleOpenModal()} variant="primary"><FiPlus /> Tambah Realisasi</Button>
                )}
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Buku Kas Umum (Realisasi)</h2>
                    <InputField type="text" placeholder="Cari uraian..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3">Tanggal</th>
                                <th className="px-6 py-3">Uraian Transaksi</th>
                                <th className="px-6 py-3">Mata Anggaran</th>
                                <th className="px-6 py-3">Jenis</th>
                                <th className="px-6 py-3 text-right">Jumlah (Rp)</th>
                                {currentUser.role === 'admin_desa' && <th className="px-6 py-3 text-center">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="6" className="text-center py-4"><Spinner /></td></tr> : 
                             filteredRealisasi.map(t => (
                                <tr key={t.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                    <td className="px-6 py-4">{(t.tanggal.toDate ? t.tanggal.toDate() : new Date(t.tanggal)).toLocaleDateString('id-ID')}</td>
                                    <td className="px-6 py-4">{t.uraian}</td>
                                    <td className="px-6 py-4 text-xs italic">{t.parentUraian}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs ${t.jenis === 'Pendapatan' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{t.jenis}</span></td>
                                    <td className="px-6 py-4 text-right font-semibold">{Number(t.jumlah).toLocaleString('id-ID')}</td>
                                    {currentUser.role === 'admin_desa' && (
                                    <td className="px-6 py-4 text-center"><div className="flex justify-center gap-4">
                                        <Button size="sm" variant="primary" onClick={() => handleOpenModal(t)}><FiEdit/></Button>
                                        <Button size="sm" variant="danger" onClick={() => confirmDelete(t)}><FiTrash2/></Button>
                                    </div></td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedRealisasi ? "Edit Realisasi" : "Tambah Realisasi"}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <InputField label="Mata Anggaran" name="parentAnggaranId" type="select" value={formData.parentAnggaranId || ''} onChange={handleFormChange} required disabled={!!selectedRealisasi}>
                        <option value="">-- Pilih Mata Anggaran Yang Disahkan --</option>
                        {anggaranSah.map(a => <option key={a.id} value={a.id}>{a.uraian} ({a.jenis})</option>)}
                    </InputField>

                    {selectedAnggaranInfo && (
                        <div className="p-3 bg-blue-50 dark:bg-gray-700 rounded-lg text-sm space-y-1">
                            <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Total Anggaran:</span><span className="font-semibold">{formatCurrency(selectedAnggaranInfo.total)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Sudah Terealisasi:</span><span className="font-semibold text-yellow-600">{formatCurrency(selectedAnggaranInfo.terealisasi)}</span></div>
                            <div className="flex justify-between border-t pt-1 mt-1 dark:border-gray-600"><span className="text-gray-600 dark:text-gray-400 font-bold">Sisa Anggaran:</span><span className="font-bold text-green-600">{formatCurrency(selectedAnggaranInfo.sisa)}</span></div>
                        </div>
                    )}
                    
                    <InputField label="Uraian Transaksi" name="uraian" type="text" value={formData.uraian || ''} onChange={handleFormChange} required />
                    <InputField label="Jumlah (Rp)" name="jumlah" type="number" value={formData.jumlah || ''} onChange={handleFormChange} required />
                    <InputField label="Tanggal Transaksi" name="tanggal" type="date" value={formData.tanggal || ''} onChange={handleFormChange} required />

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>Batal</Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting} className="ml-2">Simpan</Button>
                    </div>
                </form>
            </Modal>
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={executeDelete} isLoading={isSubmitting} title="Konfirmasi Hapus" message={`Yakin ingin menghapus realisasi "${itemToDelete?.uraian}"?`} />
        </div>
    );
};

export default PenatausahaanPage;

