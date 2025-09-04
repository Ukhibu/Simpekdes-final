import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase'; // Pastikan path ini benar
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where, writeBatch, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import { FiEdit, FiTrash2, FiSearch, FiFilter, FiUpload, FiDownload, FiPlus, FiEye } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { generatePerangkatPDF } from '../utils/generatePerangkatPDF';
import { generatePerangkatXLSX } from '../utils/generatePerangkatXLSX';
// PERUBAHAN 1: Tambahkan useLocation
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

const DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

const JABATAN_LIST = [
    "Kepala Desa",
    "Sekretaris Desa",
    "Kaur Tata Usaha dan Umum",
    "Kaur Keuangan",
    "Kaur Perencanaan",
    "Kasi Pemerintahan",
    "Kasi Kesejahteraan",
    "Kasi Pelayanan",
    "Kepala Dusun",
    "Staf Desa",
];

const PENDIDIKAN_LIST = [
    "SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"
];

const isDataLengkap = (perangkat) => {
    const requiredFields = [
        'nama', 'jabatan', 'nik', 'tempat_lahir', 'tgl_lahir', 
        'pendidikan', 'no_sk', 'tgl_sk', 'tgl_pelantikan', 'akhir_jabatan', 
        'foto_url', 'ktp_url'
    ];
    return requiredFields.every(field => perangkat[field] && String(perangkat[field]).trim() !== '');
};

