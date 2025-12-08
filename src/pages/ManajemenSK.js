import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
// [MODIFIKASI] Menggunakan komponen UI standar proyek agar konsisten
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField'; 
import Button from '../components/common/Button'; 
import { FiUpload, FiFileText, FiCheckCircle, FiAlertCircle, FiFolder, FiUser } from 'react-icons/fi';
import { uploadFileToGithub } from '../utils/githubService';
import { createNotificationForAdmins } from '../utils/notificationService';
import { DESA_LIST } from '../utils/constants';

// Konfigurasi untuk setiap tipe SK
const SK_CONFIG = {
    perangkat: { label: "Perangkat Desa", collectionName: "perangkat", folder: "sk_perangkat" },
    bpd: { label: "BPD", collectionName: "bpd", folder: "sk_bpd" },
    lpm: { label: "LPM", collectionName: "lpm", folder: "sk_lpm" },
    pkk: { label: "PKK", collectionName: "pkk", folder: "sk_pkk" },
    karang_taruna: { label: "Karang Taruna", collectionName: "karang_taruna", folder: "sk_karang_taruna" },
    rt_rw: { label: "RT/RW", collectionName: "rt_rw", folder: "sk_rt_rw" },
};

const ManajemenSK = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    
    const [skType, setSkType] = useState('perangkat');
    const [allEntities, setAllEntities] = useState([]);
    const [loadingEntities, setLoadingEntities] = useState(false);
    
    const [selectedDesa, setSelectedDesa] = useState(currentUser?.role === 'admin_desa' ? currentUser.desa : '');
    const [selectedEntity, setSelectedEntity] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Fetch data entitas (perangkat, bpd, dll) berdasarkan skType yang dipilih
    useEffect(() => {
        if (!skType) return;
        const config = SK_CONFIG[skType];
        if (!config) return;

        setLoadingEntities(true);
        const q = query(collection(db, config.collectionName));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAllEntities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoadingEntities(false);
        });

        return () => unsubscribe();
    }, [skType]);

    const entityListForUpload = useMemo(() => {
        if (!selectedDesa) return [];
        return allEntities.filter(p => p.desa === selectedDesa);
    }, [allEntities, selectedDesa]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.type === 'application/pdf') {
                // Validasi ukuran file (misal maks 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showNotification('Ukuran file terlalu besar (Maks 5MB).', 'error');
                    e.target.value = null;
                    setSelectedFile(null);
                } else {
                    setSelectedFile(file);
                }
            } else {
                showNotification('Hanya file PDF yang diizinkan.', 'error');
                e.target.value = null;
                setSelectedFile(null);
            }
        }
    };
    
    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedEntity || !selectedFile) {
            showNotification('Harap lengkapi semua pilihan dan pilih file SK.', 'error');
            return;
        }

        setIsUploading(true);

        try {
            const config = SK_CONFIG[skType];
            const entity = allEntities.find(p => p.id === selectedEntity);
            if (!entity) throw new Error('Data entitas tidak ditemukan.');
            
            const fileName = `${entity.desa}_${entity.nama.replace(/\s+/g, '_')}_${config.collectionName}_${Date.now()}.pdf`;
            
            // Panggil service untuk unggah ke GitHub
            const githubContent = await uploadFileToGithub(selectedFile, fileName, config.folder);

            const newDocRef = await addDoc(collection(db, 'efile'), {
                entityId: entity.id,
                entityName: entity.nama,
                skType: skType, // Menyimpan tipe SK
                desa: entity.desa,
                fileName: selectedFile.name,
                fileUrl: githubContent.download_url,
                githubPath: githubContent.path,
                githubSha: githubContent.sha,
                status: 'menunggu_verifikasi',
                uploadedAt: new Date(),
            });
            
             if (currentUser.role === 'admin_desa') {
                const message = `SK ${config.label} baru untuk ${entity.nama} (${entity.desa}) perlu verifikasi.`;
                
                // Link mengarah langsung ke Data SK dengan Highlight ID Dokumen
                const link = `/app/data-sk/${skType}?highlight=${newDocRef.id}`; 
                
                // Mengirim Notifikasi Tipe 'verifikasi_sk' dengan ID Dokumen
                await createNotificationForAdmins(
                    message,
                    link,
                    currentUser,
                    'verifikasi_sk', // Tipe trigger untuk tombol Verifikasi di Header
                    { 
                        docId: newDocRef.id, // ID Dokumen E-File untuk di update statusnya
                        entityName: entity.nama 
                    }
                );
            }

            showNotification('Dokumen SK berhasil diunggah.', 'success');
            // Reset form
            setSelectedEntity('');
            setSelectedFile(null);
            // Reset input file secara manual via ID form
            document.getElementById('file-upload-form').reset();

        } catch (error) {
            console.error("Upload error:", error);
            showNotification(`Gagal mengunggah file: ${error.message}`, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-24">
            
            {/* Header Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                    <FiFileText size={28} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Unggah SK Digital</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Unggah dan kelola Surat Keputusan (SK) untuk arsip digital desa.</p>
                </div>
            </div>
            
            {/* Form Section */}
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <form id="file-upload-form" onSubmit={handleUpload} className="space-y-8">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. Pilih Jenis SK */}
                        <div className="space-y-1">
                            <InputField
                                label="1. Jenis Dokumen SK"
                                type="select"
                                value={skType}
                                onChange={(e) => {
                                    setSkType(e.target.value);
                                    setSelectedEntity('');
                                }}
                                icon={<FiFolder />}
                            >
                                {Object.entries(SK_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key}>{config.label}</option>
                                ))}
                            </InputField>
                        </div>

                        {/* 2. Pilih Desa (Khusus Admin Kecamatan) */}
                        {currentUser.role === 'admin_kecamatan' ? (
                            <div className="space-y-1">
                                <InputField
                                    label="2. Asal Desa"
                                    type="select"
                                    value={selectedDesa}
                                    onChange={(e) => {
                                        setSelectedDesa(e.target.value);
                                        setSelectedEntity('');
                                    }}
                                    required
                                >
                                    <option value="">-- Pilih Desa --</option>
                                    {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                                </InputField>
                            </div>
                        ) : (
                            // Placeholder kosong agar grid tetap rapi di mode Admin Desa
                            <div className="hidden md:block"></div>
                        )}

                        {/* 3. Pilih Entitas (Personel) */}
                        <div className="md:col-span-2">
                             <InputField
                                label={`${currentUser.role === 'admin_kecamatan' ? '3.' : '2.'} Pilih Personel / Lembaga`}
                                type="select"
                                value={selectedEntity}
                                onChange={(e) => setSelectedEntity(e.target.value)}
                                required
                                disabled={!selectedDesa || loadingEntities}
                                icon={<FiUser />}
                                helpText={loadingEntities ? "Sedang memuat data..." : "Pilih nama personel atau lembaga pemilik SK."}
                            >
                                <option value="">
                                    {loadingEntities ? 'Memuat data...' : '-- Pilih Nama dari Daftar --'}
                                </option>
                                {entityListForUpload.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.nama} {p.jabatan ? `(${p.jabatan})` : p.nomor ? `(${p.nomor})` : ''}
                                    </option>
                                ))}
                            </InputField>
                        </div>
                    </div>

                    {/* 4. Area Upload File */}
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                            {currentUser.role === 'admin_kecamatan' ? '4.' : '3.'} Unggah File SK (PDF)
                        </label>
                        
                        <div className={`mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-all duration-200 relative group
                            ${selectedFile 
                                ? 'border-green-400 bg-green-50 dark:bg-green-900/10' 
                                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-blue-400'
                            }`}
                        >
                            <div className="space-y-2 text-center">
                                {selectedFile ? (
                                    <div className="flex flex-col items-center animate-fadeIn">
                                        <FiCheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {selectedFile.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                        <p className="text-xs text-green-600 font-semibold mt-2">File siap diunggah</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mx-auto h-12 w-12 text-gray-400 group-hover:text-blue-500 transition-colors">
                                            <FiUpload size={48} />
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-bold text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-2">
                                                <span>Klik untuk pilih file</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="application/pdf" required />
                                            </label>
                                            <span className="pl-1">atau seret ke sini</span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-500">
                                            Format PDF, Maksimal 5MB
                                        </p>
                                    </>
                                )}
                            </div>
                            
                            {/* Tombol ganti file jika sudah ada file terpilih */}
                            {selectedFile && (
                                <label htmlFor="file-upload" className="absolute top-2 right-2 p-1.5 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" title="Ganti File">
                                     <FiAlertCircle className="text-gray-600 dark:text-gray-300" />
                                </label>
                            )}
                        </div>
                    </div>
                
                    {/* Submit Button */}
                    <div className="pt-4 border-t dark:border-gray-700">
                        <Button 
                            type="submit" 
                            disabled={isUploading || !selectedFile || !selectedEntity} 
                            variant="primary" 
                            className="w-full py-3 flex justify-center items-center gap-2 text-base shadow-lg hover:shadow-xl transform active:scale-95 transition-all"
                        >
                            {isUploading ? <Spinner size="sm" color="white" /> : <><FiUpload className="text-lg" /> Simpan & Unggah SK</>}
                        </Button>
                        <p className="text-center text-xs text-gray-400 mt-3">
                            Pastikan data yang dipilih sudah benar sebelum mengunggah.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManajemenSK;