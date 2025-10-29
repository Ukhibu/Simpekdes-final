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
import { DESA_LIST, PENDIDIKAN_LIST, JENIS_KELAMIN_LIST, JABATAN_RT_LIST } from '../utils/constants';
import * as XLSX from 'xlsx';
import { generateRtXLSX } from '../utils/generateRtXLSX';
import { createNotificationForAdmins } from '../utils/notificationService';
import { useSearchParams } from 'react-router-dom';

const RT_CONFIG = {
    collectionName: 'rt_rw',
    title: 'Data Pengurus RT',
    formFields: [
        { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'select', options: JABATAN_RT_LIST, required: true },
        { name: 'no_rt', label: 'Nomor RT', type: 'text', required: true },
        { name: 'no_rw', label: 'Nomor RW Induk', type: 'text' }, // Direvisi dari kode asli untuk mencocokkan format
        { name: 'dusun', label: 'Dusun', type: 'text' },
        { name: 'dukuh', label: 'Dukuh', type: 'text' }, // Ditambahkan field Dukuh
        { name: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: JENIS_KELAMIN_LIST },
        { name: 'tempat_lahir', label: 'Tempat Lahir', type: 'text' },
        { name: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
        { name: 'pendidikan', label: 'Pendidikan Terakhir', type: 'select', options: PENDIDIKAN_LIST },
        { name: 'periode', label: 'Periode', type: 'text' },
        { name: 'no_hp', label: 'No. HP / WA', type: 'tel' },
    ],
    // Sesuaikan tableColumns jika perlu menampilkan Dukuh atau No RW Induk
    tableColumns: ['nama', 'jabatan', 'no_rt', 'no_rw', 'dusun', 'jenis_kelamin', 'pendidikan', 'tanggal_lahir'], // Menambahkan tanggal_lahir ke tabel
    completenessCriteria: ['nama', 'jabatan', 'no_rt', 'desa', 'jenis_kelamin', 'pendidikan'],
};

/**
 * Parses various date formats from Excel into YYYY-MM-DD.
 * Handles Excel serial numbers, common string formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD),
 * and existing Date objects.
 * @param {*} excelDate - The value from the Excel cell.
 * @returns {string} Date in YYYY-MM-DD format or empty string if invalid.
 */
const parseExcelDate = (excelDate) => {
    if (!excelDate && excelDate !== 0) return ""; // Handle empty cells, but allow 0 (though unlikely for dates)

    let date;

    // 1. Handle Excel Serial Numbers (Numbers)
    if (typeof excelDate === 'number') {
        // Excel stores dates as serial numbers. 1 = 1900-01-01.
        // JS uses milliseconds since 1970-01-01 UTC.
        // 25569 is the diff between 1970-01-01 and 1900-01-01 (adjusting for Excel leap year bug).
        // Ensure integer dates are handled correctly, time part might cause issues if not floored.
        const excelEpochDiff = 25569.0;
        const millisecondsPerDay = 86400 * 1000;
        // Use Math.round to handle potential floating point inaccuracies from Excel time values
        const jsTimestamp = Math.round((excelDate - excelEpochDiff) * millisecondsPerDay);
        date = new Date(jsTimestamp);
    }
    // 2. Handle String Dates
    else if (typeof excelDate === 'string') {
        const trimmedDate = excelDate.trim();
        // Try common formats
        // a) YYYY-MM-DD (ISO format) - Most reliable if present
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
            date = new Date(trimmedDate + 'T00:00:00'); // Add time part to avoid timezone issues during parsing
        }
        // b) DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
        else if (/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.test(trimmedDate)) {
            const parts = trimmedDate.split(/[./-]/);
            // Assume Day, Month, Year ordering
            date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
        // c) MM/DD/YYYY or MM.DD.YYYY or MM-DD-YYYY (Less common in Indonesia, but good fallback)
         else if (/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.test(trimmedDate)) {
            const parts = trimmedDate.split(/[./-]/);
            // Assume Month, Day, Year ordering
            date = new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        }
         // d) Try direct parsing as last resort for strings (might work for some ISO-like formats)
        else {
             date = new Date(trimmedDate);
             // Clear date if direct parsing results in invalid date or year looks wrong (e.g., parsing just "11" might yield year 1911)
             if (isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) {
                 date = undefined; // Mark as invalid
             }
         }
    }
    // 3. Handle if it's already a Date object (less likely from XLSX but possible)
    else if (excelDate instanceof Date) {
        date = excelDate;
    }

    // --- Validation and Formatting ---
    // Check if date is valid after parsing attempts
    if (!date || isNaN(date.getTime())) {
         console.warn(`Could not parse date value: ${excelDate}`);
         return ""; // Return empty string for invalid dates
    }

    // Adjust for timezone offset ONLY IF the original input was a serial number.
    // String dates parsed with specific DD/MM/YYYY or already in YYYY-MM-DD should ideally be treated as local dates directly.
    // The Date constructor for YYYY-MM-DD or new Date(year, monthIndex, day) usually handles local time correctly.
    // The main issue is with serial numbers originating from Excel's epoch.
    let finalDate = date;
    if (typeof excelDate === 'number') {
        // Recalculate based on UTC components to avoid timezone shifts from serial number conversion
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        const day = date.getUTCDate();
        finalDate = new Date(year, month, day); // Create new date using local constructor from UTC parts
    }


    // Format to YYYY-MM-DD
    const year = finalDate.getFullYear();
    const month = (finalDate.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = finalDate.getDate().toString().padStart(2, '0');

    // Final sanity check for year range
    if (year < 1900 || year > 2100) {
         console.warn(`Parsed date year ${year} seems incorrect for value: ${excelDate}`);
         return "";
    }


    return `${year}-${month}-${day}`;
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
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState('all');
    const [searchParams, setSearchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);
    const [hasOpenedModalFromQuery, setHasOpenedModalFromQuery] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isDeleteSelectedConfirmOpen, setIsDeleteSelectedConfirmOpen] = useState(false);

    const config = RT_CONFIG;

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
        // Query untuk data RT (memastikan no_rt ada nilainya dan bukan string kosong)
        const q = query(collection(db, config.collectionName), where("no_rt", ">", ""));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDataList(list);
            setLoading(false);
        }, (error) => {
            showNotification(`Gagal memuat data RT: ${error.message}`, 'error');
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, showNotification, config.collectionName]);

    const filteredData = useMemo(() => {
        let data = dataList;
        // Filter berdasarkan desa jika bukan admin kecamatan atau filter desa dipilih
        if (currentUser.role === 'admin_kecamatan' && filterDesa !== 'all') {
            data = data.filter(item => item.desa === filterDesa);
        } else if (currentUser.role === 'admin_desa') {
            data = data.filter(item => item.desa === currentUser.desa);
        }
        // Filter berdasarkan pencarian nama
        if (searchTerm) {
            data = data.filter(item =>
                (item.nama || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.no_rt || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        // Set default jabatan jika menambah baru, selain itu gunakan data item
        const initialJabatan = item ? item.jabatan : (JABATAN_RT_LIST.length > 0 ? JABATAN_RT_LIST[0] : '');
        setFormData(item ? { ...item } : { desa: initialDesa, jabatan: initialJabatan });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => !isSubmitting && setIsModalOpen(false);

    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        // Validasi dasar
        if (!formData.desa) return showNotification("Desa wajib diisi!", 'error');
        if (!formData.nama) return showNotification("Nama wajib diisi!", 'error');
        if (!formData.jabatan) return showNotification("Jabatan wajib diisi!", 'error');
        if (!formData.no_rt) return showNotification("Nomor RT wajib diisi!", 'error');

        setIsSubmitting(true);
        try {
            // Pastikan no_rw selalu ada (string kosong jika tidak diisi) dan no_rt tidak kosong
            const dataToSave = {
                 ...formData,
                 no_rw: formData.no_rw || "", // Pastikan no_rw ada, minimal string kosong
                 no_rt: formData.no_rt // no_rt sudah divalidasi tidak kosong
            };

            let docId = selectedItem?.id;
            if (selectedItem) {
                await updateDoc(doc(db, config.collectionName, docId), dataToSave);
                showNotification('Data RT berhasil diperbarui!', 'success');
            } else {
                // Cek duplikasi nama sebelum menambah data baru
                 const checkQuery = query(collection(db, config.collectionName),
                    where("nama", "==", dataToSave.nama),
                    where("desa", "==", dataToSave.desa), // Cek duplikasi hanya di desa yang sama
                    where("no_rt", ">", "") // Hanya cek di data RT
                 );
                 const querySnapshot = await getDocs(checkQuery);
                 if (!querySnapshot.empty) {
                     showNotification(`Data RT dengan nama "${dataToSave.nama}" sudah ada di desa ${dataToSave.desa}.`, 'error');
                     setIsSubmitting(false);
                     return;
                 }

                const newDocRef = await addDoc(collection(db, config.collectionName), dataToSave);
                docId = newDocRef.id;
                showNotification('Data RT berhasil ditambahkan!', 'success');
            }
            // Kirim notifikasi jika admin desa yang melakukan aksi
            if (currentUser.role === 'admin_desa' && docId) {
                const action = selectedItem ? 'memperbarui' : 'menambahkan';
                const message = `Admin Desa ${currentUser.desa} telah ${action} data Pengurus RT: "${formData.nama}".`;
                // Perhatikan path URL notifikasi jika struktur aplikasi Anda berbeda
                await createNotificationForAdmins(message, `/app/rt-rw/rt?edit=${docId}`, currentUser);
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving RT data:", error);
            showNotification(`Gagal menyimpan data RT: ${error.message}`, 'error');
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
            showNotification('Data RT berhasil dihapus.', 'success');
        } catch(error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null); // Reset itemToDelete
        }
    };

   const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setLoading(true); // Tampilkan loading saat proses
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                // Ambil semua data sebagai teks mentah untuk penanganan yang lebih baik
                // Gunakan { cellDates: true } untuk mencoba parsing tanggal oleh library,
                // tapi kita tetap akan memvalidasi/memformat ulang dengan parseExcelDate
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false, cellDates: true });

                if (jsonData.length === 0) throw new Error("File Excel kosong atau format tidak sesuai.");

                // Ambil semua data RT/RW dari Firestore untuk pengecekan duplikasi dan update
                const existingDocsQuery = query(collection(db, config.collectionName));
                const existingDocsSnapshot = await getDocs(existingDocsQuery);
                const existingDataMap = new Map();
                existingDocsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    // Gunakan kombinasi nama dan desa sebagai kunci unik untuk mencegah duplikasi lintas desa
                    const key = `${(data.nama || '').trim().toLowerCase()}_${(data.desa || '').trim().toLowerCase()}`;
                    existingDataMap.set(key, { id: doc.id, ...data });
                });


                const batch = writeBatch(db);
                let addedCount = 0;
                let updatedCount = 0;
                let skippedDesaCount = 0; // Untuk Admin Desa
                let skippedDuplicateInFileCount = 0; // Duplikat dalam file Excel
                let skippedInvalidDataCount = 0; // Data tidak valid (misal nama kosong)
                const processedKeysInFile = new Set(); // Melacak kunci (nama_desa) dalam file

                jsonData.forEach((row, index) => {
                    // Ekstrak data dari baris, pastikan kolom dibaca dengan benar
                    const desaExcel = String(row['DESA'] || '').trim();
                    const namaExcel = String(row['N A M A'] || '').trim();
                    const noRtExcel = String(row['NO RT'] || '').trim();
                    const noRwExcel = String(row['NO RW'] || '').trim(); // Ambil NO RW

                    // --- Validasi Data Penting ---
                    if (!namaExcel || !desaExcel || !noRtExcel) {
                        console.warn(`Baris ${index + 2} dilewati: Nama, Desa, atau No RT kosong.`);
                        skippedInvalidDataCount++;
                        return; // Lewati baris jika data penting kosong
                    }

                     // --- Pemfilteran Desa untuk Admin Desa ---
                     if (currentUser.role === 'admin_desa' && desaExcel.toLowerCase() !== currentUser.desa.toLowerCase()) {
                        skippedDesaCount++;
                        return; // Lewati jika admin desa mengupload data desa lain
                    }

                    // --- Cek Duplikasi dalam File Excel ---
                    const keyInFile = `${namaExcel.toLowerCase()}_${desaExcel.toLowerCase()}`;
                    if (processedKeysInFile.has(keyInFile)) {
                        skippedDuplicateInFileCount++;
                        return; // Lewati jika nama & desa ini sudah diproses dari file yang sama
                    }
                    processedKeysInFile.add(keyInFile);

                    // --- Persiapan Data untuk Disimpan ---
                    let jenisKelamin = '';
                    if (String(row['L'] || '').trim().toUpperCase() === 'L') jenisKelamin = 'Laki-Laki';
                    else if (String(row['P'] || '').trim().toUpperCase() === 'P') jenisKelamin = 'Perempuan';

                    let pendidikan = '';
                    // Loop PENDIDIKAN_LIST untuk mencari yang bernilai '1' atau true
                    for (const level of PENDIDIKAN_LIST) {
                         // Cek jika kolom ada dan nilainya '1' (atau representasi true lainnya)
                        // Konversi ke string untuk perbandingan yang aman
                        if (row[level] && String(row[level]).trim() === '1') {
                            pendidikan = level;
                            break;
                        }
                    }

                    // Parsing tanggal lahir dengan fungsi parseExcelDate
                    // Menggunakan nilai dari row['TANGGAL LAHIR'] yang mungkin sudah diparsing oleh cellDates: true
                    const formattedDate = parseExcelDate(row['TANGGAL LAHIR']);

                    const rtData = {
                        desa: desaExcel,
                        nama: namaExcel,
                        jenis_kelamin: jenisKelamin,
                        jabatan: String(row['JABATAN'] || JABATAN_RT_LIST[0] || '').trim(), // Default jabatan jika kosong
                        tempat_lahir: String(row['TEMPAT LAHIR'] || '').trim(),
                        tanggal_lahir: formattedDate, // Gunakan hasil parseExcelDate yang sudah YYYY-MM-DD
                        pendidikan: pendidikan,
                        periode: String(row['PRIODE'] || '').trim(), // Sesuai nama kolom di CSV
                        no_rt: noRtExcel, // Pastikan ini terisi
                        no_rw: noRwExcel, // Simpan nomor RW induk
                        dukuh: String(row['DUKUH'] || '').trim(),
                        dusun: String(row['DUSUN'] || '').trim(),
                        no_hp: String(row['No. HP / WA'] || '').trim(), // Sesuai nama kolom di CSV
                    };

                    // --- Logika Update atau Tambah ---
                    const existingDoc = existingDataMap.get(keyInFile); // Cari berdasarkan nama & desa

                    if (existingDoc) {
                        // Update data yang sudah ada
                        // Hanya update jika data dari Excel adalah data RT (no_rt tidak kosong)
                        // dan data yang ada di DB juga data RT
                        if (rtData.no_rt && existingDoc.no_rt) {
                            batch.update(doc(db, config.collectionName, existingDoc.id), rtData);
                            updatedCount++;
                        } else {
                             // Jika mencoba menimpa data RW dengan data RT atau sebaliknya, bisa dilewati atau diberi warning
                            console.warn(`Data untuk ${namaExcel} di desa ${desaExcel} dilewati karena konflik tipe (RT/RW) atau data tidak valid.`);
                            skippedInvalidDataCount++;
                        }
                    } else {
                        // Tambah data baru jika belum ada
                        // Pastikan hanya menambah data RT (no_rt tidak kosong)
                         if (rtData.no_rt) {
                            batch.set(doc(collection(db, config.collectionName)), rtData);
                            addedCount++;
                        } else {
                            console.warn(`Data RT baru untuk ${namaExcel} di desa ${desaExcel} dilewati karena no_rt kosong.`);
                            skippedInvalidDataCount++;
                        }
                    }
                });

                // --- Commit Batch dan Tampilkan Notifikasi ---
                if (addedCount > 0 || updatedCount > 0) {
                    await batch.commit();
                    let msg = `Impor selesai: ${addedCount} data baru ditambahkan, ${updatedCount} data diperbarui.`;
                    const skippedMessages = [];
                    if (skippedDesaCount > 0) skippedMessages.push(`${skippedDesaCount} baris desa lain dilewati`);
                    if (skippedDuplicateInFileCount > 0) skippedMessages.push(`${skippedDuplicateInFileCount} duplikat dalam file dilewati`);
                     if (skippedInvalidDataCount > 0) skippedMessages.push(`${skippedInvalidDataCount} data tidak valid dilewati`);

                    if (skippedMessages.length > 0) {
                        msg += ` (${skippedMessages.join(', ')}).`;
                    }
                    showNotification(msg, 'success');
                } else {
                     let msg = "Tidak ada data yang ditambahkan atau diperbarui.";
                     const skippedMessages = [];
                     if (skippedDesaCount > 0) skippedMessages.push(`${skippedDesaCount} baris desa lain dilewati`);
                     if (skippedDuplicateInFileCount > 0) skippedMessages.push(`${skippedDuplicateInFileCount} duplikat dalam file dilewati`);
                     if (skippedInvalidDataCount > 0) skippedMessages.push(`${skippedInvalidDataCount} data tidak valid dilewati`);

                     if (skippedMessages.length > 0) {
                        msg += ` Alasan: ${skippedMessages.join(', ')}.`;
                     } else {
                        msg += " Pastikan file tidak kosong dan formatnya benar.";
                     }
                    showNotification(msg, 'warning');
                }

            } catch (error) {
                console.error("Error importing data:", error);
                showNotification(`Gagal melakukan impor: ${error.message}`, 'error');
            } finally {
                setLoading(false); // Sembunyikan loading
            }
        };
        reader.onerror = (error) => {
             console.error("Error reading file:", error);
             showNotification(`Gagal membaca file: ${error.message || error}`, 'error');
             setLoading(false); // Sembunyikan loading
        }
        reader.readAsArrayBuffer(file);
        // Reset input file agar bisa upload file yang sama lagi jika perlu
        e.target.value = null;
    };

    const handleExportXLSX = async () => {
        if (filteredData.length === 0) {
            showNotification("Tidak ada data RT untuk diekspor.", "warning");
            return;
        }
        setLoading(true);
        try {
            // Menggunakan fungsi generateRtXLSX yang sudah ada
            // Pastikan generateRtXLSX memformat tanggal_lahir sesuai kebutuhan (misal DD/MM/YYYY)
            await generateRtXLSX(filteredData, db);
             showNotification("Data RT berhasil diekspor ke XLSX.", "success");
        } catch (error) {
            console.error("Error exporting RT data:", error);
            showNotification(`Gagal mengekspor data RT: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- Fungsi Bulk Delete ---
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
            showNotification(`${selectedIds.length} data RT berhasil dihapus.`, 'success');
            setSelectedIds([]); // Kosongkan pilihan setelah berhasil
        } catch (error) {
            console.error("Error deleting selected RT data:", error);
            showNotification(`Gagal menghapus data terpilih: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteSelectedConfirmOpen(false);
        }
    };
    // --- Akhir Fungsi Bulk Delete ---


    // --- JSX Return ---
    return (
        <div className="space-y-6">
            {/* Header: Search, Filter, Buttons */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                {/* Search & Filter */}
                <div className="flex items-center gap-4 flex-wrap">
                    <InputField
                        type="text"
                        placeholder="Cari (Nama, No RT/RW...)"
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
                            accept=".xlsx, .xls" // Hanya terima file Excel
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

            {/* Table Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        {/* Table Header */}
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                            <tr>
                                <th scope="col" className="p-4">
                                    <div className="flex items-center">
                                        <input
                                            id="checkbox-all"
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                                        <label htmlFor="checkbox-all" className="sr-only">checkbox</label>
                                    </div>
                                </th>
                                {/* Dinamis berdasarkan tableColumns */}
                                {config.tableColumns.map(col => (
                                    <th key={col} className="px-6 py-3 whitespace-nowrap">
                                        {config.formFields.find(f => f.name === col)?.label || col}
                                    </th>
                                ))}
                                <th className="px-6 py-3">Aksi</th>
                            </tr>
                        </thead>
                        {/* Table Body */}
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={config.tableColumns.length + 2} className="text-center py-10"><Spinner /> Loading data...</td></tr>
                            ) : filteredData.length > 0 ? filteredData.map(item => (
                                <tr key={item.id} className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${highlightedRow === item.id ? 'highlight-row' : ''}`}>
                                     {/* Checkbox per baris */}
                                     <td className="w-4 p-4">
                                        <div className="flex items-center">
                                            <input
                                                id={`checkbox-${item.id}`}
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => handleSelectOne(item.id)}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                                            <label htmlFor={`checkbox-${item.id}`} className="sr-only">checkbox</label>
                                        </div>
                                    </td>
                                    {/* Data Kolom */}
                                    {config.tableColumns.map(col => (
                                        <td key={col} className="px-6 py-4 whitespace-nowrap">
                                            {/* Format tanggal lahir khusus untuk tampilan */}
                                            {col === 'tanggal_lahir' && item[col] ? new Date(item[col] + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : item[col] || '-'}
                                        </td>
                                    ))}
                                    {/* Kolom Aksi */}
                                    <td className="px-6 py-4 flex items-center space-x-2">
                                        <button onClick={() => handleOpenModal('view', item)} className="text-green-500 hover:text-green-700 p-1" title="Lihat"><FiEye size={16}/></button>
                                        <button onClick={() => handleOpenModal('edit', item)} className="text-blue-500 hover:text-blue-700 p-1" title="Edit"><FiEdit size={16}/></button>
                                        <button onClick={() => openDeleteConfirm(item)} className="text-red-500 hover:text-red-700 p-1" title="Hapus"><FiTrash2 size={16}/></button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={config.tableColumns.length + 2} className="text-center py-10 text-gray-500">Data tidak ditemukan.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>

            {/* Modal Add/Edit/View */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? `Detail ${config.title}` : modalMode === 'edit' ? `Edit ${config.title}` : `Tambah ${config.title}`}>
                {modalMode === 'view' ? (
                    // Tampilan Detail
                     <OrganisasiDetailView data={selectedItem} config={config} />
                ) : (
                    // Form Add/Edit
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        {/* Render Form Fields */}
                        {config.formFields.map(field => {
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
                                    >
                                        <option value="">Pilih {field.label}</option>
                                        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </InputField>
                                );
                            }
                             // Tangani tipe input lain (text, date, tel, dll.)
                            return (
                                <InputField
                                    key={field.name}
                                    {...field} // Sebarkan properti field (label, name, type, required)
                                    value={formData[field.name] || ''}
                                    onChange={handleFormChange}
                                />
                            );
                        })}
                        {/* Input Desa (hanya untuk Admin Kecamatan) */}
                        {currentUser.role === 'admin_kecamatan' && (
                             <InputField
                                label="Desa"
                                name="desa"
                                type="select"
                                value={formData.desa || ''}
                                onChange={handleFormChange}
                                required>
                                <option value="">Pilih Desa</option>
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                             </InputField>
                        )}
                        {/* Tombol Aksi Form */}
                         <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                            <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                            <Button type="submit" variant="primary" isLoading={isSubmitting} className="ml-2">
                                {modalMode === 'edit' ? 'Perbarui' : 'Simpan'}
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Modal Konfirmasi Hapus Tunggal */}
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                isLoading={isSubmitting}
                title={`Hapus Data ${config.title}`}
                message={`Yakin ingin menghapus data "${itemToDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.`} />

             {/* Modal Konfirmasi Hapus Massal (Bulk Delete) */}
            <ConfirmationModal
                isOpen={isDeleteSelectedConfirmOpen}
                onClose={() => setIsDeleteSelectedConfirmOpen(false)}
                onConfirm={handleDeleteSelected}
                isLoading={isSubmitting}
                title="Hapus Data Terpilih"
                message={`Yakin ingin menghapus ${selectedIds.length} data RT yang dipilih? Tindakan ini tidak dapat dibatalkan.`} />
        </div>
    );
};

export default RtPage;

