import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Spinner from '../components/common/Spinner';
import { FiUpload } from 'react-icons/fi';
import { uploadFileToGithub } from '../utils/githubService';
import { createNotificationForAdmins } from '../utils/notificationService';
// [PERBAIKAN] Impor DESA_LIST yang hilang
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
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
        } else {
            showNotification('Hanya file PDF yang diizinkan.', 'error');
            e.target.value = null;
            setSelectedFile(null);
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
            
            const fileName = `${entity.desa}_${entity.nama.replace(/\s/g, '_')}_${config.collectionName}_${Date.now()}.pdf`;
            
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
                const message = `SK ${config.label} baru untuk ${entity.nama} (${entity.desa}) telah diunggah.`;
                const link = `/app/data-sk/${skType}?highlight=${newDocRef.id}`;
                await createNotificationForAdmins(message, link, currentUser);
            }

            showNotification('Dokumen SK berhasil diunggah.', 'success');
            // Reset form
            setSelectedEntity('');
            setSelectedFile(null);
            document.getElementById('file-upload-form').reset();

        } catch (error) {
            console.error("Upload error:", error);
            showNotification(`Gagal mengunggah file: ${error.message}`, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <p className="text-gray-600 dark:text-gray-400 mb-6">Pilih jenis SK dan unggah file PDF yang sesuai.</p>
            
            <form id="file-upload-form" onSubmit={handleUpload} className="space-y-6 max-w-xl">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">1. Pilih Jenis SK</label>
                    <select value={skType} onChange={(e) => {setSkType(e.target.value); setSelectedEntity('');}} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required>
                        {Object.entries(SK_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                        ))}
                    </select>
                </div>

                {currentUser.role === 'admin_kecamatan' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">2. Pilih Desa</label>
                        <select value={selectedDesa} onChange={(e) => {setSelectedDesa(e.target.value); setSelectedEntity('');}} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required>
                            <option value="">-- Pilih Desa --</option>
                            {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{currentUser.role === 'admin_kecamatan' ? '3.' : '2.'} Pilih Personel / Lembaga</label>
                    <select value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required disabled={!selectedDesa || loadingEntities}>
                        <option value="">-- {loadingEntities ? 'Memuat...' : 'Pilih dari daftar'} --</option>
                        {entityListForUpload.map(p => <option key={p.id} value={p.id}>{p.nama} - {p.jabatan || p.nomor}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{currentUser.role === 'admin_kecamatan' ? '4.' : '3.'} Pilih File SK (Format PDF)</label>
                    <input type="file" onChange={handleFileChange} accept="application/pdf" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800" required />
                </div>
                
                <div>
                    <button type="submit" disabled={isUploading} className="w-full flex justify-center items-center px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                        {isUploading ? <Spinner size="sm" /> : <><FiUpload className="mr-2" /> Unggah File SK</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ManajemenSK;

