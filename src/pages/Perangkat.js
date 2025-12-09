import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, writeBatch, getDocs, getDoc, collection, query, where, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import SkeletonLoader from '../components/common/SkeletonLoader';
import { FiEdit, FiSearch, FiUpload, FiDownload, FiPlus, FiEye, FiUserX, FiTrash2, FiBriefcase, FiCheckSquare, FiX, FiArchive, FiAlertCircle, FiMove, FiMapPin, FiPhone, FiCalendar, FiAward, FiChevronDown, FiFilter } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { generatePerangkatXLSX } from '../utils/generatePerangkatXLSX';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { uploadImageToCloudinary } from '../utils/imageUploader';
import { DESA_LIST } from '../utils/constants';
import Pagination from '../components/common/Pagination';
import { createNotificationForAdmins } from '../utils/notificationService';
import { checkAndProcessPurnaTugas } from '../utils/purnaTugasChecker';

const JABATAN_LIST = [ "Kepala Desa", "Pj. Kepala Desa", "Sekretaris Desa", "Kasi Pemerintahan", "Kasi Kesejahteraan", "Kasi Pelayanan", "Kaur TU dan Umum", "Kaur Keuangan", "Kaur Perencanaan", "Kadus I","Kadus II","Kadus III" ,"Kadus IV","Kadus V","Kadus VI","Staf Desa" ];
const PENDIDIKAN_LIST = ["SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"];

