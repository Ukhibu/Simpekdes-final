import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { doc, writeBatch, getDocs, getDoc, collection, query, where, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import SkeletonLoader from '../components/common/SkeletonLoader';
import { FiEdit, FiSearch, FiUpload, FiDownload, FiPlus, FiEye, FiUserX, FiTrash2, FiBriefcase, FiCheckSquare, FiX, FiArchive, FiAlertCircle, FiMove } from 'react-icons/fi';
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

const PerangkatDetailView = ({ perangkat }) => {
    if (!perangkat) return null;
    const statusPurna = perangkat.akhir_jabatan && new Date(perangkat.akhir_jabatan) < new Date();

    const DetailItem = ({ label, value }) => (
        <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
            <p className="text-gray-800 dark:text-gray-200">{value || '-'}</p>
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
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <img
                    src={perangkat.foto_url || `https://ui-avatars.com/api/?name=${perangkat.nama}&background=0D8ABC&color=fff&size=128`}
                    alt={perangkat.nama}
                    className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-white dark:border-gray-600 shadow-lg"
                />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{perangkat.nama}</h3>
                <p className="text-gray-600 dark:text-gray-300">{perangkat.jabatan} - Desa {perangkat.desa}</p>
                 {statusPurna && <p className="mt-2 text-sm font-semibold text-red-500 dark:text-red-400">Telah Purna Tugas</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem label="NIK" value={perangkat.nik} />
                <DetailItem label="NIP/NIPD" value={perangkat.nip} />
                <DetailItem label="Jenis Kelamin" value={perangkat.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                <DetailItem label="Tempat, Tanggal Lahir" value={`${perangkat.tempat_lahir || ''}, ${formatDate(perangkat.tgl_lahir)}`} />
                <DetailItem label="Pendidikan Terakhir" value={perangkat.pendidikan} />
                <DetailItem label="No. HP / WA" value={perangkat.no_hp} />
            </div>
            <div>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 mb-2">Informasi Jabatan</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailItem label="Nomor SK" value={perangkat.no_sk} />
                    <DetailItem label="Tanggal SK" value={formatDate(perangkat.tgl_sk)} />
                    <DetailItem label="Tanggal Pelantikan" value={formatDate(perangkat.tgl_pelantikan)} />
                    <DetailItem label="Akhir Masa Jabatan" value={formatDate(perangkat.akhir_jabatan)} />
                </div>
            </div>
            <div>
                 <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 mb-2">Dokumen KTP</h4>
                 {perangkat.ktp_url ? (
                     <img src={perangkat.ktp_url} alt="Foto KTP" className="mt-2 w-full max-w-sm mx-auto object-contain rounded-md"/>
                 ) : <p className="mt-1 text-gray-500 dark:text-gray-400">Tidak ada foto KTP.</p>}
            </div>
        </div>
    );
};

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
    const longPressTimer = useRef(null);

    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
    const [bulkDeleteMode, setBulkDeleteMode] = useState(null); // 'kosongkan' atau 'permanen'
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    
    // --- DRAGGABLE STATE ---
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    
    const [currentDesa, setCurrentDesa] = useState(DESA_LIST[0]);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [highlightedRow, setHighlightedRow] = useState(null);
    
    useEffect(() => {
        const highlightId = searchParams.get('highlight');
        if (highlightId) {
            setHighlightedRow(highlightId);
            if (currentUser.role === 'admin_kecamatan') {
                const targetDesa = searchParams.get('desa');
                if (targetDesa) {
                    setCurrentDesa(targetDesa);
                }
            }
            const timer = setTimeout(() => setHighlightedRow(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, currentUser.role]);
    
    useEffect(() => {
        if (currentUser && currentUser.role === 'admin_desa') {
            setCurrentDesa(currentUser.desa);
        }
    }, [currentUser]);

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

    // --- LOGIKA CLICK BOOK / SELECTION ---

    const activateSelectionMode = (id) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds(new Set([id]));
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }
    };

    const handleDoubleClick = (id) => activateSelectionMode(id);

    const handleTouchStart = (id) => {
        longPressTimer.current = setTimeout(() => activateSelectionMode(id), 800);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
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

    // --- LOGIKA SELECT ALL (DIPERBAIKI) ---
    const isAllSelected = filteredPerangkat.length > 0 && filteredPerangkat.every(p => selectedIds.has(p.id));

    const handleSelectAll = () => {
        if (isAllSelected) {
            // Unselect All (Hapus yang sedang tampil dari set)
            const newSelection = new Set(selectedIds);
            filteredPerangkat.forEach(p => newSelection.delete(p.id));
            setSelectedIds(newSelection);
        } else {
            // Select All (Tambahkan yang sedang tampil ke set)
            const newSelection = new Set(selectedIds);
            filteredPerangkat.forEach(p => newSelection.add(p.id));
            setSelectedIds(newSelection);
        }
    };

    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
        setDragPos({ x: 0, y: 0 }); // Reset posisi drag
    };

    const toggleSelectionMode = () => {
        if (isSelectionMode) {
            cancelSelectionMode();
        } else {
            setIsSelectionMode(true);
            setSelectedIds(new Set());
        }
    };

    // --- DRAG LOGIC FOR ACTION BAR ---
    const onDragStart = (e) => {
        isDraggingRef.current = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragStartPos.current = { x: clientX - dragPos.x, y: clientY - dragPos.y };
    };

    const onDragMove = (e) => {
        if (!isDraggingRef.current) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Prevent scrolling while dragging on mobile
        if(e.cancelable && e.touches) e.preventDefault(); 

        setDragPos({
            x: clientX - dragStartPos.current.x,
            y: clientY - dragStartPos.current.y
        });
    };

    const onDragEnd = () => {
        isDraggingRef.current = false;
    };

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
    if (loading) return <SkeletonLoader columns={5} />;
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-colors duration-300 pb-24"> 
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div className="relative lg:col-span-3">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder={`Cari di Desa ${currentDesa}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                </div>
            </div>
            
            <div className="flex flex-wrap justify-end gap-2 mb-4">
                 <Button onClick={() => navigate('/app/histori-perangkat')} variant="secondary">
                    <FiArchive className="mr-2" /> Riwayat Purna
                </Button>
                
                {isSelectionMode ? (
                    <>
                        {/* Tombol massal dipindah ke bawah, tapi tombol batal tetap disini jika user prefer */}
                    </>
                ) : (
                    <>
                        <Button onClick={toggleSelectionMode} variant="danger"><FiCheckSquare/> Pilih Data</Button>
                        <label className="btn btn-warning cursor-pointer"><FiUpload className="mr-2"/> 
                            <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" disabled={isUploading}/>
                            {isUploading ? 'Mengimpor...' : 'Impor Data'}
                        </label>
                        <Button onClick={handleExportClick} variant="success"><FiDownload className="mr-2"/> Ekspor XLSX</Button>
                        <Button onClick={() => handleOpenModal(null, 'add')} variant="primary"><FiPlus className="mr-2"/> Tambah Data</Button>
                    </>
                )}
            </div>
            
            <div className="table-container-modern">
                <table className="table-modern">
                    <thead>
                        <tr>
                            <th className="p-4 w-12">
                                {isSelectionMode ? (
                                    <div 
                                        onClick={handleSelectAll} 
                                        className="cursor-pointer flex justify-center items-center"
                                    >
                                        {filteredPerangkat.length > 0 && filteredPerangkat.every(p => selectedIds.has(p.id)) ? (
                                            <div className="w-5 h-5 bg-blue-600 rounded border border-blue-600 flex items-center justify-center text-white">
                                                <FiCheckSquare size={14} />
                                            </div>
                                        ) : (
                                            <div className="w-5 h-5 border-2 border-gray-400 rounded bg-white"></div>
                                        )}
                                    </div>
                                ) : (
                                    'No'
                                )}
                            </th>
                            <th>Nama Lengkap</th>
                            <th>Jabatan</th>
                            {currentUser.role === 'admin_kecamatan' && <th>Desa</th>}
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPerangkat.length > 0 ? filteredPerangkat.map((p, index) => {
                            const isPurna = p.akhir_jabatan && new Date(p.akhir_jabatan) < new Date();
                            const isKosong = !p.nama && !p.nik;
                            const isSelected = selectedIds.has(p.id);

                            return (
                                <tr 
                                    key={p.id} 
                                    className={`
                                        ${highlightedRow === p.id ? 'highlight-row' : ''}
                                        ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                                        hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer select-none
                                    `}
                                    onDoubleClick={() => activateSelectionMode(p.id)}
                                    onTouchStart={() => handleTouchStart(p.id)}
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
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white'}`}>
                                                {isSelected && <FiCheckSquare className="text-white w-3 h-3" />}
                                            </div>
                                        ) : (
                                            index + 1
                                        )}
                                    </td>

                                    <td className="font-medium flex items-center gap-3 text-gray-900 dark:text-white">
                                        {isKosong ? (<div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 flex items-center justify-center rounded-full text-gray-500"><FiBriefcase /></div>
                                        ) : (<img src={p.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nama || 'X')}&background=E2E8F0&color=4A5568`} alt={p.nama || 'Jabatan Kosong'} className="w-10 h-10 rounded-full object-cover"/>)}
                                        <div><p className="font-semibold">{p.nama || '(Jabatan Kosong)'}</p><p className="text-xs text-gray-500 dark:text-gray-400">{p.nik || 'NIK belum diisi'}</p></div>
                                    </td>
                                    <td>{p.jabatan}</td>
                                    {currentUser.role === 'admin_kecamatan' && <td>{p.desa}</td>}
                                    <td>
                                        {isPurna ? (<span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Purna Tugas</span>
                                        ) : isKosong ? (<span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Jabatan Kosong</span>
                                        ) : (<span className={`px-2 py-1 text-xs font-medium rounded-full ${isDataLengkap(p) ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>{isDataLengkap(p) ? 'Lengkap' : 'Belum Lengkap'}</span>)}
                                    </td>
                                    <td className="flex space-x-3">
                                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(p, 'view'); }} className="text-green-600 hover:text-green-800" title="Lihat Detail"><FiEye /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(p, 'edit'); }} className="text-blue-600 hover:text-blue-800" title="Edit"><FiEdit /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedPerangkat(p); setShowDeleteConfirm(true); }} className="text-red-600 hover:text-red-800" title="Hapus"><FiTrash2 /></button>
                                    </td>
                                </tr>
                            )
                        }) : (<tr><td colSpan={isSelectionMode ? 6 : 5} className="text-center py-10 text-gray-500 dark:text-gray-400">Tidak ada data untuk ditampilkan di Desa {currentDesa}.</td></tr>)}
                    </tbody>
                </table>
            </div>
            
            <div className="p-4 text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 text-center flex justify-center gap-1">
                <FiAlertCircle/> Tip: Klik 2x (PC) atau Tahan (HP) untuk memilih banyak data.
            </div>

            {currentUser?.role === 'admin_kecamatan' && (
                <Pagination
                    desaList={DESA_LIST}
                    currentDesa={currentDesa}
                    onPageChange={setCurrentDesa}
                />
            )}

            {/* ACTION BAR BAWAH (Floating & Draggable) */}
            {isSelectionMode && (
                <div 
                    className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-bounce-in transition-transform cursor-move select-none"
                    style={{ 
                        left: '50%', 
                        bottom: '1.5rem', 
                        transform: `translate(calc(-50% + ${dragPos.x}px), ${dragPos.y}px)`,
                        touchAction: 'none' // Important for dragging on mobile
                    }}
                    onMouseDown={onDragStart}
                    onMouseMove={onDragMove}
                    onMouseUp={onDragEnd}
                    onMouseLeave={onDragEnd}
                    onTouchStart={onDragStart}
                    onTouchMove={onDragMove}
                    onTouchEnd={onDragEnd}
                >
                    <div className="flex items-center gap-2 text-gray-400">
                        <FiMove /> {/* Drag Handle Icon */}
                    </div>
                    
                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

                    <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{selectedIds.size}</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">Terpilih</span>
                    </div>
                    
                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); openBulkDeleteConfirm('kosongkan'); }}
                        disabled={selectedIds.size === 0}
                        className="text-yellow-600 hover:text-yellow-700 font-semibold text-sm flex items-center gap-1 disabled:opacity-50 transition-colors"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    >
                        <FiUserX /> <span className="hidden sm:inline">Kosongkan</span>
                    </button>

                    <button 
                        onClick={(e) => { e.stopPropagation(); openBulkDeleteConfirm('permanen'); }}
                        disabled={selectedIds.size === 0}
                        className="text-red-600 hover:text-red-700 font-semibold text-sm flex items-center gap-1 disabled:opacity-50 transition-colors"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    >
                        <FiTrash2 /> <span className="hidden sm:inline">Hapus</span>
                    </button>

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); cancelSelectionMode(); }}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 font-medium text-sm flex items-center gap-1 transition-colors"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                    >
                        <FiX /> Batal
                    </button>
                </div>
            )}

            {/* MODALS */}
         <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Detail Data Perangkat' : (selectedPerangkat ? 'Edit Data Perangkat' : 'Tambah Data Perangkat')}>
                {modalMode === 'view' && selectedPerangkat ? (<PerangkatDetailView perangkat={selectedPerangkat} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries({ desa: 'Desa', nama: 'Nama Lengkap', nik: 'NIK', jenis_kelamin: 'Jenis Kelamin', tempat_lahir: 'Tempat Lahir', tgl_lahir: 'Tanggal Lahir', no_sk: 'Nomor SK', tgl_sk: 'Tanggal SK', tgl_pelantikan: 'Tanggal Pelantikan', no_hp: 'No. HP / WA', nip: 'NIP/NIPD', }).map(([key, label]) => (<div key={key}><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                            { key === 'desa' ? (<select name={key} value={formData[key] || ''} onChange={handleFormChange} className="form-input-modern" required disabled={currentUser.role === 'admin_desa'}><option value="">Pilih Desa</option>{DESA_LIST.sort().map(desa => <option key={desa} value={desa}>{desa}</option>)}</select>
                            ) : key === 'jenis_kelamin' ? (<select name={key} value={formData[key] || ''} onChange={handleFormChange} className="form-input-modern"><option value="">Pilih Jenis Kelamin</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
                            ) : (<input type={key.includes('tgl') ? 'date' : 'text'} name={key} value={formData[key] || ''} onChange={handleFormChange} className="form-input-modern"/>)}</div>))}
                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pendidikan Terakhir</label>
                            <><select name="pendidikan" value={formData.pendidikan || ''} onChange={handleFormChange} className="form-input-modern"><option value="">Pilih Pendidikan</option>{PENDIDIKAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}<option value="Lainnya">Lainnya...</option></select>
                            {formData.pendidikan === 'Lainnya' && (<input type="text" name="pendidikan_custom" value={formData.pendidikan_custom || ''} onChange={handleFormChange} placeholder="Masukkan pendidikan" className="mt-2 form-input-modern" required />)}</></div>
                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Akhir Masa Jabatan</label>
                            {(() => { const isKades = formData.jabatan && (formData.jabatan.toLowerCase().includes('kepala desa') || formData.jabatan.toLowerCase().includes('pj. kepala desa'));
                            return (<input type="date" name="akhir_jabatan" value={formData.akhir_jabatan || ''} onChange={handleFormChange} className={`form-input-modern ${!isKades ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700'}`} disabled={!isKades} title={!isKades ? "Dihitung otomatis (usia 60 tahun)" : "Masukkan tanggal akhir jabatan"}/>);})()}</div>
                            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Jabatan</label>
                            <><select name="jabatan" value={formData.jabatan || ''} onChange={handleFormChange} className="form-input-modern" disabled={!!selectedPerangkat && !(!selectedPerangkat.nama && !selectedPerangkat.nik)}><option value="">Pilih Jabatan</option>{JABATAN_LIST.map(jabatan => <option key={jabatan} value={jabatan}>{jabatan}</option>)}<option value="Lainnya">Jabatan Lainnya...</option></select>
                            {formData.jabatan === 'Lainnya' && (<input type="text" name="jabatan_custom" value={formData.jabatan_custom || ''} onChange={handleFormChange} placeholder="Masukkan nama jabatan" className="mt-2 form-input-modern" required disabled={!!selectedPerangkat && !(!selectedPerangkat.nama && !selectedPerangkat.nik)}/>)}</></div>
                            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Foto Profil</label>
                            <><input type="file" onChange={(e) => setFotoProfilFile(e.target.files[0])} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>{formData.foto_url && <img src={formData.foto_url} alt="Foto Profil Saat Ini" className="mt-2 h-24 w-24 object-cover rounded-md"/>}</></div>
                            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Foto KTP</label>
                            <><input type="file" onChange={(e) => setFotoKtpFile(e.target.files[0])} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>{formData.ktp_url && <img src={formData.ktp_url} alt="Foto KTP Saat Ini" className="mt-2 h-24 w-auto object-contain rounded-md"/>}</></div>
                        </div>
                        <div className="flex justify-end pt-4 border-t mt-6 dark:border-gray-700"><Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Tutup</Button><Button type="submit" variant="primary" isLoading={isSubmitting} className="ml-2">{selectedPerangkat ? 'Simpan Perubahan' : 'Simpan'}</Button></div>
                    </form>
                )}
            </Modal>
            
            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Konfirmasi Hapus">
                <p>Pilih tipe penghapusan untuk data "{selectedPerangkat?.nama}":</p>
                <div className="flex justify-end gap-4 mt-6">
                    <Button onClick={() => handleDelete('kosongkan')} variant="warning" isLoading={isDeleting}><FiUserX /> Kosongkan Jabatan</Button>
                    <Button onClick={() => handleDelete('permanen')} variant="danger" isLoading={isDeleting}><FiTrash2 /> Hapus Permanen</Button>
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
                 <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Pilih Opsi Ekspor Data Perangkat">
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Pilih data yang ingin Anda ekspor ke dalam file XLSX.</p>
                    <div className="flex flex-col md:flex-row justify-center gap-4">
                        <Button onClick={() => handleExportXLSX('current')} variant="secondary" className="w-full md:w-auto">
                            Hanya Desa {currentDesa}
                        </Button>
                        <Button onClick={() => handleExportXLSX('all')} variant="primary" className="w-full md:w-auto">
                            Semua Desa (Rekap Kecamatan)
                        </Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Perangkat;