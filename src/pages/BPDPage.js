import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, writeBatch, getDoc, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

// Komponen UI
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Pagination from '../components/common/Pagination';
import Button from '../components/common/Button';

// Hook & Utilitas
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useNotification } from '../context/NotificationContext';
import { generateBpdXLSX } from '../utils/generateBpdXLSX';
import { DESA_LIST } from '../utils/constants';
import { createNotificationForAdmins, createNotificationForDesaAdmins } from '../utils/notificationService';

// Ikon
import { 
    FiEdit, FiTrash2, FiSearch, FiFilter, FiPlus, FiUpload, 
    FiDownload, FiEye, FiCheckSquare, FiX, FiMove, FiAlertCircle,
    FiUser, FiMapPin, FiCalendar, FiSmartphone, FiBriefcase
} from 'react-icons/fi';

// Daftar statis
const JABATAN_BPD_LIST = ["Ketua", "Wakil Ketua", "Sekretaris", "Anggota"];
const PENDIDIKAN_LIST = ["SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"];
const AGAMA_LIST = ["Islam", "Kristen", "Katolik", "Hindu", "Budha", "Konghucu"];
const JENIS_KELAMIN_LIST = ["Laki-laki", "Perempuan"];

// --- KOMPONEN DETAIL YANG DIPERBAIKI ---
const BpdDetailView = ({ bpd }) => {
    if (!bpd) return null;

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const DetailItem = ({ label, value, icon: Icon }) => (
        <div className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-1">
                {Icon && <Icon className="text-gray-400 text-xs" />}
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words">{value || '-'}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header Profil */}
            <div className="flex flex-col items-center text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-blue-100 dark:border-gray-600">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                    <FiUser size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{bpd.nama}</h3>
                <p className="text-gray-600 dark:text-gray-300 font-medium">{bpd.jabatan}</p>
                <div className="mt-2 flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-600 rounded-full shadow-sm">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-300">Desa {bpd.desa}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs text-gray-500 dark:text-gray-300">Periode {bpd.periode || '-'}</span>
                </div>
            </div>

            {/* Grid Informasi */}
            <div className="space-y-4">
                <div>
                    <h4 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                        <FiBriefcase className="text-blue-500" /> Informasi Keanggotaan
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <DetailItem label="No. SK Bupati" value={bpd.no_sk_bupati} />
                        <DetailItem label="Tgl SK Bupati" value={formatDate(bpd.tgl_sk_bupati)} icon={FiCalendar} />
                        <DetailItem label="Tgl Pelantikan" value={formatDate(bpd.tgl_pelantikan)} icon={FiCalendar} />
                        <DetailItem label="Wilayah Pemilihan" value={bpd.wil_pmlhn} icon={FiMapPin} />
                    </div>
                </div>

                <div>
                    <h4 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                        <FiUser className="text-blue-500" /> Data Pribadi
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <DetailItem label="Jenis Kelamin" value={bpd.jenis_kelamin} />
                        <DetailItem label="Tempat, Tgl Lahir" value={`${bpd.tempat_lahir || ''}, ${formatDate(bpd.tgl_lahir)}`} />
                        <DetailItem label="Pendidikan" value={bpd.pendidikan} />
                        <DetailItem label="Pekerjaan" value={bpd.pekerjaan} />
                        <DetailItem label="Agama" value={bpd.agama} />
                        <DetailItem label="Kontak (HP/WA)" value={bpd.no_hp} icon={FiSmartphone} />
                    </div>
                </div>

                <div>
                    <h4 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                        <FiMapPin className="text-blue-500" /> Alamat Domisili
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                        <DetailItem label="Desa" value={bpd.desa} />
                        <DetailItem label="RT" value={bpd.rt} />
                        <DetailItem label="RW" value={bpd.rw} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- HALAMAN UTAMA ---
const BPDPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    // Logic useFirestoreCollection tetap sama untuk menjaga sinkronisasi dengan Dashboard
    const { data: allBpd, loading, addItem, updateItem, deleteItem } = useFirestoreCollection('bpd');

    const [allPerangkat, setAllPerangkat] = useState([]);
    const [exportConfig, setExportConfig] = useState(null);
    const [loadingExtras, setLoadingExtras] = useState(true);

    const [modalMode, setModalMode] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBpd, setSelectedBpd] = useState(null);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [periodeFilter, setPeriodeFilter] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadConfig, setUploadConfig] = useState(null);
    
    // State Hapus
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [bpdToDelete, setBpdToDelete] = useState(null);
    const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);

    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const navigate = useNavigate();
    const [highlightedRow, setHighlightedRow] = useState(null);

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

    // --- DEKLARASI FUNGSI (Logika Bisnis) ---
    const handleOpenModal = useCallback((bpd = null, mode = 'add') => {
        setModalMode(mode);
        setSelectedBpd(bpd);
        if (mode === 'add') {
            const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
            setFormData({ desa: initialDesa, rt: '', rw: '' });
        } else {
            setFormData(bpd);
        }
        setIsModalOpen(true);
    }, [currentUser, currentDesa]);

    const handleCloseModal = useCallback(() => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setModalMode(null);
        setSelectedBpd(null);
        setFormData({});
    }, [isSubmitting]);

    // --- EFEK SAMPING & LOGIKA ---
    useEffect(() => {
        if (currentUser && currentUser.role === 'admin_desa') {
            setCurrentDesa(currentUser.desa);
        }
    }, [currentUser]);

    useEffect(() => {
        if (isSelectionMode) {
            setMenuPos({ 
                x: window.innerWidth / 2 - 110, 
                y: window.innerHeight - 120 
            });
        }
    }, [isSelectionMode]);

    useEffect(() => {
        const fetchExtraData = async () => {
            setLoadingExtras(true);
            try {
                const exportRef = doc(db, 'settings', 'exportConfig');
                const exportSnap = await getDoc(exportRef);
                if (exportSnap.exists()) {
                    setExportConfig(exportSnap.data());
                }

                const perangkatQuery = query(collection(db, 'perangkat'));
                const perangkatSnapshot = await getDocs(perangkatQuery);
                const perangkatList = perangkatSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllPerangkat(perangkatList);

            } catch (error) {
                console.error("Error fetching extra data for export:", error);
                showNotification("Gagal memuat data pendukung untuk ekspor.", "error");
            } finally {
                setLoadingExtras(false);
            }
        };

        fetchExtraData();
    }, [showNotification]);


    useEffect(() => {
        const fetchUploadConfig = async () => {
            const docRef = doc(db, 'settings', 'bpdUploadConfig');
            const docSnap = await getDoc(docRef);
            setUploadConfig(docSnap.exists() ? docSnap.data() : {});
        };
        fetchUploadConfig();
    }, []);

    useEffect(() => {
        const editId = searchParams.get('edit');
        const viewId = searchParams.get('view');
        const highlightId = searchParams.get('highlight');
        const targetDesa = searchParams.get('desa');
    
        if (currentUser.role === 'admin_kecamatan' && targetDesa && targetDesa !== currentDesa) {
            setCurrentDesa(targetDesa);
        }
    
        if (highlightId) {
            setHighlightedRow(highlightId);
            const timer = setTimeout(() => {
                setHighlightedRow(null);
                searchParams.delete('highlight');
                searchParams.delete('desa');
                setSearchParams(searchParams, { replace: true });
            }, 3000);
            return () => clearTimeout(timer);
        }
    
        if ((editId || viewId) && allBpd.length > 0) {
            const bpdToShow = allBpd.find(b => b.id === (editId || viewId));
            if (bpdToShow) {
                handleOpenModal(bpdToShow, editId ? 'edit' : 'view');
                searchParams.delete('edit');
                searchParams.delete('view');
                setSearchParams(searchParams, { replace: true });
            }
        }
    }, [allBpd, searchParams, currentUser.role, currentDesa, handleOpenModal, setSearchParams]);
    
    // Filter Data
    const filteredBpd = useMemo(() => {
        if (!currentUser) return [];
        let data = allBpd;

        if (currentUser.role === 'admin_kecamatan') {
            if (currentDesa !== 'all') {
                data = data.filter(b => b.desa === currentDesa);
            }
        } else {
            data = data.filter(b => b.desa === currentUser.desa);
        }
        
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(b =>
                (b.nama && b.nama.toLowerCase().includes(searchLower)) ||
                (b.jabatan && b.jabatan.toLowerCase().includes(searchLower))
            );
        }
        if (periodeFilter) {
            data = data.filter(b => b.periode && b.periode.includes(periodeFilter));
        }
        return data;
    }, [allBpd, searchTerm, currentUser, currentDesa, periodeFilter]);

    // --- LOGIKA SELEKSI (CHECKBOX) & GESTURE ---

    const activateSelectionMode = (id) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds([id]);
            if (navigator.vibrate) navigator.vibrate(50);
        }
    };

    const handleRowDoubleClick = (id) => {
        activateSelectionMode(id);
    };

    const handleRowTouchStart = (id, e) => {
        isScrolling.current = false;
        touchStartCoords.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };

        longPressTimer.current = setTimeout(() => {
            if (!isScrolling.current) {
                activateSelectionMode(id);
            }
        }, 600);
    };

    const handleRowTouchMove = (e) => {
        const moveX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
        const moveY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);

        if (moveX > 10 || moveY > 10) {
            isScrolling.current = true;
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
    };

    const handleRowTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredBpd.length) setSelectedIds([]);
        else setSelectedIds(filteredBpd.map(item => item.id));
    };

    // --- LOGIKA DRAGGABLE POPUP MENU ---
    const startDrag = (e) => {
        setIsDragging(true);
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        dragOffset.current = {
            x: clientX - menuPos.x,
            y: clientY - menuPos.y
        };
    };

    const onDrag = (e) => {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const newX = clientX - dragOffset.current.x;
        const newY = clientY - dragOffset.current.y;

        setMenuPos({ x: newX, y: newY });
    };

    const stopDrag = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', onDrag);
            window.addEventListener('mouseup', stopDrag);
            window.addEventListener('touchmove', onDrag, { passive: false });
            window.addEventListener('touchend', stopDrag);
        } else {
            window.removeEventListener('mousemove', onDrag);
            window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', onDrag);
            window.removeEventListener('touchend', stopDrag);
        }
        return () => {
            window.removeEventListener('mousemove', onDrag);
            window.removeEventListener('mouseup', stopDrag);
            window.removeEventListener('touchmove', onDrag);
            window.removeEventListener('touchend', stopDrag);
        };
    }, [isDragging]);

    const openDeleteSelectedConfirm = () => {
        if (selectedIds.length === 0) return;
        setIsDeleteSelectedConfirmOpen(true);
    };

    const handleDeleteSelected = async () => {
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, 'bpd', id));
            });
            await batch.commit();
            showNotification(`${selectedIds.length} data BPD berhasil dihapus.`, 'success');
            setIsSelectionMode(false);
            setSelectedIds([]);
        } catch (error) {
            showNotification(`Gagal menghapus: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteSelectedConfirmOpen(false);
        }
    };
    
    // --- FORM HANDLING ---
    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.desa) {
            showNotification("Desa wajib diisi!", 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            let docId = selectedBpd ? selectedBpd.id : null;
            if (selectedBpd) {
                await updateItem(selectedBpd.id, formData);
                showNotification("Data BPD berhasil diperbarui.", "success");
                
                if (currentUser.role === 'admin_kecamatan') {
                    const message = `Admin Kecamatan telah memperbarui data BPD untuk "${formData.nama}".`;
                    const link = `/app/bpd/data?view=${selectedBpd.id}`;
                    await createNotificationForDesaAdmins(selectedBpd.desa, message, link);
                }
            } else {
                const newDocRef = await addItem(formData);
                docId = newDocRef.id;
                showNotification("Data BPD baru berhasil ditambahkan.", "success");

                if (currentUser.role === 'admin_desa' && docId) {
                    const message = `Admin Desa ${currentUser.desa} telah menambahkan data BPD baru: "${formData.nama}".`;
                    const link = `/app/bpd/data?view=${docId}&desa=${currentUser.desa}`;
                    await createNotificationForAdmins(message, link, currentUser);
                }
            }
            handleCloseModal();
        } catch(error){
            showNotification(`Gagal menyimpan data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = (bpd) => {
        setBpdToDelete(bpd);
        setIsDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!bpdToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteItem(bpdToDelete.id);
            showNotification(`Data BPD "${bpdToDelete.nama}" berhasil dihapus.`, 'success');
        } catch (error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setBpdToDelete(null);
        }
    };

    // --- XLSX EXPORT & IMPORT ---
    const handleExportXLSX = useCallback((scope) => {
        setIsExportModalOpen(false);
        let dataToExport;

        if (scope === 'all') {
            dataToExport = allBpd;
        } else { 
            dataToExport = filteredBpd;
        }

        if (dataToExport.length === 0) {
            showNotification("Tidak ada data untuk diekspor.", "warning");
            return;
        }
        
        const exportDetails = {
            bpdData: dataToExport,
            role: currentUser.role,
            desa: scope === 'all' ? 'all' : (currentUser.desa || currentDesa),
            periodeFilter: periodeFilter,
            exportConfig: exportConfig,
            allPerangkat: allPerangkat
        };

        generateBpdXLSX(exportDetails);
    }, [allBpd, filteredBpd, currentUser, currentDesa, periodeFilter, exportConfig, allPerangkat, showNotification]);

    const handleExportClick = useCallback(() => {
        if (currentUser.role === 'admin_kecamatan') {
            setIsExportModalOpen(true);
        } else {
            handleExportXLSX('current');
        }
    }, [currentUser, handleExportXLSX]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!uploadConfig || Object.values(uploadConfig).every(v => !v)) {
            showNotification("Pengaturan format upload belum diatur.", "warning");
            e.target.value = null;
            return;
        }
        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const existingDataMap = new Map(allBpd.map(b => [
                    `${String(b.nama || '').toLowerCase().trim()}_${String(b.no_sk_bupati || '').toString().trim()}`,
                    b.id
                ]));
    
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {raw: false});
                if (jsonData.length === 0) throw new Error('File Excel kosong.');
    
                const batch = writeBatch(db);
                let newEntriesCount = 0;
                let updatedEntriesCount = 0;
    
                const reverseUploadConfig = {};
                for (const key in uploadConfig) {
                    if (uploadConfig[key]) reverseUploadConfig[uploadConfig[key]] = key;
                }
    
                for (const row of jsonData) {
                    const newDoc = {};
                    for (const excelHeader in row) {
                        const firestoreField = reverseUploadConfig[excelHeader.trim()];
                        if (firestoreField) {
                            let value = row[excelHeader];
                            if (value instanceof Date) {
                                const userTimezoneOffset = value.getTimezoneOffset() * 60000;
                                value = new Date(value.getTime() - userTimezoneOffset).toISOString().split('T')[0];
                            }
                            newDoc[firestoreField] = value;
                        }
                    }
                    if (currentUser.role === 'admin_desa') newDoc.desa = currentUser.desa;
                    const nama = String(newDoc.nama || '').toLowerCase().trim();
                    const noSkBupati = String(newDoc.no_sk_bupati || '').toString().trim();
                    if (!nama || !noSkBupati || !newDoc.desa) continue;
    
                    const uniqueKey = `${nama}_${noSkBupati}`;
                    
                    if (existingDataMap.has(uniqueKey)) {
                        const docId = existingDataMap.get(uniqueKey);
                        const docRef = doc(db, 'bpd', docId);
                        batch.update(docRef, newDoc);
                        updatedEntriesCount++;
                    } else {
                        const newDocRef = doc(collection(db, 'bpd'));
                        batch.set(newDocRef, newDoc);
                        existingDataMap.set(uniqueKey, newDocRef.id);
                        newEntriesCount++;
                    }
                }
    
                if (newEntriesCount > 0 || updatedEntriesCount > 0) {
                    await batch.commit();
                    
                    if (currentUser.role === 'admin_desa') {
                        const message = `Impor BPD Desa ${currentUser.desa}: ${newEntriesCount} data ditambah, ${updatedEntriesCount} data diperbarui.`;
                        const link = `/app/bpd/data?desa=${currentUser.desa}`;
                        await createNotificationForAdmins(message, link, currentUser);
                    }
                }
    
                let notificationMessage = "";
                if (newEntriesCount > 0) notificationMessage += `${newEntriesCount} data baru berhasil diimpor. `;
                if (updatedEntriesCount > 0) notificationMessage += `${updatedEntriesCount} data berhasil diperbarui.`;
                if (!notificationMessage) notificationMessage = "Tidak ada data baru atau yang perlu diperbarui dari file.";
                
                showNotification(notificationMessage, 'success', 8000);
    
            } catch (error) {
                showNotification(`Gagal memproses file: ${error.message}`, 'error');
            } finally {
                setIsUploading(false);
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    const getModalTitle = () => {
        if (modalMode === 'view') return 'Detail Anggota BPD';
        if (modalMode === 'edit') return 'Edit Data BPD';
        return 'Tambah Data BPD';
    };
    
    const highlightClass = (id) => highlightedRow === id ? 'bg-yellow-50 dark:bg-yellow-900/40 ring-2 ring-yellow-400' : '';

    if (loading || loadingExtras) return <Spinner size="lg" />;

    return (
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[85vh] relative pb-24">
            
            {/* --- HEADER SECTION --- */}
            <div className="mb-6 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Data BPD</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Kelola data Badan Permusyawaratan Desa</p>
                    </div>
                    
                    {/* Action Buttons Group */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                         <label className={`btn btn-sm bg-yellow-500 hover:bg-yellow-600 text-white border-none rounded-lg cursor-pointer flex items-center gap-2 px-4 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <FiUpload className=""/> 
                            <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={isUploading}/>
                            <span className="hidden sm:inline">{isUploading ? 'Proses...' : 'Impor Excel'}</span>
                        </label>
                        <Button onClick={handleExportClick} variant="success" className="btn-sm flex items-center gap-2 rounded-lg shadow-sm">
                            <FiDownload /> <span className="hidden sm:inline">Ekspor</span>
                        </Button>
                        <Button onClick={() => handleOpenModal(null, 'add')} variant="primary" className="btn-sm flex items-center gap-2 rounded-lg shadow-blue-200 dark:shadow-none shadow-sm">
                            <FiPlus /> Tambah Data
                        </Button>
                    </div>
                </div>

                {/* Toolbar Filter */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-6 lg:col-span-5 relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Cari nama atau jabatan..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>
                    <div className="md:col-span-6 lg:col-span-4 relative">
                        <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Filter periode (Contoh: 2019-2025)" 
                            value={periodeFilter} 
                            onChange={(e) => setPeriodeFilter(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>
                </div>
            </div>
            
            {/* --- DATA DISPLAY: CARD (Mobile) & TABLE (Desktop) --- */}
            {filteredBpd.length > 0 ? (
                <>
                    {/* MOBILE CARD VIEW */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {filteredBpd.map((p) => (
                            <div 
                                key={p.id}
                                className={`bg-white dark:bg-gray-800 p-4 rounded-xl border transition-all relative overflow-hidden
                                    ${selectedIds.includes(p.id) ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'}
                                    ${highlightClass(p.id)}
                                `}
                                onClick={() => isSelectionMode && toggleSelection(p.id)}
                                onTouchStart={(e) => handleRowTouchStart(p.id, e)}
                                onTouchMove={handleRowTouchMove}
                                onTouchEnd={handleRowTouchEnd}
                            >
                                {isSelectionMode && (
                                    <div className="absolute top-4 right-4 z-10">
                                         <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${selectedIds.includes(p.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                            {selectedIds.includes(p.id) && <FiCheckSquare className="text-white w-4 h-4" />}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex items-start gap-4" onClick={() => !isSelectionMode && handleOpenModal(p, 'view')}>
                                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-gray-700 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
                                        {p.nama ? p.nama.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 dark:text-white truncate">{p.nama}</h3>
                                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{p.jabatan}</p>
                                        <div className="mt-2 space-y-1">
                                            {currentUser.role === 'admin_kecamatan' && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                    <FiMapPin size={10} /> Desa {p.desa}
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                <FiCalendar size={10} /> Periode {p.periode || '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Mobile Actions */}
                                {!isSelectionMode && (
                                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(p, 'edit'); }} className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm font-medium">Edit</button>
                                        <button onClick={(e) => { e.stopPropagation(); confirmDelete(p); }} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/30 rounded-lg text-sm font-medium">Hapus</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* DESKTOP TABLE VIEW */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                                <tr>
                                    <th className="p-4 w-14 text-center">
                                        {isSelectionMode ? (
                                            <button onClick={toggleSelectAll} className="hover:text-blue-600 transition-colors">
                                                {selectedIds.length === filteredBpd.length ? <FiCheckSquare size={18} className="text-blue-600"/> : <div className="w-4 h-4 border-2 border-gray-400 rounded mx-auto"></div>}
                                            </button>
                                        ) : 'No'}
                                    </th>
                                    <th className="px-6 py-4">Nama & No. SK</th>
                                    {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-4">Desa</th>}
                                    <th className="px-6 py-4">Jabatan</th>
                                    <th className="px-6 py-4">Periode</th>
                                    <th className="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredBpd.map((p, index) => (
                                    <tr 
                                        key={p.id} 
                                        className={`bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group
                                            ${highlightClass(p.id)} 
                                            ${selectedIds.includes(p.id) ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}
                                        `}
                                        onDoubleClick={() => handleRowDoubleClick(p.id)}
                                        onClick={() => isSelectionMode && toggleSelection(p.id)}
                                    >
                                        <td className="p-4 text-center text-gray-500">
                                            {isSelectionMode ? (
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${selectedIds.includes(p.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                                    {selectedIds.includes(p.id) && <FiCheckSquare className="text-white w-3 h-3" />}
                                                </div>
                                            ) : index + 1}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    {p.nama ? p.nama.charAt(0).toUpperCase() : '-'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{p.nama}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{p.no_sk_bupati || '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {currentUser.role === 'admin_kecamatan' && (
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                                    {p.desa}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{p.jabatan}</td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{p.periode}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenModal(p, 'view'); }} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Lihat"><FiEye size={18}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenModal(p, 'edit'); }} className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Edit"><FiEdit size={18}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); confirmDelete(p); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Hapus"><FiTrash2 size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                        <FiSearch size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tidak ada data ditemukan</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">Coba ubah kata kunci pencarian atau filter Anda, atau tambahkan data baru.</p>
                </div>
            )}

            {/* --- DRAGGABLE ACTION MENU --- */}
            {isSelectionMode && (
                <div 
                    style={{
                        position: 'fixed',
                        left: `${menuPos.x}px`,
                        top: `${menuPos.y}px`,
                        zIndex: 50,
                        touchAction: 'none'
                    }}
                    className="flex items-center gap-3 p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-600 shadow-2xl rounded-full animate-in zoom-in duration-200"
                >
                    <div 
                        onMouseDown={startDrag}
                        onTouchStart={startDrag}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full cursor-move transition-colors"
                    >
                        <FiMove className="text-gray-500 dark:text-gray-400" size={16} />
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                            {selectedIds.length}
                        </span>
                    </div>

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

                    <div className="flex items-center gap-1 pr-1">
                        <button 
                            onClick={openDeleteSelectedConfirm}
                            disabled={selectedIds.length === 0}
                            className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all disabled:opacity-50"
                            title="Hapus Terpilih"
                        >
                            <FiTrash2 size={18} />
                        </button>
                        
                        <button 
                            onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}
                            className="p-2.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all"
                            title="Batal"
                        >
                            <FiX size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Tip Gesture */}
            <div className="mt-6 flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                    <FiAlertCircle size={14}/> 
                    <span>Tip: Klik 2x (PC) atau Tahan (HP) baris untuk memilih banyak data.</span>
                </div>
            </div>

            {/* Pagination for Kecamatan Admin */}
            {currentUser?.role === 'admin_kecamatan' && (
                <div className="mt-6 border-t border-gray-100 dark:border-gray-700 pt-6">
                    <Pagination
                        desaList={DESA_LIST}
                        currentDesa={currentDesa}
                        onPageChange={setCurrentDesa}
                    />
                </div>
            )}

            {/* --- MODALS --- */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={getModalTitle()}>
                {modalMode === 'view' ? (
                    <BpdDetailView bpd={selectedBpd} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-6">
                        {/* Section: Jabatan & SK */}
                        <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl space-y-4">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600 pb-2">Informasi Jabatan</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField label="Jabatan" name="jabatan" value={formData.jabatan || ''} onChange={handleFormChange} type="select" required>
                                    <option value="">Pilih Jabatan</option>
                                    {JABATAN_BPD_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                                </InputField>
                                 <InputField label="Periode" name="periode" value={formData.periode || ''} onChange={handleFormChange} placeholder="Contoh: 2019-2025" />
                                <InputField label="No. SK Bupati" name="no_sk_bupati" value={formData.no_sk_bupati || ''} onChange={handleFormChange} />
                                <InputField label="Tgl. SK Bupati" name="tgl_sk_bupati" value={formData.tgl_sk_bupati || ''} onChange={handleFormChange} type="date" />
                                <InputField label="Tgl Pelantikan" name="tgl_pelantikan" value={formData.tgl_pelantikan || ''} onChange={handleFormChange} type="date" />
                                <InputField label="Wilayah Pemilihan" name="wil_pmlhn" value={formData.wil_pmlhn || ''} onChange={handleFormChange} />
                            </div>
                        </div>
                        
                        {/* Section: Data Diri */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600 pb-2">Data Pribadi</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <InputField label="Nama Lengkap" name="nama" value={formData.nama || ''} onChange={handleFormChange} required placeholder="Nama sesuai KTP" />
                                 <InputField label="Jenis Kelamin" name="jenis_kelamin" value={formData.jenis_kelamin || ''} onChange={handleFormChange} type="select">
                                    <option value="">Pilih Jenis Kelamin</option>
                                    {JENIS_KELAMIN_LIST.map(jk => <option key={jk} value={jk}>{jk}</option>)}
                                 </InputField>
                                 <InputField label="Tempat Lahir" name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleFormChange} />
                                 <InputField label="Tgl Lahir" name="tgl_lahir" value={formData.tgl_lahir || ''} onChange={handleFormChange} type="date" />
                                 <InputField label="Pekerjaan" name="pekerjaan" value={formData.pekerjaan || ''} onChange={handleFormChange} />
                                 <InputField label="Pendidikan" name="pendidikan" value={formData.pendidikan || ''} onChange={handleFormChange} type="select">
                                    <option value="">Pilih Pendidikan</option>
                                    {PENDIDIKAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                                 </InputField>
                                 <InputField label="Agama" name="agama" value={formData.agama || ''} onChange={handleFormChange} type="select">
                                    <option value="">Pilih Agama</option>
                                    {AGAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                                 </InputField>
                                 <InputField label="No. HP / WA" name="no_hp" value={formData.no_hp || ''} onChange={handleFormChange} placeholder="08..." />
                            </div>
                        </div>

                        {/* Section: Alamat */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider border-b border-gray-200 dark:border-gray-600 pb-2">Alamat Domisili</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <InputField label="Desa" name="desa" value={formData.desa || ''} onChange={handleFormChange} type="select" required disabled={currentUser.role === 'admin_desa'}>
                                    <option value="">Pilih Desa</option>
                                    {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                                </InputField>
                                <InputField label="RT" name="rt" value={formData.rt || ''} onChange={handleFormChange} placeholder="001" />
                                <InputField label="RW" name="rw" value={formData.rw || ''} onChange={handleFormChange} placeholder="001" />
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 gap-3 border-t border-gray-100 dark:border-gray-700">
                            <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors" disabled={isSubmitting}>Batal</button>
                            <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-all disabled:opacity-70" disabled={isSubmitting}>
                                {isSubmitting && <Spinner size="sm" color="white" />}
                                {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
            
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={executeDelete}
                isLoading={isSubmitting}
                title="Konfirmasi Hapus"
                message={`Apakah Anda yakin ingin menghapus data anggota BPD "${bpdToDelete?.nama}"?`}
            />

            <ConfirmationModal 
                isOpen={isDeleteSelectedConfirmOpen} 
                onClose={() => setIsDeleteSelectedConfirmOpen(false)} 
                onConfirm={handleDeleteSelected} 
                isLoading={isSubmitting} 
                title="Hapus Data Terpilih" 
                message={`Yakin ingin menghapus ${selectedIds.length} data terpilih?`} 
                variant="danger"
            />

            {currentUser.role === 'admin_kecamatan' && (
                 <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Ekspor Data BPD">
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiDownload size={32}/>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Pilih Lingkup Data</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">Pilih data mana yang ingin Anda unduh sebagai file Excel.</p>
                        
                        <div className="grid grid-cols-1 gap-3">
                            <button onClick={() => handleExportXLSX('current')} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group">
                                <span className="font-medium text-gray-700 dark:text-gray-200">Hanya Desa {currentDesa}</span>
                                <FiDownload className="text-gray-400 group-hover:text-blue-500" />
                            </button>
                            <button onClick={() => handleExportXLSX('all')} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-xl hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group">
                                <div className="text-left">
                                    <span className="block font-medium text-gray-700 dark:text-gray-200">Semua Desa (Rekap)</span>
                                    <span className="text-xs text-gray-500">Data seluruh kecamatan</span>
                                </div>
                                <FiDownload className="text-gray-400 group-hover:text-green-500" />
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default BPDPage;