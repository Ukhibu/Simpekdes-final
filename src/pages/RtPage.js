import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import OrganisasiDetailView from '../components/common/OrganisasiDetailView';
import Pagination from '../components/common/Pagination'; 
import { FiSearch, FiPlus, FiEdit, FiTrash2, FiEye, FiUpload, FiDownload, FiCheckSquare, FiX, FiAlertCircle, FiMove, FiMoreHorizontal, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { DESA_LIST, PENDIDIKAN_LIST, JENIS_KELAMIN_LIST } from '../utils/constants';
import * as XLSX from 'xlsx';
import { generateRtXLSX } from '../utils/generateRtXLSX';
import { createNotificationForAdmins } from '../utils/notificationService';
import { useSearchParams } from 'react-router-dom';

const SAFE_DESA_LIST = Array.isArray(DESA_LIST) ? DESA_LIST : [];
const JABATAN_RT_LIST = ["Ketua", "Sekretaris", "Bendahara", "Anggota"];

const RT_CONFIG = {
    collectionName: 'rt_rw',
    title: 'Data Pengurus RT',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'select', options: JABATAN_RT_LIST, required: true },
        { name: 'no_rt', label: 'Nomor RT', type: 'text', required: true },
        { name: 'no_rw', label: 'Nomor RW (Induk)', type: 'text' },
        { name: 'dusun', label: 'Dusun', type: 'text' },
        { name: 'dukuh', label: 'Dukuh', type: 'text' },
        { name: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: JENIS_KELAMIN_LIST, required: true },
        { name: 'tempat_lahir', label: 'Tempat Lahir', type: 'text' },
        { name: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
        { name: 'pendidikan', label: 'Pendidikan Terakhir', type: 'select', options: PENDIDIKAN_LIST },
        { name: 'periode', label: 'Periode Jabatan', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ],
    tableColumns: ['nama', 'jabatan', 'no_rt', 'desa', 'dusun'],
    completenessCriteria: ['nama', 'jabatan', 'no_rt', 'desa', 'jenis_kelamin'],
};

// Helper Functions
const formatDateIndo = (dateString) => {
    if (!dateString) return "-";
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(date).replace(/ /g, '-');
    } catch (e) { return dateString; }
};

const parseExcelDate = (excelDate) => {
    if (!excelDate) return "";
    let date;
    if (typeof excelDate === 'number') {
        date = new Date((excelDate - 25569) * 86400 * 1000);
    } else {
        date = new Date(excelDate);
    }
    if (isNaN(date.getTime())) return "";
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - tzoffset);
    return localDate.toISOString().split('T')[0];
};

const RtPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Manual Input Toggles (untuk mengizinkan input manual jika data belum ada)
    const [manualInputMode, setManualInputMode] = useState({
        rw: false,
        rt: false,
        dusun: false,
        dukuh: false
    });

    // Konfirmasi Hapus State
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState('all');
    const [exportConfig, setExportConfig] = useState({});

    // STATE UNTUK AUTO-OPEN & SELEKSI
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
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 }); // Posisi popup
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Initial Load Config
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, 'settings', 'exportConfig');
                const snap = await getDoc(docRef);
                if (snap.exists()) setExportConfig(snap.data());
            } catch (err) { console.error(err); }
        };
        fetchConfig();
    }, []);

    // Set Initial Menu Position (Bottom Center) - DISESUAIKAN UNTUK BENTUK LONJONG/KECIL
    useEffect(() => {
        if (isSelectionMode) {
            setMenuPos({ 
                x: window.innerWidth / 2 - 110, 
                y: window.innerHeight - 120 
            });
        }
    }, [isSelectionMode]);

    // Set Default Desa
    useEffect(() => {
        if (currentUser) {
            if (currentUser.role === 'admin_kecamatan') {
                setFilterDesa(SAFE_DESA_LIST[0] || 'all'); 
            } else {
                setFilterDesa(currentUser.desa);
            }
        }
    }, [currentUser]);

    // Load Data
    useEffect(() => {
        if (!currentUser) return setLoading(false);
        setLoading(true);
        const q = query(collection(db, RT_CONFIG.collectionName)); 
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(item => item.no_rt && !item.no_rw_only); 
            setDataList(list);
            setLoading(false);
        }, (error) => {
            showNotification(`Gagal memuat data: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, showNotification]);

    // --- LOGIKA HIERARKI WILAYAH (RW -> RT -> DUSUN/DUKUH) ---
    const wilayahHierarchy = useMemo(() => {
        const hierarchy = {}; 
        // Struktur: { [NamaDesa]: { [NoRW]: { rts: Set(NoRT), data: { [NoRT]: { dusuns: Set, dukuhs: Set } } } } }

        dataList.forEach(item => {
            const d = item.desa;
            const rw = item.no_rw;
            const rt = item.no_rt;
            
            if (!d || !rw) return;

            if (!hierarchy[d]) hierarchy[d] = {};
            if (!hierarchy[d][rw]) hierarchy[d][rw] = { rts: new Set(), data: {} };

            if (rt) {
                hierarchy[d][rw].rts.add(rt);
                if (!hierarchy[d][rw].data[rt]) {
                    hierarchy[d][rw].data[rt] = { dusuns: new Set(), dukuhs: new Set() };
                }
                if (item.dusun) hierarchy[d][rw].data[rt].dusuns.add(item.dusun);
                if (item.dukuh) hierarchy[d][rw].data[rt].dukuhs.add(item.dukuh);
            }
        });
        return hierarchy;
    }, [dataList]);

    // Get Options Helpers
    const getRwOptions = (desa) => {
        if (!desa || !wilayahHierarchy[desa]) return [];
        return Object.keys(wilayahHierarchy[desa]).sort((a, b) => parseInt(a) - parseInt(b));
    };

    const getRtOptions = (desa, rw) => {
        if (!desa || !rw || !wilayahHierarchy[desa] || !wilayahHierarchy[desa][rw]) return [];
        return Array.from(wilayahHierarchy[desa][rw].rts).sort((a, b) => parseInt(a) - parseInt(b));
    };

    const getDusunOptions = (desa, rw, rt) => {
        if (!desa || !rw || !rt || !wilayahHierarchy[desa] || !wilayahHierarchy[desa][rw] || !wilayahHierarchy[desa][rw].data[rt]) return [];
        return Array.from(wilayahHierarchy[desa][rw].data[rt].dusuns);
    };

    const getDukuhOptions = (desa, rw, rt) => {
        if (!desa || !rw || !rt || !wilayahHierarchy[desa] || !wilayahHierarchy[desa][rw] || !wilayahHierarchy[desa][rw].data[rt]) return [];
        return Array.from(wilayahHierarchy[desa][rw].data[rt].dukuhs);
    };

    // Auto-fill Logic saat RT berubah
    useEffect(() => {
        if (isModalOpen && formData.desa && formData.no_rw && formData.no_rt && !manualInputMode.dusun && !manualInputMode.dukuh) {
            const dusunOpts = getDusunOptions(formData.desa, formData.no_rw, formData.no_rt);
            const dukuhOpts = getDukuhOptions(formData.desa, formData.no_rw, formData.no_rt);
            
            // Jika hanya ada 1 opsi yang tersedia untuk RT tersebut, auto-select
            if (dusunOpts.length === 1 && formData.dusun !== dusunOpts[0]) {
                setFormData(prev => ({ ...prev, dusun: dusunOpts[0] }));
            }
            if (dukuhOpts.length === 1 && formData.dukuh !== dukuhOpts[0]) {
                setFormData(prev => ({ ...prev, dukuh: dukuhOpts[0] }));
            }
        }
    }, [formData.no_rt, formData.no_rw, formData.desa, isModalOpen]);


    // --- [PERBAIKAN] LOGIKA AUTO-OPEN DARI DASHBOARD & NOTIFIKASI ---
    useEffect(() => {
        const viewId = searchParams.get('view');
        const editId = searchParams.get('edit');
        const targetId = viewId || editId;

        if (targetId && dataList.length > 0 && !hasOpenedModalFromQuery) {
            const itemToProcess = dataList.find(item => item.id === targetId);
            
            if (itemToProcess) {
                if (currentUser.role === 'admin_kecamatan' && itemToProcess.desa) {
                    setFilterDesa(itemToProcess.desa);
                }
                
                const mode = viewId ? 'view' : 'edit';
                handleOpenModal(mode, itemToProcess);
                setHasOpenedModalFromQuery(true);
                setHighlightedRow(targetId);
                
                setTimeout(() => {
                    const rowElement = document.getElementById(`row-${targetId}`);
                    if (rowElement) {
                        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 500);

                const newSearchParams = new URLSearchParams(searchParams);
                newSearchParams.delete('view');
                newSearchParams.delete('edit');
                setSearchParams(newSearchParams, { replace: true });

                setTimeout(() => setHighlightedRow(null), 3000);
            }
        }
    }, [searchParams, dataList, hasOpenedModalFromQuery, setSearchParams, currentUser.role]);

    // Filter Data
    const filteredData = useMemo(() => {
        let data = dataList;
        if (filterDesa !== 'all') {
            data = data.filter(item => item.desa === filterDesa);
        }
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            data = data.filter(item => 
                (item.nama || '').toLowerCase().includes(lowerSearch) ||
                (item.jabatan || '').toLowerCase().includes(lowerSearch) ||
                (item.no_rt || '').toLowerCase().includes(lowerSearch)
            );
        }
        return data.sort((a, b) => (parseInt(a.no_rt) || 0) - (parseInt(b.no_rt) || 0));
    }, [dataList, searchTerm, filterDesa]);

    // --- LOGIKA SELEKSI (CHECKBOX) & GESTURE ---

    const activateSelectionMode = (id) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds([id]);
            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate(50);
        }
    };

    const handleRowDoubleClick = (id) => {
        activateSelectionMode(id);
    };

    const handleRowTouchStart = (id, e) => {
        isScrolling.current = false;
        // Simpan koordinat awal sentuhan
        touchStartCoords.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };

        // Timer untuk Long Press (misal 600ms)
        longPressTimer.current = setTimeout(() => {
            // Hanya aktifkan jika tidak sedang scroll
            if (!isScrolling.current) {
                activateSelectionMode(id);
            }
        }, 600);
    };

    const handleRowTouchMove = (e) => {
        // Hitung jarak pergerakan jari
        const moveX = Math.abs(e.touches[0].clientX - touchStartCoords.current.x);
        const moveY = Math.abs(e.touches[0].clientY - touchStartCoords.current.y);

        // Jika gerak lebih dari 10px, anggap user sedang scroll
        if (moveX > 10 || moveY > 10) {
            isScrolling.current = true;
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
    };

    const handleRowTouchEnd = () => {
        // Bersihkan timer saat jari diangkat
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredData.length) setSelectedIds([]);
        else setSelectedIds(filteredData.map(item => item.id));
    };

    // --- LOGIKA DRAGGABLE POPUP MENU ---

    const startDrag = (e) => {
        // Mencegah default touch action browser (seperti scroll halaman saat drag popup)
        // Hanya jika target adalah handle drag
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

        // Update posisi
        const newX = clientX - dragOffset.current.x;
        const newY = clientY - dragOffset.current.y;

        setMenuPos({ x: newX, y: newY });
    };

    const stopDrag = () => {
        setIsDragging(false);
    };

    // Global event listeners untuk drag agar smooth
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


    // Trigger Modal Hapus Massal
    const openDeleteSelectedConfirm = () => {
        if (selectedIds.length === 0) return;
        setIsDeleteSelectedConfirmOpen(true);
    };

    // Eksekusi Hapus Massal
    const handleDeleteSelected = async () => {
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, RT_CONFIG.collectionName, id));
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

    // --- HANDLER MODAL & FORM ---
    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : filterDesa;
        setFormData(item ? { ...item } : { desa: initialDesa, jenis_kelamin: 'Laki-Laki', jabatan: 'Ketua', no_rw: '', no_rt: '', dusun: '', dukuh: '' });
        // Reset manual mode saat buka modal
        setManualInputMode({ rw: false, rt: false, dusun: false, dukuh: false });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => !isSubmitting && setIsModalOpen(false);
    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    // Toggle Input Manual (untuk menambah data baru yang belum ada di list)
    const toggleManualInput = (field) => {
        setManualInputMode(prev => ({ ...prev, [field]: !prev[field] }));
        // Reset nilai saat toggle untuk menghindari data sisa yang tidak valid di mode lain
        setFormData(prev => ({ ...prev, [field]: '' }));
    };

    // [PERBAIKAN] LOGIKA SUBMIT + LINK NOTIFIKASI VIEW DETAIL
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.desa) return showNotification("Desa wajib diisi!", 'error');
        setIsSubmitting(true);
        try {
            const dataToSave = { ...formData };
            ['dusun', 'dukuh', 'no_hp', 'tempat_lahir', 'no_rw'].forEach(f => { if (!dataToSave[f]) dataToSave[f] = ''; });
            dataToSave.no_rw_only = false; 

            let savedId = selectedItem?.id;

            if (selectedItem) {
                await updateDoc(doc(db, RT_CONFIG.collectionName, selectedItem.id), dataToSave);
                showNotification('Data RT diperbarui!', 'success');
            } else {
                const docRef = await addDoc(collection(db, RT_CONFIG.collectionName), dataToSave);
                savedId = docRef.id; // Tangkap ID baru
                showNotification('Data RT ditambahkan!', 'success');
            }

            if (currentUser.role === 'admin_desa') {
                const action = selectedItem ? 'memperbarui' : 'menambahkan';
                // [PERBAIKAN] Link menggunakan parameter ?view={id}
                const link = `/app/rt-rw/rt?view=${savedId}`;
                await createNotificationForAdmins(
                    `Admin Desa ${currentUser.desa} ${action} data RT: "${formData.nama}".`, 
                    link, 
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

    // --- IMPORT & EXPORT ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: "A", defval: "" });

                let startRowIndex = 0;
                for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
                     if (String(jsonData[i]['B']).includes('N A M A')) { startRowIndex = i + 2; break; }
                }
                if (startRowIndex === 0) startRowIndex = 3;

                const validRows = jsonData.slice(startRowIndex);
                if (validRows.length === 0) throw new Error("File kosong atau format tidak sesuai.");

                const batch = writeBatch(db);
                let addedCount = 0;
                let updatedCount = 0;

                const existingMap = new Map();
                dataList.forEach(item => {
                    const key = `${item.nama.toLowerCase()}_${item.desa.toLowerCase()}`;
                    existingMap.set(key, item.id);
                });

                validRows.forEach(row => {
                    const nama = String(row['B'] || '').trim();
                    if (!nama) return;

                    let desaTarget = currentUser.role === 'admin_desa' ? currentUser.desa : String(row['A'] || '').trim();
                    if (!desaTarget) return; 

                    let jenisKelamin = "Laki-Laki";
                    if (row['C'] == 1) jenisKelamin = "Laki-Laki"; else if (row['D'] == 1) jenisKelamin = "Perempuan";

                    let pendidikan = "";
                    if (row['H'] == 1) pendidikan = "SD";
                    else if (row['I'] == 1) pendidikan = "SLTP";
                    else if (row['J'] == 1) pendidikan = "SLTA";
                    else if (row['K'] == 1) pendidikan = "D1";
                    else if (row['L'] == 1) pendidikan = "D2";
                    else if (row['M'] == 1) pendidikan = "D3";
                    else if (row['N'] == 1) pendidikan = "S1";
                    else if (row['O'] == 1) pendidikan = "S2";

                    const tglLahirRaw = row['G'];
                    let tglLahirFixed = "";
                    if (tglLahirRaw) {
                        const isoDate = parseExcelDate(tglLahirRaw);
                        if (isoDate) tglLahirFixed = isoDate;
                    }

                    const newData = {
                        desa: desaTarget,
                        nama: nama,
                        jenis_kelamin: jenisKelamin,
                        jabatan: String(row['E'] || ''),
                        tempat_lahir: String(row['F'] || ''),
                        tanggal_lahir: tglLahirFixed,
                        pendidikan: pendidikan,
                        periode: String(row['P'] || ''),
                        no_rw: String(row['Q'] || ''), 
                        no_rt: String(row['R'] || ''), 
                        dukuh: String(row['S'] || ''),
                        dusun: String(row['T'] || ''),
                        no_hp: String(row['U'] || ''),
                        no_rw_only: false
                    };

                    if (newData.nama && newData.no_rt) {
                        const key = `${newData.nama.toLowerCase()}_${newData.desa.toLowerCase()}`;
                        if (existingMap.has(key)) {
                            batch.update(doc(db, RT_CONFIG.collectionName, existingMap.get(key)), newData);
                            updatedCount++;
                        } else {
                            batch.set(doc(collection(db, RT_CONFIG.collectionName)), newData);
                            addedCount++;
                        }
                    }
                });

                if (addedCount > 0 || updatedCount > 0) {
                    await batch.commit();
                    showNotification(`Impor: ${addedCount} baru, ${updatedCount} update.`, 'success');
                } else {
                    showNotification("Tidak ada data valid.", 'warning');
                }
            } catch (error) { showNotification(`Error impor: ${error.message}`, 'error'); }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null; 
    };

    const handleExportXLSX = async () => {
        if (filteredData.length === 0) return showNotification("Tidak ada data.", "warning");
        try { await generateRtXLSX(filteredData, db, exportConfig, currentUser); } 
        catch (error) { showNotification(error.message, 'error'); }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, RT_CONFIG.collectionName, itemToDelete.id));
            showNotification('Data dihapus.', 'success');
        } catch(error) { showNotification(error.message, 'error'); } 
        finally { setIsSubmitting(false); setIsDeleteConfirmOpen(false); }
    };

    return (
        <div className="space-y-6 pb-20"> 
            {/* Header & Tools */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <InputField 
                        type="text" 
                        placeholder="Cari Nama / RT..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        icon={<FiSearch />} 
                        className="w-full md:w-64"
                    />
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                            Desa: {filterDesa === 'all' ? 'Semua' : filterDesa}
                        </div>
                    )}
                </div>
                
                <div className="flex gap-2 w-full md:w-auto justify-end">
                    <label className="btn btn-warning cursor-pointer flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">
                        <FiUpload className="mr-2"/> Import
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls"/>
                    </label>
                    <Button onClick={handleExportXLSX} variant="success" className="flex items-center"><FiDownload className="mr-2"/> Ekspor</Button>
                    <Button onClick={() => handleOpenModal('add')} variant="primary" className="flex items-center"><FiPlus className="mr-2"/> Tambah</Button>
                </div>
            </div>

            {/* Tabel Data */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden relative">
                 <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                            <tr>
                                <th className="px-6 py-3 w-10">
                                    {isSelectionMode ? (
                                        <button onClick={toggleSelectAll} className="text-gray-600">
                                            {selectedIds.length === filteredData.length ? <FiCheckSquare size={18} className="text-blue-600"/> : <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>}
                                        </button>
                                    ) : 'No'}
                                </th>
                                <th className="px-6 py-3">Nama Lengkap</th>
                                <th className="px-6 py-3">Jabatan</th>
                                <th className="px-6 py-3">Desa</th>
                                <th className="px-6 py-3">RT / Dusun</th>
                                <th className="px-6 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-8"><Spinner /></td></tr>
                            ) : filteredData.length > 0 ? filteredData.map((item, index) => (
                                <tr 
                                    id={`row-${item.id}`}
                                    key={item.id} 
                                    className={`border-b dark:border-gray-700 transition-colors select-none cursor-pointer 
                                        ${selectedIds.includes(item.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''} 
                                        ${highlightedRow === item.id ? 'bg-yellow-100 dark:bg-yellow-900 ring-2 ring-yellow-400' : 'hover:bg-gray-50 dark:hover:bg-gray-600'}
                                    `}
                                    // --- INTERAKSI GESTURE ---
                                    onDoubleClick={() => handleRowDoubleClick(item.id)}
                                    onTouchStart={(e) => handleRowTouchStart(item.id, e)}
                                    onTouchMove={handleRowTouchMove}
                                    onTouchEnd={handleRowTouchEnd}
                                    onClick={() => isSelectionMode && toggleSelection(item.id)}
                                >
                                    <td className="px-6 py-4 font-medium">
                                        {/* Tampilan Checkbox (Click book seleksi) */}
                                        {isSelectionMode ? (
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedIds.includes(item.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                                                {selectedIds.includes(item.id) && <FiCheckSquare className="text-white w-3 h-3" />}
                                            </div>
                                        ) : index + 1}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.nama}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            item.jabatan === 'Ketua' ? 'bg-blue-100 text-blue-800' : 
                                            item.jabatan === 'Sekretaris' ? 'bg-green-100 text-green-800' : 
                                            item.jabatan === 'Bendahara' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                        }`}>{item.jabatan}</span>
                                    </td>
                                    <td className="px-6 py-4">{item.desa}</td>
                                    <td className="px-6 py-4">RT {item.no_rt} <span className="text-xs text-gray-400">({item.dusun})</span></td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal('view', item); }} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><FiEye size={18}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', item); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><FiEdit size={18}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="6" className="text-center py-10 text-gray-400">Data RT kosong.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
                 
                 {/* Pagination Desa */}
                 {!loading && currentUser.role === 'admin_kecamatan' && (
                    <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col items-center">
                        <span className="text-xs text-gray-500 mb-2">Navigasi Data Per Desa (Klik Angka)</span>
                        <Pagination 
                            desaList={SAFE_DESA_LIST} 
                            currentDesa={filterDesa} 
                            onPageChange={(desa) => setFilterDesa(desa)} 
                        />
                    </div>
                 )}
                 
                 <div className="p-4 text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 text-center flex justify-center gap-1">
                    <FiAlertCircle/> Tip: Klik 2x (PC) atau Tahan (HP) pada baris data untuk opsi hapus banyak.
                 </div>
            </div>

            {/* --- DRAGGABLE ACTION MENU POPUP (Compact Pill Shape) --- */}
            {isSelectionMode && (
                <div 
                    style={{
                        position: 'fixed',
                        left: `${menuPos.x}px`,
                        top: `${menuPos.y}px`,
                        zIndex: 9999,
                        touchAction: 'none' // Penting agar tidak scroll halaman saat drag
                    }}
                    className="flex items-center gap-3 pl-2 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-2xl rounded-full animate-in fade-in zoom-in duration-200 backdrop-blur-sm bg-opacity-95"
                >
                    {/* Handle Drag (Area Geser) */}
                    <div 
                        onMouseDown={startDrag}
                        onTouchStart={startDrag}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full cursor-move transition-colors group"
                        title="Geser Menu"
                    >
                        <FiMove className="text-gray-500 dark:text-gray-400 group-hover:text-blue-500" size={16} />
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center select-none">
                            {selectedIds.length}
                        </span>
                    </div>

                    {/* Pembatas Vertical */}
                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>

                    {/* Tombol Aksi (Icon Only untuk Compactness) */}
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={openDeleteSelectedConfirm}
                            disabled={selectedIds.length === 0}
                            title="Hapus Data Terpilih"
                            className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FiTrash2 size={20} />
                        </button>
                        
                        <button 
                            onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}
                            title="Batal Seleksi"
                            className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all active:scale-95"
                        >
                            <FiX size={20} />
                        </button>
                    </div>
                </div>
            )}
            
            {/* Modal Form */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Detail' : modalMode === 'edit' ? 'Edit Data' : 'Tambah Data'}>
                {modalMode === 'view' ? (
                    <OrganisasiDetailView data={selectedItem} config={RT_CONFIG} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Nama Lengkap" name="nama" value={formData.nama || ''} onChange={handleFormChange} required />
                            <InputField label="Jabatan" name="jabatan" type="select" value={formData.jabatan || ''} onChange={handleFormChange} required>
                                {JABATAN_RT_LIST.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </InputField>
                            
                            {/* --- FORM BAGIAN RT / RW / DUSUN / DUKUH (DROPDOWN CERDAS) --- */}
                            
                            {/* Input RW */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nomor RW (Induk)</label>
                                    <button 
                                        type="button" 
                                        onClick={() => toggleManualInput('rw')}
                                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                                        title={manualInputMode.rw ? "Kembali ke Pilihan" : "Input Manual Baru"}
                                    >
                                        {manualInputMode.rw ? <FiToggleRight size={16}/> : <FiToggleLeft size={16}/>}
                                        {manualInputMode.rw ? "Manual" : "Pilih"}
                                    </button>
                                </div>
                                {manualInputMode.rw ? (
                                    <input 
                                        type="text" 
                                        name="no_rw" 
                                        value={formData.no_rw || ''} 
                                        onChange={handleFormChange}
                                        placeholder="Ketik No. RW..."
                                        className="form-input-modern"
                                    />
                                ) : (
                                    <select 
                                        name="no_rw" 
                                        value={formData.no_rw || ''} 
                                        onChange={(e) => {
                                            handleFormChange(e);
                                            // Reset RT saat RW berubah agar konsisten
                                            setFormData(prev => ({...prev, no_rw: e.target.value, no_rt: '', dusun: '', dukuh: ''}));
                                        }}
                                        className="form-input-modern"
                                    >
                                        <option value="">-- Pilih RW --</option>
                                        {getRwOptions(formData.desa).map(rw => (
                                            <option key={rw} value={rw}>RW {rw}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Input RT */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nomor RT</label>
                                    <button 
                                        type="button" 
                                        onClick={() => toggleManualInput('rt')}
                                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                                        title={manualInputMode.rt ? "Kembali ke Pilihan" : "Input Manual Baru"}
                                    >
                                        {manualInputMode.rt ? <FiToggleRight size={16}/> : <FiToggleLeft size={16}/>}
                                        {manualInputMode.rt ? "Manual" : "Pilih"}
                                    </button>
                                </div>
                                {manualInputMode.rt ? (
                                    <input 
                                        type="text" 
                                        name="no_rt" 
                                        value={formData.no_rt || ''} 
                                        onChange={handleFormChange}
                                        placeholder="Ketik No. RT..."
                                        className="form-input-modern"
                                        required
                                    />
                                ) : (
                                    <select 
                                        name="no_rt" 
                                        value={formData.no_rt || ''} 
                                        onChange={handleFormChange}
                                        className="form-input-modern"
                                        required
                                        disabled={!formData.no_rw && !manualInputMode.rw}
                                    >
                                        <option value="">-- Pilih RT --</option>
                                        {getRtOptions(formData.desa, formData.no_rw).map(rt => (
                                            <option key={rt} value={rt}>RT {rt}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Input Dusun */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dusun</label>
                                    <button 
                                        type="button" 
                                        onClick={() => toggleManualInput('dusun')}
                                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                                    >
                                        {manualInputMode.dusun ? "Manual" : "Pilih"}
                                    </button>
                                </div>
                                {manualInputMode.dusun ? (
                                    <input type="text" name="dusun" value={formData.dusun || ''} onChange={handleFormChange} className="form-input-modern" />
                                ) : (
                                    <select 
                                        name="dusun" 
                                        value={formData.dusun || ''} 
                                        onChange={handleFormChange} 
                                        className="form-input-modern"
                                        disabled={!formData.no_rt && !manualInputMode.rt}
                                    >
                                        <option value="">-- Pilih Dusun --</option>
                                        {getDusunOptions(formData.desa, formData.no_rw, formData.no_rt).map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Input Dukuh */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dukuh</label>
                                    <button 
                                        type="button" 
                                        onClick={() => toggleManualInput('dukuh')}
                                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                                    >
                                        {manualInputMode.dukuh ? "Manual" : "Pilih"}
                                    </button>
                                </div>
                                {manualInputMode.dukuh ? (
                                    <input type="text" name="dukuh" value={formData.dukuh || ''} onChange={handleFormChange} className="form-input-modern" />
                                ) : (
                                    <select 
                                        name="dukuh" 
                                        value={formData.dukuh || ''} 
                                        onChange={handleFormChange} 
                                        className="form-input-modern"
                                        disabled={!formData.no_rt && !manualInputMode.rt}
                                    >
                                        <option value="">-- Pilih Dukuh --</option>
                                        {getDukuhOptions(formData.desa, formData.no_rw, formData.no_rt).map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            
                            <InputField label="JK" name="jenis_kelamin" type="select" value={formData.jenis_kelamin || ''} onChange={handleFormChange} required>
                                {JENIS_KELAMIN_LIST.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </InputField>
                            <InputField label="Pendidikan" name="pendidikan" type="select" value={formData.pendidikan || ''} onChange={handleFormChange}>
                                <option value="">- Pilih -</option>
                                {PENDIDIKAN_LIST.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </InputField>

                            <InputField label="Tempat Lahir" name="tempat_lahir" value={formData.tempat_lahir || ''} onChange={handleFormChange} />
                            <InputField label="Tanggal Lahir" name="tanggal_lahir" type="date" value={formData.tanggal_lahir || ''} onChange={handleFormChange} />
                            <InputField label="No. HP / WA" name="no_hp" value={formData.no_hp || ''} onChange={handleFormChange} />
                            <InputField label="Periode" name="periode" value={formData.periode || ''} onChange={handleFormChange} />
                        </div>
                        {currentUser.role === 'admin_kecamatan' && (
                             <InputField label="Desa" name="desa" type="select" value={formData.desa || ''} onChange={(e) => {
                                 handleFormChange(e);
                                 // Reset hierarki jika desa berubah
                                 setFormData(prev => ({...prev, desa: e.target.value, no_rw: '', no_rt: '', dusun: '', dukuh: ''}));
                             }} required>
                                <option value="">Pilih Desa</option>
                                {SAFE_DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                             </InputField>
                        )}
                        <div className="flex justify-end pt-4 border-t gap-2">
                            <Button type="button" variant="secondary" onClick={handleCloseModal}>Batal</Button>
                            <Button type="submit" variant="primary">Simpan</Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Modal Konfirmasi Hapus Single */}
            <ConfirmationModal 
                isOpen={isDeleteConfirmOpen} 
                onClose={() => setIsDeleteConfirmOpen(false)} 
                onConfirm={handleDelete} 
                isLoading={isSubmitting} 
                title="Hapus Data RT" 
                message={`Yakin ingin menghapus data pengurus RT "${itemToDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.`} 
                variant="danger"
            />

            {/* Modal Konfirmasi Hapus Massal */}
            <ConfirmationModal 
                isOpen={isDeleteSelectedConfirmOpen} 
                onClose={() => setIsDeleteSelectedConfirmOpen(false)} 
                onConfirm={handleDeleteSelected} 
                isLoading={isSubmitting} 
                title="Hapus Data Terpilih" 
                message={`Yakin ingin menghapus ${selectedIds.length} data terpilih? Tindakan ini tidak dapat dibatalkan.`} 
                variant="danger"
            />
        </div>
    );
};

export default RtPage;