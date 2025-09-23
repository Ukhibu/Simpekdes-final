import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Spinner from '../components/common/Spinner';

// Disamakan dengan header dan mapping import di Perangkat.js
const INTERNAL_FIELDS = {
    desa: 'Desa',
    nama: 'Nama Lengkap',
    jabatan: 'Jabatan',
    tempat_lahir: 'Tempat Lahir',
    tgl_lahir: 'Tanggal Lahir',
    no_sk: 'Nomor SK',
    tgl_sk: 'Tanggal SK',
    tgl_pelantikan: 'Tanggal Pelantikan',
    akhir_jabatan: 'Akhir Masa Jabatan',
    no_hp: 'No. HP / WA',
    nik: 'NIK',
    nip: 'NIP/NIPD',
    jenis_kelamin_l: 'Laki-laki (Kolom Centang/1)',
    jenis_kelamin_p: 'Perempuan (Kolom Centang/1)',
    pendidikan_sd: 'Pendidikan SD',
    pendidikan_sltp: 'Pendidikan SLTP',
    pendidikan_slta: 'Pendidikan SLTA',
    pendidikan_d1: 'Pendidikan D1',
    pendidikan_d2: 'Pendidikan D2',
    pendidikan_d3: 'Pendidikan D3',
    pendidikan_s1: 'Pendidikan S1',
    pendidikan_s2: 'Pendidikan S2',
    pendidikan_s3: 'Pendidikan S3',
};

const PengaturanAplikasi = () => {
    const [activeTab, setActiveTab] = useState('branding');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [brandingConfig, setBrandingConfig] = useState({});
    const [exportConfig, setExportConfig] = useState({});
    const [uploadConfig, setUploadConfig] = useState({});
    
    const [logoFile, setLogoFile] = useState(null);

    useEffect(() => {
        const fetchConfigs = async () => {
            setLoading(true);
            try {
                const brandingRef = doc(db, 'settings', 'branding');
                const exportRef = doc(db, 'settings', 'exportConfig');
                const uploadRef = doc(db, 'settings', 'uploadConfig');

                const [brandingSnap, exportSnap, uploadSnap] = await Promise.all([
                    getDoc(brandingRef),
                    getDoc(exportRef),
                    getDoc(uploadRef)
                ]);

                setBrandingConfig(brandingSnap.exists() ? brandingSnap.data() : { appName: 'SIMPEKDES', loginTitle: 'Sistem Informasi', loginSubtitle: 'Kecamatan Punggelan' });
                setExportConfig(exportSnap.exists() ? exportSnap.data() : { namaPenandaTangan: 'NAMA CAMAT', jabatanPenandaTangan: 'Camat Punggelan' });
                setUploadConfig(uploadSnap.exists() ? uploadSnap.data() : {});

            } catch (error) {
                console.error("Gagal memuat konfigurasi:", error);
                alert("Gagal memuat konfigurasi dari database.");
            } finally {
                setLoading(false);
            }
        };
        fetchConfigs();
    }, []);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setLogoFile(e.target.files[0]);
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
                    const cloudinaryFormData = new FormData();
                    cloudinaryFormData.append('file', logoFile);
                    cloudinaryFormData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

                    const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`, {
                        method: 'POST',
                        body: cloudinaryFormData,
                    });
                    const data = await response.json();
                    if (data.secure_url) {
                        configData.loginLogoUrl = data.secure_url;
                    } else {
                        throw new Error('Upload logo ke Cloudinary gagal.');
                    }
                }
                docRef = doc(db, 'settings', 'branding');
                await setDoc(docRef, configData, { merge: true });
                setBrandingConfig(configData);
                setLogoFile(null);

            } else if (configType === 'export') {
                configData = exportConfig;
                docRef = doc(db, 'settings', 'exportConfig');
                await setDoc(docRef, configData, { merge: true });

            } else if (configType === 'upload') {
                configData = uploadConfig;
                docRef = doc(db, 'settings', 'uploadConfig');
                await setDoc(docRef, configData, { merge: true });
            }

            alert(`Pengaturan ${configType} berhasil disimpan!`);
        } catch (error) {
            console.error("Error saving settings:", error);
            alert(`Gagal menyimpan pengaturan: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <Spinner size="lg" />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-colors duration-300">
            <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Pengaturan Aplikasi</h1>
            
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('branding')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'branding' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        Tampilan & Branding
                    </button>
                    <button onClick={() => setActiveTab('export')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'export' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        Pengaturan Ekspor
                    </button>
                    <button onClick={() => setActiveTab('upload')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'upload' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                        Format Upload
                    </button>
                </nav>
            </div>

            <div>
                {activeTab === 'branding' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pengaturan Tampilan & Branding</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Logo Aplikasi (di Halaman Login)</label>
                            <div className="mt-2 flex items-center space-x-4">
                                <img src={brandingConfig.loginLogoUrl || 'https://placehold.co/80x80?text=Logo'} alt="Current Logo" className="w-20 h-20 rounded-md bg-gray-100 dark:bg-gray-700 object-contain" />
                                <input type="file" onChange={handleFileChange} accept="image/*" className="text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                            </div>
                        </div>
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

                {activeTab === 'upload' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pemetaan Kolom Upload</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Isi kolom kanan dengan nama header yang **persis** ada di file upload Anda (Excel, CSV, atau key di JSON).</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {Object.entries(INTERNAL_FIELDS).map(([key, label]) => (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label} <span className="text-gray-400">({key})</span></label>
                                    <input type="text" value={uploadConfig[key] || ''} onChange={(e) => setUploadConfig({...uploadConfig, [key]: e.target.value})} className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"/>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => handleSave('upload')} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md">{isSaving ? 'Menyimpan...' : 'Simpan Format Upload'}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PengaturanAplikasi;
