import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import { FiPlus, FiEdit, FiTrash2, FiSend, FiCheckSquare, FiLock, FiXSquare, FiInfo } from 'react-icons/fi';
import { KATEGORI_PENDAPATAN, KATEGORI_BELANJA, DESA_LIST } from '../utils/constants';
// [BARU] Impor fungsi notifikasi
import { createNotificationForAdmins, createNotificationForDesaAdmins } from '../utils/notificationService';

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
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? DESA_LIST[0] : currentUser.desa);
    
    // State baru untuk modal penolakan
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');


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
        const totalP = p.reduce((sum, a) => sum + (Number(a.jumlah) || 0), 0);
        const totalB = b.reduce((sum, a) => sum + (Number(a.jumlah) || 0), 0);
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
                status: 'Draft',
                alasanPenolakan: null // Hapus alasan penolakan saat diedit
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
        if (type === 'tolak') {
            setRejectionReason('');
            setIsRejectModalOpen(true);
        } else {
            setIsConfirmOpen(true);
        }
    };

    const executeAction = async () => {
        if (!itemToProcess || !actionType) return;
        setIsSubmitting(true);
        try {
            const docRef = doc(db, 'anggaran_tahunan', itemToProcess.id);
            if (actionType === 'delete') {
                // Logika baru untuk menghapus subkoleksi
                const realisasiQuery = query(collection(db, `anggaran_tahunan/${itemToProcess.id}/realisasi`));
                const realisasiSnapshot = await getDocs(realisasiQuery);
                
                const batch = writeBatch(db);
                
                realisasiSnapshot.forEach((realisasiDoc) => {
                    batch.delete(realisasiDoc.ref);
                });
                
                batch.delete(docRef);
                
                await batch.commit();
                showNotification('Anggaran beserta data realisasinya berhasil dihapus', 'success');
            } else {
                const newStatus = actionType === 'ajukan' ? 'Diajukan' : 'Disahkan';
                await updateDoc(docRef, { status: newStatus, alasanPenolakan: null });
                showNotification(`Anggaran berhasil ${newStatus.toLowerCase()}`, 'success');

                // [BARU] Logika pengiriman notifikasi
                if (actionType === 'ajukan') {
                    const message = `Pengajuan anggaran dari Desa ${itemToProcess.desa} (${itemToProcess.tahun}) menunggu persetujuan.`;
                    const link = `/app/keuangan/penganggaran`;
                    await createNotificationForAdmins(message, link, currentUser);
                } else if (actionType === 'sahkan') {
                    const message = `Pengajuan anggaran "${itemToProcess.uraian}" (${itemToProcess.tahun}) telah DISAHKAN.`;
                    const link = `/app/keuangan/penganggaran`;
                    await createNotificationForDesaAdmins(itemToProcess.desa, message, link);
                }
            }
        } catch (error) {
            showNotification(`Gagal: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsConfirmOpen(false);
            setItemToProcess(null);
        }
    };

    const handleRejectSubmit = async () => {
        if (!itemToProcess || !rejectionReason.trim()) {
            showNotification('Alasan penolakan tidak boleh kosong.', 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            const docRef = doc(db, 'anggaran_tahunan', itemToProcess.id);
            await updateDoc(docRef, { status: 'Ditolak', alasanPenolakan: rejectionReason });
            showNotification('Anggaran berhasil ditolak.', 'success');

            // [BARU] Kirim notifikasi penolakan
            const message = `Pengajuan anggaran "${itemToProcess.uraian}" (${itemToProcess.tahun}) DITOLAK.`;
            const link = `/app/keuangan/penganggaran`;
            await createNotificationForDesaAdmins(itemToProcess.desa, message, link);

        } catch (error) {
            showNotification(`Gagal menolak anggaran: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsRejectModalOpen(false);
            setItemToProcess(null);
            setRejectionReason('');
        }
    };

    const kategoriOptions = formData.jenis === 'Pendapatan' ? KATEGORI_PENDAPATAN : KATEGORI_BELANJA;
    const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
    
    const statusColors = {
        'Draft': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        'Diajukan': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        'Disahkan': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        'Ditolak': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };

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
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[item.status] || statusColors['Draft']}`}>
                                        {item.status}
                                    </span>
                                    {item.status === 'Ditolak' && item.alasanPenolakan && (
                                        <p className="text-xs text-red-500 italic mt-1" title={item.alasanPenolakan}>
                                            <FiInfo className="inline mr-1" />
                                            Alasan: {item.alasanPenolakan.substring(0, 30)}{item.alasanPenolakan.length > 30 ? '...' : ''}
                                        </p>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-center gap-2">
                                        {/* --- Tombol Admin Desa --- */}
                                        {currentUser.role === 'admin_desa' && (item.status === 'Draft' || item.status === 'Ditolak') && (
                                            <>
                                                <Button size="sm" variant="success" onClick={() => handleAction(item, 'ajukan')} title="Ajukan"><FiSend/></Button>
                                                <Button size="sm" variant="primary" onClick={() => handleOpenModal(item)} title="Edit"><FiEdit/></Button>
                                                <Button size="sm" variant="danger" onClick={() => handleAction(item, 'delete')} title="Hapus"><FiTrash2/></Button>
                                            </>
                                        )}

                                        {/* --- Tombol Admin Kecamatan --- */}
                                        {currentUser.role === 'admin_kecamatan' && item.status === 'Diajukan' && (
                                            <>
                                                <Button size="sm" variant="success" onClick={() => handleAction(item, 'sahkan')} title="Sahkan"><FiCheckSquare/></Button>
                                                <Button size="sm" variant="danger" onClick={() => handleAction(item, 'tolak')} title="Tolak"><FiXSquare/></Button>
                                            </>
                                        )}
                                        
                                        {currentUser.role === 'admin_kecamatan' && (item.status === 'Disahkan' || item.status === 'Ditolak') && (
                                             <Button size="sm" variant="danger" onClick={() => handleAction(item, 'delete')} title="Hapus Permanen"><FiTrash2/></Button>
                                        )}
                                        
                                        {/* --- Ikon Terkunci --- */}
                                        {item.status === 'Disahkan' && currentUser.role === 'admin_desa' && <FiLock className="text-gray-500 mx-auto" title="Terkunci"/>}
                                        {item.status === 'Diajukan' && currentUser.role === 'admin_desa' && <FiLock className="text-gray-500 mx-auto" title="Terkunci"/>}
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

    const getConfirmMessage = () => {
        if (!itemToProcess) return '';
        switch (actionType) {
            case 'ajukan': return `Anda yakin ingin mengajukan anggaran "${itemToProcess.uraian}" untuk disahkan?`;
            case 'sahkan': return `Anda yakin ingin mengesahkan anggaran "${itemToProcess.uraian}"?`;
            case 'delete': return `Anda yakin ingin menghapus anggaran "${itemToProcess.uraian}" beserta semua data realisasinya? Tindakan ini tidak dapat dibatalkan.`;
            default: return 'Apakah Anda yakin?';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Penganggaran APBDes</h1>
                <div className="flex items-center gap-4">
                     <InputField label="Tahun" type="select" value={filterTahun} onChange={(e) => setFilterTahun(Number(e.target.value))}>
                        {tahunOptions.map(th => <option key={th} value={th}>{th}</option>)}
                    </InputField>
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
                title={`Konfirmasi Aksi`}
                message={getConfirmMessage()}
            />

            <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Tolak Pengajuan Anggaran">
                <div className="space-y-4">
                    <p>Anda akan menolak pengajuan untuk: <strong className="font-semibold">{itemToProcess?.uraian}</strong>.</p>
                    <InputField
                        label="Alasan Penolakan"
                        name="rejectionReason"
                        type="textarea"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        required
                        placeholder="Jelaskan alasan mengapa pengajuan ini ditolak..."
                    />
                    <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
                        <Button type="button" variant="secondary" onClick={() => setIsRejectModalOpen(false)} disabled={isSubmitting}>Batal</Button>
                        <Button type="button" variant="danger" onClick={handleRejectSubmit} isLoading={isSubmitting}>Tolak Pengajuan</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PenganggaranPage;

