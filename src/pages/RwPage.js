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
import { FiSearch, FiPlus, FiEdit, FiTrash2, FiEye, FiUpload, FiDownload, FiCheckSquare, FiX, FiAlertCircle, FiMove, FiMoreHorizontal } from 'react-icons/fi';
import { DESA_LIST, PENDIDIKAN_LIST, JENIS_KELAMIN_LIST } from '../utils/constants';
import * as XLSX from 'xlsx';
import { generateRwXLSX } from '../utils/generateRwXLSX';
import { createNotificationForAdmins } from '../utils/notificationService';
import { useSearchParams } from 'react-router-dom';

const SAFE_DESA_LIST = Array.isArray(DESA_LIST) ? DESA_LIST : [];
const JABATAN_RW_LIST = ["Ketua"];

const RW_CONFIG = {
    collectionName: 'rt_rw',
    title: 'Data Pengurus RW',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'select', options: JABATAN_RW_LIST, required: true },
        { name: 'no_rw', label: 'Nomor RW', type: 'text', required: true },
        { name: 'dusun', label: 'Dusun', type: 'text' },
        { name: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: JENIS_KELAMIN_LIST, required: true },
        { name: 'tempat_lahir', label: 'Tempat Lahir', type: 'text' },
        { name: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
        { name: 'pendidikan', label: 'Pendidikan Terakhir', type: 'select', options: PENDIDIKAN_LIST },
        { name: 'periode', label: 'Periode Jabatan', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ],
    tableColumns: ['nama', 'jabatan', 'no_rw', 'desa', 'dusun'],
    completenessCriteria: ['nama', 'jabatan', 'no_rw', 'desa', 'jenis_kelamin'],
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

const RwPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [dataList, setDataList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
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

    // --- STATE & REFS UNTUK SELEKSI & GESER POPUP (Sama dengan RtPage) ---
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

    // Set Initial Menu Position (Bottom Center)
    useEffect(() => {
        if (isSelectionMode) {
            // Offset X dikurangi agar pas di tengah (asumsi lebar popup ~220px)
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
        const q = query(collection(db, RW_CONFIG.collectionName)); 
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(item => item.no_rw && !item.no_rt); 
            setDataList(list);
            setLoading(false);
        }, (error) => {
            showNotification(`Gagal memuat data: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, showNotification]);

    // --- LOGIKA AUTO-OPEN DARI DASHBOARD ---
    useEffect(() => {
        const editId = searchParams.get('edit');
        if (editId && dataList.length > 0 && !hasOpenedModalFromQuery) {
            const itemToEdit = dataList.find(item => item.id === editId);
            if (itemToEdit) {
                if (currentUser.role === 'admin_kecamatan' && itemToEdit.desa) {
                    setFilterDesa(itemToEdit.desa);
                }
                handleOpenModal('edit', itemToEdit);
                setHasOpenedModalFromQuery(true);
                setHighlightedRow(editId);
                
                setTimeout(() => {
                    const rowElement = document.getElementById(`row-${editId}`);
                    if (rowElement) {
                        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 500);

                const newSearchParams = new URLSearchParams(searchParams);
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
                (item.no_rw || '').toLowerCase().includes(lowerSearch)
            );
        }
        return data.sort((a, b) => (parseInt(a.no_rw) || 0) - (parseInt(b.no_rw) || 0));
    }, [dataList, searchTerm, filterDesa]);

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
        if (selectedIds.length === filteredData.length) setSelectedIds([]);
        else setSelectedIds(filteredData.map(item => item.id));
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
                batch.delete(doc(db, RW_CONFIG.collectionName, id));
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
        setFormData(item ? { ...item } : { desa: initialDesa, jenis_kelamin: 'Laki-Laki', jabatan: 'Ketua' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => !isSubmitting && setIsModalOpen(false);
    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.desa) return showNotification("Desa wajib diisi!", 'error');
        setIsSubmitting(true);
        try {
            const dataToSave = { ...formData, no_rt: "" }; // RW tidak punya RT
            ['dusun', 'no_hp', 'tempat_lahir'].forEach(f => { if (!dataToSave[f]) dataToSave[f] = ''; });

            if (selectedItem) {
                await updateDoc(doc(db, RW_CONFIG.collectionName, selectedItem.id), dataToSave);
                showNotification('Data RW diperbarui!', 'success');
            } else {
                await addDoc(collection(db, RW_CONFIG.collectionName), dataToSave);
                showNotification('Data RW ditambahkan!', 'success');
            }
            if (currentUser.role === 'admin_desa') {
                const action = selectedItem ? 'memperbarui' : 'menambahkan';
                await createNotificationForAdmins(`Admin Desa ${currentUser.desa} ${action} data RW: "${formData.nama}".`, '/app/rt-rw/rw', currentUser);
            }
            handleCloseModal();
        } catch (error) { showNotification(error.message, 'error'); } 
        finally { setIsSubmitting(false); }
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
                        dusun: String(row['R'] || ''),
                        no_hp: String(row['S'] || ''),
                        no_rt: ""
                    };

                    if (newData.nama && newData.no_rw) {
                        const key = `${newData.nama.toLowerCase()}_${newData.desa.toLowerCase()}`;
                        if (existingMap.has(key)) {
                            batch.update(doc(db, RW_CONFIG.collectionName, existingMap.get(key)), newData);
                            updatedCount++;
                        } else {
                            batch.set(doc(collection(db, RW_CONFIG.collectionName)), newData);
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
        try { await generateRwXLSX(filteredData, db, exportConfig, currentUser); } 
        catch (error) { showNotification(error.message, 'error'); }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, RW_CONFIG.collectionName, itemToDelete.id));
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
                        placeholder="Cari Nama / RW..." 
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
                                <th className="px-6 py-3">Wilayah (RW / Dusun)</th>
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
                                            item.jabatan === 'Ketua' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                        }`}>{item.jabatan}</span>
                                    </td>
                                    <td className="px-6 py-4">{item.desa}</td>
                                    <td className="px-6 py-4">RW {item.no_rw} <br/><span className="text-xs text-gray-400">{item.dusun}</span></td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal('view', item); }} className="p-2 text-green-600 hover:bg-green-100 rounded-full"><FiEye size={18}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal('edit', item); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><FiEdit size={18}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="6" className="text-center py-10 text-gray-400">Data RW kosong.</td></tr>
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
                        touchAction: 'none' // Mencegah scroll halaman saat drag
                    }}
                    // Desain: Lonjong (rounded-full), compact, shadow besar
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
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Detail RW' : modalMode === 'edit' ? 'Edit Data RW' : 'Tambah Data RW'}>
                {modalMode === 'view' ? (
                    <OrganisasiDetailView data={selectedItem} config={RW_CONFIG} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Nama Lengkap" name="nama" value={formData.nama || ''} onChange={handleFormChange} required />
                            <InputField label="Jabatan" name="jabatan" type="select" value={formData.jabatan || ''} onChange={handleFormChange} required>
                                {JABATAN_RW_LIST.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </InputField>
                            <InputField label="Nomor RW" name="no_rw" value={formData.no_rw || ''} onChange={handleFormChange} required placeholder="Contoh: 01" />
                            <InputField label="Dusun" name="dusun" value={formData.dusun || ''} onChange={handleFormChange} />
                            
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
                             <InputField label="Desa" name="desa" type="select" value={formData.desa || ''} onChange={handleFormChange} required>
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
                title="Hapus Data RW" 
                message={`Yakin ingin menghapus data pengurus RW "${itemToDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.`} 
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

export default RwPage;