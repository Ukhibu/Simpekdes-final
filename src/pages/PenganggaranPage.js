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
import { FiPlus, FiEdit, FiTrash2, FiSend, FiCheckSquare, FiLock } from 'react-icons/fi';
import { KATEGORI_PENDAPATAN, KATEGORI_BELANJA, DESA_LIST } from '../utils/constants';

const PenganggaranPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    
    const [anggaranList, setAnggaranList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAnggaran, setSelectedAnggaran] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [itemToProcess, setItemToProcess] = useState(null);
    const [actionType, setActionType] = useState('');
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    // [BARU] State untuk filter desa oleh Admin Kecamatan
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? DESA_LIST[0] : currentUser.desa);

    useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, 'anggaran_tahunan'), 
            where("desa", "==", filterDesa),
            where("tahun", "==", Number(filterTahun))
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAnggaranList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [filterDesa, filterTahun]);

    const { pendapatan, belanja, totalAnggaranPendapatan, totalAnggaranBelanja } = useMemo(() => {
        const p = anggaranList.filter(a => a.jenis === 'Pendapatan');
        const b = anggaranList.filter(a => a.jenis === 'Belanja');
        const totalP = p.reduce((sum, a) => sum + a.jumlah, 0);
        const totalB = b.reduce((sum, a) => sum + a.jumlah, 0);
        return { pendapatan: p, belanja: b, totalAnggaranPendapatan: totalP, totalAnggaranBelanja: totalB };
    }, [anggaranList]);
    
    const formatCurrency = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`;

    const handleOpenModal = (item = null) => {
        setSelectedAnggaran(item);
        setFormData(item || { jenis: 'Belanja', desa: currentUser.desa, tahun: filterTahun, jumlah: 0, status: 'Draft' });
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

        if (name === 'kategori') {
            const allKategori = [...KATEGORI_PENDAPATAN, ...KATEGORI_BELANJA];
            const selectedKat = allKategori.find(k => k.nama === value);
            if (selectedKat) {
                updatedFormData = {
                    ...updatedFormData,
                    bidang: selectedKat.bidang,
                    kode_rekening: selectedKat.kode_rekening,
                    uraian: selectedKat.nama,
                };
            }
        }
        setFormData(updatedFormData);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const allKategori = [...KATEGORI_PENDAPATAN, ...KATEGORI_BELANJA];
            const selectedKat = allKategori.find(k => k.nama === formData.kategori);

            if (!formData.kategori || !selectedKat) {
                showNotification("Kategori wajib dipilih dan valid.", 'error');
                setIsSubmitting(false);
                return;
            }

            const dataToSave = {
                ...formData,
                jumlah: Number(formData.jumlah) || 0,
                tahun: Number(filterTahun),
                desa: currentUser.desa,
                bidang: selectedKat.bidang || '',
                kode_rekening: selectedKat.kode_rekening || '',
                uraian: selectedKat.nama || '',
                status: 'Draft' // Selalu kembali ke draft saat disimpan
            };

            if (selectedAnggaran) {
                await updateDoc(doc(db, 'anggaran_tahunan', selectedAnggaran.id), dataToSave);
                showNotification('Anggaran berhasil diperbarui', 'success');
            } else {
                await addDoc(collection(db, 'anggaran_tahunan'), dataToSave);
                showNotification('Anggaran berhasil ditambahkan', 'success');
            }
            handleCloseModal();
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleAction = (item, type) => {
        setItemToProcess(item);
        setActionType(type);
        setIsConfirmOpen(true);
    };

    const executeAction = async () => {
        if (!itemToProcess || !actionType) return;
        setIsSubmitting(true);
        try {
            const docRef = doc(db, 'anggaran_tahunan', itemToProcess.id);
            if (actionType === 'delete') {
                await deleteDoc(docRef);
                showNotification('Anggaran berhasil dihapus', 'success');
            } else {
                const newStatus = actionType === 'ajukan' ? 'Diajukan' : 'Disahkan';
                await updateDoc(docRef, { status: newStatus });
                showNotification(`Anggaran berhasil ${newStatus.toLowerCase()}`, 'success');
            }
        } catch (error) {
            showNotification(`Gagal: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsConfirmOpen(false);
            setItemToProcess(null);
        }
    };

    const kategoriOptions = formData.jenis === 'Pendapatan' ? KATEGORI_PENDAPATAN : KATEGORI_BELANJA;
    const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
    
    const renderTableSection = (title, data, colorClass) => (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h3 className={`text-xl font-semibold ${colorClass} mb-4`}>{title}</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-4 py-3">Kode Rekening</th>
                            <th className="px-4 py-3">Uraian</th>
                            <th className="px-4 py-3 text-right">Jumlah (Rp)</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length > 0 ? data.map(item => (
                            <tr key={item.id} className="border-b dark:border-gray-700">
                                <td className="px-4 py-3">{item.kode_rekening}</td>
                                <td className="px-4 py-3">{item.uraian}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(item.jumlah)}</td>
                                <td className="px-4 py-3 text-center">{item.status}</td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex justify-center gap-2">
                                        {item.status === 'Draft' && currentUser.role === 'admin_desa' && (
                                            <>
                                                <Button size="sm" variant="success" onClick={() => handleAction(item, 'ajukan')}><FiSend/></Button>
                                                <Button size="sm" variant="primary" onClick={() => handleOpenModal(item)}><FiEdit/></Button>
                                                <Button size="sm" variant="danger" onClick={() => handleAction(item, 'delete')}><FiTrash2/></Button>
                                            </>
                                        )}
                                        {currentUser.role === 'admin_kecamatan' && item.status === 'Diajukan' && (
                                            <Button size="sm" variant="success" onClick={() => handleAction(item, 'sahkan')}><FiCheckSquare/></Button>
                                        )}
                                        {item.status === 'Disahkan' && <FiLock className="text-gray-500 mx-auto" />}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="5" className="text-center py-6 italic text-gray-500">Belum ada data.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Penganggaran APBDes</h1>
                <div className="flex items-center gap-4">
                     <InputField label="Tahun" type="select" value={filterTahun} onChange={(e) => setFilterTahun(Number(e.target.value))}>
                        {tahunOptions.map(th => <option key={th} value={th}>{th}</option>)}
                    </InputField>
                    {/* [BARU] Filter Desa untuk Admin Kecamatan */}
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField label="Desa" type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)}>
                             {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                        </InputField>
                    )}
                    {currentUser.role === 'admin_desa' && (
                        <Button onClick={() => handleOpenModal()} variant="primary" className="self-end"><FiPlus/> Tambah</Button>
                    )}
                </div>
            </div>
            
            {loading ? <Spinner /> : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md text-center">
                            <p className="text-sm text-green-600 dark:text-green-400 font-bold">Total Anggaran Pendapatan</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalAnggaranPendapatan)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md text-center">
                            <p className="text-sm text-red-600 dark:text-red-400 font-bold">Total Anggaran Belanja</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalAnggaranBelanja)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md text-center">
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-bold">Surplus / (Defisit)</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalAnggaranPendapatan - totalAnggaranBelanja)}</p>
                        </div>
                    </div>
                    {renderTableSection("Pendapatan", pendapatan, "text-green-600 dark:text-green-400")}
                    {renderTableSection("Belanja", belanja, "text-red-600 dark:text-red-400")}
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedAnggaran ? "Edit Anggaran" : "Tambah Anggaran"}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <InputField label="Jenis" name="jenis" type="select" value={formData.jenis || 'Belanja'} onChange={handleFormChange}>
                        <option value="Pendapatan">Pendapatan</option>
                        <option value="Belanja">Belanja</option>
                    </InputField>
                    <InputField label="Kategori" name="kategori" type="select" value={formData.kategori || ''} onChange={handleFormChange} required>
                        <option value="">-- Pilih Kategori --</option>
                        {kategoriOptions.map(k => <option key={k.nama} value={k.nama}>{k.nama}</option>)}
                    </InputField>
                    <InputField label="Jumlah (Rp)" name="jumlah" type="number" value={formData.jumlah || ''} onChange={handleFormChange} required />
                    <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
                        <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting}>Simpan</Button>
                    </div>
                </form>
            </Modal>
            
            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={executeAction}
                isLoading={isSubmitting}
                title={`Konfirmasi ${actionType}`}
                message={`Anda yakin ingin ${actionType} anggaran "${itemToProcess?.uraian}"?`}
            />
        </div>
    );
};

export default PenganggaranPage;

