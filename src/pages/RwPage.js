import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, writeBatch, getDocs } from 'firebase/firestore'; // Pastikan getDocs diimpor
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import OrganisasiDetailView from '../components/common/OrganisasiDetailView';
import { FiSearch, FiFilter, FiPlus, FiEdit, FiTrash2, FiEye, FiUpload, FiDownload } from 'react-icons/fi';
import { DESA_LIST, PENDIDIKAN_LIST, JENIS_KELAMIN_LIST, JABATAN_RW_LIST } from '../utils/constants';
import * as XLSX from 'xlsx';
import { generateRwXLSX } from '../utils/generateRwXLSX';
import { createNotificationForAdmins } from '../utils/notificationService';
import { useSearchParams } from 'react-router-dom';

// Konfigurasi RW yang telah disesuaikan
const RW_CONFIG = {
    collectionName: 'rt_rw',
    title: 'Data Pengurus RW',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'select', options: JABATAN_RW_LIST, required: true },
        { name: 'no_rw', label: 'Nomor RW', type: 'text', required: true },
        { name: 'dusun', label: 'Dusun', type: 'text' },
        { name: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: JENIS_KELAMIN_LIST },
        { name: 'tempat_lahir', label: 'Tempat Lahir', type: 'text' },
        { name: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
        { name: 'pendidikan', label: 'Pendidikan Terakhir', type: 'select', options: PENDIDIKAN_LIST },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
        // no_rt sengaja tidak dimasukkan karena ini form RW
    ],
    tableColumns: ['nama', 'jabatan', 'no_rw', 'dusun', 'jenis_kelamin', 'pendidikan', 'tanggal_lahir'], // Menampilkan tanggal lahir
    completenessCriteria: ['nama', 'jabatan', 'no_rw', 'desa', 'jenis_kelamin', 'pendidikan'],
};

/**
 * Parses various date formats from Excel into YYYY-MM-DD.
 * Handles Excel serial numbers, common string formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD),
 * and existing Date objects.
 * @param {*} excelDate - The value from the Excel cell.
 * @returns {string} Date in YYYY-MM-DD format or empty string if invalid.
 */
