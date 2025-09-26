import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { FiSave, FiInfo } from 'react-icons/fi';

const PengaturanBPD = () => {
    const [config, setConfig] = useState({
        desa: '',
        nama: '',
        no_sk_bupati: '',
        tgl_sk_bupati: '',
        periode: '',
        jabatan: '',
        nama_lengkap: '',
        nik: '',
        tempat_lahir: '',
        tgl_lahir: '',
        pekerjaan: '',
        pendidikan: '',
        agama: '',
        rt: '',
        rw: '',
        no_hp: ''
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchConfig = async () => {
            setLoading(true);
            const docRef = doc(db, 'settings', 'bpdUploadConfig');
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    // Pastikan semua key ada di state, bahkan jika tidak ada di DB
                    const dbData = docSnap.data();
                    const completeConfig = { ...config, ...dbData };
                    setConfig(completeConfig);
                }
            } catch (error) {
                console.error("Gagal memuat konfigurasi BPD:", error);
                showNotification("Gagal memuat konfigurasi dari database.", "error");
            }
            setLoading(false);
        };
        fetchConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showNotification]);

    const handleChange = (e) => {
        setConfig({
            ...config,
            [e.target.name]: e.target.value
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'bpdUploadConfig'), config, { merge: true });
            showNotification('Pengaturan format upload data BPD berhasil disimpan!', 'success');
        } catch (error) {
            console.error("Error saving config: ", error);
            showNotification('Gagal menyimpan pengaturan.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <Spinner size="lg" />;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-colors duration-300">
            <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">Pengaturan Impor Excel BPD</h1>
            <div className="flex items-start p-4 mb-6 text-sm text-blue-800 rounded-lg bg-blue-50 dark:bg-gray-700 dark:text-blue-300" role="alert">
                <FiInfo className="flex-shrink-0 inline w-5 h-5 mr-3" />
                <div>
                    <span className="font-medium">Penting!</span> Atur nama kolom agar sesuai persis dengan header di file Excel Anda. Ini akan digunakan untuk memetakan data saat impor. Kosongkan field jika kolom tersebut tidak ada di file Anda.
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.keys(config).map(key => (
                        <InputField
                            key={key}
                            label={key.replace(/_/g, ' ')}
                            name={key}
                            value={config[key]}
                            onChange={handleChange}
                            placeholder={`Contoh: ${key.replace(/_/g, ' ').toUpperCase()}`}
                        />
                    ))}
                </div>
                <div className="col-span-full flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2" disabled={isSaving}>
                        {isSaving ? <Spinner size="sm" /> : <FiSave />}
                        {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PengaturanBPD;

