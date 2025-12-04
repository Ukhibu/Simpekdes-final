import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, where, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSearchParams } from 'react-router-dom';

// Komponen UI
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Pagination from '../components/common/Pagination';

// Ikon
import { 
    FiSearch, FiUser, FiPlus, FiEdit, FiTrash2, FiDownload, 
    FiCheckSquare, FiX, FiMove, FiAlertCircle, FiCalendar, 
    FiClipboard, FiFilter, FiPrinter, FiHeart, FiCheckCircle, FiClock
} from 'react-icons/fi';

// Konstanta & Utils
import { PKK_PROGRAM_CONFIG, DESA_LIST, PKK_CONFIG } from '../utils/constants';
import { generatePKKProgramPDF } from '../utils/generatePKKProgramPDF';
import { createNotificationForAdmins } from '../utils/notificationService';
import * as XLSX from 'xlsx';

// Format Tanggal
const formatDateIndo = (dateString) => {
    if (!dateString) return "-";
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
    } catch (e) { return dateString; }
};

// Daftar 10 Program Pokok PKK
const PROGRAM_POKOK_PKK = [
    "Penghayatan dan Pengamalan Pancasila",
    "Gotong Royong",
    "Pangan",
    "Sandang",
    "Perumahan dan Tata Laksana Rumah Tangga",
    "Pendidikan dan Keterampilan",
    "Kesehatan",
    "Pengembangan Kehidupan Berkoperasi",
    "Kelestarian Lingkungan Hidup",
    "Perencanaan Sehat"
];

// Status Program
const getProgramStatus = (program) => {
    if (!program.realisasi) return { label: 'Belum Terlaksana', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
    const realisasi = parseInt(program.realisasi) || 0;
    if (realisasi >= 100) return { label: 'Selesai', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    if (realisasi > 0) return { label: 'Berjalan', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    return { label: 'Belum Terlaksana', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
};

// Kartu Statistik
const StatCard = ({ icon, title, value, colorClass }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4 transition-all hover:scale-[1.02]">
        <div className={`p-3 rounded-xl text-white shadow-lg ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</h3>
        </div>
    </div>
);

const PKKProgramPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
    const [currentDesaPage, setCurrentDesaPage] = useState(DESA_LIST[0]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const longPressTimer = useRef(null);
    const isScrolling = useRef(false);
    const touchStartCoords = useRef({ x: 0, y: 0 });

    const [searchParams, setSearchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);

    // 1. Fetch Data
    useEffect(() => {
        setLoading(true);
        const collectionName = PKK_PROGRAM_CONFIG?.collectionName || 'pkk_program';
        const q = query(collection(db, collectionName));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDataList(list);
            setLoading(false);
        }, (error) => {
            showNotification(`Gagal memuat data: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [showNotification]);

    // 2. Filter Logic
    const filteredData = useMemo(() => {
        let data = dataList;
        const targetDesa = currentUser.role === 'admin_kecamatan' 
            ? (filterDesa === 'all' ? currentDesaPage : filterDesa)
            : currentUser.desa;

        data = data.filter(item => item.desa === targetDesa);

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(item => 
                (item.nama_program || '').toLowerCase().includes(lower) ||
                (item.kategori || '').toLowerCase().includes(lower) ||
                (item.tujuan || '').toLowerCase().includes(lower)
            );
        }
        return data;
    }, [dataList, searchTerm, filterDesa, currentDesaPage, currentUser]);

    // Stats Calculation
    const stats = useMemo(() => {
        const total = filteredData.length;
        const selesai = filteredData.filter(i => (parseInt(i.realisasi) || 0) >= 100).length;
        const berjalan = filteredData.filter(i => (parseInt(i.realisasi) || 0) > 0 && (parseInt(i.realisasi) || 0) < 100).length;
        const totalAnggaran = filteredData.reduce((sum, i) => sum + (parseInt(i.anggaran) || 0), 0);
        return { total, selesai, berjalan, totalAnggaran };
    }, [filteredData]);

    // 3. Handlers
    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : (filterDesa !== 'all' ? filterDesa : currentDesaPage);
        setFormData(item ? { ...item } : { desa: initialDesa, realisasi: 0, kategori: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (!isSubmitting) {
            setIsModalOpen(false);
            setSelectedItem(null);
            setFormData({});
        }
    };

    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.desa) return showNotification("Desa wajib diisi!", 'error');
        setIsSubmitting(true);
        
        const collectionName = PKK_PROGRAM_CONFIG?.collectionName || 'pkk_program';
        try {
            let savedId;
            if (selectedItem) {
                await updateDoc(doc(db, collectionName, selectedItem.id), formData);
                savedId = selectedItem.id;
                showNotification('Program PKK diperbarui!', 'success');
            } else {
                const docRef = await addDoc(collection(db, collectionName), formData);
                savedId = docRef.id;
                showNotification('Program PKK ditambahkan!', 'success');
            }
            
            if (currentUser.role === 'admin_desa') {
                const action = selectedItem ? 'memperbarui' : 'menambahkan';
                await createNotificationForAdmins(
                    `Admin Desa ${currentUser.desa} ${action} Program PKK: "${formData.nama_program}"`, 
                    `/app/pkk/program?view=${savedId}`, 
                    currentUser
                );
            }
            handleCloseModal();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete Handlers
    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        const collectionName = PKK_PROGRAM_CONFIG?.collectionName || 'pkk_program';
        try {
            await deleteDoc(doc(db, collectionName, itemToDelete.id));
            showNotification('Data dihapus.', 'success');
        } catch(error) { showNotification(error.message, 'error'); } 
        finally { setIsSubmitting(false); setIsDeleteConfirmOpen(false); }
    };

    const handleDeleteSelected = async () => {
        setIsSubmitting(true);
        const collectionName = PKK_PROGRAM_CONFIG?.collectionName || 'pkk_program';
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => batch.delete(doc(db, collectionName, id)));
            await batch.commit();
            showNotification(`${selectedIds.length} data dihapus.`, 'success');
            setIsSelectionMode(false);
            setSelectedIds([]);
        } catch (error) { showNotification(error.message, 'error'); } 
        finally { setIsSubmitting(false); setIsDeleteSelectedConfirmOpen(false); }
    };

    // EXPORT PDF (Mengambil Nama Ketua dari Data PKKPage)
    const handleExportPDF = async () => {
        if (filteredData.length === 0) return showNotification("Tidak ada data.", "warning");
        
        const effectiveDesa = currentUser.role === 'admin_kecamatan' 
            ? (filterDesa !== 'all' ? filterDesa : currentDesaPage) 
            : currentUser.desa;

        try {
            showNotification("Menyiapkan PDF...", "info");
            
            // 1. Cari Ketua TP PKK di desa tersebut
            const pkkCollectionName = PKK_CONFIG?.collectionName || 'pkk';
            const q = query(
                collection(db, pkkCollectionName), 
                where('desa', '==', effectiveDesa),
                where('jabatan', '==', 'Ketua') // Mencari jabatan Ketua
            );
            
            const querySnapshot = await getDocs(q);
            let ketuaName = "";
            
            if (!querySnapshot.empty) {
                const ketuaData = querySnapshot.docs[0].data();
                ketuaName = ketuaData.nama || "";
            } else {
                // Fallback: Coba cari yang mengandung kata "Ketua" jika "Ketua" pas tidak ada
                const qAll = query(collection(db, pkkCollectionName), where('desa', '==', effectiveDesa));
                const allSnap = await getDocs(qAll);
                const ketuaCandidate = allSnap.docs.find(d => d.data().jabatan?.toLowerCase().includes('ketua'));
                if (ketuaCandidate) ketuaName = ketuaCandidate.data().nama;
            }

            // 2. Ambil Logo
            const brandingRef = doc(db, 'settings', 'branding');
            const brandingSnap = await getDoc(brandingRef);
            let logoUrl = null;
            if (brandingSnap.exists()) logoUrl = brandingSnap.data().logoUrl;

            // 3. Generate PDF
            generatePKKProgramPDF(filteredData, effectiveDesa, ketuaName, logoUrl);
            showNotification("PDF berhasil diunduh.", "success");

        } catch (error) {
            console.error("PDF Export Error:", error);
            showNotification("Gagal mengunduh PDF.", "error");
        }
    };

    // --- GESTURE & SELECTION UTILS (Sama seperti LPMPage) ---
    useEffect(() => { if (isSelectionMode) setMenuPos({ x: window.innerWidth / 2 - 110, y: window.innerHeight - 120 }); }, [isSelectionMode]);
    const activateSelectionMode = (id) => { if (!isSelectionMode) { setIsSelectionMode(true); setSelectedIds([id]); if (navigator.vibrate) navigator.vibrate(50); } };
    const toggleSelection = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    const toggleSelectAll = () => selectedIds.length === filteredData.length ? setSelectedIds([]) : setSelectedIds(filteredData.map(i => i.id));
    
    const handleRowTouchStart = (id, e) => {
        isScrolling.current = false;
        touchStartCoords.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        longPressTimer.current = setTimeout(() => { if (!isScrolling.current) activateSelectionMode(id); }, 600);
    };
    const handleRowTouchMove = (e) => {
        const moveX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
        const moveY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);
        if (moveX > 10 || moveY > 10) { isScrolling.current = true; if (longPressTimer.current) clearTimeout(longPressTimer.current); }
    };
    const handleRowTouchEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
    
    const startDrag = (e) => { setIsDragging(true); const c = e.touches ? e.touches[0] : e; dragOffset.current = { x: c.clientX - menuPos.x, y: c.clientY - menuPos.y }; };
    const onDrag = (e) => { if (!isDragging) return; const c = e.touches ? e.touches[0] : e; setMenuPos({ x: c.clientX - dragOffset.current.x, y: c.clientY - dragOffset.current.y }); };
    const stopDrag = () => setIsDragging(false);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', onDrag); window.addEventListener('mouseup', stopDrag);
            window.addEventListener('touchmove', onDrag, {passive: false}); window.addEventListener('touchend', stopDrag);
        } else {
            window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', onDrag); window.removeEventListener('touchend', stopDrag);
        }
        return () => { window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', stopDrag); window.removeEventListener('touchmove', onDrag); window.removeEventListener('touchend', stopDrag); };
    }, [isDragging]);

    if (loading) return <div className="flex justify-center items-center h-96"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6 pb-24">
            {/* --- DASHBOARD STATS (Atas) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    icon={<FiClipboard className="w-6 h-6" />}
                    title="Total Program"
                    value={stats.total}
                    colorClass="bg-gradient-to-r from-pink-500 to-rose-600"
                />
                <StatCard 
                    icon={<FiCheckCircle className="w-6 h-6" />}
                    title="Selesai"
                    value={stats.selesai}
                    colorClass="bg-gradient-to-r from-green-500 to-emerald-600"
                />
                <StatCard 
                    icon={<FiClock className="w-6 h-6" />}
                    title="Berjalan"
                    value={stats.berjalan}
                    colorClass="bg-gradient-to-r from-blue-500 to-indigo-600"
                />
                <StatCard 
                    icon={<FiAlertCircle className="w-6 h-6" />}
                    title="Total Anggaran"
                    value={`Rp ${(stats.totalAnggaran / 1000000).toFixed(1)} Jt`}
                    subTitle="Estimasi Dana"
                    colorClass="bg-gradient-to-r from-purple-500 to-violet-600"
                />
            </div>

            {/* --- HEADER & TOOLS --- */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <FiHeart className="text-pink-500"/> Manajemen Program PKK
                            {isSelectionMode && <span className="text-sm font-normal px-3 py-1 bg-pink-100 text-pink-700 rounded-full">{selectedIds.length} dipilih</span>}
                        </h1>
                    </div>
                    <div className="flex gap-2">
                         <Button onClick={handleExportPDF} variant="danger" className="shadow-sm flex items-center"><FiPrinter className="mr-2"/> PDF</Button>
                         <Button onClick={() => handleOpenModal('add')} variant="primary" className="shadow-sm flex items-center"><FiPlus className="mr-2"/> Tambah</Button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                         <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                         <input 
                            type="text" 
                            placeholder="Cari program, kategori..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                         />
                    </div>
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="w-full md:w-64 relative">
                             <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                             <select 
                                value={filterDesa} 
                                onChange={(e) => setFilterDesa(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none appearance-none"
                             >
                                <option value="all">Mode Pagination (Per Desa)</option>
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                             </select>
                        </div>
                    )}
                </div>
            </div>

            {/* --- TABEL DATA --- */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden relative">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 uppercase text-xs font-semibold border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 w-10 text-center">
                                    {isSelectionMode ? (
                                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-pink-600 transition-colors">
                                            {selectedIds.length === filteredData.length ? <FiCheckSquare size={20} className="text-pink-600"/> : <div className="w-5 h-5 border-2 border-gray-400 rounded mx-auto"></div>}
                                        </button>
                                    ) : 'No'}
                                </th>
                                <th className="px-6 py-4">Nama Program & Kategori</th>
                                <th className="px-6 py-4">Tujuan & Sasaran</th>
                                <th className="px-6 py-4">Waktu & Anggaran</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredData.length > 0 ? filteredData.map((item, index) => {
                                const isSelected = selectedIds.includes(item.id);
                                const status = getProgramStatus(item);
                                return (
                                    <tr 
                                        key={item.id}
                                        id={`row-${item.id}`}
                                        className={`group transition-colors select-none cursor-pointer 
                                            ${isSelected ? 'bg-pink-50 dark:bg-pink-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}
                                            ${highlightedRow === item.id ? 'bg-yellow-50 dark:bg-yellow-900/20 animate-pulse' : ''}
                                        `}
                                        onClick={() => isSelectionMode && toggleSelection(item.id)}
                                        onDoubleClick={() => activateSelectionMode(item.id)}
                                        onTouchStart={(e) => handleRowTouchStart(item.id, e)}
                                        onTouchMove={handleRowTouchMove}
                                        onTouchEnd={handleRowTouchEnd}
                                    >
                                        <td className="px-6 py-4 text-center font-medium text-gray-500 dark:text-gray-400">
                                            {isSelectionMode ? (
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-pink-600 border-pink-600' : 'border-gray-400'}`}>
                                                    {isSelected && <FiCheckSquare className="text-white w-3 h-3" />}
                                                </div>
                                            ) : index + 1}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900 dark:text-white">{item.nama_program}</div>
                                            <div className="text-xs text-pink-600 dark:text-pink-400 mt-1 font-medium">{item.kategori || 'Umum'}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1"><FiUser size={12}/> {item.penanggung_jawab || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300 max-w-xs">
                                            <p className="truncate font-medium" title={item.tujuan}>{item.tujuan}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate" title={item.sasaran}>Sasaran: {item.sasaran}</p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                            <div className="flex items-center gap-1 text-xs mb-1 font-medium">
                                                <FiCalendar className="text-pink-400"/> {formatDateIndo(item.waktu_pelaksanaan)}
                                            </div>
                                            <div className="font-mono text-gray-700 dark:text-gray-200 text-sm">
                                                Rp {parseInt(item.anggaran).toLocaleString('id-ID')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                                                {status.label} ({item.realisasi || 0}%)
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                 <button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', item); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 rounded-lg"><FiEdit size={18}/></button>
                                                 <button onClick={(e) => { e.stopPropagation(); setItemToDelete(item); setIsDeleteConfirmOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 rounded-lg"><FiTrash2 size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500">Belum ada data program kerja.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {currentUser.role === 'admin_kecamatan' && filterDesa === 'all' && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-center">
                        <Pagination desaList={DESA_LIST} currentDesa={currentDesaPage} onPageChange={setCurrentDesaPage} />
                    </div>
                )}
            </div>

            {/* --- MENU AKSI MASSAL --- */}
            {isSelectionMode && (
                <div style={{ position: 'fixed', left: `${menuPos.x}px`, top: `${menuPos.y}px`, zIndex: 9999, touchAction: 'none' }} className="flex items-center gap-3 pl-2 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-2xl rounded-full animate-in fade-in zoom-in duration-200 backdrop-blur-md">
                    <div onMouseDown={startDrag} onTouchStart={startDrag} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-full cursor-move group"><FiMove className="text-gray-500"/> <span className="font-bold text-pink-600">{selectedIds.length}</span></div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <button onClick={() => setIsDeleteSelectedConfirmOpen(true)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-full"><FiTrash2 size={20}/></button>
                    <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-full"><FiX size={20}/></button>
                </div>
            )}

            {/* --- MODAL FORM --- */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'edit' ? 'Edit Program PKK' : 'Tambah Program PKK'}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Nama Program" name="nama_program" value={formData.nama_program || ''} onChange={handleFormChange} required placeholder="Contoh: Penyuluhan Gizi Balita" />
                        {/* Dropdown 10 Program Pokok PKK */}
                        <InputField label="Kategori (10 Pokok PKK)" name="kategori" type="select" value={formData.kategori || ''} onChange={handleFormChange} required>
                            <option value="">Pilih Kategori</option>
                            {PROGRAM_POKOK_PKK.map(p => <option key={p} value={p}>{p}</option>)}
                        </InputField>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <InputField label="Tujuan" name="tujuan" type="textarea" value={formData.tujuan || ''} onChange={handleFormChange} required />
                         <InputField label="Sasaran" name="sasaran" type="textarea" value={formData.sasaran || ''} onChange={handleFormChange} required />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Lokasi" name="lokasi" value={formData.lokasi || ''} onChange={handleFormChange} required />
                        <InputField label="Waktu Pelaksanaan" name="waktu_pelaksanaan" type="date" value={formData.waktu_pelaksanaan || ''} onChange={handleFormChange} required />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <InputField label="Pelaksana / Penanggung Jawab" name="penanggung_jawab" value={formData.penanggung_jawab || ''} onChange={handleFormChange} />
                        </div>
                        <InputField label="Realisasi (%)" name="realisasi" type="number" value={formData.realisasi || ''} onChange={handleFormChange} placeholder="0-100" />
                    </div>
                    
                    <InputField label="Anggaran (Rp)" name="anggaran" type="number" value={formData.anggaran || ''} onChange={handleFormChange} required prefix="Rp" />

                    {currentUser.role === 'admin_kecamatan' && (
                         <InputField label="Desa" name="desa" type="select" value={formData.desa || ''} onChange={handleFormChange} required>
                            <option value="">Pilih Desa</option>
                            {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                         </InputField>
                    )}

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>Batal</Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting}>Simpan</Button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDelete} isLoading={isSubmitting} title="Hapus Program" message="Yakin ingin menghapus program kerja ini?" variant="danger"/>
            <ConfirmationModal isOpen={isDeleteSelectedConfirmOpen} onClose={() => setIsDeleteSelectedConfirmOpen(false)} onConfirm={handleDeleteSelected} isLoading={isSubmitting} title="Hapus Massal" message={`Yakin ingin menghapus ${selectedIds.length} data terpilih?`} variant="danger"/>
        </div>
    );
};

export default PKKProgramPage;