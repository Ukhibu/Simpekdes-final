import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import Spinner from '../components/common/Spinner';
// --- PERBAIKAN: Mengimpor fungsi uploader dari file utilitas ---
import { uploadImageToCloudinary } from '../utils/imageUploader';

const PengaturanAplikasi = () => {
    const [activeTab, setActiveTab] = useState('branding');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { showNotification } = useNotification();

    const [brandingConfig, setBrandingConfig] = useState({});
    const [exportConfig, setExportConfig] = useState({});
    
    const [logoFile, setLogoFile] = useState(null);
    const [backgroundFile, setBackgroundFile] = useState(null);

    useEffect(() => {
        const fetchConfigs = async () => {
            setLoading(true);
            try {
                const brandingRef = doc(db, 'settings', 'branding');
                const exportRef = doc(db, 'settings', 'exportConfig');

                const [brandingSnap, exportSnap] = await Promise.all([
                    getDoc(brandingRef),
                    getDoc(exportRef)
                ]);

                setBrandingConfig(brandingSnap.exists() ? brandingSnap.data() : { appName: 'SIMPEKDES', loginTitle: 'Sistem Informasi', loginSubtitle: 'Kecamatan Punggelan' });
                setExportConfig(exportSnap.exists() ? exportSnap.data() : { namaPenandaTangan: 'NAMA CAMAT', jabatanPenandaTangan: 'Camat Punggelan' });

            } catch (error) {
                console.error("Gagal memuat konfigurasi:", error);
                showNotification("Gagal memuat konfigurasi dari database.", 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchConfigs();
    }, [showNotification]);

    const handleFileChange = (e, type) => {
        if (e.target.files[0]) {
            if (type === 'logo') setLogoFile(e.target.files[0]);
            if (type === 'background') setBackgroundFile(e.target.files[0]);
        }
    };

    const handleSave = async (configType) => {
        setIsSaving(true);
        let configData;
        let docRef;

        try {
            if (configType === 'branding') {
                configData = { ...brandingConfig };
                
                const logoUrl = await uploadImageToCloudinary(logoFile);
                if (logoUrl) configData.loginLogoUrl = logoUrl;

                const backgroundUrl = await uploadImageToCloudinary(backgroundFile);
                if (backgroundUrl) configData.hubBackgroundUrl = backgroundUrl;
                
                docRef = doc(db, 'settings', 'branding');
                await setDoc(docRef, configData, { merge: true });
                
                setBrandingConfig(configData);
                setLogoFile(null);
                setBackgroundFile(null);

            } else if (configType === 'export') {
                configData = exportConfig;
                docRef = doc(db, 'settings', 'exportConfig');
                await setDoc(docRef, configData, { merge: true });
            }

            showNotification(`Pengaturan ${configType} berhasil disimpan! Perubahan mungkin memerlukan refresh halaman.`, 'success');
        } catch (error) {
            console.error("Error saving settings:", error);
            showNotification(`Gagal menyimpan pengaturan: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <Spinner size="lg" />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-colors duration-300">    
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('branding')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'branding' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        Tampilan & Branding
                    </button>
                    <button onClick={() => setActiveTab('export')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'export' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        Pengaturan Ekspor
                    </button>
                </nav>
            </div>

            <div>
                {activeTab === 'branding' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pengaturan Tampilan & Branding</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Aplikasi</label>
                            <input type="text" value={brandingConfig.appName || ''} onChange={(e) => setBrandingConfig({...brandingConfig, appName: e.target.value})} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Judul di Halaman Login</label>
                            <input type="text" value={brandingConfig.loginTitle || ''} onChange={(e) => setBrandingConfig({...brandingConfig, loginTitle: e.target.value})} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sub-judul di Halaman Login</label>
                            <input type="text" value={brandingConfig.loginSubtitle || ''} onChange={(e) => setBrandingConfig({...brandingConfig, loginSubtitle: e.target.value})} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Logo Aplikasi (di Halaman Login)</label>
                            <div className="mt-2 flex items-center space-x-4">
                                <img src={brandingConfig.loginLogoUrl || 'https://placehold.co/80x80?text=Logo'} alt="Current Logo" className="w-20 h-20 rounded-md bg-gray-100 dark:bg-gray-700 object-contain" />
                                <input type="file" onChange={(e) => handleFileChange(e, 'logo')} accept="image/*" className="text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gambar Latar Belakang (di Halaman Hub Utama)</label>
                            <div className="mt-2 flex items-center space-x-4">
                                <img src={brandingConfig.hubBackgroundUrl || 'https://placehold.co/120x80?text=Background'} alt="Current Background" className="w-32 h-20 rounded-md bg-gray-100 dark:bg-gray-700 object-cover" />
                                <input type="file" onChange={(e) => handleFileChange(e, 'background')} accept="image/*" className="text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => handleSave('branding')} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md">{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Branding'}</button>
                        </div>
                    </div>
                )}

                {activeTab === 'export' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pengaturan Tanda Tangan Ekspor PDF</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Teks ini akan muncul di bagian bawah setiap dokumen PDF yang diekspor.</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Penanda Tangan</label>
                            <input type="text" value={exportConfig.namaPenandaTangan || ''} onChange={(e) => setExportConfig({...exportConfig, namaPenandaTangan: e.target.value})} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Jabatan</label>
                            <input type="text" value={exportConfig.jabatanPenandaTangan || ''} onChange={(e) => setExportConfig({...exportConfig, jabatanPenandaTangan: e.target.value})} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pangkat / Golongan</label>
                            <input type="text" value={exportConfig.pangkatPenandaTangan || ''} onChange={(e) => setExportConfig({...exportConfig, pangkatPenandaTangan: e.target.value})} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NIP</label>
                            <input type="text" value={exportConfig.nipPenandaTangan || ''} onChange={(e) => setExportConfig({...exportConfig, nipPenandaTangan: e.target.value})} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"/>
                        </div>
                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => handleSave('export')} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md">{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Ekspor'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PengaturanAplikasi;
