import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, writeBatch, getDocs, where, getDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import { FiEdit, FiSearch, FiFilter, FiUpload, FiDownload, FiPlus, FiEye, FiUserX, FiTrash2, FiBriefcase, FiCheckSquare, FiXSquare } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { generatePerangkatXLSX } from '../utils/generatePerangkatXLSX';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

// Fallback list in case data from Firestore is unavailable
const STATIC_DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

// Komponen Detail Perangkat untuk Modal (didefinisikan di luar komponen utama)
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
    
    // State for dynamic lists from settings
    const [desaList, setDesaList] = useState(STATIC_DESA_LIST); // Initialize with static list
    const [jabatanList, setJabatanList] = useState([]);
    const [pendidikanList, setPendidikanList] = useState([]);

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

    // New state for selection mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Fetch dynamic settings from Firestore
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'settings', 'appConfig'));
                if (settingsDoc.exists()) {
                    const settings = settingsDoc.data();
                    // If fetched list is valid, use it. Otherwise, the static list remains.
                    if(settings.desaList && settings.desaList.length > 0) {
                        setDesaList(settings.desaList);
                    }
                    setJabatanList(settings.jabatanList || []);
                    setPendidikanList(settings.pendidikanList || []);
                }
            } catch (error) {
                console.error("Error fetching settings, using fallback lists:", error);
            }
        };

        const fetchExportConfig = async () => {
            try {
                const exportRef = doc(db, 'settings', 'exportConfig');
                const exportSnap = await getDoc(exportRef);
                if (exportSnap.exists()) setExportConfig(exportSnap.data());
            } catch (error) {
                console.error("Error fetching export config:", error);
            }
        };

        fetchSettings();
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
    
    const calculateAkhirJabatan = (tglLahir) => {
        if (!tglLahir || !(typeof tglLahir === 'string' || tglLahir instanceof Date)) return null;
        try {
            let birthDate = tglLahir instanceof Date ? tglLahir : new Date(tglLahir.replace(/-/g, '/'));
            
            if (isNaN(birthDate.getTime())) {
                 let parts = tglLahir.split('-');
                 if (parts.length === 3 && parts[2].length === 4) { // DD-MM-YYYY
                    birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                 } else {
                    return null
                 }
            }
            
            if (isNaN(birthDate.getTime())) return null;
    
            birthDate.setFullYear(birthDate.getFullYear() + 60);
            const year = birthDate.getFullYear();
            const month = String(birthDate.getMonth() + 1).padStart(2, '0');
            const day = String(birthDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error("Invalid date for tglLahir:", tglLahir);
            return null;
        }
    };

    useEffect(() => {
        if (formData.tgl_lahir && (modalMode === 'edit' || modalMode === 'add')) {
            const calculatedDate = calculateAkhirJabatan(formData.tgl_lahir);
            if (calculatedDate !== formData.akhir_jabatan) {
                setFormData(prevData => ({ ...prevData, akhir_jabatan: calculatedDate }));
            }
        }
    }, [formData.tgl_lahir, modalMode]);


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

        if (perangkat && perangkat.jabatan && !jabatanList.includes(perangkat.jabatan)) {
            initialFormData.jabatan_custom = perangkat.jabatan;
            initialFormData.jabatan = 'Lainnya';
        } else {
            initialFormData.jabatan_custom = '';
        }

        if (perangkat && perangkat.pendidikan && !pendidikanList.includes(perangkat.pendidikan)) {
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

        if (dataToSave.tgl_lahir) {
            dataToSave.akhir_jabatan = calculateAkhirJabatan(dataToSave.tgl_lahir);
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
                // Read file with options to handle dates and prevent formula objects
                const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellFormula: false });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
    
                const header = ["desa", "nama", "jenis_kelamin_l", "jenis_kelamin_p", "jabatan", "tempat_lahir", "tgl_lahir", "pendidikan_sd", "pendidikan_sltp", "pendidikan_slta", "pendidikan_d1", "pendidikan_d2", "pendidikan_d3", "pendidikan_s1", "pendidikan_s2", "pendidikan_s3", "no_sk", "tgl_sk", "tgl_pelantikan", "akhir_jabatan", "no_hp", "nik"];
                // Convert sheet to JSON, forcing all values to strings (raw: false) except for dates.
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header, range: 1, blankrows: false, raw: false });
    
                const dataRows = jsonData.map(row => {
                    const newDoc = {
                        desa: row.desa,
                        nama: row.nama,
                        jabatan: row.jabatan,
                        tempat_lahir: row.tempat_lahir,
                        tgl_lahir: row.tgl_lahir,
                        no_sk: row.no_sk,
                        tgl_sk: row.tgl_sk,
                        tgl_pelantikan: row.tgl_pelantikan,
                        akhir_jabatan: row.akhir_jabatan,
                        no_hp: row.no_hp,
                        nik: row.nik,
                    };
                    
                    // Sanitize dates - convert formatted strings back to Date objects
                    ['tgl_lahir', 'tgl_sk', 'tgl_pelantikan', 'akhir_jabatan'].forEach(field => {
                        if (typeof newDoc[field] === 'string') {
                           const date = new Date(Date.parse(newDoc[field].replace(/(\d{2})-(\d{2})-(\d{4})/, '$2/$1/$3')));
                           if (!isNaN(date.getTime())) {
                               newDoc[field] = date;
                           }
                        }
                    });

                    newDoc.jenis_kelamin = row.jenis_kelamin_l ? 'L' : (row.jenis_kelamin_p ? 'P' : null);
    
                    const pendidikanMapping = {
                        pendidikan_sd: 'SD', pendidikan_sltp: 'SLTP', pendidikan_slta: 'SLTA',
                        pendidikan_d1: 'D1', pendidikan_d2: 'D2', pendidikan_d3: 'D3',
                        pendidikan_s1: 'S1', pendidikan_s2: 'S2', pendidikan_s3: 'S3',
                    };

                    for (const key in pendidikanMapping) {
                        if (row[key]) {
                            newDoc.pendidikan = pendidikanMapping[key];
                            break;
                        }
                    }
    
                    if (newDoc.nama && newDoc.jabatan) {
                        if(newDoc.tgl_lahir) newDoc.akhir_jabatan = calculateAkhirJabatan(newDoc.tgl_lahir);
                        return newDoc;
                    }
                    return null;
                }).filter(Boolean);
    
                if (dataRows.length === 0) throw new Error("Tidak ada data valid yang ditemukan.");
    
                const batch = writeBatch(db);
                let updatedCount = 0;
                let createdCount = 0;
    
                for (const item of dataRows) {
                    if (currentUser.role === 'admin_desa' && item.desa !== currentUser.desa) continue;

                    const vacantDoc = await findJabatanKosongAtauPurna(item.jabatan, item.desa);
                    if (vacantDoc) {
                        batch.update(doc(db, 'perangkat', vacantDoc.id), item);
                        updatedCount++;
                    } else {
                        batch.set(doc(collection(db, 'perangkat')), item);
                        createdCount++;
                    }
                }
    
                await batch.commit();
                alert(`Impor berhasil!\n- ${updatedCount} jabatan diisi.\n- ${createdCount} data baru ditambahkan.`);
    
            } catch (error) {
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
        setSelectedIds(new Set()); // Reset selection when toggling mode
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
                    } else { // permanen
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


    if (loading) return <Spinner size="lg"/>;
    
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
                            {desaList.sort().map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </select>
                    </div>
                )}
            </div>
            
            <div className="flex flex-wrap justify-end gap-2 mb-4">
                {isSelectionMode ? (
                    <>
                        <button onClick={() => handleBulkDelete('kosongkan')} className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2" disabled={isDeleting || selectedIds.size === 0}>
                           <FiUserX /> Kosongkan ({selectedIds.size})
                        </button>
                        <button onClick={() => handleBulkDelete('permanen')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2" disabled={isDeleting || selectedIds.size === 0}>
                           <FiTrash2 /> Hapus ({selectedIds.size})
                        </button>
                        <button onClick={toggleSelectionMode} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2">
                            <FiXSquare/> Batal
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={toggleSelectionMode} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
                           <FiCheckSquare/> Pilih Data
                        </button>
                        <label className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 cursor-pointer flex items-center gap-2">
                            <FiUpload/> {isUploading ? 'Mengimpor...' : 'Impor Data'}
                            <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" disabled={isUploading}/>
                        </label>
                        <button onClick={handleExportXLSX} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                            <FiDownload/> Ekspor XLSX
                        </button>
                        <button onClick={() => handleOpenModal(null, 'add')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                            <FiPlus/> Tambah Data
                        </button>
                    </>
                )}
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            {isSelectionMode && (
                                <th className="p-4">
                                    <input type="checkbox" onChange={handleSelectAll} checked={filteredPerangkat.length > 0 && selectedIds.size === filteredPerangkat.length} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"/>
                                </th>
                            )}
                            <th className="px-6 py-3">Nama Lengkap</th>
                            <th className="px-6 py-3">Jabatan</th>
                            {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPerangkat.length > 0 ? filteredPerangkat.map((p) => {
                            const isPurna = p.akhir_jabatan && new Date(p.akhir_jabatan) < new Date();
                            const isKosong = !p.nama && !p.nik;
                            
                            return (
                                <tr key={p.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                {isSelectionMode && (
                                    <td className="p-4">
                                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => handleSelect(p.id)} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"/>
                                    </td>
                                )}
                                <td className="px-6 py-4 font-medium flex items-center gap-3 text-gray-900 dark:text-white">
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
                                <td className="px-6 py-4">{p.jabatan}</td>
                                {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{p.desa}</td>}
                                <td className="px-6 py-4">
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
                                <td className="px-6 py-4 flex space-x-3">
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
                                            <select name={key} value={formData[key] || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2" required disabled={currentUser.role === 'admin_desa'}>
                                                <option value="">Pilih Desa</option>
                                                {desaList.sort().map(desa => <option key={desa} value={desa}>{desa}</option>)}
                                            </select>
                                        ) : key === 'jenis_kelamin' ? (
                                            <select name={key} value={formData[key] || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2">
                                                <option value="">Pilih Jenis Kelamin</option>
                                                <option value="L">Laki-laki</option>
                                                <option value="P">Perempuan</option>
                                            </select>
                                        ) : (
                                            <input type={key.includes('tgl') ? 'date' : 'text'} name={key} value={formData[key] || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2"/>
                                        )
                                    }
                                </div>
                            ))}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pendidikan Terakhir</label>
                                <>
                                    <select name="pendidikan" value={formData.pendidikan || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2">
                                        <option value="">Pilih Pendidikan</option>
                                        {pendidikanList.map(p => <option key={p} value={p}>{p}</option>)}
                                        <option value="Lainnya">Lainnya...</option>
                                    </select>
                                    {formData.pendidikan === 'Lainnya' && (
                                        <input
                                            type="text"
                                            name="pendidikan_custom"
                                            value={formData.pendidikan_custom || ''}
                                            onChange={handleFormChange}
                                            placeholder="Masukkan pendidikan"
                                            className="mt-2 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2"
                                            required
                                        />
                                    )}
                                </>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Akhir Masa Jabatan</label>
                                <input 
                                    type="date" 
                                    name="akhir_jabatan" 
                                    value={formData.akhir_jabatan || ''} 
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm p-2 bg-gray-100 dark:bg-gray-600 cursor-not-allowed text-gray-500 dark:text-gray-400"
                                    readOnly
                                    disabled
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Jabatan</label>
                                <>
                                    <select name="jabatan" value={formData.jabatan || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2" disabled={!!selectedPerangkat && !(!selectedPerangkat.nama && !selectedPerangkat.nik)}>
                                        <option value="">Pilih Jabatan</option>
                                        {jabatanList.map(jabatan => <option key={jabatan} value={jabatan}>{jabatan}</option>)}
                                        <option value="Lainnya">Jabatan Lainnya...</option>
                                    </select>
                                    {formData.jabatan === 'Lainnya' && (
                                        <input
                                            type="text"
                                            name="jabatan_custom"
                                            value={formData.jabatan_custom || ''}
                                            onChange={handleFormChange}
                                            placeholder="Masukkan nama jabatan"
                                            className="mt-2 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2"
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
                            <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md mr-2" disabled={isSubmitting}>Tutup</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center" disabled={isSubmitting}>
                                {isSubmitting && <Spinner size="sm" />}
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>
            
            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Konfirmasi Hapus">
                <p>Pilih tipe penghapusan untuk data "{selectedPerangkat?.nama}":</p>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={() => handleDelete('kosongkan')} className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2" disabled={isDeleting}>
                        <FiUserX /> {isDeleting ? 'Memproses...' : 'Kosongkan Jabatan'}
                    </button>
                    <button onClick={() => handleDelete('permanen')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2" disabled={isDeleting}>
                        <FiTrash2 /> {isDeleting ? 'Memproses...' : 'Hapus Permanen'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Perangkat;

