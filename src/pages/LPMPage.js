import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, writeBatch, getDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSearchParams } from 'react-router-dom';

// Komponen UI
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import SkeletonLoader from '../components/common/SkeletonLoader';
import InputField from '../components/common/InputField';
import OrganisasiDetailView from '../components/common/OrganisasiDetailView';
import Pagination from '../components/common/Pagination';

// Utilitas & Konfigurasi
import { LPM_CONFIG, DESA_LIST, JENIS_KELAMIN_LIST, PENDIDIKAN_LIST } from '../utils/constants';
import { generateLpmXLSX } from '../utils/generateLpmXLSX';
import { createNotificationForAdmins } from '../utils/notificationService';
import * as XLSX from 'xlsx';

// Ikon
import { FiEdit, FiSearch, FiUpload, FiDownload, FiPlus, FiEye, FiTrash2, FiCheckSquare, FiX, FiMove, FiAlertCircle, FiCheckCircle, FiXCircle, FiClock, FiArrowRight, FiMapPin } from 'react-icons/fi';

// Konstanta Jabatan LPM
const JABATAN_LPM_LIST = ["Ketua", "Sekretaris", "Bendahara", "Anggota"];

const LPMPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);

    // State untuk data pendukung
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [exportConfig, setExportConfig] = useState(null);
    const [loadingExtras, setLoadingExtras] = useState(true);

    // State untuk Modal & Form
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // State untuk Konfirmasi Hapus
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);

    // State untuk Filter & Pencarian
    const [searchTerm, setSearchTerm] = useState('');
    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);
    const [hasOpenedModalFromQuery, setHasOpenedModalFromQuery] = useState(false);

    // --- STATE & REFS UNTUK SELEKSI & GESER POPUP ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    
    // Gesture Refs
    const longPressTimer = useRef(null);
    const isScrolling = useRef(false);
    const touchStartCoords = useRef({ x: 0, y: 0 });

    // Draggable Menu State
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 }); 
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Mengambil data utama (LPM) dari Firestore
    useEffect(() => {
        const q = query(collection(db, LPM_CONFIG.collectionName));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDataList(list);
            setLoading(false);
        }, (error) => {
            console.error(`Error fetching ${LPM_CONFIG.collectionName}:`, error);
            showNotification(`Gagal memuat data: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [showNotification]);

    // Mengambil data pendukung untuk ekspor
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
                console.error("Error fetching extra data for export:", error);
            } finally {
                setLoadingExtras(false);
            }
        };
        fetchExtraData();
    }, []);

    // Set Initial Menu Position
    useEffect(() => {
        if (isSelectionMode) {
            setMenuPos({ 
                x: window.innerWidth / 2 - 110, 
                y: window.innerHeight - 120 
            });
        }
    }, [isSelectionMode]);

    // Efek untuk menangani Auto-Open dari URL
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
                
                setTimeout(() => {
                    const rowElement = document.getElementById(`row-${targetId}`);
                    if (rowElement) {
                        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 500);

                const mode = viewId ? 'view' : 'edit';
                handleOpenModal(mode, item);
                setHasOpenedModalFromQuery(true);
                
                const timer = setTimeout(() => setHighlightedRow(null), 3000);

                const newSearchParams = new URLSearchParams(searchParams);
                newSearchParams.delete('edit');
                newSearchParams.delete('view');
                newSearchParams.delete('highlight');
                setSearchParams(newSearchParams, { replace: true });

                return () => clearTimeout(timer);
            }
        }
    }, [searchParams, dataList, currentUser.role, hasOpenedModalFromQuery, setSearchParams]);

    // Helper: Cek Status Kelengkapan & Purna Tugas
    const getStatusInfo = (item) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (item.akhir_jabatan) {
            const akhirDate = new Date(item.akhir_jabatan);
            if (akhirDate < today) {
                return { label: 'Purna Tugas', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300', icon: <FiClock size={14}/> };
            }
        }

        const requiredFields = ['nama', 'jabatan', 'no_sk', 'tgl_lahir', 'jenis_kelamin'];
        const isComplete = requiredFields.every(field => item[field] && String(item[field]).trim() !== '');

        if (isComplete) {
            return { label: 'Lengkap', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', icon: <FiCheckCircle size={14}/> };
        } else {
            return { label: 'Belum Lengkap', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300', icon: <FiAlertCircle size={14}/> };
        }
    };

    const filteredData = useMemo(() => {
        let data = dataList;
        if (currentUser.role === 'admin_kecamatan') {
            data = data.filter(item => item.desa === currentDesa);
        } else {
             data = data.filter(item => item.desa === currentUser.desa);
        }
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(item => (item.nama || '').toLowerCase().includes(searchLower) || (item.jabatan || '').toLowerCase().includes(searchLower));
        }
        return data;
    }, [dataList, searchTerm, currentDesa, currentUser]);

    // --- LOGIKA SELEKSI & GESTURE ---
    const activateSelectionMode = (id) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds([id]);
            if (navigator.vibrate) navigator.vibrate(50);
        }
    };

    const handleRowDoubleClick = (id) => activateSelectionMode(id);

    const handleRowTouchStart = (id, e) => {
        isScrolling.current = false;
        touchStartCoords.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        longPressTimer.current = setTimeout(() => {
            if (!isScrolling.current) activateSelectionMode(id);
        }, 600);
    };

    const handleRowTouchMove = (e) => {
        const moveX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
        const moveY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);
        if (moveX > 10 || moveY > 10) {
            isScrolling.current = true;
            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        }
    };

    const handleRowTouchEnd = () => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredData.length) setSelectedIds([]);
        else setSelectedIds(filteredData.map(item => item.id));
    };

    // --- LOGIKA DRAGGABLE POPUP ---
    const startDrag = (e) => {
        setIsDragging(true);
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragOffset.current = { x: clientX - menuPos.x, y: clientY - menuPos.y };
    };

    const onDrag = (e) => {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        setMenuPos({ x: clientX - dragOffset.current.x, y: clientY - dragOffset.current.y });
    };

    const stopDrag = () => setIsDragging(false);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', onDrag); window.addEventListener('mouseup', stopDrag);
            window.addEventListener('touchmove', onDrag, { passive: false }); window.addEventListener('touchend', stopDrag);
        } else {
            window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', onDrag); window.removeEventListener('touchend', stopDrag);
        }
        return () => {
            window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', onDrag); window.removeEventListener('touchend', stopDrag);
        };
    }, [isDragging]);

    // Modal Handlers
    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
        setFormData(item ? { ...item } : { desa: initialDesa, jenis_kelamin: 'L' }); // Default
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
        try {
            let savedId;
            if (selectedItem) {
                await updateDoc(doc(db, LPM_CONFIG.collectionName, selectedItem.id), formData);
                savedId = selectedItem.id;
                showNotification('Data LPM berhasil diperbarui.', 'success');
            } else {
                const newDocRef = await addDoc(collection(db, LPM_CONFIG.collectionName), formData);
                savedId = newDocRef.id;
                showNotification('Data LPM berhasil ditambahkan.', 'success');
            }
            
            if (currentUser.role === 'admin_desa') {
                const action = selectedItem ? 'memperbarui' : 'menambahkan';
                const message = `Admin Desa ${currentUser.desa} telah ${action} data LPM: "${formData.nama}".`;
                const link = `/app/lpm/data?view=${savedId}`;
                await createNotificationForAdmins(message, link, currentUser);
            }
            handleCloseModal();
        } catch (error) {
            showNotification(`Gagal menyimpan data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, LPM_CONFIG.collectionName, itemToDelete.id));
            showNotification('Data berhasil dihapus.', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    const openDeleteSelectedConfirm = () => {
        if (selectedIds.length === 0) return;
        setIsDeleteSelectedConfirmOpen(true);
    };

    const handleDeleteSelected = async () => {
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, LPM_CONFIG.collectionName, id));
            });
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

    const handleExportXLSX = () => {
        if (filteredData.length === 0) return showNotification("Tidak ada data.", "warning");
        const exportDetails = { dataToExport: filteredData, role: currentUser.role, desa: currentDesa, exportConfig, allPerangkat };
        generateLpmXLSX(exportDetails);
    };

    const handleFileUpload = (e) => {
        // Logika import placeholder
        const file = e.target.files[0];
        if(!file) return;
        showNotification('Fitur Import aktif.', 'info');
    };

    if (loading || loadingExtras) return <SkeletonLoader columns={5} />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md pb-24 transition-colors duration-300">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white flex items-center gap-2">
                Data Pengurus LPM
                {isSelectionMode && <span className="text-sm font-normal px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{selectedIds.length} dipilih</span>}
            </h1>

            {/* Header & Tools */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <InputField 
                        type="text" 
                        placeholder="Cari nama atau jabatan..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        icon={<FiSearch />} 
                        className="w-full md:w-72"
                    />
                    
                    {/* [MODIFIKASI] Menampilkan Desa Terpilih (Sesuai Pagination) untuk Admin Kecamatan */}
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="flex items-center px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg shadow-sm animate-fadeIn">
                            <FiMapPin className="text-blue-500 mr-2" />
                            <span className="text-xs font-semibold text-blue-500 uppercase mr-1 tracking-wider">Desa:</span>
                            <span className="text-sm font-bold text-gray-800 dark:text-blue-100">{currentDesa}</span>
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

            {/* Tabel Data */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 uppercase text-xs font-semibold border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 w-10 text-center">
                                    {isSelectionMode ? (
                                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-blue-600 transition-colors">
                                            {selectedIds.length === filteredData.length ? <FiCheckSquare size={20} className="text-blue-600"/> : <div className="w-5 h-5 border-2 border-gray-400 rounded mx-auto"></div>}
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
                                            ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}
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
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400 dark:border-gray-500'}`}>
                                                    {isSelected && <FiCheckSquare className="text-white w-3 h-3" />}
                                                </div>
                                            ) : index + 1}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {item.nama}
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
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors" 
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

                {/* Pagination untuk Admin Kecamatan */}
                {currentUser.role === 'admin_kecamatan' && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-center">
                        <Pagination desaList={DESA_LIST} currentDesa={currentDesa} onPageChange={setCurrentDesa} />
                    </div>
                )}

                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <FiAlertCircle className="text-blue-500"/> 
                    <span>Klik 2x atau Tahan baris untuk mode seleksi massal.</span>
                </div>
            </div>

            {/* --- DRAGGABLE MENU (Hapus Massal) --- */}
            {isSelectionMode && (
                <div 
                    style={{ position: 'fixed', left: `${menuPos.x}px`, top: `${menuPos.y}px`, zIndex: 9999, touchAction: 'none' }}
                    className="flex items-center gap-3 pl-2 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-2xl rounded-full animate-in fade-in zoom-in duration-200 backdrop-blur-md"
                >
                    <div onMouseDown={startDrag} onTouchStart={startDrag} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full cursor-move transition-colors group">
                        <FiMove className="text-gray-500 dark:text-gray-400 group-hover:text-blue-500" size={16} />
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center select-none">
                            {selectedIds.length}
                        </span>
                    </div>
                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex items-center gap-1">
                        <button onClick={openDeleteSelectedConfirm} disabled={selectedIds.length === 0} className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all active:scale-95 disabled:opacity-50">
                            <FiTrash2 size={20} />
                        </button>
                        <button onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }} className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all active:scale-95">
                            <FiX size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Form */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Detail Pengurus' : `${selectedItem ? 'Edit' : 'Tambah'} Data LPM`}>
                {modalMode === 'view' ? <OrganisasiDetailView data={selectedItem} config={LPM_CONFIG} /> : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Nama Lengkap" name="nama" value={formData.nama || ''} onChange={handleFormChange} required />
                            
                            {/* Input Jabatan */}
                            <InputField 
                                label="Jabatan" 
                                name="jabatan" 
                                type="select" 
                                value={formData.jabatan || ''} 
                                onChange={handleFormChange} 
                                required
                            >
                                <option value="">Pilih Jabatan</option>
                                {JABATAN_LPM_LIST.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                            <Button type="submit" variant="primary" isLoading={isSubmitting}>Simpan</Button>
                        </div>
                    </form>
                )}
            </Modal>

            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDelete} isLoading={isSubmitting} title="Hapus Data" message="Yakin ingin menghapus data ini?" variant="danger"/>
            <ConfirmationModal isOpen={isDeleteSelectedConfirmOpen} onClose={() => setIsDeleteSelectedConfirmOpen(false)} onConfirm={handleDeleteSelected} isLoading={isSubmitting} title="Hapus Massal" message={`Yakin ingin menghapus ${selectedIds.length} data terpilih?`} variant="danger"/>
        </div>
    );
};

export default LPMPage;