// --- Detail View Component (Modern Card Style) ---
const PerangkatDetailView = ({ perangkat }) => {
    if (!perangkat) return null;
    const statusPurna = perangkat.akhir_jabatan && new Date(perangkat.akhir_jabatan) < new Date();

    const DetailItem = ({ label, value, icon: Icon }) => (
        <div className="group flex items-start space-x-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 border border-transparent hover:border-blue-100 dark:hover:border-blue-800">
            {Icon && <div className="mt-1 p-2 rounded-lg bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform"><Icon size={16}/></div>}
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{value || '-'}</p>
            </div>
        </div>
    );

    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'});
        } catch {
            return dateString;
        }
    }

    return (
        <div className="space-y-6">
            {/* Header Profile */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center shadow-xl ring-1 ring-white/20">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full opacity-75 group-hover:opacity-100 transition duration-200 blur"></div>
                        <img
                            src={perangkat.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(perangkat.nama)}&background=ffffff&color=0D8ABC&size=128`}
                            alt={perangkat.nama}
                            className="relative w-28 h-28 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-2xl"
                        />
                    </div>
                    <h3 className="mt-4 text-2xl font-bold tracking-tight">{perangkat.nama}</h3>
                    <p className="text-blue-100 font-medium text-lg opacity-90">{perangkat.jabatan}</p>
                    <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-sm border border-white/20">
                        <FiMapPin size={14}/>
                        <span>Desa {perangkat.desa}</span>
                    </div>
                    {statusPurna && (
                        <span className="mt-3 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg border border-red-400 animate-pulse">
                            Telah Purna Tugas
                        </span>
                    )}
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem label="NIK" value={perangkat.nik} icon={FiBriefcase} />
                <DetailItem label="NIP/NIPD" value={perangkat.nip} icon={FiAward} />
                <DetailItem label="Jenis Kelamin" value={perangkat.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} icon={FiUserX} />
                <DetailItem label="Tempat, Tanggal Lahir" value={`${perangkat.tempat_lahir || ''}, ${formatDate(perangkat.tgl_lahir)}`} icon={FiCalendar} />
                <DetailItem label="Pendidikan Terakhir" value={perangkat.pendidikan} icon={FiAward} />
                <DetailItem label="No. HP / WA" value={perangkat.no_hp} icon={FiPhone} />
            </div>

            {/* Jabatan Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-1">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3 px-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Informasi SK & Jabatan
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailItem label="Nomor SK" value={perangkat.no_sk} />
                    <DetailItem label="Tanggal SK" value={formatDate(perangkat.tgl_sk)} />
                    <DetailItem label="Tanggal Pelantikan" value={formatDate(perangkat.tgl_pelantikan)} />
                    <DetailItem label="Akhir Masa Jabatan" value={formatDate(perangkat.akhir_jabatan)} />
                </div>
            </div>

            {/* KTP Section */}
            {perangkat.ktp_url && (
                <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3 px-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Dokumen KTP
                    </h4>
                    <div className="group relative bg-gray-100 dark:bg-gray-900 rounded-xl p-2 border-2 border-dashed border-gray-300 dark:border-gray-700 overflow-hidden hover:border-blue-400 transition-colors">
                        <img src={perangkat.ktp_url} alt="Foto KTP" className="w-full h-auto max-h-64 object-contain rounded-lg mx-auto transition-transform duration-500 group-hover:scale-105"/>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main Component ---
const Perangkat = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const { data: allPerangkat, loading, addItem, updateItem } = useFirestoreCollection('perangkat', { orderByField: 'nama' });

    useEffect(() => {
        checkAndProcessPurnaTugas().then(({ processed, skipped }) => {
            if (!skipped && processed > 0) {
                showNotification(`${processed} perangkat telah dipindahkan ke riwayat purna tugas.`, 'info');
            }
        });
    }, []);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPerangkat, setSelectedPerangkat] = useState(null);
    const [formData, setFormData] = useState({});
    const [fotoProfilFile, setFotoProfilFile] = useState(null);
    const [fotoKtpFile, setFotoKtpFile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [modalMode, setModalMode] = useState('edit');
    const [exportConfig, setExportConfig] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // --- STATE CLICK BOOK & SELECTION ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    
    // --- REFS UNTUK GESTURE CONTROL (Scroll Detection) ---
    const longPressTimer = useRef(null);
    const isScrolling = useRef(false);
    const touchStartCoords = useRef({ x: 0, y: 0 });

    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
    const [bulkDeleteMode, setBulkDeleteMode] = useState(null); // 'kosongkan' atau 'permanen'
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    
    // --- DRAGGABLE STATE (SMOOTH VERSION) ---
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    
    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [highlightedRow, setHighlightedRow] = useState(null);
    
    // --- SINKRONISASI DASHBOARD & SCROLL TO VIEW ---
    useEffect(() => {
        const highlightId = searchParams.get('highlight');
        if (highlightId && allPerangkat.length > 0) {
            // Set highlight state
            setHighlightedRow(highlightId);
            
            // Jika admin kecamatan, pastikan tab desa sesuai
            if (currentUser.role === 'admin_kecamatan') {
                const targetDesa = searchParams.get('desa');
                if (targetDesa) {
                    setCurrentDesa(targetDesa);
                }
            }

            // Scroll Logic: Tunggu render DOM selesai
            setTimeout(() => {
                const element = document.getElementById(`row-${highlightId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500); // Delay 500ms agar data ter-render dulu

            // Hilangkan highlight setelah 3 detik
            const timer = setTimeout(() => setHighlightedRow(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, currentUser.role, allPerangkat]); // Tambahkan allPerangkat ke dependency
    
    useEffect(() => {
        if (currentUser && currentUser.role === 'admin_desa') {
            setCurrentDesa(currentUser.desa);
        }
    }, [currentUser]);

    // Initial Menu Position (Bottom Center)
    useEffect(() => {
        if (isSelectionMode) {
            setMenuPos({ x: 0, y: 0 });
        }
    }, [isSelectionMode]);

    useEffect(() => {
        const fetchExportConfig = async () => {
            try {
                const exportRef = doc(db, 'settings', 'exportConfig');
                const exportSnap = await getDoc(exportRef);
                if (exportSnap.exists()) setExportConfig(exportSnap.data());
            } catch (error) {
                console.error("Error fetching export config:", error);
            }
        };
        fetchExportConfig();
    }, []);

    useEffect(() => {
        const editId = searchParams.get('edit');
        if (editId && allPerangkat.length > 0) {
            const perangkatToEdit = allPerangkat.find(p => p.id === editId);
            if (perangkatToEdit) {
                handleOpenModal(perangkatToEdit, 'edit');
                navigate(location.pathname, { replace: true });
            }
        }
    }, [allPerangkat, searchParams, navigate, location.pathname]);
    
    const isDataLengkap = (perangkat) => {
        if (!perangkat.nama && !perangkat.nik) return false;
        const requiredFields = [ 'nama', 'jabatan', 'nik', 'tempat_lahir', 'tgl_lahir', 'pendidikan', 'no_sk', 'tgl_sk', 'tgl_pelantikan', 'foto_url', 'ktp_url' ];
        return requiredFields.every(field => perangkat[field] && String(perangkat[field]).trim() !== '');
    };
    
    const excelDateToJSDate = (serial) => {
        if (typeof serial === 'string') {
            const date = new Date(serial);
            if (!isNaN(date.getTime())) {
                const userTimezoneOffset = date.getTimezoneOffset() * 60000;
                return new Date(date.getTime() + userTimezoneOffset);
            }
            return null;
        }
        if (typeof serial === 'number') {
            const utc_days = Math.floor(serial - 25569);
            const utc_value = utc_days * 86400;
            const date_info = new Date(utc_value * 1000);
            const fractional_day = serial - Math.floor(serial) + 0.0000001;
            let total_seconds = Math.floor(86400 * fractional_day);
            const seconds = total_seconds % 60;
            total_seconds -= seconds;
            const hours = Math.floor(total_seconds / (60 * 60));
            const minutes = Math.floor(total_seconds / 60) % 60;
            return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
        }
        return null;
    };

    const formatDateToYYYYMMDD = (date) => {
        if (!date || isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseAndFormatDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return formatDateToYYYYMMDD(value);
        const parsed = excelDateToJSDate(value);
        return parsed ? formatDateToYYYYMMDD(parsed) : null;
    };

    const calculateAkhirJabatan = (tglLahir) => {
        const birthDate = parseAndFormatDate(tglLahir);
        if (!birthDate) return null;
        try {
            const date = new Date(birthDate);
            date.setFullYear(date.getFullYear() + 60);
            return formatDateToYYYYMMDD(date);
        } catch (error) {
            console.error("Invalid date for tglLahir:", tglLahir);
            return null;
        }
    };

    useEffect(() => {
        if (formData.tgl_lahir && (modalMode === 'edit' || modalMode === 'add')) {
            const isKades = formData.jabatan && (formData.jabatan.toLowerCase().includes('kepala desa') || formData.jabatan.toLowerCase().includes('pj. kepala desa'));
            if (!isKades) {
                const calculatedDate = calculateAkhirJabatan(formData.tgl_lahir);
                if (calculatedDate !== formData.akhir_jabatan) {
                    setFormData(prevData => ({ ...prevData, akhir_jabatan: calculatedDate }));
                }
            }
        }
    }, [formData.tgl_lahir, formData.jabatan, modalMode]);

    const filteredPerangkat = useMemo(() => {
        if (!currentUser) return [];
        let data = allPerangkat;
        
        if (currentUser.role === 'admin_kecamatan') {
            data = data.filter(p => p.desa === currentDesa);
        } else if (currentUser.role === 'admin_desa') {
            data = data.filter(p => p.desa === currentUser.desa);
        }

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            data = data.filter(p => 
                (p.nama && p.nama.toLowerCase().includes(search)) || 
                (p.nip && String(p.nip).includes(search)) ||
                (p.nik && String(p.nik).includes(search))
            );
        }
        
        return data;
    }, [allPerangkat, searchTerm, currentUser, currentDesa]);

    // --- LOGIKA CLICK BOOK / SELECTION DENGAN ANTI-SCROLL ---

    const activateSelectionMode = (id) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds(new Set([id]));
            if (navigator.vibrate) navigator.vibrate(50);
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }
    };

    const handleDoubleClick = (id) => activateSelectionMode(id);

    const handleTouchStart = (id, e) => {
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

    const handleTouchMove = (e) => {
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

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const toggleSelection = (id) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
    };

    // --- LOGIKA SELECT ALL ---
    const isAllSelected = filteredPerangkat.length > 0 && filteredPerangkat.every(p => selectedIds.has(p.id));

    const handleSelectAll = () => {
        if (isAllSelected) {
            const newSelection = new Set(selectedIds);
            filteredPerangkat.forEach(p => newSelection.delete(p.id));
            setSelectedIds(newSelection);
        } else {
            const newSelection = new Set(selectedIds);
            filteredPerangkat.forEach(p => newSelection.add(p.id));
            setSelectedIds(newSelection);
        }
    };

    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
        setMenuPos({ x: 0, y: 0 });
    };

    const toggleSelectionMode = () => {
        if (isSelectionMode) {
            cancelSelectionMode();
        } else {
            setIsSelectionMode(true);
            setSelectedIds(new Set());
        }
    };

    // --- SMOOTH DRAG LOGIC FOR ACTION BAR (WINDOW LISTENERS) ---
    
    const startDrag = (e) => {
        setIsDragging(true);
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragStartPos.current = {
            x: clientX - menuPos.x,
            y: clientY - menuPos.y
        };
    };

    const onDrag = useCallback((e) => {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const newX = clientX - dragStartPos.current.x;
        const newY = clientY - dragStartPos.current.y;
        
        setMenuPos({ x: newX, y: newY });
    }, [isDragging]);

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
    }, [isDragging, onDrag]);

    // --- TRIGGER BULK ACTION ---
    const openBulkDeleteConfirm = (mode) => {
        if (selectedIds.size === 0) return;
        setBulkDeleteMode(mode);
        setIsBulkDeleteConfirmOpen(true);
    };

   const handleOpenModal = (perangkat = null, mode = 'edit') => {
        setModalMode(mode);
        setSelectedPerangkat(perangkat);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : (perangkat ? perangkat.desa : currentDesa);
        let initialFormData = perangkat ? { ...perangkat } : { desa: initialDesa, jabatan: '', pendidikan: '' };
        if (perangkat && perangkat.jabatan && !JABATAN_LIST.includes(perangkat.jabatan)) {
            initialFormData.jabatan_custom = perangkat.jabatan;
            initialFormData.jabatan = 'Lainnya';
        } else {
            initialFormData.jabatan_custom = '';
        }
        if (perangkat && perangkat.pendidikan && !PENDIDIKAN_LIST.includes(perangkat.pendidikan)) {
            initialFormData.pendidikan_custom = perangkat.pendidikan;
            initialFormData.pendidikan = 'Lainnya';
        } else {
            initialFormData.pendidikan_custom = '';
        }
        setFormData(initialFormData);
        setFotoProfilFile(null);
        setFotoKtpFile(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setSelectedPerangkat(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        let dataToSave = { ...formData };
        if (!dataToSave.desa) {
            showNotification("Desa wajib diisi!", 'error');
            setIsSubmitting(false);
            return;
        }

        if (dataToSave.jabatan === 'Lainnya') dataToSave.jabatan = dataToSave.jabatan_custom || '';
        delete dataToSave.jabatan_custom;
        if (dataToSave.pendidikan === 'Lainnya') dataToSave.pendidikan = dataToSave.pendidikan_custom || '';
        delete dataToSave.pendidikan_custom;
        dataToSave.tgl_lahir = parseAndFormatDate(dataToSave.tgl_lahir);
        dataToSave.tgl_sk = parseAndFormatDate(dataToSave.tgl_sk);
        dataToSave.tgl_pelantikan = parseAndFormatDate(dataToSave.tgl_pelantikan);
        const isKades = dataToSave.jabatan && (dataToSave.jabatan.toLowerCase().includes('kepala desa') || dataToSave.jabatan.toLowerCase().includes('pj. kepala desa'));
        if (!isKades && dataToSave.tgl_lahir) {
             dataToSave.akhir_jabatan = calculateAkhirJabatan(dataToSave.tgl_lahir);
        } else {
             dataToSave.akhir_jabatan = parseAndFormatDate(dataToSave.akhir_jabatan);
        }

        try {
            const fotoProfilUrl = await uploadImageToCloudinary(fotoProfilFile, process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET, process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);
            const fotoKtpUrl = await uploadImageToCloudinary(fotoKtpFile, process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET, process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);

            if (fotoProfilUrl) dataToSave.foto_url = fotoProfilUrl;
            if (fotoKtpUrl) dataToSave.ktp_url = fotoKtpUrl;
            
            let docId = selectedPerangkat ? selectedPerangkat.id : null;
            
            if (selectedPerangkat) {
                await updateItem(selectedPerangkat.id, dataToSave);
            } else {
                const existingDoc = await findJabatanKosongAtauPurna(dataToSave.jabatan, dataToSave.desa);
                if (existingDoc) {
                    await updateItem(existingDoc.id, dataToSave);
                    docId = existingDoc.id;
                    showNotification(`Formasi jabatan ${dataToSave.jabatan} yang kosong/purna telah diisi.`, 'info');
                } else {
                    const newDoc = await addItem(dataToSave);
                    docId = newDoc.id;
                }
            }
            
          if (currentUser.role === 'admin_desa' && docId) {
                const action = selectedPerangkat ? 'memperbarui' : 'menambahkan';
                const message = `Admin Desa ${currentUser.desa} telah ${action} data perangkat: "${dataToSave.nama}".`;
                const link = `/app/perangkat?desa=${currentUser.desa}&highlight=${docId}`;
                await createNotificationForAdmins(message, link, currentUser);
            }

            handleCloseModal();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
       const handleDelete = async (mode) => {
        if (!selectedPerangkat) return;
        setShowDeleteConfirm(false);
        setIsDeleting(true);

        try {
            if (mode === 'kosongkan') {
                const { jabatan, desa } = selectedPerangkat;
                const dataToUpdate = {
                    nama: null, nik: null, jenis_kelamin: null, tempat_lahir: null, tgl_lahir: null,
                    pendidikan: null, no_sk: null, tgl_sk: null, tgl_pelantikan: null,
                    akhir_jabatan: null, no_hp: null, nip: null, foto_url: null, ktp_url: null,
                    jabatan, desa, status: 'Jabatan Kosong'
                };
                await updateItem(selectedPerangkat.id, dataToUpdate);
                showNotification('Data personel telah dikosongkan.', 'info');
            } else if (mode === 'permanen') {
                const docRef = doc(db, 'perangkat', selectedPerangkat.id);
                await deleteDoc(docRef);
                showNotification('Data berhasil dihapus permanen.', 'success');
            }
        } catch (error) {
            showNotification("Terjadi kesalahan saat memproses data.", 'error');
        } finally {
            setIsDeleting(false);
            setSelectedPerangkat(null);
        }
    };
    
    const executeBulkDelete = async () => {
        if (selectedIds.size === 0 || !bulkDeleteMode) return;
        setIsDeleting(true);
        try {
            const batch = writeBatch(db);
            for (const id of selectedIds) {
                const docRef = doc(db, 'perangkat', id);
                if (bulkDeleteMode === 'kosongkan') {
                    const perangkat = allPerangkat.find(p => p.id === id);
                    if(perangkat){
                        const dataToUpdate = { nama: null, nik: null, jenis_kelamin: null, tempat_lahir: null, tgl_lahir: null, pendidikan: null, no_sk: null, tgl_sk: null, tgl_pelantikan: null, akhir_jabatan: null, no_hp: null, nip: null, foto_url: null, ktp_url: null, status: 'Jabatan Kosong' };
                        batch.update(docRef, dataToUpdate);
                    }
                } else {
                    batch.delete(docRef);
                }
            }
            await batch.commit();
            showNotification(`${selectedIds.size} data berhasil diproses.`, 'success');
        } catch (error) {
            showNotification("Terjadi kesalahan saat memproses data.", 'error');
        } finally {
            setIsDeleting(false);
            cancelSelectionMode();
            setIsBulkDeleteConfirmOpen(false);
        }
    };

     const handleExportClick = () => {
        if (currentUser.role === 'admin_kecamatan') {
            setIsExportModalOpen(true);
        } else {
            handleExportXLSX('current');
        }
    };

    const handleExportXLSX = (scope) => {
        setIsExportModalOpen(false);
        let dataToExport;
        let groupedData;

        if (scope === 'all') {
            dataToExport = allPerangkat;
            if (dataToExport.length === 0) {
                showNotification("Tidak ada data untuk diekspor.", "warning");
                return;
            }
            const dataByDesa = dataToExport.reduce((acc, p) => {
                const desa = p.desa || 'Lainnya';
                if (!acc[desa]) {
                    acc[desa] = [];
                }
                acc[desa].push(p);
                return acc;
            }, {});
            groupedData = DESA_LIST.map(desa => ({
                desa: desa,
                perangkat: dataByDesa[desa] || []
            }));

        } else { // scope === 'current'
            dataToExport = filteredPerangkat;
            if (dataToExport.length === 0) {
                showNotification("Tidak ada data untuk diekspor di desa ini.", "warning");
                return;
            }
            const desaName = currentUser.role === 'admin_desa' ? currentUser.desa : currentDesa;
            groupedData = [{ desa: desaName, perangkat: dataToExport }];
        }

        generatePerangkatXLSX(groupedData, exportConfig);
    };

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
                const jsonDataObjects = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null });

                if (jsonDataObjects.length === 0) throw new Error("File Excel tidak valid atau kosong.");
                
                const batch = writeBatch(db);
                let updatedCount = 0;
                let createdCount = 0;
                let skippedCount = 0;
                let duplicates = [];

                const allExistingPerangkat = await getDocs(collection(db, 'perangkat')).then(snap =>
                    snap.docs.map(d => ({id: d.id, ...d.data()}))
                );

                for (const row of jsonDataObjects) {
                    const newDoc = {};
                    newDoc.desa = row['DESA'] ? String(row['DESA']).trim() : null;
                    newDoc.nama = row['N A M A'] ? String(row['N A M A']).trim() : null;
                    newDoc.jabatan = row['JABATAN'] ? String(row['JABATAN']).trim() : null;
                    newDoc.tempat_lahir = row['TEMPAT LAHIR'] || null;
                    newDoc.nik = row['N I K'] ? String(row['N I K']).replace(/\s/g, '') : null;
                    newDoc.nip = row['NIP/NIPD'] || null;
                    newDoc.no_sk = row['NO SK'] || null;
                    newDoc.no_hp = row['No. HP / WA'] || null;
                    newDoc.tgl_lahir = parseAndFormatDate(row['TANGGAL LAHIR']);
                    newDoc.tgl_sk = parseAndFormatDate(row['TANGGAL SK']);
                    newDoc.tgl_pelantikan = parseAndFormatDate(row['TANGGAL PELANTIKAN']);
                    newDoc.jenis_kelamin = row['L'] == 1 ? 'L' : (row['P'] == 1 ? 'P' : null);

                    const pendidikanMap = { 'SD': 'SD', 'SLTP': 'SLTP', 'SLTA': 'SLTA', 'D1': 'D1', 'D2': 'D2', 'D3': 'D3', 'S1': 'S1', 'S2': 'S2', 'S3': 'S3' };
                    newDoc.pendidikan = null;
                    for (const key in pendidikanMap) {
                      if (row[key] == 1) { 
                        newDoc.pendidikan = pendidikanMap[key];
                        break; 
                      }
                    }
                    if (!newDoc.nama || !newDoc.jabatan || !newDoc.desa) {
                        skippedCount++;
                        continue;
                    }
                    if (currentUser.role === 'admin_desa' && newDoc.desa.toUpperCase() !== currentUser.desa.toUpperCase()) {
                        skippedCount++;
                        continue;
                    }
                    const isKades = newDoc.jabatan.toLowerCase().includes('kepala desa') || newDoc.jabatan.toLowerCase().includes('pj. kepala desa');
                    if (isKades && row['AKHIR MASA JABATAN']) {
                        newDoc.akhir_jabatan = parseAndFormatDate(row['AKHIR MASA JABATAN']);
                    } else if (newDoc.tgl_lahir) {
                        newDoc.akhir_jabatan = calculateAkhirJabatan(newDoc.tgl_lahir);
                    } else {
                        newDoc.akhir_jabatan = null;
                    }
                    
                    const existingPerangkatByNik = newDoc.nik ? allExistingPerangkat.find(p => p.nik === newDoc.nik) : null;
                    const existingPerangkatByName = allExistingPerangkat.find(p => p.nama && p.desa && p.nama.toLowerCase() === newDoc.nama.toLowerCase() && p.desa.toLowerCase() === newDoc.desa.toLowerCase());

                    if (existingPerangkatByNik) {
                        const docRef = doc(db, 'perangkat', existingPerangkatByNik.id);
                        batch.update(docRef, newDoc);
                        updatedCount++;
                    } else if (existingPerangkatByName) {
                        duplicates.push(`${newDoc.nama} (Desa ${newDoc.desa})`);
                        skippedCount++;
                    } else {
                        const vacantDoc = await findJabatanKosongAtauPurna(newDoc.jabatan, newDoc.desa);
                        if (vacantDoc) {
                            const docRef = doc(db, 'perangkat', vacantDoc.id);
                            batch.update(docRef, newDoc);
                            updatedCount++;
                        } else {
                            const newDocRef = doc(collection(db, 'perangkat'));
                            batch.set(newDocRef, newDoc);
                            createdCount++;
                        }
                    }
                }
                await batch.commit();
                let alertMessage = `Impor selesai!\n- ${createdCount} data baru ditambahkan.\n- ${updatedCount} data diperbarui.\n- ${skippedCount} baris dilewati.`;
                if (duplicates.length > 0) {
                    alertMessage += `\n\nData duplikat yang dilewati:\n- ${duplicates.join('\n- ')}`;
                }
                showNotification(alertMessage, 'info', 10000);
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

 const findJabatanKosongAtauPurna = async (jabatan, desa) => {
        const q = query(collection(db, 'perangkat'), where("desa", "==", desa), where("jabatan", "==", jabatan));
        const querySnapshot = await getDocs(q);
        let docToUpdate = null;
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const isPurna = data.akhir_jabatan && new Date(data.akhir_jabatan) < new Date();
            const isKosong = !data.nama && !data.nik;
            if (isPurna || isKosong) {
                docToUpdate = { id: doc.id, data: data };
            }
        });
        return docToUpdate;
    };
    
    // Inject Custom Pulse Animation for Highlighted Row
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes highlight-pulse {
                0%, 100% { background-color: rgba(234, 179, 8, 0.1); box-shadow: inset 0 0 0 2px rgba(234, 179, 8, 0.3); }
                50% { background-color: rgba(234, 179, 8, 0.4); box-shadow: inset 0 0 10px 2px rgba(234, 179, 8, 0.6); }
            }
            .animate-highlight-pulse {
                animation: highlight-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    if (loading) return <SkeletonLoader columns={5} />;
    
    return (
        <div className="space-y-6 pb-24">
            {/* Header & Controls */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    {/* Search Bar with modern focus ring */}
                    <div className="w-full lg:w-1/3 relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-500">
                            <FiSearch className="text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        </div>
                        <input 
                            type="text" 
                            placeholder={`Cari di Desa ${currentDesa}...`} 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                    
                    {/* Action Buttons Group with Hover Effects */}
                    <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end items-center">
                         <button 
                            onClick={() => navigate('/app/histori-perangkat')} 
                            className="flex items-center px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 active:scale-95"
                         >
                            <FiArchive className="mr-2" /> Riwayat
                        </button>
                        
                        {isSelectionMode ? (
                            <></> // Mode selection controlled via floating bar
                        ) : (
                            <>
                                <button 
                                    onClick={toggleSelectionMode} 
                                    className="flex items-center px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 active:scale-95"
                                >
                                    <FiCheckSquare className="mr-2"/> Pilih
                                </button>
                                
                                <label className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white font-medium rounded-xl hover:from-amber-500 hover:to-amber-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/30 transition-all duration-200 cursor-pointer active:scale-95">
                                    <FiUpload className="mr-2"/> 
                                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" disabled={isUploading}/>
                                    {isUploading ? '...' : 'Impor'}
                                </label>
                                
                                <button 
                                    onClick={handleExportClick} 
                                    className="flex items-center px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-emerald-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-200 active:scale-95"
                                >
                                    <FiDownload className="mr-2"/> Ekspor
                                </button>
                                
                                <button 
                                    onClick={() => handleOpenModal(null, 'add')} 
                                    className="flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 active:scale-95"
                                >
                                    <FiPlus className="mr-2 stroke-[2.5px]"/> Tambah
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Table Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-4 w-16 text-center">
                                    {isSelectionMode ? (
                                        <div onClick={handleSelectAll} className="cursor-pointer flex justify-center items-center hover:scale-110 transition-transform">
                                            {isAllSelected ? (
                                                <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center text-white shadow-md">
                                                    <FiCheckSquare size={14} />
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700"></div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">No</span>
                                    )}
                                </th>
                                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Perangkat Desa</th>
                                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jabatan</th>
                                {currentUser.role === 'admin_kecamatan' && (
                                    <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Desa</th>
                                )}
                                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {filteredPerangkat.length > 0 ? filteredPerangkat.map((p, index) => {
                                const isPurna = p.akhir_jabatan && new Date(p.akhir_jabatan) < new Date();
                                const isKosong = !p.nama && !p.nik;
                                const isSelected = selectedIds.has(p.id);
                                const isHighlighted = highlightedRow === p.id;

                                return (
                                    <tr 
                                        key={p.id}
                                        id={`row-${p.id}`} // Penting untuk scrollIntoView
                                        className={`
                                            group transition-all duration-300
                                            ${isHighlighted ? 'animate-highlight-pulse z-10 relative' : ''}
                                            ${isSelected ? 'bg-blue-50/90 dark:bg-blue-900/40' : 'hover:bg-gray-50/80 dark:hover:bg-gray-700/30'}
                                        `}
                                        style={{ animationDelay: `${index * 50}ms` }} // Stagger animation effect
                                        onDoubleClick={() => handleDoubleClick(p.id)}
                                        onTouchStart={(e) => handleTouchStart(p.id, e)}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                        onClick={(e) => {
                                            if (isSelectionMode) {
                                                if (!e.target.closest('button')) {
                                                    toggleSelection(p.id);
                                                }
                                            }
                                        }}
                                    >
                                        <td className="p-4 text-center">
                                            {isSelectionMode ? (
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all mx-auto ${isSelected ? 'bg-blue-600 border-blue-600 scale-110' : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700'}`}>
                                                    {isSelected && <FiCheckSquare className="text-white w-3 h-3" />}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{index + 1}</span>
                                            )}
                                        </td>

                                        <td className="p-4">
                                            <div className="flex items-center gap-4">
                                                {isKosong ? (
                                                    <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 ring-2 ring-gray-50 dark:ring-gray-800">
                                                        <FiBriefcase size={20} />
                                                    </div>
                                                ) : (
                                                    <div className="relative group-hover:scale-105 transition-transform duration-300">
                                                        <img 
                                                            src={p.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nama || 'X')}&background=E2E8F0&color=4A5568`} 
                                                            alt={p.nama} 
                                                            className="w-11 h-11 rounded-full object-cover shadow-sm border-2 border-white dark:border-gray-600"
                                                        />
                                                        {isHighlighted && <span className="absolute top-0 right-0 w-3 h-3 bg-yellow-400 border-2 border-white rounded-full animate-ping"></span>}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                        {p.nama || <span className="text-gray-400 italic font-normal">Belum terisi</span>}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                                                        {p.nik ? `NIK: ${p.nik}` : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="p-4">
                                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-full whitespace-nowrap">
                                                {p.jabatan}
                                            </span>
                                        </td>

                                        {currentUser.role === 'admin_kecamatan' && (
                                            <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                                                {p.desa}
                                            </td>
                                        )}

                                        <td className="p-4">
                                            {isPurna ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                    <span className="w-2 h-2 rounded-full bg-gray-500"></span> Purna Tugas
                                                </span>
                                            ) : isKosong ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Kosong
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                                                    isDataLengkap(p) 
                                                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' 
                                                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
                                                }`}>
                                                    <span className={`w-2 h-2 rounded-full ${isDataLengkap(p) ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                                    {isDataLengkap(p) ? 'Lengkap' : 'Belum Lengkap'}
                                                </span>
                                            )}
                                        </td>

                                        <td className="p-4 text-right">
                                            <div className="flex justify-end items-center gap-1 sm:gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenModal(p, 'view'); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Lihat Detail">
                                                    <FiEye size={18} />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenModal(p, 'edit'); }} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors" title="Edit Data">
                                                    <FiEdit size={18} />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); setSelectedPerangkat(p); setShowDeleteConfirm(true); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Hapus Data">
                                                    <FiTrash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan={currentUser.role === 'admin_kecamatan' ? 6 : 5} className="text-center py-20">
                                        <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 animate-fadeIn">
                                            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full mb-4">
                                                <FiSearch size={40} className="opacity-50" />
                                            </div>
                                            <p className="text-base font-medium">Tidak ada data ditemukan untuk Desa {currentDesa}</p>
                                            <p className="text-sm opacity-75 mt-1">Coba kata kunci lain atau tambah data baru.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="text-center mt-4">
                 <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                    <FiAlertCircle size={12}/> 
                    <span>Tip: Klik 2x (PC) atau Tahan (HP) pada baris tabel untuk masuk mode pemilihan massal.</span>
                </p>
            </div>

            {currentUser?.role === 'admin_kecamatan' && (
                <div className="mt-8">
                    <Pagination
                        desaList={DESA_LIST}
                        currentDesa={currentDesa}
                        onPageChange={setCurrentDesa}
                    />
                </div>
            )}

            {/* ACTION BAR BAWAH (Floating & Draggable) */}
            {isSelectionMode && (
                <div 
                    className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-bounce-in transition-transform cursor-move select-none backdrop-blur-md bg-white/90 dark:bg-gray-800/90"
                    style={{ 
                        left: '50%', 
                        bottom: '2rem', 
                        transform: `translate(calc(-50% + ${menuPos.x}px), ${menuPos.y}px)`,
                        touchAction: 'none'
                    }}
                    onMouseDown={startDrag}
                    onTouchStart={startDrag}
                >
                    <div className="flex items-center gap-3 text-gray-400 cursor-move hover:text-gray-600 transition-colors">
                        <FiMove />
                    </div>
                    
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                    <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg min-w-[1.5rem] text-center shadow-sm">{selectedIds.size}</span>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap hidden sm:inline">Terpilih</span>
                    </div>
                    
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                    <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); openBulkDeleteConfirm('kosongkan'); }}
                            disabled={selectedIds.size === 0}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors disabled:opacity-50 hover:scale-110 active:scale-95"
                            title="Kosongkan Jabatan"
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        >
                            <FiUserX size={20} />
                        </button>

                        <button 
                            onClick={(e) => { e.stopPropagation(); openBulkDeleteConfirm('permanen'); }}
                            disabled={selectedIds.size === 0}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 hover:scale-110 active:scale-95"
                            title="Hapus Permanen"
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        >
                            <FiTrash2 size={20} />
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); cancelSelectionMode(); }}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors hover:rotate-90 duration-200"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    >
                        <FiX size={20} />
                    </button>
                </div>
            )}

            {/* MODALS */}
         <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Profil Perangkat Desa' : (selectedPerangkat ? 'Edit Data Perangkat' : 'Tambah Data Perangkat')}>
                {modalMode === 'view' && selectedPerangkat ? (<PerangkatDetailView perangkat={selectedPerangkat} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {Object.entries({ desa: 'Desa', nama: 'Nama Lengkap', nik: 'NIK', jenis_kelamin: 'Jenis Kelamin', tempat_lahir: 'Tempat Lahir', tgl_lahir: 'Tanggal Lahir', no_sk: 'Nomor SK', tgl_sk: 'Tanggal SK', tgl_pelantikan: 'Tanggal Pelantikan', no_hp: 'No. HP / WA', nip: 'NIP/NIPD', }).map(([key, label]) => (
                            <div key={key}>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
                                { key === 'desa' ? (
                                    <div className="relative">
                                        <select name={key} value={formData[key] || ''} onChange={handleFormChange} className="form-input-modern appearance-none" required disabled={currentUser.role === 'admin_desa'}>
                                            <option value="">Pilih Desa</option>{DESA_LIST.sort().map(desa => <option key={desa} value={desa}>{desa}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500"><FiChevronDown/></div>
                                    </div>
                                ) : key === 'jenis_kelamin' ? (
                                    <div className="relative">
                                        <select name={key} value={formData[key] || ''} onChange={handleFormChange} className="form-input-modern appearance-none">
                                            <option value="">Pilih Jenis Kelamin</option><option value="L">Laki-laki</option><option value="P">Perempuan</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500"><FiChevronDown/></div>
                                    </div>
                                ) : (
                                    <input type={key.includes('tgl') ? 'date' : 'text'} name={key} value={formData[key] || ''} onChange={handleFormChange} className="form-input-modern" placeholder={`Masukkan ${label}`}/>
                                )}
                            </div>
                            ))}
                            
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Pendidikan Terakhir</label>
                                <div className="relative">
                                    <select name="pendidikan" value={formData.pendidikan || ''} onChange={handleFormChange} className="form-input-modern appearance-none">
                                        <option value="">Pilih Pendidikan</option>{PENDIDIKAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}<option value="Lainnya">Lainnya...</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500"><FiChevronDown/></div>
                                </div>
                                {formData.pendidikan === 'Lainnya' && (<input type="text" name="pendidikan_custom" value={formData.pendidikan_custom || ''} onChange={handleFormChange} placeholder="Masukkan pendidikan manual" className="mt-2 form-input-modern" required />)}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Akhir Masa Jabatan</label>
                                {(() => { 
                                    const isKades = formData.jabatan && (formData.jabatan.toLowerCase().includes('kepala desa') || formData.jabatan.toLowerCase().includes('pj. kepala desa'));
                                    return (
                                        <input type="date" name="akhir_jabatan" value={formData.akhir_jabatan || ''} onChange={handleFormChange} 
                                        className={`form-input-modern ${!isKades ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed border-dashed' : ''}`} 
                                        disabled={!isKades} 
                                        title={!isKades ? "Dihitung otomatis (usia 60 tahun)" : "Masukkan tanggal akhir jabatan"}/>
                                    );
                                })()}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Jabatan</label>
                                <div className="relative">
                                    <select name="jabatan" value={formData.jabatan || ''} onChange={handleFormChange} className="form-input-modern appearance-none" disabled={!!selectedPerangkat && !(!selectedPerangkat.nama && !selectedPerangkat.nik)}>
                                        <option value="">Pilih Jabatan</option>{JABATAN_LIST.map(jabatan => <option key={jabatan} value={jabatan}>{jabatan}</option>)}<option value="Lainnya">Jabatan Lainnya...</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500"><FiChevronDown/></div>
                                </div>
                                {formData.jabatan === 'Lainnya' && (<input type="text" name="jabatan_custom" value={formData.jabatan_custom || ''} onChange={handleFormChange} placeholder="Masukkan nama jabatan manual" className="mt-2 form-input-modern" required disabled={!!selectedPerangkat && !(!selectedPerangkat.nama && !selectedPerangkat.nik)}/>)}
                            </div>

                            <div className="md:col-span-2 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 group hover:border-blue-400 transition-colors">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Foto Profil</label>
                                <div className="flex items-center gap-4">
                                    {formData.foto_url && <img src={formData.foto_url} alt="Preview" className="h-16 w-16 object-cover rounded-full shadow-sm border-2 border-white dark:border-gray-600"/>}
                                    <input type="file" onChange={(e) => setFotoProfilFile(e.target.files[0])} accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/50 dark:file:text-blue-300 transition-colors"/>
                                </div>
                            </div>

                            <div className="md:col-span-2 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 group hover:border-blue-400 transition-colors">
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Foto KTP</label>
                                <div className="flex flex-col gap-3">
                                    <input type="file" onChange={(e) => setFotoKtpFile(e.target.files[0])} accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/50 dark:file:text-blue-300 transition-colors"/>
                                    {formData.ktp_url && <img src={formData.ktp_url} alt="Preview KTP" className="h-32 w-auto object-contain rounded-lg border border-gray-200 dark:border-gray-600"/>}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-gray-700 gap-3">
                            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                            <Button type="submit" variant="primary" isLoading={isSubmitting}>{selectedPerangkat ? 'Simpan Perubahan' : 'Simpan Data'}</Button>
                        </div>
                    </form>
                )}
            </Modal>
            
            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Konfirmasi Hapus">
                <div className="text-center p-4">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4 animate-bounce">
                        <FiTrash2 className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Hapus Data Perangkat?</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Anda akan menghapus data atas nama <strong className="text-red-600">{selectedPerangkat?.nama}</strong>.
                        <br/>Tindakan ini tidak dapat dibatalkan.
                    </p>
                </div>
                <div className="flex justify-center gap-3 mt-6">
                    <Button onClick={() => handleDelete('kosongkan')} variant="warning" isLoading={isDeleting} className="flex-1 justify-center py-3">
                        <FiUserX className="mr-2"/> Kosongkan
                    </Button>
                    <Button onClick={() => handleDelete('permanen')} variant="danger" isLoading={isDeleting} className="flex-1 justify-center py-3">
                        <FiTrash2 className="mr-2"/> Permanen
                    </Button>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={isBulkDeleteConfirmOpen}
                onClose={() => setIsBulkDeleteConfirmOpen(false)}
                onConfirm={executeBulkDelete}
                isLoading={isDeleting}
                title="Konfirmasi Aksi Massal"
                message={`Apakah Anda yakin ingin ${bulkDeleteMode === 'kosongkan' ? 'mengosongkan jabatan' : 'menghapus permanen'} untuk ${selectedIds.size} data yang dipilih?`}
                variant={bulkDeleteMode === 'kosongkan' ? 'warning' : 'danger'}
            />

            {currentUser.role === 'admin_kecamatan' && (
                 <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Ekspor Data Perangkat">
                    <div className="p-4">
                        <div className="mb-6 flex justify-center">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-full ring-8 ring-emerald-50 dark:ring-emerald-900/20">
                                <FiDownload className="text-emerald-600 dark:text-emerald-400 w-8 h-8"/>
                            </div>
                        </div>
                        <p className="text-center text-gray-600 dark:text-gray-300 mb-8 font-medium">
                            Silakan pilih cakupan data yang ingin Anda unduh dalam format Excel (.xlsx).
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={() => handleExportXLSX('current')} className="p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group relative overflow-hidden">
                                <div className="relative z-10">
                                    <span className="block font-bold text-lg text-gray-800 dark:text-white group-hover:text-blue-600">Desa {currentDesa}</span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 block">Hanya data desa yang sedang aktif.</span>
                                </div>
                            </button>
                            <button onClick={() => handleExportXLSX('all')} className="p-5 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-left group relative overflow-hidden">
                                <div className="relative z-10">
                                    <span className="block font-bold text-lg text-gray-800 dark:text-white group-hover:text-emerald-600">Semua Desa</span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 block">Rekapitulasi seluruh kecamatan.</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Perangkat;