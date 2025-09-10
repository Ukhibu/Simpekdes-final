import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { FiSave, FiInfo } from 'react-icons/fi';

const PengaturanBPD = () => {
    const [config, setConfig] = useState({
        nama: '', 
        // NIK dihapus dari sini
        jabatan: '', desa: '', periode: '', no_sk_bupati: '',
        tgl_sk_bupati: '', tgl_pelantikan: '', wil_pmlhn: '', tempat_lahir: '',
        tgl_lahir: '', pekerjaan: '', pendidikan: '', agama: '', rt: '', rw: '', no_hp: ''
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            const docRef = doc(db, 'settings', 'bpdUploadConfig');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setConfig(prevConfig => ({ ...prevConfig, ...docSnap.data() }));
            }
            setLoading(false);
        };
        fetchConfig();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prevConfig => ({ ...prevConfig, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'bpdUploadConfig'), config, { merge: true });
            alert('Pengaturan format upload data BPD berhasil disimpan!');
        } catch (error) {
            console.error("Error saving config: ", error);
            alert('Gagal menyimpan pengaturan.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Setelan Format Upload Data BPD</h1>
            
            <div className="bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-500 text-blue-700 dark:text-blue-300 p-4 mb-6 rounded-md" role="alert">
                <div className="flex">
                    <div className="py-1"><FiInfo className="h-5 w-5 mr-3"/></div>
                    <div>
                        <p className="font-bold">Petunjuk Penggunaan</p>
                        <p className="text-sm">
                            Isi setiap bidang di bawah ini dengan nama header kolom yang **sama persis** seperti yang ada di file Excel Anda. 
                            Contoh: jika di database nama field-nya `no_sk_bupati` dan di Excel Anda nama kolomnya adalah "Nomor SK Pengangkatan", maka isilah bidang "No. SK Bupati" dengan "Nomor SK Pengangkatan".
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <InputField label="Nama Lengkap" name="nama" value={config.nama} onChange={handleChange} placeholder="NAMA" required />
                    {/* Input NIK dihapus dari sini */}
                    <InputField label="Jabatan" name="jabatan" value={config.jabatan} onChange={handleChange} placeholder="Jabatan" />
                    <InputField label="Desa" name="desa" value={config.desa} onChange={handleChange} placeholder="ALAMAT" />
                    <InputField label="Periode" name="periode" value={config.periode} onChange={handleChange} placeholder="PERIODE" />
                    <InputField label="No. SK Bupati" name="no_sk_bupati" value={config.no_sk_bupati} onChange={handleChange} placeholder="NO. SK Bupati" required />
                    <InputField label="Tgl. SK Bupati" name="tgl_sk_bupati" value={config.tgl_sk_bupati} onChange={handleChange} placeholder="Tgl. SK Bupati" />
                    <InputField label="Tgl Pelantikan" name="tgl_pelantikan" value={config.tgl_pelantikan} onChange={handleChange} placeholder="Tgl Pelantikan/Pengambilan Sumpah" />
                    <InputField label="Wilayah Pemilihan" name="wil_pmlhn" value={config.wil_pmlhn} onChange={handleChange} placeholder="Wil Pmlhn" />
                    <InputField label="Tempat Lahir" name="tempat_lahir" value={config.tempat_lahir} onChange={handleChange} placeholder="Tempat Lahir" />
                    <InputField label="Tgl Lahir" name="tgl_lahir" value={config.tgl_lahir} onChange={handleChange} placeholder="Tgl Lahir" />
                    <InputField label="Pekerjaan" name="pekerjaan" value={config.pekerjaan} onChange={handleChange} placeholder="Pekerjaan" />
                    <InputField label="Pendidikan" name="pendidikan" value={config.pendidikan} onChange={handleChange} placeholder="Pendidikan" />
                    <InputField label="Agama" name="agama" value={config.agama} onChange={handleChange} placeholder="Agama" />
                    <InputField label="RT" name="rt" value={config.rt} onChange={handleChange} placeholder="RT" />
                    <InputField label="RW" name="rw" value={config.rw} onChange={handleChange} placeholder="RW" />
                    <InputField label="No. HP / WA" name="no_hp" value={config.no_hp} onChange={handleChange} placeholder="No. HP / WA" />
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center" disabled={isSaving}>
                        {isSaving ? <Spinner size="sm" /> : <FiSave className="mr-2"/>}
                        {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PengaturanBPD;