const parseExcelDate = (excelDate) => {
    // Implementasi parseExcelDate tetap sama seperti di RtPage.js
    if (!excelDate && excelDate !== 0) return "";

    let date;
    if (typeof excelDate === 'number') {
        const excelEpochDiff = 25569.0;
        const millisecondsPerDay = 86400 * 1000;
        const jsTimestamp = Math.round((excelDate - excelEpochDiff) * millisecondsPerDay);
        date = new Date(jsTimestamp);
    }
    else if (typeof excelDate === 'string') {
        const trimmedDate = excelDate.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
             // Handle YYYY-MM-DD slightly differently to ensure local date interpretation
            const parts = trimmedDate.split('-');
            date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
        // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
        else if (/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.test(trimmedDate)) {
            const parts = trimmedDate.split(/[./-]/);
            date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
        // MM/DD/YYYY or MM.DD.YYYY or MM-DD-YYYY
         else if (/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.test(trimmedDate)) { // Fallback, less common format
            const parts = trimmedDate.split(/[./-]/);
            date = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        }
        else {
             date = new Date(trimmedDate); // Last resort direct parse
             if (isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) {
                 date = undefined;
             }
         }
    }
    else if (excelDate instanceof Date) {
        date = excelDate;
    }

    if (!date || isNaN(date.getTime())) {
         console.warn(`Could not parse date value: ${excelDate}`);
         return "";
    }

    // Adjust for timezone only if the source was a number (Excel serial)
    // to prevent double adjustment or incorrect shifts for string dates.
    let finalDate = date;
    if (typeof excelDate === 'number') {
        // Use UTC methods to extract components and reconstruct locally
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth(); // 0-indexed
        const day = date.getUTCDate();
        // Create a new Date object using local time constructor
        finalDate = new Date(year, month, day);
    }

    // Format to YYYY-MM-DD
    const year = finalDate.getFullYear();
    const month = (finalDate.getMonth() + 1).toString().padStart(2, '0');
    const day = finalDate.getDate().toString().padStart(2, '0');

    if (year < 1900 || year > 2100) { // Basic sanity check
         console.warn(`Parsed date year ${year} seems incorrect for value: ${excelDate}`);
         return "";
    }

    return `${year}-${month}-${day}`;
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
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState('all');
    const [searchParams, setSearchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);
    const [hasOpenedModalFromQuery, setHasOpenedModalFromQuery] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);

    const config = RW_CONFIG;

    useEffect(() => {
        const editId = searchParams.get('edit');
        if (editId && dataList.length > 0 && !hasOpenedModalFromQuery) {
            const itemToEdit = dataList.find(item => item.id === editId);
            if (itemToEdit) {
                setHighlightedRow(editId);
                handleOpenModal('edit', itemToEdit);
                setHasOpenedModalFromQuery(true);
                const newSearchParams = new URLSearchParams(searchParams);
                newSearchParams.delete('edit');
                setSearchParams(newSearchParams, { replace: true });
                const timer = setTimeout(() => setHighlightedRow(null), 3000);
                return () => clearTimeout(timer);
            }
        }
    }, [searchParams, dataList, hasOpenedModalFromQuery, setSearchParams]);

    useEffect(() => {
        if (currentUser) {
            setFilterDesa(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return setLoading(false);
        setLoading(true);
        // Query untuk data RW (memastikan no_rw ada nilainya dan bukan string kosong)
        const q = query(collection(db, config.collectionName), where("no_rw", ">", ""));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDataList(list);
            setLoading(false);
        }, (error) => {
            showNotification(`Gagal memuat data RW: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, showNotification, config.collectionName]);

    const filteredData = useMemo(() => {
        let data = dataList;
        // Filter desa
        if (currentUser.role === 'admin_kecamatan' && filterDesa !== 'all') {
            data = data.filter(item => item.desa === filterDesa);
        } else if (currentUser.role === 'admin_desa') {
            data = data.filter(item => item.desa === currentUser.desa);
        }
        // Filter search
        if (searchTerm) {
            data = data.filter(item =>
                (item.nama || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.no_rw || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.jabatan || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return data;
    }, [dataList, searchTerm, filterDesa, currentUser]);

    const handleOpenModal = (mode, item = null) => {
        setModalMode(mode);
        setSelectedItem(item);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : '';
        // Set default jabatan 'Ketua' for add mode
        const initialJabatan = item ? item.jabatan : 'Ketua';
        setFormData(item ? { ...item } : { desa: initialDesa, jabatan: initialJabatan });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => !isSubmitting && setIsModalOpen(false);

    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        // Validasi
        if (!formData.desa) return showNotification("Desa wajib diisi!", 'error');
        if (!formData.nama) return showNotification("Nama wajib diisi!", 'error');
        if (!formData.jabatan) return showNotification("Jabatan wajib diisi!", 'error');
        if (!formData.no_rw) return showNotification("Nomor RW wajib diisi!", 'error');

        setIsSubmitting(true);
        try {
            // Data RW harus memiliki no_rt = ""
            const dataToSave = { ...formData, no_rt: "" };
            let docId = selectedItem?.id;

            if (selectedItem) {
                // Update
                await updateDoc(doc(db, config.collectionName, docId), dataToSave);
                showNotification('Data RW berhasil diperbarui!', 'success');
            } else {
                 // Cek duplikasi nama sebelum menambah data baru
                 const checkQuery = query(collection(db, config.collectionName),
                    where("nama", "==", dataToSave.nama),
                    where("desa", "==", dataToSave.desa), // Cek duplikasi hanya di desa yang sama
                    where("no_rw", ">", "") // Hanya cek di data RW
                 );
                 const querySnapshot = await getDocs(checkQuery);
                 if (!querySnapshot.empty) {
                     showNotification(`Data RW dengan nama "${dataToSave.nama}" sudah ada di desa ${dataToSave.desa}.`, 'error');
                     setIsSubmitting(false);
                     return;
                 }
                // Add
                const newDocRef = await addDoc(collection(db, config.collectionName), dataToSave);
                docId = newDocRef.id;
                showNotification('Data RW berhasil ditambahkan!', 'success');
            }
            // Notifikasi
            if (currentUser.role === 'admin_desa' && docId) {
                const action = selectedItem ? 'memperbarui' : 'menambahkan';
                const message = `Admin Desa ${currentUser.desa} telah ${action} data Pengurus RW: "${formData.nama}".`;
                await createNotificationForAdmins(message, `/app/rt-rw/rw?edit=${docId}`, currentUser);
            }
            handleCloseModal();
        } catch (error) {
             console.error("Error saving RW data:", error);
            showNotification(`Gagal menyimpan data RW: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openDeleteConfirm = (item) => {
        setItemToDelete(item);
        setIsDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, config.collectionName, itemToDelete.id));
            showNotification('Data RW berhasil dihapus.', 'success');
        } catch(error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

   const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                // Gunakan cellDates: true dan raw: false
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false, cellDates: true });

                if (jsonData.length === 0) throw new Error("File Excel kosong atau format tidak sesuai.");

                // Ambil data Firestore yang relevan (RW)
                const existingDocsQuery = query(collection(db, config.collectionName), where("no_rw", ">", ""));
                const existingDocsSnapshot = await getDocs(existingDocsQuery);
                const existingDataMap = new Map();
                existingDocsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const key = `${(data.nama || '').trim().toLowerCase()}_${(data.desa || '').trim().toLowerCase()}`;
                    existingDataMap.set(key, { id: doc.id, ...data });
                });

                const batch = writeBatch(db);
                let addedCount = 0;
                let updatedCount = 0;
                let skippedDesaCount = 0;
                let skippedDuplicateInFileCount = 0;
                let skippedInvalidDataCount = 0;
                const processedKeysInFile = new Set();

                jsonData.forEach((row, index) => {
                    // Ekstrak data sesuai format RW.xlsx
                    const desaExcel = String(row['DESA'] || '').trim();
                    const namaExcel = String(row['N A M A'] || '').trim();
                    const noRwExcel = String(row['NO RW'] || '').trim(); // Kolom kunci untuk RW

                    // --- Validasi Data Penting ---
                    if (!namaExcel || !desaExcel || !noRwExcel) {
                        console.warn(`Baris ${index + 2} dilewati: Nama, Desa, atau No RW kosong.`);
                        skippedInvalidDataCount++;
                        return;
                    }

                    // --- Filter Desa untuk Admin Desa ---
                    if (currentUser.role === 'admin_desa' && desaExcel.toLowerCase() !== currentUser.desa.toLowerCase()) {
                        skippedDesaCount++;
                        return;
                    }

                    // --- Cek Duplikasi dalam File Excel ---
                    const keyInFile = `${namaExcel.toLowerCase()}_${desaExcel.toLowerCase()}`;
                    if (processedKeysInFile.has(keyInFile)) {
                        skippedDuplicateInFileCount++;
                        return;
                    }
                    processedKeysInFile.add(keyInFile);

                    // --- Persiapan Data RW ---
                    let jenisKelamin = '';
                    if (String(row['L'] || '').trim().toUpperCase() === 'L') jenisKelamin = 'Laki-Laki';
                    else if (String(row['P'] || '').trim().toUpperCase() === 'P') jenisKelamin = 'Perempuan';

                    let pendidikan = '';
                    for (const level of PENDIDIKAN_LIST) {
                         if (row[level] && String(row[level]).trim() === '1') {
                            pendidikan = level;
                            break;
                        }
                    }

                    const formattedDate = parseExcelDate(row['TANGGAL LAHIR']); // Gunakan parseExcelDate

                    const rwData = {
                        desa: desaExcel,
                        nama: namaExcel,
                        jenis_kelamin: jenisKelamin,
                        jabatan: String(row['JABATAN'] || 'Ketua').trim(), // Default 'Ketua' jika kosong
                        tempat_lahir: String(row['TEMPAT LAHIR'] || '').trim(),
                        tanggal_lahir: formattedDate, // Hasil YYYY-MM-DD
                        pendidikan: pendidikan,
                        periode: String(row['PRIODE'] || '').trim(),
                        no_rw: noRwExcel, // Nomor RW
                        dusun: String(row['DUSUN'] || '').trim(),
                        no_hp: String(row['No. HP / WA'] || '').trim(),
                        no_rt: "", // Pastikan no_rt KOSONG untuk data RW
                        // 'dukuh' tidak ada di format RW.xlsx
                    };

                    // --- Logika Update atau Tambah ---
                    const existingDoc = existingDataMap.get(keyInFile);

                    if (existingDoc) {
                        // Update jika data yang ada adalah data RW (no_rw ada, no_rt kosong)
                        if (existingDoc.no_rw && !existingDoc.no_rt) {
                            batch.update(doc(db, config.collectionName, existingDoc.id), rwData);
                            updatedCount++;
                        } else {
                            console.warn(`Data RW untuk ${namaExcel} di desa ${desaExcel} dilewati karena data yang ada bukan RW.`);
                            skippedInvalidDataCount++; // Atau kategori lain jika perlu
                        }
                    } else {
                        // Tambah data RW baru
                        batch.set(doc(collection(db, config.collectionName)), rwData);
                        addedCount++;
                    }
                });

                // --- Commit Batch dan Notifikasi ---
                if (addedCount > 0 || updatedCount > 0) {
                    await batch.commit();
                    let msg = `Impor RW selesai: ${addedCount} data baru ditambahkan, ${updatedCount} data diperbarui.`;
                    const skippedMessages = [];
                    if (skippedDesaCount > 0) skippedMessages.push(`${skippedDesaCount} baris desa lain`);
                    if (skippedDuplicateInFileCount > 0) skippedMessages.push(`${skippedDuplicateInFileCount} duplikat dalam file`);
                    if (skippedInvalidDataCount > 0) skippedMessages.push(`${skippedInvalidDataCount} data tidak valid`);

                    if (skippedMessages.length > 0) {
                        msg += ` (${skippedMessages.join(', ')} dilewati).`;
                    }
                    showNotification(msg, 'success');
                } else {
                    let msg = "Tidak ada data RW yang ditambahkan atau diperbarui.";
                     const skippedMessages = [];
                     if (skippedDesaCount > 0) skippedMessages.push(`${skippedDesaCount} baris desa lain`);
                     if (skippedDuplicateInFileCount > 0) skippedMessages.push(`${skippedDuplicateInFileCount} duplikat dalam file`);
                     if (skippedInvalidDataCount > 0) skippedMessages.push(`${skippedInvalidDataCount} data tidak valid`);

                    if (skippedMessages.length > 0) {
                        msg += ` Alasan: ${skippedMessages.join(', ')} dilewati.`;
                     } else {
                        msg += " Pastikan file tidak kosong dan formatnya benar.";
                     }
                    showNotification(msg, 'warning');
                }

            } catch (error) {
                console.error("Error importing RW data:", error);
                showNotification(`Gagal melakukan impor data RW: ${error.message}`, 'error');
            } finally {
                setLoading(false);
            }
        };
         reader.onerror = (error) => {
             console.error("Error reading file:", error);
             showNotification(`Gagal membaca file: ${error.message || error}`, 'error');
             setLoading(false);
        }
        reader.readAsArrayBuffer(file);
        e.target.value = null; // Reset input file
    };


    const handleExportXLSX = async () => {
        if (filteredData.length === 0) {
            showNotification("Tidak ada data RW untuk diekspor.", "warning");
            return;
        }
        setLoading(true);
        try {
            // Gunakan generateRwXLSX
            await generateRwXLSX(filteredData, db); // Pastikan ini sesuai dengan implementasi generateRwXLSX
             showNotification("Data RW berhasil diekspor ke XLSX.", "success");
        } catch (error) {
            console.error("Error exporting RW data:", error);
            showNotification(`Gagal mengekspor data RW: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- Fungsi Bulk Delete (Sama seperti di RtPage) ---
     const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(filteredData.map(item => item.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const openDeleteSelectedConfirm = () => {
        if (selectedIds.length === 0) {
             showNotification("Pilih data yang ingin dihapus terlebih dahulu.", "warning");
             return;
        }
        setIsDeleteSelectedConfirmOpen(true);
    };

    const handleDeleteSelected = async () => {
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, config.collectionName, id));
            });
            await batch.commit();
            showNotification(`${selectedIds.length} data RW berhasil dihapus.`, 'success');
            setSelectedIds([]);
        } catch (error) {
            console.error("Error deleting selected RW data:", error);
            showNotification(`Gagal menghapus data RW terpilih: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteSelectedConfirmOpen(false);
        }
    };
    // --- Akhir Fungsi Bulk Delete ---

    // --- JSX Return (Struktur sama, hanya label/judul yang disesuaikan) ---
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                 {/* Search & Filter */}
                <div className="flex items-center gap-4 flex-wrap">
                    <InputField
                        type="text"
                        placeholder="Cari (Nama, No RW...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={<FiSearch />}
                    />
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField
                            type="select"
                            value={filterDesa}
                            onChange={(e) => setFilterDesa(e.target.value)}
                            icon={<FiFilter />}
                        >
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                </div>
                 {/* Action Buttons */}
                 <div className="flex flex-wrap gap-2">
                    {selectedIds.length > 0 && (
                         <Button onClick={openDeleteSelectedConfirm} variant="danger" disabled={isSubmitting}>
                             <FiTrash2 className="mr-1 inline-block"/> Hapus ({selectedIds.length})
                         </Button>
                    )}
                    <label className={`btn btn-warning cursor-pointer ${loading || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                         <FiUpload className="mr-1 inline-block"/> Impor Data
                         <input
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                            accept=".xlsx, .xls"
                            disabled={loading || isSubmitting}
                         />
                    </label>
                    <Button onClick={handleExportXLSX} variant="success" disabled={loading || isSubmitting || filteredData.length === 0}>
                        <FiDownload className="mr-1 inline-block"/> Ekspor Data
                    </Button>
                    <Button onClick={() => handleOpenModal('add')} variant="primary" disabled={loading || isSubmitting}>
                        <FiPlus className="mr-1 inline-block"/> Tambah Data
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                            <tr>
                                <th scope="col" className="p-4">
                                    <div className="flex items-center">
                                        <input
                                            id="checkbox-all-rw" // ID unik
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                                        <label htmlFor="checkbox-all-rw" className="sr-only">checkbox</label>
                                    </div>
                                </th>
                                {config.tableColumns.map(col => (
                                    <th key={col} className="px-6 py-3 whitespace-nowrap">
                                        {config.formFields.find(f => f.name === col)?.label || col}
                                    </th>
                                ))}
                                <th className="px-6 py-3">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={config.tableColumns.length + 2} className="text-center py-10"><Spinner /> Loading data RW...</td></tr>
                            ) : filteredData.length > 0 ? filteredData.map(item => (
                                <tr key={item.id} className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${highlightedRow === item.id ? 'highlight-row' : ''}`}>
                                     <td className="w-4 p-4">
                                        <div className="flex items-center">
                                            <input
                                                id={`checkbox-rw-${item.id}`} // ID unik
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => handleSelectOne(item.id)}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                                            <label htmlFor={`checkbox-rw-${item.id}`} className="sr-only">checkbox</label>
                                        </div>
                                    </td>
                                    {config.tableColumns.map(col => (
                                         <td key={col} className="px-6 py-4 whitespace-nowrap">
                                            {/* Format tanggal lahir */}
                                            {col === 'tanggal_lahir' && item[col] ? new Date(item[col] + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : item[col] || '-'}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4 flex items-center space-x-2">
                                        <button onClick={() => handleOpenModal('view', item)} className="text-green-500 hover:text-green-700 p-1" title="Lihat"><FiEye size={16}/></button>
                                        <button onClick={() => handleOpenModal('edit', item)} className="text-blue-500 hover:text-blue-700 p-1" title="Edit"><FiEdit size={16}/></button>
                                        <button onClick={() => openDeleteConfirm(item)} className="text-red-500 hover:text-red-700 p-1" title="Hapus"><FiTrash2 size={16}/></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={config.tableColumns.length + 2} className="text-center py-10 text-gray-500">Data RW tidak ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>

            {/* Modal */}
             <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? `Detail ${config.title}` : modalMode === 'edit' ? `Edit ${config.title}` : `Tambah ${config.title}`}>
                {modalMode === 'view' ? (
                     <OrganisasiDetailView data={selectedItem} config={config} />
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        {config.formFields.map(field => {
                             // Jabatan RW di-disable dan default 'Ketua' saat add/edit?
                             // Jika ya, tambahkan `disabled: true` atau kondisi lain
                             // const isDisabled = field.name === 'jabatan';
                            if (field.type === 'select') {
                                return (
                                    <InputField
                                        key={field.name}
                                        label={field.label}
                                        name={field.name}
                                        type="select"
                                        value={formData[field.name] || ''}
                                        onChange={handleFormChange}
                                        required={field.required}
                                        // disabled={isDisabled}
                                    >
                                        <option value="">Pilih {field.label}</option>
                                        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </InputField>
                                );
                            }
                            return (
                                <InputField
                                    key={field.name}
                                    {...field}
                                    value={formData[field.name] || ''}
                                    onChange={handleFormChange}
                                />
                            );
                        })}
                        {currentUser.role === 'admin_kecamatan' && (
                             <InputField label="Desa" name="desa" type="select" value={formData.desa || ''} onChange={handleFormChange} required>
                                <option value="">Pilih Desa</option>
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                             </InputField>
                        )}
                         <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                            <Button type="submit" variant="primary" isLoading={isSubmitting} className="ml-2">
                                 {modalMode === 'edit' ? 'Perbarui' : 'Simpan'}
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Confirmation Modals */}
            <ConfirmationModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDelete} isLoading={isSubmitting} title={`Hapus Data ${config.title}`} message={`Yakin ingin menghapus data "${itemToDelete?.nama}"?`} />
            <ConfirmationModal isOpen={isDeleteSelectedConfirmOpen} onClose={() => setIsDeleteSelectedConfirmOpen(false)} onConfirm={handleDeleteSelected} isLoading={isSubmitting} title="Hapus Data RW Terpilih" message={`Yakin ingin menghapus ${selectedIds.length} data RW yang dipilih?`} />
        </div>
    );
};

export default RwPage;

