import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, writeBatch, getDocs, where, getDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button'; // Menggunakan komponen Button baru
import SkeletonLoader from '../components/common/SkeletonLoader'; // Menggunakan Skeleton Loader baru
import { FiEdit, FiSearch, FiFilter, FiUpload, FiDownload, FiPlus, FiEye, FiUserX, FiTrash2, FiBriefcase, FiCheckSquare, FiXSquare } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { generatePerangkatXLSX } from '../utils/generatePerangkatXLSX';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

// --- Daftar statis untuk memastikan dropdown selalu terisi ---
const STATIC_DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];
const JABATAN_LIST = [
    "Kepala Desa", "Pj. Kepala Desa", "Sekretaris Desa", "Kasi Pemerintahan", "Kasi Kesejahteraan", "Kasi Pelayanan", "Kaur Tata Usaha dan Umum", "Kaur Keuangan", "Kaur Perencanaan", "Kepala Dusun", "Staf Desa"
];
const PENDIDIKAN_LIST = ["SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"];


// Komponen Detail Perangkat untuk Modal
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
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPerangkat, setSelectedPerangkat] = useState(null);
    const [formData, setFormData] = useState({});
    
    const [fotoProfilFile, setFotoProfilFile] = useState(null);
    const [fotoKtpFile, setFotoKtpFile] = useState(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState('all');
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [modalMode, setModalMode] = useState('edit');
    const [exportConfig, setExportConfig] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

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
        if (!currentUser || (currentUser.role === 'admin_desa' && !currentUser.desa)) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const perangkatCollection = collection(db, 'perangkat');
        const q = currentUser.role === 'admin_kecamatan' 
            ? query(perangkatCollection)
            : query(perangkatCollection, where("desa", "==", currentUser.desa));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllPerangkat(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching data:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser]);

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
        const requiredFields = [
            'nama', 'jabatan', 'nik', 'tempat_lahir', 'tgl_lahir', 
            'pendidikan', 'no_sk', 'tgl_sk', 'tgl_pelantikan', 
            'foto_url', 'ktp_url'
        ];
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
            if (!isKades) { // Hanya hitung otomatis jika bukan Kades
                const calculatedDate = calculateAkhirJabatan(formData.tgl_lahir);
                if (calculatedDate !== formData.akhir_jabatan) {
                    setFormData(prevData => ({ ...prevData, akhir_jabatan: calculatedDate }));
                }
            }
        }
    }, [formData.tgl_lahir, formData.jabatan, modalMode]);


    const filteredPerangkat = useMemo(() => {
        return allPerangkat
            .filter(p => {
                if (currentUser.role === 'admin_desa') return p.desa === currentUser.desa;
                if (filterDesa === 'all') return true;
                return p.desa === filterDesa;
            })
            .filter(p => {
                if (!searchTerm) return true;
                const search = searchTerm.toLowerCase();
                return (p.nama && p.nama.toLowerCase().includes(search)) || 
                       (p.nip && String(p.nip).includes(search)) ||
                       (p.nik && String(p.nik).includes(search));
            });
    }, [allPerangkat, searchTerm, filterDesa, currentUser]);

    const handleOpenModal = (perangkat = null, mode = 'edit') => {
        setModalMode(mode);
        setSelectedPerangkat(perangkat);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : (perangkat ? perangkat.desa : '');
        
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

    const uploadImageToCloudinary = async (file) => {
        if (!file) return null;
        const data = new FormData();
        data.append('file', file);
        data.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: data
        });
        const result = await res.json();
        return result.secure_url;
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

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        let dataToSave = { ...formData };
        if (!dataToSave.desa) {
            alert("Desa wajib diisi!");
            setIsSubmitting(false);
            return;
        }

        if (dataToSave.jabatan === 'Lainnya') {
            dataToSave.jabatan = dataToSave.jabatan_custom || '';
        }
        delete dataToSave.jabatan_custom;
        
        if (dataToSave.pendidikan === 'Lainnya') {
            dataToSave.pendidikan = dataToSave.pendidikan_custom || '';
        }
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
            const fotoProfilUrl = await uploadImageToCloudinary(fotoProfilFile);
            const fotoKtpUrl = await uploadImageToCloudinary(fotoKtpFile);

            if (fotoProfilUrl) dataToSave.foto_url = fotoProfilUrl;
            if (fotoKtpUrl) dataToSave.ktp_url = fotoKtpUrl;
            
            if (selectedPerangkat) {
                const docRef = doc(db, 'perangkat', selectedPerangkat.id);
                await updateDoc(docRef, dataToSave);
                alert('Data berhasil diperbarui!');
            } else {
                const existingDoc = await findJabatanKosongAtauPurna(dataToSave.jabatan, dataToSave.desa);
                if (existingDoc) {
                    const docRef = doc(db, 'perangkat', existingDoc.id);
                    await updateDoc(docRef, dataToSave);
                    alert(`Formasi jabatan ${dataToSave.jabatan} yang kosong/purna telah diisi.`);
                } else {
                    await addDoc(collection(db, 'perangkat'), dataToSave);
                    alert('Data baru berhasil ditambahkan!');
                }
            }
            
            handleCloseModal();
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("Gagal menyimpan data.");
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
                const perangkatRef = doc(db, 'perangkat', selectedPerangkat.id);
                const { jabatan, desa } = selectedPerangkat;
                const dataToUpdate = {
                    nama: null, nik: null, jenis_kelamin: null, tempat_lahir: null, tgl_lahir: null,
                    pendidikan: null, no_sk: null, tgl_sk: null, tgl_pelantikan: null,
                    akhir_jabatan: null, no_hp: null, nip: null, foto_url: null, ktp_url: null,
                    jabatan, desa, status: 'Jabatan Kosong'
                };
                await updateDoc(perangkatRef, dataToUpdate);
                alert('Data personel telah dikosongkan.');
            } else if (mode === 'permanen') {
                await deleteDoc(doc(db, 'perangkat', selectedPerangkat.id));
                alert('Data berhasil dihapus permanen.');
            }
        } catch (error) {
            alert("Terjadi kesalahan saat memproses data.");
        } finally {
            setIsDeleting(false);
            setSelectedPerangkat(null);
        }
    };
    
    const handleExportXLSX = () => {
        const dataToExport = filteredPerangkat;
        if (dataToExport.length === 0) return alert("Tidak ada data untuk diekspor.");
        
        let groupedData;
        if (filterDesa === 'all' && currentUser.role === 'admin_kecamatan') {
            groupedData = dataToExport.reduce((acc, p) => {
                (acc[p.desa] = acc[p.desa] || []).push(p);
                return acc;
            }, {});
            groupedData = Object.entries(groupedData).map(([desa, perangkat]) => ({ desa, perangkat }));
        } else {
            const desaName = filterDesa !== 'all' ? filterDesa : currentUser.desa;
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
                let alertMessage = `Impor selesai!\n- ${createdCount} data baru ditambahkan.\n- ${updatedCount} data diperbarui.\n- ${skippedCount} baris dilewati (data tidak lengkap/tidak sesuai desa/duplikat nama).`;
                if (duplicates.length > 0) {
                    alertMessage += `\n\nData duplikat yang dilewati:\n- ${duplicates.join('\n- ')}`;
                }
                alert(alertMessage);


            } catch (error) {
                console.error("Error processing file:", error);
                alert(`Gagal memproses file: ${error.message}`);
            } finally {
                setIsUploading(false);
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsArrayBuffer(file);
    };


    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedIds(new Set());
    };

    const handleSelect = (id) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allFilteredIds = new Set(filteredPerangkat.map(p => p.id));
            setSelectedIds(allFilteredIds);
        } else {
            setSelectedIds(new Set());
        }
    };
    
    const handleBulkDelete = async (mode) => {
        if (selectedIds.size === 0) return alert("Pilih data yang akan diproses.");

        const modeText = mode === 'kosongkan' ? 'mengosongkan jabatan' : 'menghapus permanen';
        if (window.confirm(`Anda yakin ingin ${modeText} untuk ${selectedIds.size} data yang dipilih?`)) {
            setIsDeleting(true);
            try {
                const batch = writeBatch(db);
                for (const id of selectedIds) {
                    const docRef = doc(db, 'perangkat', id);
                    if (mode === 'kosongkan') {
                        const perangkat = allPerangkat.find(p => p.id === id);
                        if(perangkat){
                            const dataToUpdate = {
                                nama: null, nik: null, jenis_kelamin: null, tempat_lahir: null, tgl_lahir: null,
                                pendidikan: null, no_sk: null, tgl_sk: null, tgl_pelantikan: null,
                                akhir_jabatan: null, no_hp: null, nip: null, foto_url: null, ktp_url: null,
                                status: 'Jabatan Kosong'
                            };
                            batch.update(docRef, dataToUpdate);
                        }
                    } else {
                        batch.delete(docRef);
                    }
                }
                await batch.commit();
                alert(`${selectedIds.size} data berhasil diproses.`);
            } catch (error) {
                alert("Terjadi kesalahan saat memproses data.");
            } finally {
                setIsDeleting(false);
                toggleSelectionMode();
            }
        }
    };

    if (loading) return <SkeletonLoader columns={currentUser.role === 'admin_kecamatan' ? 5 : 4} />;
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-colors duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div className="relative lg:col-span-2">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Cari nama, NIP, atau NIK..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                </div>
                {currentUser.role === 'admin_kecamatan' && (
                    <div className="relative">
                        <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                         <select value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg appearance-none bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="all">Semua Desa</option>
                            {STATIC_DESA_LIST.sort().map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </select>
                    </div>
                )}
            </div>
            
           <div className="flex flex-wrap justify-end gap-2 mb-4">
                {isSelectionMode ? (
                    <>
                        <Button onClick={() => handleBulkDelete('kosongkan')} variant="warning" disabled={isDeleting || selectedIds.size === 0} isLoading={isDeleting}>
                           <FiUserX /> Kosongkan ({selectedIds.size})
                        </Button>
                        <Button onClick={() => handleBulkDelete('permanen')} variant="danger" disabled={isDeleting || selectedIds.size === 0} isLoading={isDeleting}>
                           <FiTrash2 /> Hapus ({selectedIds.size})
                        </Button>
                        <Button onClick={toggleSelectionMode} variant="secondary">
                            <FiXSquare/> Batal
                        </Button>
                    </>
                ) : (
                    <>
                        <Button onClick={toggleSelectionMode} variant="danger">
                           <FiCheckSquare/> Pilih Data
                        </Button>
                        <label className="btn btn-warning">
                            <FiUpload className="mr-2"/> 
                            <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" disabled={isUploading}/>
                            {isUploading ? 'Mengimpor...' : 'Impor Data'}
                        </label>
                        <Button onClick={handleExportXLSX} variant="success">
                            <FiDownload className="mr-2"/> Ekspor XLSX
                        </Button>
                        <Button onClick={() => handleOpenModal(null, 'add')} variant="primary">
                            <FiPlus className="mr-2"/> Tambah Data
                        </Button>
                    </>
                )}
            </div>
            
            <div className="table-container-modern">
                <table className="table-modern">
                    <thead>
                        <tr>
                            {isSelectionMode && (
                                <th className="p-4">
                                    <input type="checkbox" onChange={handleSelectAll} checked={filteredPerangkat.length > 0 && selectedIds.size === filteredPerangkat.length} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"/>
                                </th>
                            )}
                            <th>Nama Lengkap</th>
                            <th>Jabatan</th>
                            {currentUser.role === 'admin_kecamatan' && <th>Desa</th>}
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPerangkat.length > 0 ? filteredPerangkat.map((p) => {
                            const isPurna = p.akhir_jabatan && new Date(p.akhir_jabatan) < new Date();
                            const isKosong = !p.nama && !p.nik;
                            
                            return (
                                <tr key={p.id}>
                                {isSelectionMode && (
                                    <td className="p-4">
                                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => handleSelect(p.id)} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"/>
                                    </td>
                                )}
                                <td className="font-medium flex items-center gap-3 text-gray-900 dark:text-white">
                                    {isKosong ? (
                                         <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 flex items-center justify-center rounded-full text-gray-500">
                                             <FiBriefcase />
                                         </div>
                                    ) : (
                                        <img src={p.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nama || 'X')}&background=E2E8F0&color=4A5568`} alt={p.nama || 'Jabatan Kosong'} className="w-10 h-10 rounded-full object-cover"/>
                                    )}
                                    <div>
                                        <p className="font-semibold">{p.nama || '(Jabatan Kosong)'}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.nik || 'NIK belum diisi'}</p>
                                    </div>
                                </td>
                                <td>{p.jabatan}</td>
                                {currentUser.role === 'admin_kecamatan' && <td>{p.desa}</td>}
                                <td>
                                    {isPurna ? (
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Purna Tugas</span>
                                    ) : isKosong ? (
                                         <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Jabatan Kosong</span>
                                    ) : (
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${isDataLengkap(p) ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                                            {isDataLengkap(p) ? 'Lengkap' : 'Belum Lengkap'}
                                        </span>
                                    )}
                                </td>
                                <td className="flex space-x-3">
                                    <button onClick={() => handleOpenModal(p, 'view')} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" title="Lihat Detail"><FiEye /></button>
                                    <button onClick={() => handleOpenModal(p, 'edit')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Edit"><FiEdit /></button>
                                    <button onClick={() => { setSelectedPerangkat(p); setShowDeleteConfirm(true); }} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Hapus"><FiTrash2 /></button>
                                </td>
                                </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan={isSelectionMode ? 6 : 5} className="text-center py-10 text-gray-500 dark:text-gray-400">Belum ada data perangkat atau hasil filter kosong.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'view' ? 'Detail Data Perangkat' : (selectedPerangkat ? 'Edit Data Perangkat' : 'Tambah Data Perangkat')}>
                 {modalMode === 'view' && selectedPerangkat ? (
                    <PerangkatDetailView perangkat={selectedPerangkat} />
                 ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries({
                                desa: 'Desa', nama: 'Nama Lengkap', nik: 'NIK', jenis_kelamin: 'Jenis Kelamin',
                                tempat_lahir: 'Tempat Lahir', tgl_lahir: 'Tanggal Lahir',
                                no_sk: 'Nomor SK', tgl_sk: 'Tanggal SK', tgl_pelantikan: 'Tanggal Pelantikan',
                                no_hp: 'No. HP / WA', nip: 'NIP/NIPD',
                            }).map(([key, label]) => (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                                    {
                                        key === 'desa' ? (
                                            <select name={key} value={formData[key] || ''} onChange={handleFormChange} className="form-input-modern" required disabled={currentUser.role === 'admin_desa'}>
                                                <option value="">Pilih Desa</option>
                                                {STATIC_DESA_LIST.sort().map(desa => <option key={desa} value={desa}>{desa}</option>)}
                                            </select>
                                        ) : key === 'jenis_kelamin' ? (
                                            <select name={key} value={formData[key] || ''} onChange={handleFormChange} className="form-input-modern">
                                                <option value="">Pilih Jenis Kelamin</option>
                                                <option value="L">Laki-laki</option>
                                                <option value="P">Perempuan</option>
                                            </select>
                                        ) : (
                                            <input type={key.includes('tgl') ? 'date' : 'text'} name={key} value={formData[key] || ''} onChange={handleFormChange} className="form-input-modern"/>
                                        )
                                    }
                                </div>
                            ))}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pendidikan Terakhir</label>
                                <>
                                    <select name="pendidikan" value={formData.pendidikan || ''} onChange={handleFormChange} className="form-input-modern">
                                        <option value="">Pilih Pendidikan</option>
                                        {PENDIDIKAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                                        <option value="Lainnya">Lainnya...</option>
                                    </select>
                                    {formData.pendidikan === 'Lainnya' && (
                                        <input
                                            type="text"
                                            name="pendidikan_custom"
                                            value={formData.pendidikan_custom || ''}
                                            onChange={handleFormChange}
                                            placeholder="Masukkan pendidikan"
                                            className="mt-2 form-input-modern"
                                            required
                                        />
                                    )}
                                </>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Akhir Masa Jabatan</label>
                                {(() => {
                                    const isKades = formData.jabatan && (formData.jabatan.toLowerCase().includes('kepala desa') || formData.jabatan.toLowerCase().includes('pj. kepala desa'));
                                    return (
                                        <input 
                                            type="date" 
                                            name="akhir_jabatan" 
                                            value={formData.akhir_jabatan || ''} 
                                            onChange={handleFormChange}
                                            className={`form-input-modern ${!isKades ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700'}`}
                                            disabled={!isKades}
                                            title={!isKades ? "Dihitung otomatis berdasarkan tanggal lahir (usia 60 tahun)" : "Silakan masukkan tanggal akhir jabatan"}
                                        />
                                    );
                                })()}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Jabatan</label>
                                <>
                                    <select name="jabatan" value={formData.jabatan || ''} onChange={handleFormChange} className="form-input-modern" disabled={!!selectedPerangkat && !(!selectedPerangkat.nama && !selectedPerangkat.nik)}>
                                        <option value="">Pilih Jabatan</option>
                                        {JABATAN_LIST.map(jabatan => <option key={jabatan} value={jabatan}>{jabatan}</option>)}
                                        <option value="Lainnya">Jabatan Lainnya...</option>
                                    </select>
                                    {formData.jabatan === 'Lainnya' && (
                                        <input
                                            type="text"
                                            name="jabatan_custom"
                                            value={formData.jabatan_custom || ''}
                                            onChange={handleFormChange}
                                            placeholder="Masukkan nama jabatan"
                                            className="mt-2 form-input-modern"
                                            required
                                            disabled={!!selectedPerangkat && !(!selectedPerangkat.nama && !selectedPerangkat.nik)}
                                        />
                                    )}
                                </>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Foto Profil</label>
                                <>
                                    <input type="file" onChange={(e) => setFotoProfilFile(e.target.files[0])} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                                    {formData.foto_url && <img src={formData.foto_url} alt="Foto Profil Saat Ini" className="mt-2 h-24 w-24 object-cover rounded-md"/>}
                                </>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Foto KTP</label>
                                <>
                                    <input type="file" onChange={(e) => setFotoKtpFile(e.target.files[0])} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                                    {formData.ktp_url && <img src={formData.ktp_url} alt="Foto KTP Saat Ini" className="mt-2 h-24 w-auto object-contain rounded-md"/>}
                                </>
                            </div>
                        </div>
                        <div className="flex justify-end pt-4 border-t mt-6 dark:border-gray-700">
                             <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Tutup</Button>
                             <Button type="submit" variant="primary" isLoading={isSubmitting} className="ml-2">
                                 {selectedPerangkat ? 'Simpan Perubahan' : 'Simpan'}
                             </Button>
                        </div>
                    </form>
                 )}
            </Modal>
            
            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Konfirmasi Hapus">
                <p>Pilih tipe penghapusan untuk data "{selectedPerangkat?.nama}":</p>
                <div className="flex justify-end gap-4 mt-6">
                     <Button onClick={() => handleDelete('kosongkan')} variant="warning" isLoading={isDeleting}>
                        <FiUserX /> Kosongkan Jabatan
                    </Button>
                     <Button onClick={() => handleDelete('permanen')} variant="danger" isLoading={isDeleting}>
                        <FiTrash2 /> Hapus Permanen
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default Perangkat;


