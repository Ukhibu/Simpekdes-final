import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, collectionGroup } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiFileText, FiTrendingUp, FiTrendingDown, FiDollarSign, FiActivity } from 'react-icons/fi';
import { DESA_LIST } from '../utils/constants';

// --- HELPER: Format Rupiah Kompak ---
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

const PenatausahaanPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    
    // State Data
    const [realisasiList, setRealisasiList] = useState([]);
    const [anggaranSah, setAnggaranSah] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // State Modal & Form
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRealisasi, setSelectedRealisasi] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State Delete
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    
    // State Filter
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? DESA_LIST[0] : currentUser.desa);
    
    // State Info Anggaran (untuk validasi sisa saat input)
    const [selectedAnggaranInfo, setSelectedAnggaranInfo] = useState(null);

    // 1. DATA FETCHING
    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        const fetchData = async () => {
            try {
                // Fetch Anggaran yang DISAHKAN untuk dropdown & referensi
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

                // Fetch Semua Realisasi di Desa & Tahun Tersebut (via Collection Group dengan filter parentDesa)
                // Catatan: Memerlukan index 'realisasi' di Firestore jika filter kompleks
                const realisasiQuery = query(
                    collectionGroup(db, 'realisasi'),
                    where('parentDesa', '==', filterDesa)
                );

                const unsub = onSnapshot(realisasiQuery, (snapshot) => {
                    const allRealisasi = snapshot.docs.map(d => {
                        const data = d.data();
                        const parentAnggaran = sahList.find(a => a.id === data.parentAnggaranId);
                        
                        // Filter manual tahun di sisi client jika query Firestore terbatas
                        // (Karena tanggal realisasi harus sesuai tahun anggaran)
                        const realisasiYear = data.tanggal?.toDate ? data.tanggal.toDate().getFullYear() : new Date(data.tanggal).getFullYear();
                        
                        if (realisasiYear !== Number(filterTahun)) return null;
                        if (!parentAnggaran) return null; // Hanya tampilkan jika anggaran induk ditemukan (validasi integritas)

                        return {
                            id: d.id,
                            ...data,
                            parentUraian: parentAnggaran.uraian || 'N/A',
                            jenis: parentAnggaran.jenis || 'N/A',
                        };
                    }).filter(r => r !== null); // Hapus null
                    
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
    
    // 2. KALKULASI & FILTER
    const { filteredRealisasi, totalPendapatan, totalBelanja, surplusDefisit } = useMemo(() => {
        const filtered = realisasiList.filter(t => (t.uraian || '').toLowerCase().includes(searchTerm.toLowerCase()));
        
        const p = realisasiList.filter(r => r.jenis === 'Pendapatan').reduce((sum, r) => sum + (Number(r.jumlah) || 0), 0);
        const b = realisasiList.filter(r => r.jenis === 'Belanja').reduce((sum, r) => sum + (Number(r.jumlah) || 0), 0);

        return { 
            filteredRealisasi: filtered,
            totalPendapatan: p,
            totalBelanja: b,
            surplusDefisit: p - b
        };
    }, [realisasiList, searchTerm]);

    // 3. HANDLERS
    const handleOpenModal = (item = null) => {
        setSelectedRealisasi(item);
        setSelectedAnggaranInfo(null);
        if (item) {
            // Saat edit, hitung info sisa anggaran berdasarkan parent
            const parentAnggaran = anggaranSah.find(a => a.id === item.parentAnggaranId);
            if (parentAnggaran) {
                const realisasiLain = realisasiList
                    .filter(r => r.parentAnggaranId === item.parentAnggaranId && r.id !== item.id)
                    .reduce((sum, r) => sum + r.jumlah, 0);
                
                setSelectedAnggaranInfo({
                    total: parentAnggaran.jumlah,
                    terealisasi: realisasiLain, // Terealisasi selain item ini
                    sisa: parentAnggaran.jumlah - realisasiLain
                });
            }
            // Konversi Timestamp ke string date untuk input
            const dateStr = item.tanggal && item.tanggal.toDate 
                ? item.tanggal.toDate().toISOString().split('T')[0] 
                : item.tanggal;
            
            setFormData({ ...item, tanggal: dateStr });
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
                // Hitung realisasi saat ini untuk anggaran ini
                const realisasiSaatIni = realisasiList
                    .filter(r => r.parentAnggaranId === value)
                    .reduce((sum, r) => sum + r.jumlah, 0);
                
                setSelectedAnggaranInfo({
                    total: selected.jumlah,
                    terealisasi: realisasiSaatIni,
                    sisa: selected.jumlah - realisasiSaatIni
                });
                // Otomatis isi uraian transaksi default (bisa diubah user)
                newFormData.uraian = `Realisasi ${selected.uraian}`;
            } else {
                setSelectedAnggaranInfo(null);
                newFormData.uraian = '';
            }
        }
        setFormData(newFormData);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        // Validasi Sisa Anggaran (Hanya Warning atau Block)
        // Kita gunakan logika Block agar tidak over-budget
        if (selectedAnggaranInfo) {
            // Jika mode edit, 'sisa' di info sudah exclude jumlah item ini, jadi aman dibandingkan langsung
            // Jika mode tambah, 'sisa' adalah sisa murni
            if (Number(formData.jumlah) > selectedAnggaranInfo.sisa) {
                showNotification(`Jumlah realisasi melebihi sisa anggaran (Sisa: ${formatCurrency(selectedAnggaranInfo.sisa)}).`, 'error');
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
                parentDesa: filterDesa, 
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
        <div className="space-y-8 pb-12">
            
            {/* --- HEADER & FILTERS --- */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FiFileText className="text-blue-600"/> Buku Kas Umum
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pencatatan realisasi pendapatan dan belanja desa.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="w-full md:w-32">
                         <InputField type="select" value={filterTahun} onChange={e => setFilterTahun(e.target.value)} className="bg-gray-50 border-none">
                              {tahunOptions.map(th => <option key={th} value={th}>{th}</option>)}
                         </InputField>
                    </div>
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="w-full md:w-48">
                            <InputField type="select" value={filterDesa} onChange={e => setFilterDesa(e.target.value)} className="bg-gray-50 border-none">
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                            </InputField>
                        </div>
                    )}
                    {currentUser.role === 'admin_desa' && (
                        <Button onClick={() => handleOpenModal()} variant="primary" className="whitespace-nowrap shadow-md hover:shadow-lg transition-all"><FiPlus className="mr-1"/> Tambah</Button>
                    )}
                </div>
            </div>

            {loading ? <div className="flex justify-center h-64 items-center"><Spinner size="lg" /></div> : (
                <>
                    {/* --- STAT CARDS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard 
                            title="Realisasi Pendapatan" 
                            value={totalPendapatan} 
                            icon={<FiTrendingUp size={24} />} 
                            colorClass="bg-gradient-to-r from-emerald-500 to-green-600" 
                            isCurrency={true}
                            subTitle="Pemasukan Tercatat"
                        />
                        <StatCard 
                            title="Realisasi Belanja" 
                            value={totalBelanja} 
                            icon={<FiTrendingDown size={24} />} 
                            colorClass="bg-gradient-to-r from-rose-500 to-red-600" 
                            isCurrency={true}
                            subTitle="Pengeluaran Tercatat"
                        />
                        <StatCard 
                            title="Surplus / (Defisit)" 
                            value={surplusDefisit} 
                            icon={<FiActivity size={24} />} 
                            colorClass={surplusDefisit >= 0 ? "bg-gradient-to-r from-blue-500 to-indigo-600" : "bg-gradient-to-r from-orange-500 to-red-500"} 
                            isCurrency={true}
                            subTitle="Selisih Kas"
                        />
                    </div>

                    {/* --- TABLE SECTION --- */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <FiDollarSign className="text-yellow-500"/> Riwayat Transaksi
                            </h2>
                            <div className="w-full md:w-72">
                                <InputField type="text" placeholder="Cari uraian transaksi..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} icon={<FiSearch />} className="bg-gray-50 border-gray-200" />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-lg">Tanggal</th>
                                        <th className="px-4 py-3">Uraian Transaksi</th>
                                        <th className="px-4 py-3">Mata Anggaran</th>
                                        <th className="px-4 py-3 text-center">Jenis</th>
                                        <th className="px-4 py-3 text-right">Jumlah (Rp)</th>
                                        {currentUser.role === 'admin_desa' && <th className="px-4 py-3 text-center rounded-tr-lg">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredRealisasi.length > 0 ? filteredRealisasi.map(t => (
                                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                                {(t.tanggal.toDate ? t.tanggal.toDate() : new Date(t.tanggal)).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.uraian}</td>
                                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                                                {t.parentUraian}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${t.jenis === 'Pendapatan' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {t.jenis}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-gray-700 dark:text-gray-200">
                                                {Number(t.jumlah).toLocaleString('id-ID')}
                                            </td>
                                            {currentUser.role === 'admin_desa' && (
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleOpenModal(t)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit">
                                                            <FiEdit size={16}/>
                                                        </button>
                                                        <button onClick={() => confirmDelete(t)} className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Hapus">
                                                            <FiTrash2 size={16}/>
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={currentUser.role === 'admin_desa' ? 6 : 5} className="text-center py-12 text-gray-500 italic">Belum ada data realisasi.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* --- MODAL FORM --- */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedRealisasi ? "Edit Realisasi" : "Tambah Realisasi"}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <InputField 
                        label="Mata Anggaran (Sumber)" 
                        name="parentAnggaranId" 
                        type="select" 
                        value={formData.parentAnggaranId || ''} 
                        onChange={handleFormChange} 
                        required 
                        disabled={!!selectedRealisasi}
                    >
                        <option value="">-- Pilih Mata Anggaran Yang Disahkan --</option>
                        {anggaranSah.map(a => <option key={a.id} value={a.id}>{a.uraian} ({a.jenis})</option>)}
                    </InputField>

                    {selectedAnggaranInfo && (
                        <div className="p-4 bg-blue-50 dark:bg-gray-700 rounded-xl border border-blue-100 dark:border-gray-600 text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Pagu Anggaran:</span>
                                <span className="font-semibold dark:text-white">{formatCurrency(selectedAnggaranInfo.total)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Terealisasi Lainnya:</span>
                                <span className="font-semibold text-yellow-600 dark:text-yellow-400">{formatCurrency(selectedAnggaranInfo.terealisasi)}</span>
                            </div>
                            <div className="border-t border-blue-200 dark:border-gray-600 my-1"></div>
                            <div className="flex justify-between font-bold">
                                <span className="text-blue-700 dark:text-blue-300">Sisa Anggaran:</span>
                                <span className={`${selectedAnggaranInfo.sisa < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(selectedAnggaranInfo.sisa)}</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Uraian Transaksi" name="uraian" type="text" value={formData.uraian || ''} onChange={handleFormChange} required placeholder="Contoh: Pembelian ATK..." />
                        <InputField label="Tanggal" name="tanggal" type="date" value={formData.tanggal || ''} onChange={handleFormChange} required />
                    </div>
                    
                    <InputField label="Jumlah Realisasi (Rp)" name="jumlah" type="number" value={formData.jumlah || ''} onChange={handleFormChange} required prefix="Rp" />

                    <div className="flex justify-end pt-6 border-t dark:border-gray-700 gap-3">
                        <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting}>Simpan Data</Button>
                    </div>
                </form>
            </Modal>
            
            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen} 
                onClose={() => setIsDeleteConfirmOpen(false)} 
                onConfirm={executeDelete} 
                isLoading={isSubmitting} 
                title="Hapus Transaksi" 
                message={`Yakin ingin menghapus realisasi "${itemToDelete?.uraian}"?`} 
                variant="danger"
            />
        </div>
    );
};

export default PenatausahaanPage;