const calculateAkhirJabatan = (tglLahir) => {
    if (!tglLahir || typeof tglLahir !== 'string') return null;
    try {
        let parts = tglLahir.split('-');
        let birthDate;
        if (parts[0].length === 4) { // YYYY-MM-DD
            birthDate = new Date(tglLahir);
        } else { // DD-MM-YYYY
            birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
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
    const [modalMode, setModalMode] = useState('edit');
    const [exportConfig, setExportConfig] = useState(null);
    const [uploadConfig, setUploadConfig] = useState(null);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    // PERUBAHAN 2: Inisialisasi useLocation
    const location = useLocation();

    useEffect(() => {
        const fetchConfigs = async () => {
            const exportRef = doc(db, 'settings', 'exportConfig');
            const uploadRef = doc(db, 'settings', 'uploadConfig');
            const exportSnap = await getDoc(exportRef);
            const uploadSnap = await getDoc(uploadRef);
            if (exportSnap.exists()) setExportConfig(exportSnap.data());
            if (uploadSnap.exists()) setUploadConfig(uploadSnap.data());
        };
        fetchConfigs();

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

    // PERUBAHAN 3: Memperbaiki useEffect untuk auto-edit
    useEffect(() => {
        const editId = searchParams.get('edit');
        // Hanya jalankan jika ID ada di URL dan data sudah dimuat
        if (editId && allPerangkat.length > 0) {
            const perangkatToEdit = allPerangkat.find(p => p.id === editId);
            if (perangkatToEdit) {
                // Buka modal dengan data yang ditemukan
                handleOpenModal(perangkatToEdit, 'edit');
                // Ganti URL untuk menghapus '?edit=...' 
                // Menggunakan location.pathname memastikan kita tetap di halaman yang benar (/app/perangkat)
                navigate(location.pathname, { replace: true });
            }
        }
        // Efek ini bergantung pada `allPerangkat`, jadi akan berjalan lagi saat data tiba.
    }, [allPerangkat, searchParams, navigate, location.pathname]);

    useEffect(() => {
        if (formData.tgl_lahir && modalMode === 'edit') {
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
                       (p.nip && p.nip.includes(search)) ||
                       (p.nik && p.nik.includes(search));
            });
    }, [allPerangkat, searchTerm, filterDesa, currentUser]);

    const handleOpenModal = (perangkat = null, mode = 'edit') => {
        setModalMode(mode);
        setSelectedPerangkat(perangkat);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : (perangkat ? perangkat.desa : '');
        
        let initialFormData = perangkat ? { ...perangkat } : { desa: initialDesa };

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
            if (!dataToSave.jabatan_custom || dataToSave.jabatan_custom.trim() === '') {
                alert("Jabatan Lainnya harus diisi!");
                setIsSubmitting(false);
                return;
            }
            dataToSave.jabatan = dataToSave.jabatan_custom;
        }
        delete dataToSave.jabatan_custom;
        
        if (dataToSave.pendidikan === 'Lainnya') {
            if (!dataToSave.pendidikan_custom || dataToSave.pendidikan_custom.trim() === '') {
                alert("Pendidikan Lainnya harus diisi!");
                setIsSubmitting(false);
                return;
            }
            dataToSave.pendidikan = dataToSave.pendidikan_custom;
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
                await addDoc(collection(db, 'perangkat'), dataToSave);
                alert('Data berhasil ditambahkan!');
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("Gagal menyimpan data.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (id) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus data ini?")) {
            await deleteDoc(doc(db, 'perangkat', id));
        }
    };
    
    const getExportData = () => {
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
                       (p.nip && p.nip.includes(search)) ||
                       (p.nik && p.nik.includes(search));
            });
    };

    const handleExport = (format) => {
        const dataToExport = getExportData();
        
        if (dataToExport.length === 0) {
            alert("Tidak ada data untuk diekspor sesuai filter yang dipilih.");
            return;
        }

        let groupedData = [];
        if (currentUser.role === 'admin_kecamatan' && filterDesa === 'all') {
            const desaGroups = dataToExport.reduce((acc, p) => {
                const desa = p.desa || 'Tanpa Desa';
                (acc[desa] = acc[desa] || []).push(p);
                return acc;
            }, {});
            groupedData = Object.keys(desaGroups).map(desa => ({
                desa: desa,
                perangkat: desaGroups[desa]
            }));
        } else {
            const desaName = currentUser.role === 'admin_desa' ? currentUser.desa : filterDesa;
            groupedData = [{ desa: desaName, perangkat: dataToExport }];
        }
        
        if (!exportConfig) {
            alert("Pengaturan ekspor belum dimuat. Silakan atur di halaman Pengaturan.");
            return;
        }

        if (format === 'pdf') {
            generatePerangkatPDF(groupedData, exportConfig);
        } else if (format === 'xlsx') {
            generatePerangkatXLSX(groupedData, exportConfig);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!uploadConfig || Object.keys(uploadConfig).length === 0) {
            alert("Pengaturan format upload belum dimuat atau diatur. Silakan atur di halaman Pengaturan.");
            e.target.value = null;
            return;
        }

        setIsUploading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const existingNiks = new Set(allPerangkat.map(p => p.nik).filter(Boolean));
                const fileContent = evt.target.result;
                let parsedData = [];
                let defaultDesa = 'Unknown';

                if (file.type === 'application/json') {
                    parsedData = JSON.parse(fileContent);
                } else if (file.type === 'text/csv') {
                    const lines = fileContent.split(/\r?\n/);
                    if (lines.length < 2) throw new Error("File CSV tidak valid.");
                    const headers = lines[0].split(',').map(h => h.trim());
                    parsedData = lines.slice(1).map(line => {
                        if (!line) return null;
                        const values = line.split(',').map(v => v.trim());
                        const obj = {};
                        headers.forEach((header, index) => {
                            obj[header] = values[index];
                        });
                        return obj;
                    }).filter(Boolean);
                } else if (file.type.includes('sheet') || file.type.includes('excel')) {
                    const wb = XLSX.read(fileContent, { type: 'binary' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
                    
                    if (data && data[0] && data[0][0] && typeof data[0][0] === 'string') {
                        const match = data[0][0].match(/DESA\s(.*?)\s\(/i);
                        if (match && match[1]) defaultDesa = match[1].trim();
                    }

                    const headerRowIndex = data.findIndex(row => row.some(cell => Object.values(uploadConfig).includes(cell)));
                    if (headerRowIndex === -1) throw new Error(`Tidak ada header yang cocok dengan pengaturan ditemukan.`);
                    const headers = data[headerRowIndex].map(h => typeof h === 'string' ? h.trim() : h);
                    const dataRows = data.slice(headerRowIndex + 1);

                    parsedData = dataRows.map(row => {
                        const obj = {};
                        headers.forEach((header, index) => {
                            if(header) obj[header] = row[index];
                        });
                        return obj;
                    });
                } else {
                    throw new Error("Tipe file tidak didukung. Harap unggah file XLSX, CSV, atau JSON.");
                }

                if (parsedData.length === 0) {
                    throw new Error("Tidak ada data valid yang ditemukan di dalam file.");
                }

                const mappedData = parsedData.map(item => {
                    const newItem = {};
                    for (const key in uploadConfig) {
                        const fileHeader = uploadConfig[key];
                        if (item[fileHeader] !== undefined && item[fileHeader] !== null) {
                            newItem[key] = item[fileHeader];
                        }
                    }

                    if (!newItem.desa) {
                        newItem.desa = defaultDesa;
                    }

                    if (uploadConfig.ttl && item[uploadConfig.ttl]) {
                        const [tempat_lahir, tgl_lahir] = String(item[uploadConfig.ttl]).split(',').map(s => s.trim());
                        newItem.tempat_lahir = tempat_lahir;
                        newItem.tgl_lahir = tgl_lahir;
                    }
                    
                    if (newItem.nik) newItem.nik = String(newItem.nik);

                    if (newItem.tgl_lahir) {
                        newItem.akhir_jabatan = calculateAkhirJabatan(newItem.tgl_lahir);
                    }

                    return newItem;
                }).filter(p => p.nama && p.jabatan);


                if (mappedData.length === 0) {
                    throw new Error("Data setelah pemetaan tidak valid atau kosong. Pastikan setidaknya kolom 'Nama' dan 'Jabatan' terisi dan terpetakan dengan benar.");
                }
                
                const newData = mappedData.filter(p => p.nik && !existingNiks.has(p.nik));
                const skippedCount = mappedData.length - newData.length;

                if (newData.length === 0) {
                    alert(`Proses selesai. Tidak ada data baru untuk ditambahkan. ${skippedCount} data dilewati karena NIK sudah ada.`);
                    return;
                }

                const batch = writeBatch(db);
                newData.forEach(perangkat => {
                    const docRef = doc(collection(db, 'perangkat'));
                    batch.set(docRef, perangkat);
                });
                await batch.commit();
                alert(`${newData.length} data baru berhasil di-upload! ${skippedCount} data dilewati karena NIK sudah ada.`);

            } catch (error) {
                console.error("Error processing file: ", error);
                alert(`Gagal memproses file: ${error.message}`);
            } finally {
                setIsUploading(false);
                e.target.value = null;
            }
        };

        if (file.type.includes('sheet') || file.type.includes('excel')) {
            reader.readAsBinaryString(file);
        } else {
            reader.readAsText(file);
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
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </select>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 mb-4">
                {currentUser.role === 'admin_kecamatan' && (
                    <>
                        <label className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 cursor-pointer flex items-center gap-2">
                            <FiUpload/> {isUploading ? 'Mengupload...' : 'Impor Data'}
                            <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv, .json" disabled={isUploading}/>
                        </label>
                        <button onClick={() => handleExport('xlsx')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                            <FiDownload/> Ekspor XLSX
                        </button>
                    </>
                )}
                <button onClick={() => handleExport('pdf')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><FiDownload/> Ekspor PDF</button>
                {currentUser.role === 'admin_desa' && (
                    <button onClick={() => handleOpenModal(null, 'edit')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <FiPlus/> Tambah Data
                    </button>
                )}
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Nama Lengkap</th>
                            <th className="px-6 py-3">Jabatan</th>
                            {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                            <th className="px-6 py-3">Status Data</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPerangkat.length > 0 ? filteredPerangkat.map((p) => (
                            <tr key={p.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4 font-medium flex items-center gap-3 text-gray-900 dark:text-white">
                                    <img src={p.foto_url || `https://ui-avatars.com/api/?name=${p.nama}&background=E2E8F0&color=4A5568`} alt={p.nama} className="w-10 h-10 rounded-full object-cover"/>
                                    <div>
                                        <p className="font-semibold">{p.nama}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.nik || 'NIK belum diisi'}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">{p.jabatan}</td>
                                {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{p.desa}</td>}
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${isDataLengkap(p) ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                                        {isDataLengkap(p) ? 'Lengkap' : 'Belum Lengkap'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 flex space-x-3">
                                    {currentUser.role === 'admin_kecamatan' && (
                                        <>
                                            <button onClick={() => handleOpenModal(p, 'view')} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" title="Lihat Detail"><FiEye /></button>
                                            <button onClick={() => handleOpenModal(p, 'edit')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Edit"><FiEdit /></button>
                                        </>
                                    )}
                                    {currentUser.role === 'admin_desa' && (
                                        <button onClick={() => handleOpenModal(p, 'edit')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Edit"><FiEdit /></button>
                                    )}
                                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Hapus"><FiTrash2 /></button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="text-center py-10 text-gray-500 dark:text-gray-400">Belum ada data perangkat.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalMode === 'edit' ? (selectedPerangkat ? 'Edit Data Perangkat' : 'Tambah Data Perangkat') : 'Detail Data Perangkat'}>
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
                                {modalMode === 'view' ? (
                                    <p className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md min-h-[42px] text-gray-800 dark:text-gray-200">{formData[key] || '-'}</p>
                                ) : (
                                    key === 'desa' ? (
                                        <select name={key} value={formData[key] || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2" required disabled={currentUser.role === 'admin_desa'}>
                                            <option value="">Pilih Desa</option>
                                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
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
                                )}
                            </div>
                        ))}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pendidikan Terakhir</label>
                            {modalMode === 'view' ? (
                                <p className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md min-h-[42px] text-gray-800 dark:text-gray-200">{formData.pendidikan || '-'}</p>
                            ) : (
                                <>
                                    <select name="pendidikan" value={formData.pendidikan || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2">
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
                                            className="mt-2 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2"
                                            required
                                        />
                                    )}
                                </>
                            )}
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
                            {modalMode === 'view' ? (
                                <p className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md min-h-[42px] text-gray-800 dark:text-gray-200">{selectedPerangkat?.jabatan || '-'}</p>
                            ) : (
                                <>
                                    <select name="jabatan" value={formData.jabatan || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2">
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
                                            className="mt-2 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2"
                                            required
                                        />
                                    )}
                                </>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Foto Profil</label>
                            {modalMode === 'view' ? (
                                formData.foto_url ? <img src={formData.foto_url} alt="Foto Profil" className="mt-2 h-24 w-24 object-cover rounded-md"/> : <p className="mt-1 text-gray-500 dark:text-gray-400">- Tidak ada foto -</p>
                            ) : (
                                <>
                                    <input type="file" onChange={(e) => setFotoProfilFile(e.target.files[0])} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                                    {formData.foto_url && <img src={formData.foto_url} alt="Foto Profil Saat Ini" className="mt-2 h-24 w-24 object-cover rounded-md"/>}
                                </>
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Foto KTP</label>
                            {modalMode === 'view' ? (
                                formData.ktp_url ? <img src={formData.ktp_url} alt="Foto KTP" className="mt-2 h-24 w-auto object-contain rounded-md"/> : <p className="mt-1 text-gray-500 dark:text-gray-400">- Tidak ada foto -</p>
                            ) : (
                                <>
                                    <input type="file" onChange={(e) => setFotoKtpFile(e.target.files[0])} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                                    {formData.ktp_url && <img src={formData.ktp_url} alt="Foto KTP Saat Ini" className="mt-2 h-24 w-auto object-contain rounded-md"/>}
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t mt-6 dark:border-gray-700">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md mr-2" disabled={isSubmitting}>Tutup</button>
                        {modalMode === 'edit' && (
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center" disabled={isSubmitting}>
                                {isSubmitting && <Spinner size="sm" />}
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        )}
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Perangkat;

