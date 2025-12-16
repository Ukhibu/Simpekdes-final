import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import Spinner from '../components/common/Spinner';
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
    
    const [logoPreview, setLogoPreview] = useState(null);
    const [backgroundPreview, setBackgroundPreview] = useState(null);

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

                setBrandingConfig(brandingSnap.exists() ? brandingSnap.data() : { 
                    appName: 'SIMPEKDES', 
                    loginTitle: 'Sistem Informasi', 
                    loginSubtitle: 'Kecamatan Punggelan' 
                });
                setExportConfig(exportSnap.exists() ? exportSnap.data() : { 
                    namaPenandaTangan: 'NAMA CAMAT', 
                    jabatanPenandaTangan: 'Camat Punggelan' 
                });

            } catch (error) {
                console.error("Gagal memuat konfigurasi:", error);
                showNotification("Gagal memuat konfigurasi dari database.", 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchConfigs();
    }, [showNotification]);

    // --- PERBAIKAN LOGIKA PROSES GAMBAR ---
    const processImageToHD_PNG = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    
                    // Pertahankan resolusi tinggi (Max 1024px)
                    const MAX_WIDTH = 1024; 
                    const MAX_HEIGHT = 1024;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // PENTING: { alpha: true } memaksa canvas mendukung transparansi
                    const ctx = canvas.getContext('2d', { alpha: true });

                    // Bersihkan canvas sepenuhnya sebelum menggambar (mencegah artefak hitam)
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Gambar ulang image ke canvas
                    ctx.drawImage(img, 0, 0, width, height);

                    // Konversi ke Blob PNG
                    canvas.toBlob((blob) => {
                        if (blob) {
                            // Buat file baru dengan nama .png untuk memastikan upload ke Cloudinary dianggap PNG
                            const newFile = new File([blob], "logo_transparent.png", { type: "image/png" });
                            resolve(newFile);
                        } else {
                            reject(new Error("Gagal mengonversi canvas ke blob"));
                        }
                    }, 'image/png', 1.0);
                };
                
                img.onerror = (err) => reject(err);
            };
            
            reader.onerror = (err) => reject(err);
        });
    };

    const handleFileChange = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            if (type === 'logo') {
                // Proses konversi PNG Transparan
                const processedPngFile = await processImageToHD_PNG(file);
                
                setLogoFile(processedPngFile);
                setLogoPreview(URL.createObjectURL(processedPngFile));
                showNotification("Logo berhasil diproses menjadi PNG Transparan.", "success");
            } 
            else if (type === 'background') {
                setBackgroundFile(file);
                setBackgroundPreview(URL.createObjectURL(file));
            }
        } catch (error) {
            console.error("Gagal memproses gambar:", error);
            showNotification("Gagal memproses gambar.", "error");
        }
    };

    const handleSave = async (configType) => {
        setIsSaving(true);
        let configData;
        let docRef;

        try {
            if (configType === 'branding') {
                configData = { ...brandingConfig };
                
                if (logoFile) {
                    const logoUrl = await uploadImageToCloudinary(
                        logoFile, 
                        process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET1, 
                        process.env.REACT_APP_CLOUDINARY_CLOUD_NAME1
                    );
                    if (logoUrl) configData.loginLogoUrl = logoUrl;
                }

                if (backgroundFile) {
                    const backgroundUrl = await uploadImageToCloudinary(
                        backgroundFile, 
                        process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET2, 
                        process.env.REACT_APP_CLOUDINARY_CLOUD_NAME2
                    );
                    if (backgroundUrl) configData.hubBackgroundUrl = backgroundUrl;
                }
                
                docRef = doc(db, 'settings', 'branding');
                await setDoc(docRef, configData, { merge: true });
                
                setBrandingConfig(configData);
                setLogoFile(null);
                setLogoPreview(null);
                setBackgroundFile(null);
                setBackgroundPreview(null);

            } else if (configType === 'export') {
                configData = exportConfig;
                docRef = doc(db, 'settings', 'exportConfig');
                await setDoc(docRef, configData, { merge: true });
            }

            showNotification(`Pengaturan ${configType} berhasil disimpan!`, 'success');
        } catch (error) {
            console.error("Error saving settings:", error);
            showNotification(`Gagal menyimpan: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <Spinner size="lg" />;

    // Style untuk background checkerboard (kotak-kotak transparan)
    const transparentPatternStyle = {
        backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
    };

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
                        
                        {/* INPUT LOGO */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Logo Aplikasi (Auto PNG Transparent)</label>
                            <div className="mt-2 flex items-center space-x-4">
                                {/* Kotak Preview dengan Background Checkerboard untuk membuktikan transparansi */}
                                <div 
                                    className="relative group w-24 h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center overflow-hidden bg-white"
                                    style={transparentPatternStyle}
                                >
                                    <img 
                                        src={logoPreview || brandingConfig.loginLogoUrl || 'https://placehold.co/80x80?text=Logo'} 
                                        alt="Current Logo" 
                                        className="w-full h-full object-contain p-2 relative z-10" 
                                    />
                                </div>
                                <input type="file" onChange={(e) => handleFileChange(e, 'logo')} accept="image/*" className="text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Preview di atas menggunakan background kotak-kotak. Jika Anda melihat kotak-kotak di belakang logo, berarti logo tersebut <strong>sudah transparan</strong>.
                            </p>
                        </div>

                        {/* INPUT BACKGROUND */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gambar Latar Belakang (Hub Utama)</label>
                            <div className="mt-2 flex items-center space-x-4">
                                <img src={backgroundPreview || brandingConfig.hubBackgroundUrl || 'https://placehold.co/120x80?text=Background'} alt="Current Background" className="w-32 h-20 rounded-md bg-gray-100 dark:bg-gray-700 object-cover" />
                                <input type="file" onChange={(e) => handleFileChange(e, 'background')} accept="image/*" className="text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => handleSave('branding')} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center hover:bg-blue-700 transition-colors">
                                {isSaving && <Spinner size="sm" />}
                                {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Branding'}
                            </button>
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
                            <button onClick={() => handleSave('export')} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center hover:bg-blue-700 transition-colors">
                                {isSaving && <Spinner size="sm" />}
                                {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Ekspor'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PengaturanAplikasi;