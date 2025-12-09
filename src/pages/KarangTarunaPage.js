import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSearchParams } from 'react-router-dom';

// Komponen UI
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import SkeletonLoader from '../components/common/SkeletonLoader';
import InputField from '../components/common/InputField';
import Pagination from '../components/common/Pagination';

// Utilitas & Konfigurasi
import { KARANG_TARUNA_CONFIG, DESA_LIST, JENIS_KELAMIN_LIST, PENDIDIKAN_LIST } from '../utils/constants';
import { generateKarangTarunaXLSX } from '../utils/generateKarangTarunaXLSX';
import { createNotificationForAdmins } from '../utils/notificationService';
import * as XLSX from 'xlsx';

// Ikon
import { 
    FiEdit, FiSearch, FiUpload, FiDownload, FiPlus, FiEye, FiTrash2, 
    FiCheckSquare, FiX, FiMove, FiAlertCircle, FiCheckCircle, FiClock, FiMapPin,
    FiUser, FiCalendar, FiBook, FiHash, FiPhone, FiFlag, FiBriefcase, FiActivity
} from 'react-icons/fi';

// Konstanta Jabatan Karang Taruna
const JABATAN_KT_LIST = [
    "Ketua", 
    "Wakil Ketua", 
    "Sekretaris", 
    "Wakil Sekretaris",
    "Bendahara", 
    "Wakil Bendahara",
    "Seksi Pendidikan dan Pelatihan",
    "Seksi Usaha Kesejahteraan Sosial",
    "Seksi Kelompok Usaha Bersama",
    "Seksi Kerohanian dan Pembinaan Mental",
    "Seksi Olahraga dan Seni Budaya",
    "Seksi Lingkungan Hidup",
    "Seksi Hubungan Masyarakat",
    "Anggota"
];

// Helper Component untuk Baris Detail yang Modern
const DetailRow = ({ icon, label, value, isLast }) => (
    <div className={`flex items-start sm:items-center justify-between py-3 ${!isLast ? 'border-b border-dashed border-gray-100 dark:border-gray-700' : ''} group hover:bg-gray-50 dark:hover:bg-gray-700/30 px-2 rounded-lg transition-colors`}>
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            {icon && <span className="text-cyan-600 dark:text-cyan-400 opacity-80">{icon}</span>}
            <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right max-w-[60%] break-words">
            {value || '-'}
        </span>
    </div>
);

const KarangTarunaPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);

    // State Data Pendukung
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [exportConfig, setExportConfig] = useState(null);
    const [loadingExtras, setLoadingExtras] = useState(true);

    // State Modal & Form
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // State Hapus
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);

    // State Filter & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);
    const [hasOpenedModalFromQuery, setHasOpenedModalFromQuery] = useState(false);

    // --- SELEKSI & GESTURE ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const longPressTimer = useRef(null);
    const isScrolling = useRef(false);
    const touchStartCoords = useRef({ x: 0, y: 0 });

    // --- DRAGGABLE MENU ---
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 }); 
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // 1. Fetch Data Utama
    useEffect(() => {
        const collectionName = KARANG_TARUNA_CONFIG?.collectionName || 'karang_taruna';
        const q = query(collection(db, collectionName));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDataList(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching KT data:", error);
            showNotification(`Gagal memuat data: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [showNotification]);

    // 2. Fetch Data Pendukung (Export Config & Perangkat)
    useEffect(() => {
        const fetchExtraData = async () => {
            try {
                const exportRef = doc(db, 'settings', 'exportConfig');
                const exportSnap = await getDoc(exportRef);
                if (exportSnap.exists()) setExportConfig(exportSnap.data());

                const perangkatQuery = query(collection(db, 'perangkat'));
                const perangkatSnapshot = await getDocs(perangkatQuery);
                setAllPerangkat(perangkatSnapshot.docs.map(doc => doc.data()));
            } catch (error) {
                console.error("Error fetching extras:", error);
            } finally {
                setLoadingExtras(false);
            }
        };
        fetchExtraData();
    }, []);

    // 3. Initial Menu Position
    useEffect(() => {
        if (isSelectionMode) {
            setMenuPos({ 
                x: window.innerWidth / 2 - 110, 
                y: window.innerHeight - 120 
            });
        }
    }, [isSelectionMode]);

    // 4. Auto Open Modal dari URL
    useEffect(() => {
        const editId = searchParams.get('edit');
        const viewId = searchParams.get('view');
        const targetId = editId || viewId;

        if (targetId && dataList.length > 0 && !hasOpenedModalFromQuery) {
            const item = dataList.find(d => d.id === targetId);
            if (item) {
                if (currentUser.role === 'admin_kecamatan') {
                    setCurrentDesa(item.desa);
                }
                setHighlightedRow(targetId);
                
                // Scroll
                setTimeout(() => {
                    const rowElement = document.getElementById(`row-${targetId}`);
                    if (rowElement) rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);

                const mode = viewId ? 'view' : 'edit';
                handleOpenModal(mode, item);
                setHasOpenedModalFromQuery(true);
                
                const timer = setTimeout(() => setHighlightedRow(null), 3000);
                
                // Bersihkan URL
                const newSearchParams = new URLSearchParams(searchParams);
                newSearchParams.delete('edit');
                newSearchParams.delete('view');
                newSearchParams.delete('highlight');
                setSearchParams(newSearchParams, { replace: true });

                return () => clearTimeout(timer);
            }
        }
    }, [searchParams, dataList, currentUser.role, hasOpenedModalFromQuery, setSearchParams]);

    // Helper: Status Kelengkapan
    const getStatusInfo = (item) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Cek Purna Tugas
        if (item.akhir_jabatan) {
            const akhirDate = new Date(item.akhir_jabatan);
            if (akhirDate < today) {
                return { label: 'Purna Tugas', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300', icon: <FiClock size={14}/> };
            }
        }

        // Field Wajib Karang Taruna
        const requiredFields = ['nama', 'jabatan', 'no_sk', 'tgl_lahir', 'jenis_kelamin', 'no_hp'];
        const isComplete = requiredFields.every(field => item[field] && String(item[field]).trim() !== '');

        if (isComplete) {
            return { label: 'Lengkap', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', icon: <FiCheckCircle size={14}/> };
        } else {
            return { label: 'Belum Lengkap', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300', icon: <FiAlertCircle size={14}/> };
        }
    };

    // Filter Data Logic
    const filteredData = useMemo(() => {
        let data = dataList;
        
        // Filter Desa (Menggunakan currentDesa)
        if (currentUser.role === 'admin_kecamatan') {
            data = data.filter(item => item.desa === currentDesa);
        } else {
             data = data.filter(item => item.desa === currentUser.desa);
        }

        // Search
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(item => 
                (item.nama || '').toLowerCase().includes(searchLower) || 
                (item.jabatan || '').toLowerCase().includes(searchLower)
            );
        }
        return data;
    }, [dataList, searchTerm, currentDesa, currentUser]);

    // --- HANDLERS ---
    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
        setFormData(item ? { ...item } : { desa: initialDesa, jenis_kelamin: 'L' }); 
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedItem(null);
        setFormData({});
    };

    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.desa) return showNotification("Desa wajib diisi!", 'error');
        setIsSubmitting(true);
        
        const collectionName = KARANG_TARUNA_CONFIG?.collectionName || 'karang_taruna';

        try {
            let savedId;
            if (selectedItem) {
                await updateDoc(doc(db, collectionName, selectedItem.id), formData);
                savedId = selectedItem.id;
                showNotification('Data Karang Taruna berhasil diperbarui.', 'success');
            } else {
                const newDocRef = await addDoc(collection(db, collectionName), formData);
                savedId = newDocRef.id;
                showNotification('Data Karang Taruna berhasil ditambahkan.', 'success');
            }
            
            // Notifikasi ke Kecamatan
            if (currentUser.role === 'admin_desa') {
                const action = selectedItem ? 'memperbarui' : 'menambahkan';
                const message = `Admin Desa ${currentUser.desa} telah ${action} data Karang Taruna: "${formData.nama}".`;
                const link = `/app/karang-taruna/data?view=${savedId}`;
                await createNotificationForAdmins(message, link, currentUser);
            }
            handleCloseModal();
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- HAPUS ---
    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            const collectionName = KARANG_TARUNA_CONFIG?.collectionName || 'karang_taruna';
            await deleteDoc(doc(db, collectionName, itemToDelete.id));
            showNotification('Data berhasil dihapus.', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    const handleDeleteSelected = async () => {
        setIsSubmitting(true);
        try {
            const collectionName = KARANG_TARUNA_CONFIG?.collectionName || 'karang_taruna';
            const batch = writeBatch(db);
            selectedIds.forEach(id => batch.delete(doc(db, collectionName, id)));
            await batch.commit();
            showNotification(`${selectedIds.length} data berhasil dihapus.`, 'success');
            setIsSelectionMode(false);
            setSelectedIds([]);
        } catch (error) {
            showNotification(`Gagal menghapus: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteSelectedConfirmOpen(false);
        }
    };

    // --- EXPORT & IMPORT ---
    const handleExportXLSX = () => {
        if (filteredData.length === 0) return showNotification("Tidak ada data.", "warning");
        
        const exportDetails = { 
            dataToExport: filteredData, 
            role: currentUser.role, 
            desa: currentDesa, 
            exportConfig, 
            allPerangkat,
            config: KARANG_TARUNA_CONFIG || { title: 'Data Karang Taruna' }
        };
        generateKarangTarunaXLSX(exportDetails);
    };

    // --- PERBAIKAN: HANDLE FILE UPLOAD DENGAN DATE PARSING FIX & DETEKSI DUPLIKASI ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                const jsonDataWithHeaders = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 2 });
                if (jsonDataWithHeaders.length < 1) throw new Error("Format file tidak sesuai. Header tidak ditemukan di baris ke-3.");
                
                const headerRow = jsonDataWithHeaders[0];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 3, header: headerRow });

                if (jsonData.length === 0) throw new Error("File Excel tidak berisi data.");

                const batch = writeBatch(db);
                let newEntriesCount = 0;
                let updatedEntriesCount = 0;
                let skippedCount = 0;

                const parseAndFormatDate = (value) => {
                    if (!value) return null;
                    const formatDateString = (y, m, d) => {
                        const mm = m < 10 ? `0${m}` : m;
                        const dd = d < 10 ? `0${d}` : d;
                        return `${y}-${mm}-${dd}`;
                    };
                    if (value instanceof Date) {
                        return formatDateString(value.getFullYear(), value.getMonth() + 1, value.getDate());
                    }
                    if (typeof value === 'number') {
                        const date = XLSX.SSF.parse_date_code(value);
                        if (date) {
                             return formatDateString(date.y, date.m, date.d);
                        }
                    }
                    try {
                        const date = new Date(value);
                        if (!isNaN(date.getTime())) {
                             return formatDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
                        }
                    } catch (e) { /* ignore */ }
                    return null;
                };

                const existingDataMap = dataList.map(item => ({
                    id: item.id,
                    nik: item.nik ? String(item.nik).trim() : null,
                    nama: item.nama ? String(item.nama).trim().toUpperCase() : null,
                    desa: item.desa ? String(item.desa).trim().toUpperCase() : null,
                    jabatan: item.jabatan ? String(item.jabatan).trim().toUpperCase() : null
                }));

                jsonData.forEach(row => {
                    const rowDesa = row['DESA'] ? String(row['DESA']).trim() : null;
                    if (!rowDesa) { skippedCount++; return; }
                    if (currentUser.role === 'admin_desa' && rowDesa.toUpperCase() !== currentUser.desa.toUpperCase()) { skippedCount++; return; }

                    const rowNik = row['NIK'] ? String(row['NIK']).trim() : null;
                    const rowNama = row['N A M A'] ? String(row['N A M A']).trim() : null;

                    if (!rowNama) { skippedCount++; return; }

                    let existingDoc = null;
                    if (rowNik) existingDoc = existingDataMap.find(d => d.nik === rowNik);
                    if (!existingDoc && rowNama) existingDoc = existingDataMap.find(d => d.nama === rowNama.toUpperCase() && d.desa === rowDesa.toUpperCase());

                    const docData = {};
                    docData.desa = rowDesa;
                    docData.nik = rowNik;
                    docData.nama = rowNama;
                    docData.jabatan = row['JABATAN'] ? String(row['JABATAN']).trim() : null;
                    docData.jenis_kelamin = row['L'] == 1 ? 'L' : (row['P'] == 1 ? 'P' : null);
                    docData.tempat_lahir = row['TEMPAT LAHIR'] || null;
                    docData.tgl_lahir = parseAndFormatDate(row['TANGGAL LAHIR']);
                    
                    const pendidikanMap = { 'SD': 'SD', 'SLTP': 'SLTP', 'SLTA': 'SLTA', 'D1': 'D1', 'D2': 'D2', 'D3': 'D3', 'S1': 'S1', 'S2': 'S2', 'S3': 'S3' };
                    docData.pendidikan = null;
                    for (const key in pendidikanMap) { if (row[key] == 1) { docData.pendidikan = pendidikanMap[key]; break; } }

                    docData.no_sk = row['NO SK'] || null;
                    docData.tgl_pelantikan = parseAndFormatDate(row['TANGGAL PELANTIKAN']);
                    docData.akhir_jabatan = parseAndFormatDate(row['AKHIR MASA JABATAN']);
                    docData.no_hp = row['No. HP / WA'] ? String(row['No. HP / WA']) : null;
                    docData.masa_bakti = row['Masa Bakti (Tahun)'] || null;

                    if (docData.nama && docData.desa) {
                        if (existingDoc) {
                            const docRef = doc(db, KARANG_TARUNA_CONFIG.collectionName, existingDoc.id);
                            docData.status_import = "Terupdate"; 
                            docData.last_updated = new Date().toISOString();
                            batch.update(docRef, docData);
                            updatedEntriesCount++;
                        } else {
                            const newDocRef = doc(collection(db, KARANG_TARUNA_CONFIG.collectionName));
                            docData.created_at = new Date().toISOString();
                            docData.status_import = "Baru";
                            batch.set(newDocRef, docData);
                            newEntriesCount++;
                        }
                    } else {
                        skippedCount++;
                    }
                });

                if (newEntriesCount > 0 || updatedEntriesCount > 0) {
                    await batch.commit();
                    let msg = "";
                    if (newEntriesCount > 0) msg += `${newEntriesCount} Data Baru Ditambahkan. `;
                    if (updatedEntriesCount > 0) msg += `${updatedEntriesCount} Data Berhasil Diperbarui (Terupdate). `;
                    if (skippedCount > 0) msg += `(${skippedCount} baris dilewati).`;
                    showNotification(msg, 'success');
                } else {
                    showNotification(`Tidak ada perubahan data. ${skippedCount > 0 ? `${skippedCount} baris dilewati.` : ''}`, 'info');
                }
            } catch (error) {
                console.error("Error processing file:", error);
                showNotification(`Gagal memproses file: ${error.message}`, 'error');
            } finally {
                setIsUploading(false);
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // --- GESTURE & DRAG UTILS ---
    const activateSelectionMode = (id) => {
        if (!isSelectionMode) { setIsSelectionMode(true); setSelectedIds([id]); if (navigator.vibrate) navigator.vibrate(50); }
    };
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

    // Format Date Helper
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch { return dateString; }
    };

    if (loading || loadingExtras) return <SkeletonLoader columns={5} />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md pb-24 transition-colors duration-300">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white flex items-center gap-2">
                Data Karang Taruna
                {isSelectionMode && <span className="text-sm font-normal px-2 py-1 bg-cyan-100 text-cyan-700 rounded-full">{selectedIds.length} dipilih</span>}
            </h1>

            {/* --- HEADER & TOOLS --- */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <InputField 
                        type="text" 
                        placeholder="Cari nama atau jabatan..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        icon={<FiSearch />} 
                        className="w-full md:w-72"
                    />
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="flex items-center px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800 rounded-lg shadow-sm animate-fadeIn whitespace-nowrap w-full md:w-auto">
                            <FiMapPin className="text-cyan-600 mr-2" />
                            <span className="text-xs font-semibold text-cyan-600 uppercase mr-1 tracking-wider">Desa:</span>
                            <span className="text-sm font-bold text-gray-800 dark:text-cyan-100">{currentDesa}</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2 w-full md:w-auto justify-end flex-wrap">
                    <label className="btn btn-warning cursor-pointer px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg flex items-center transition-colors shadow-sm">
                        <FiUpload className="mr-2"/> Import
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={isUploading}/>
                    </label>
                    <Button onClick={handleExportXLSX} variant="success" className="shadow-sm"><FiDownload className="mr-2"/> Ekspor</Button>
                    <Button onClick={() => handleOpenModal('add')} variant="primary" className="shadow-sm"><FiPlus className="mr-2"/> Tambah</Button>
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
                                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-cyan-600 transition-colors">
                                            {selectedIds.length === filteredData.length ? <FiCheckSquare size={20} className="text-cyan-600"/> : <div className="w-5 h-5 border-2 border-gray-400 rounded mx-auto"></div>}
                                        </button>
                                    ) : 'No'}
                                </th>
                                <th className="px-6 py-4">Nama Pengurus</th>
                                <th className="px-6 py-4">Jabatan</th>
                                <th className="px-6 py-4">No. SK</th>
                                <th className="px-6 py-4 text-center">Status Data</th>
                                <th className="px-6 py-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredData.length > 0 ? filteredData.map((item, index) => {
                                const status = getStatusInfo(item);
                                const isSelected = selectedIds.includes(item.id);
                                
                                return (
                                    <tr 
                                        key={item.id}
                                        id={`row-${item.id}`}
                                        className={`group transition-colors select-none cursor-pointer 
                                            ${isSelected ? 'bg-cyan-50 dark:bg-cyan-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}
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
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-cyan-600 border-cyan-600' : 'border-gray-400 dark:border-gray-500'}`}>
                                                    {isSelected && <FiCheckSquare className="text-white w-3 h-3" />}
                                                </div>
                                            ) : index + 1}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {item.nama}
                                            {item.status_import === 'Terupdate' && (
                                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300">
                                                    Terupdate
                                                </span>
                                            )}
                                            <div className="text-xs text-gray-500 dark:text-gray-400 md:hidden mt-1">{item.jabatan}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{item.jabatan}</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-mono text-xs">{item.no_sk || '-'}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.color} border-transparent`}>
                                                {status.icon} {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenModal('view', item); }} 
                                                    className="p-1.5 text-cyan-600 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-900/30 rounded-lg transition-colors" 
                                                    title="Lihat Detail"
                                                >
                                                    <FiEye size={18} />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', item); }} 
                                                    className="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/30 rounded-lg transition-colors" 
                                                    title="Edit Data"
                                                >
                                                    <FiEdit size={18} />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setItemToDelete(item); setIsDeleteConfirmOpen(true); }} 
                                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors" 
                                                    title="Hapus"
                                                >
                                                    <FiTrash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan="6" className="text-center py-12 text-gray-500 dark:text-gray-400">Tidak ada data ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {currentUser.role === 'admin_kecamatan' && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-center">
                        <Pagination desaList={DESA_LIST} currentDesa={currentDesa} onPageChange={setCurrentDesa} />
                    </div>
                )}
            </div>

            {/* --- MENU AKSI MASSAL --- */}
            {isSelectionMode && (
                <div style={{ position: 'fixed', left: `${menuPos.x}px`, top: `${menuPos.y}px`, zIndex: 9999, touchAction: 'none' }} className="flex items-center gap-3 pl-2 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-2xl rounded-full animate-in fade-in zoom-in duration-200 backdrop-blur-md">
                    <div onMouseDown={startDrag} onTouchStart={startDrag} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-full cursor-move group"><FiMove className="text-gray-500 dark:text-gray-400 group-hover:text-cyan-500" size={16} />
                        <span className="bg-cyan-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center select-none">
                            {selectedIds.length}
                        </span>
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <button onClick={() => setIsDeleteSelectedConfirmOpen(true)} className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all active:scale-95 disabled:opacity-50"><FiTrash2 size={20} /></button>
                    <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all active:scale-95"><FiX size={20} /></button>
                </div>
            )}

            {/* --- MODAL FORM / VIEW MODERN --- */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Detail Pengurus Karang Taruna' : (modalMode === 'edit' ? 'Edit Karang Taruna' : 'Tambah Karang Taruna')}>
                {modalMode === 'view' && selectedItem ? (
                    // --- TAMPILAN DETAIL MODERN ---
                    <div className="space-y-6 animate-fadeIn">
                        {/* Header Profil Singkat */}
                        <div className="flex items-center space-x-4 p-5 bg-gradient-to-r from-cyan-50 to-white dark:from-cyan-900/20 dark:to-gray-800 rounded-xl border border-cyan-100 dark:border-cyan-800/50 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-cyan-100 dark:bg-cyan-800/50 rounded-full blur-xl opacity-50"></div>

                            <div className="relative w-16 h-16 rounded-full bg-white dark:bg-gray-700 border-2 border-cyan-100 dark:border-cyan-700 flex items-center justify-center text-cyan-600 dark:text-cyan-300 text-2xl font-bold shadow-md">
                                {selectedItem.nama ? selectedItem.nama.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="relative z-10 flex-1">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{selectedItem.nama}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200">
                                        <FiActivity size={12} /> {selectedItem.jabatan}
                                    </span>
                                    {/* Status Badge */}
                                    {(() => {
                                        const status = getStatusInfo(selectedItem);
                                        return (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.color} border-transparent`}>
                                                {status.icon} {status.label}
                                            </span>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Grid Informasi - Mengikuti Urutan Form Formulir */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Kolom Kiri: Informasi Pribadi */}
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                                    <FiUser className="text-cyan-600" />
                                    <h4 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">Informasi Pribadi</h4>
                                </div>
                                <div className="space-y-1">
                                    <DetailRow icon={<FiHash />} label="NIK" value={selectedItem.nik} />
                                    <DetailRow icon={<FiUser />} label="Nama Lengkap" value={selectedItem.nama} />
                                    <DetailRow icon={<FiBriefcase />} label="Jabatan" value={selectedItem.jabatan} />
                                    <DetailRow icon={<FiFlag />} label="Jenis Kelamin" value={selectedItem.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                                    <DetailRow icon={<FiBook />} label="Pendidikan" value={selectedItem.pendidikan} />
                                    <DetailRow icon={<FiMapPin />} label="Tempat Lahir" value={selectedItem.tempat_lahir} />
                                    <DetailRow icon={<FiCalendar />} label="Tanggal Lahir" value={formatDate(selectedItem.tgl_lahir)} isLast />
                                </div>
                            </div>

                            {/* Kolom Kanan: Data Organisasi & Kontak */}
                            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-300">
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                                    <FiBriefcase className="text-cyan-600" />
                                    <h4 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">Data Organisasi</h4>
                                </div>
                                <div className="space-y-1">
                                    <DetailRow icon={<FiHash />} label="Nomor SK" value={selectedItem.no_sk} />
                                    <DetailRow icon={<FiCalendar />} label="Tgl Pelantikan" value={formatDate(selectedItem.tgl_pelantikan)} />
                                    <DetailRow icon={<FiClock />} label="Masa Bakti" value={selectedItem.masa_bakti ? `${selectedItem.masa_bakti} Tahun` : '-'} />
                                    <DetailRow icon={<FiCalendar />} label="Akhir Jabatan" value={formatDate(selectedItem.akhir_jabatan)} />
                                    <DetailRow icon={<FiPhone />} label="No. HP / WA" value={selectedItem.no_hp} />
                                    {selectedItem.desa && (
                                        <DetailRow icon={<FiMapPin />} label="Desa" value={selectedItem.desa} isLast />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                            <Button type="button" variant="secondary" onClick={handleCloseModal}>Tutup</Button>
                        </div>
                    </div>
                ) : (
                    // --- FORMULIR EDIT / TAMBAH ---
                    <form onSubmit={handleFormSubmit} className="space-y-4 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="NIK" name="nik" value={formData.nik || ''} onChange={handleFormChange} placeholder="Nomor Induk Kependudukan"/>
                            <InputField label="Nama Lengkap" name="nama" value={formData.nama || ''} onChange={handleFormChange} required />
                            
                            <InputField label="Jabatan" name="jabatan" type="select" value={formData.jabatan || ''} onChange={handleFormChange} required>
                                <option value="">Pilih Jabatan</option>
                                {JABATAN_KT_LIST.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </InputField>

                            <InputField label="Jenis Kelamin" name="jenis_kelamin" type="select" value={formData.jenis_kelamin || ''} onChange={handleFormChange}>
                                <option value="">Pilih</option>
                                {JENIS_KELAMIN_LIST.map(jk => <option key={jk} value={jk}>{jk}</option>)}
                            </InputField>
                            <InputField label="Pendidikan" name="pendidikan" type="select" value={formData.pendidikan || ''} onChange={handleFormChange}>
                                <option value="">Pilih</option>
                                {PENDIDIKAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                            </InputField>
                            <InputField label="Tempat Lahir" name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleFormChange} />
                            <InputField label="Tanggal Lahir" name="tgl_lahir" type="date" value={formData.tgl_lahir || ''} onChange={handleFormChange} />
                            <InputField label="Nomor SK" name="no_sk" value={formData.no_sk || ''} onChange={handleFormChange} />
                            <InputField label="Tanggal Pelantikan" name="tgl_pelantikan" type="date" value={formData.tgl_pelantikan || ''} onChange={handleFormChange} />
                            <InputField label="Masa Bakti (Tahun)" name="masa_bakti" type="number" value={formData.masa_bakti || ''} onChange={handleFormChange} />
                            <InputField label="Akhir Jabatan" name="akhir_jabatan" type="date" value={formData.akhir_jabatan || ''} onChange={handleFormChange} />
                            <InputField label="No. HP" name="no_hp" value={formData.no_hp || ''} onChange={handleFormChange} />
                        </div>
                        
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
                )}
            </Modal>

            {/* --- KONFIRMASI HAPUS --- */}
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDelete} isLoading={isSubmitting} title="Hapus Data" message="Yakin ingin menghapus data ini?" variant="danger"/>
            <ConfirmationModal isOpen={isDeleteSelectedConfirmOpen} onClose={() => setIsDeleteSelectedConfirmOpen(false)} onConfirm={handleDeleteSelected} isLoading={isSubmitting} title="Hapus Massal" message={`Yakin ingin menghapus ${selectedIds.length} data terpilih?`} variant="danger"/>
        </div>
    );
};

export default KarangTarunaPage;