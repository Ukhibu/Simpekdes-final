import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSearchParams } from 'react-router-dom';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import { FiPlus, FiEdit, FiTrash2, FiSend, FiCheckSquare, FiLock, FiXSquare, FiInfo, FiTrendingUp, FiTrendingDown, FiPieChart, FiDollarSign } from 'react-icons/fi';
import { KATEGORI_PENDAPATAN, KATEGORI_BELANJA, DESA_LIST } from '../utils/constants';
import { createNotificationForAdmins, createNotificationForDesaAdmins } from '../utils/notificationService';

// --- HELPER: Format Rupiah Kompak (Sama seperti Dashboard) ---
const formatRupiahKompak = (value) => {
    const num = Number(value);
    if (isNaN(num)) return 'Rp 0';

    if (Math.abs(num) >= 1e12) {
        return `Rp ${(num / 1e12).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T`;
    }
    if (Math.abs(num) >= 1e9) {
        return `Rp ${(num / 1e9).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
    }
    if (Math.abs(num) >= 1e6) {
        return `Rp ${(num / 1e6).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Jt`;
    }
    return `Rp ${num.toLocaleString('id-ID')}`;
};

const formatCurrency = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`;

// --- KOMPONEN STAT CARD MODERN ---
const StatCard = ({ title, value, icon, colorClass, isCurrency = false, subTitle }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-start space-x-4 transition-all hover:scale-[1.02] hover:shadow-md h-full">
        <div className={`p-3 md:p-4 rounded-xl text-white shadow-lg shrink-0 ${colorClass}`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-gray-500 dark:text-gray-400 text-[10px] md:text-xs font-bold uppercase tracking-wider truncate" title={title}>{title}</p>
            <h3 className="text-lg md:text-xl lg:text-2xl font-extrabold text-gray-800 dark:text-white mt-1 break-words leading-tight">
                {isCurrency 
                    ? formatRupiahKompak(value)
                    : value.toLocaleString('id-ID')}
            </h3>
            {subTitle && <p className="text-[10px] md:text-xs text-gray-400 mt-1 font-medium truncate">{subTitle}</p>}
        </div>
    </div>
);

const PenganggaranPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [searchParams] = useSearchParams();
    
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
    
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Effect untuk sinkronisasi URL parameter (dari notifikasi)
    useEffect(() => {
        const urlDesa = searchParams.get('desa');
        const urlTahun = searchParams.get('tahun');

        if (urlDesa && currentUser.role === 'admin_kecamatan') {
            setFilterDesa(urlDesa);
        }
        if (urlTahun) {
            setFilterTahun(Number(urlTahun));
        }
    }, [searchParams, currentUser.role]);

    // Data Fetching
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

    // Kalkulasi Statistik
    const { pendapatan, belanja, totalAnggaranPendapatan, totalAnggaranBelanja, surplusDefisit } = useMemo(() => {
        const p = anggaranList.filter(a => a.jenis === 'Pendapatan');
        const b = anggaranList.filter(a => a.jenis === 'Belanja');
        const totalP = p.reduce((sum, a) => sum + (Number(a.jumlah) || 0), 0);
        const totalB = b.reduce((sum, a) => sum + (Number(a.jumlah) || 0), 0);
        return { 
            pendapatan: p, 
            belanja: b, 
            totalAnggaranPendapatan: totalP, 
            totalAnggaranBelanja: totalB,
            surplusDefisit: totalP - totalB 
        };
    }, [anggaranList]);
    
    // Handlers
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
                alasanPenolakan: null 
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

                if (actionType === 'ajukan') {
                    const message = `Pengajuan anggaran Desa ${itemToProcess.desa}: ${itemToProcess.uraian} (${formatCurrency(itemToProcess.jumlah)})`;
                    const link = `/app/keuangan/penganggaran?desa=${itemToProcess.desa}&tahun=${itemToProcess.tahun}`;
                    
                    await createNotificationForAdmins(
                        message, 
                        link, 
                        currentUser, 
                        'pengesahan_anggaran', 
                        {
                            anggaranId: itemToProcess.id,
                            uraian: itemToProcess.uraian,
                            desa: itemToProcess.desa,
                            tahun: itemToProcess.tahun
                        }
                    );
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
        'Draft': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
        'Diajukan': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800',
        'Disahkan': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800',
        'Ditolak': 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
    };

    // --- FIX: Fungsi getConfirmMessage ditambahkan ---
    const getConfirmMessage = () => {
        if (!itemToProcess) return '';
        switch (actionType) {
            case 'ajukan': return `Anda yakin ingin mengajukan anggaran "${itemToProcess.uraian}" untuk disahkan?`;
            case 'sahkan': return `Anda yakin ingin mengesahkan anggaran "${itemToProcess.uraian}"?`;
            case 'delete': return `Anda yakin ingin menghapus anggaran "${itemToProcess.uraian}" beserta semua data realisasinya? Tindakan ini tidak dapat dibatalkan.`;
            default: return 'Apakah Anda yakin?';
        }
    };

    const renderTableSection = (title, data, headerColorClass) => (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <h3 className={`text-lg font-bold ${headerColorClass} mb-4 border-b pb-2 border-gray-100 dark:border-gray-700 flex items-center gap-2`}>
                {title === 'Pendapatan' ? <FiTrendingUp /> : <FiTrendingDown />} {title}
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 uppercase text-xs font-semibold">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">Kode Rekening</th>
                            <th className="px-4 py-3">Uraian</th>
                            <th className="px-4 py-3 text-right">Jumlah (Rp)</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-center rounded-tr-lg">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data.length > 0 ? data.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.kode_rekening}</td>
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.uraian}</td>
                                <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">{formatCurrency(item.jumlah)}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[item.status] || statusColors['Draft']}`}>
                                        {item.status}
                                    </span>
                                    {item.status === 'Ditolak' && item.alasanPenolakan && (
                                        <div className="group relative inline-block ml-1">
                                            <FiInfo className="text-red-400 cursor-help" />
                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-gray-900 text-white text-xs rounded p-2 hidden group-hover:block z-50">
                                                {item.alasanPenolakan}
                                            </div>
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-center gap-2">
                                        {currentUser.role === 'admin_desa' && (item.status === 'Draft' || item.status === 'Ditolak') && (
                                            <>
                                                <button onClick={() => handleAction(item, 'ajukan')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ajukan">
                                                    <FiSend size={16}/>
                                                </button>
                                                <button onClick={() => handleOpenModal(item)} className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="Edit">
                                                    <FiEdit size={16}/>
                                                </button>
                                                <button onClick={() => handleAction(item, 'delete')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                                                    <FiTrash2 size={16}/>
                                                </button>
                                            </>
                                        )}
                                        {currentUser.role === 'admin_kecamatan' && item.status === 'Diajukan' && (
                                            <>
                                                <button onClick={() => handleAction(item, 'sahkan')} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Sahkan">
                                                    <FiCheckSquare size={16}/>
                                                </button>
                                                <button onClick={() => handleAction(item, 'tolak')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Tolak">
                                                    <FiXSquare size={16}/>
                                                </button>
                                            </>
                                        )}
                                        {currentUser.role === 'admin_kecamatan' && (item.status === 'Disahkan' || item.status === 'Ditolak') && (
                                            <button onClick={() => handleAction(item, 'delete')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Permanen">
                                                <FiTrash2 size={16}/>
                                            </button>
                                        )}
                                        {item.status === 'Disahkan' && currentUser.role === 'admin_desa' && <FiLock className="text-gray-400" title="Terkunci"/>}
                                        {item.status === 'Diajukan' && currentUser.role === 'admin_desa' && <FiLock className="text-gray-400" title="Sedang Diproses"/>}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="5" className="text-center py-8 text-gray-500 italic">Belum ada data anggaran.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    if (loading) return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-8 pb-12">
            {/* --- FILTER & HEADER SECTION --- */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FiPieChart className="text-blue-600"/> Penganggaran APBDes
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Kelola rencana anggaran pendapatan dan belanja desa.</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                     <div className="w-full md:w-32">
                        <InputField type="select" value={filterTahun} onChange={(e) => setFilterTahun(Number(e.target.value))} className="bg-gray-50 border-none">
                            {tahunOptions.map(th => <option key={th} value={th}>{th}</option>)}
                        </InputField>
                     </div>
                     {currentUser.role === 'admin_kecamatan' && (
                        <div className="w-full md:w-48">
                            <InputField type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} className="bg-gray-50 border-none">
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                            </InputField>
                        </div>
                     )}
                     {currentUser.role === 'admin_desa' && (
                        <Button onClick={() => handleOpenModal()} variant="primary" className="whitespace-nowrap"><FiPlus className="mr-1"/> Tambah</Button>
                     )}
                </div>
            </div>
            
            {/* --- STAT CARDS MODERN --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="Target Pendapatan" 
                    value={totalAnggaranPendapatan} 
                    icon={<FiTrendingUp size={24} />} 
                    colorClass="bg-gradient-to-r from-emerald-500 to-green-600" 
                    isCurrency={true}
                    subTitle="Total Rencana Pemasukan"
                />
                <StatCard 
                    title="Pagu Belanja" 
                    value={totalAnggaranBelanja} 
                    icon={<FiTrendingDown size={24} />} 
                    colorClass="bg-gradient-to-r from-rose-500 to-red-600" 
                    isCurrency={true}
                    subTitle="Total Rencana Pengeluaran"
                />
                <StatCard 
                    title={surplusDefisit >= 0 ? "Surplus Anggaran" : "Defisit Anggaran"}
                    value={surplusDefisit} 
                    icon={<FiDollarSign size={24} />} 
                    colorClass={surplusDefisit >= 0 ? "bg-gradient-to-r from-blue-500 to-indigo-600" : "bg-gradient-to-r from-orange-500 to-red-500"} 
                    isCurrency={true}
                    subTitle="Selisih Pendapatan & Belanja"
                />
            </div>

            {/* --- TABLE SECTIONS --- */}
            <div className="grid grid-cols-1 gap-8">
                {renderTableSection("Pendapatan Desa", pendapatan, "text-emerald-600 dark:text-emerald-400")}
                {renderTableSection("Belanja Desa", belanja, "text-rose-600 dark:text-rose-400")}
            </div>

            {/* --- MODAL FORM --- */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedAnggaran ? "Edit Rencana Anggaran" : "Tambah Rencana Anggaran"}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="p-3 bg-blue-50 dark:bg-gray-700 rounded-lg text-sm text-blue-800 dark:text-blue-200 mb-4 flex gap-2">
                        <FiInfo className="shrink-0 mt-0.5"/>
                        <p>Pastikan memilih kategori yang sesuai dengan kode rekening APBDes yang berlaku.</p>
                    </div>

                    <InputField label="Jenis Anggaran" name="jenis" type="select" value={formData.jenis || 'Belanja'} onChange={handleFormChange}>
                        <option value="Pendapatan">Pendapatan</option>
                        <option value="Belanja">Belanja</option>
                    </InputField>
                    
                    <InputField label="Kategori / Mata Anggaran" name="kategori" type="select" value={formData.kategori || ''} onChange={handleFormChange} required>
                        <option value="">-- Pilih Kategori --</option>
                        {kategoriOptions.map(k => <option key={k.nama} value={k.nama}>{k.kode_rekening} - {k.nama}</option>)}
                    </InputField>
                    
                    <InputField label="Jumlah Anggaran (Rp)" name="jumlah" type="number" value={formData.jumlah || ''} onChange={handleFormChange} required prefix="Rp" />
                    
                    <div className="flex justify-end pt-6 border-t dark:border-gray-700 gap-3">
                        <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting}>Simpan Draft</Button>
                    </div>
                </form>
            </Modal>
            
            {/* --- CONFIRMATION MODALS --- */}
            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={executeAction}
                isLoading={isSubmitting}
                title="Konfirmasi Aksi"
                message={getConfirmMessage()}
                variant={actionType === 'delete' || actionType === 'tolak' ? 'danger' : 'primary'}
            />

            <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Tolak Pengajuan">
                <div className="space-y-4">
                    <div className="bg-red-50 p-3 rounded-lg text-red-800 text-sm">
                        Anda akan menolak pengajuan anggaran: <strong>{itemToProcess?.uraian}</strong>
                    </div>
                    <InputField
                        label="Alasan Penolakan (Wajib)"
                        name="rejectionReason"
                        type="textarea"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        required
                        placeholder="Contoh: Nominal tidak sesuai dengan pagu kecamatan..."
                    />
                    <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
                        <Button type="button" variant="secondary" onClick={() => setIsRejectModalOpen(false)} disabled={isSubmitting}>Batal</Button>
                        <Button type="button" variant="danger" onClick={handleRejectSubmit} isLoading={isSubmitting}>Kirim Penolakan</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PenganggaranPage;