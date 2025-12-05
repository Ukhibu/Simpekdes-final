import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import BeritaAcaraPreview from '../components/bpd/BeritaAcaraPreview';
import { FiPrinter, FiSave, FiDownload, FiImage, FiRefreshCw, FiUploadCloud } from 'react-icons/fi';
import { formatDate } from '../utils/dateFormatter';
import html2pdf from 'html2pdf.js';
import defaultFrame from '../assets/berita-acara-frame.png'; // Import gambar default
import '../styles/BeritaAcara.css';

const DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

// Template default untuk konten berita acara
const generateInitialContent = (bpd, config) => {
    if (!bpd || !config) return "";

    const pelantikanDate = bpd.tgl_pelantikan ? formatDate(bpd.tgl_pelantikan, 'long') : '[Hari, Tanggal, Bulan, Tahun]';
    const skDate = bpd.tgl_sk_bupati ? formatDate(bpd.tgl_sk_bupati, 'long-dayless') : '[Tanggal SK Bupati]';
    
    const namaLengkap = `${bpd.nama || '[Nama Anggota BPD]'}${bpd.gelar ? `, ${bpd.gelar}` : ''}`;
    const saksi1Nama = `${config.saksi1Nama || '[Nama Saksi 1]'}${config.saksi1Gelar ? `, ${config.saksi1Gelar}` : ''}`;
    const saksi2Nama = `${config.saksi2Nama || '[Nama Saksi 2]'}${config.saksi2Gelar ? `, ${config.saksi2Gelar}` : ''}`;

    return `Pada hari ini ${pelantikanDate}, dengan mengambil tempat di Aula Kantor Kecamatan Punggelan, saya, nama ${config.pejabatNama || '[Nama Pejabat]'} Jabatan ${config.pejabatJabatan || '[Jabatan Pejabat]'} Kabupaten Banjarnegara berdasarkan Peraturan Bupati Banjarnegara Nomor 29 Tahun 2018 tentang Petunjuk Pelaksanaan Peraturan Daerah Kabupaten Banjarnegara Nomor 18 Tahun 2017 tentang Badan Permusyawaratan Desa, dengan disaksikan oleh 2 (dua) saksi masing-masing:

1. Nama    : ${saksi1Nama}
   Jabatan  : ${config.saksi1Jabatan || '[Jabatan Saksi 1]'}

2. Nama    : ${saksi2Nama}
   Jabatan  : ${config.saksi2Jabatan || '[Jabatan Saksi 2]'}

Telah mengambil sumpah Jabatan Anggota Badan Permusyawaratan Desa nama ${namaLengkap} yang dengan Keputusan Bupati Banjarnegara NOMOR: ${bpd.no_sk_bupati || '[Nomor SK Bupati]'} Tanggal ${skDate} diangkat dalam Jabatan sebagai Anggota Badan Permusyawaratan Desa Aula Kantor Kecamatan Punggelan Kecamatan Punggelan Kabupaten Banjarnegara Periode Tahun ${bpd.periode || '[Periode]'}.

Anggota Badan Permusyawaratan Desa yang mengangkat sumpah jabatan tersebut didampingi oleh seorang Rohaniawan, nama ${config.rohaniawanNama || '[Nama Rohaniawan]'} NIP. ${config.rohaniawanNip || '[NIP Rohaniawan]'} Jabatan ${config.rohaniawanJabatan || '[Jabatan Rohaniawan]'}.

Anggota Badan Permusyawaratan Desa yang mengangkat sumpah jabatan tersebut mengucapkan sumpah jabatan Anggota Badan Permusyawaratan Desa Aula Kantor Kecamatan Punggelan sebagai berikut:

"Demi Allah saya bersumpah;
- Bahwa saya, akan memenuhi kewajiban saya selaku Anggota Badan Permusyawaratan Desa dengan sebaik-baiknya, sejujur-jujurnya dan seadil-adilnya;
- Bahwa saya, akan selalu taat dalam mengamalkan dan mempertahankan pancasila sebagai dasar
- Dan bahwa saya akan menegakkan kehidupan demokrasi dan Undang-Undang Dasar Negara Republik Indonesia Tahun 1945 serta melaksanakan segala peraturan perundang-undangan dengan selurus-lurusnya yang berlaku bagi Desa, Daerah dan Negara Kesatuan Republik Indonesia;

Demikian berita acara pengambilan sumpah jabatan ini dibuat dengan sebenar-benarnya untuk dapat digunakan sebagaimana mestinya.`;
};

const BeritaAcaraBPDPage = () => {
    const { currentUser } = useAuth();
    const [bpdList, setBpdList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDesa, setSelectedDesa] = useState(currentUser?.role === 'admin_desa' ? currentUser.desa : '');
    const [selectedBpd, setSelectedBpd] = useState(null);
    const [documentContent, setDocumentContent] = useState('');
    const [config, setConfig] = useState({});
    const [isEditingConfig, setIsEditingConfig] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingFrame, setIsUploadingFrame] = useState(false); // State untuk loading upload gambar

    // Fetch BPD data based on selected village
    useEffect(() => {
        if (!currentUser || !selectedDesa) {
            setBpdList([]);
            return;
        }
        
        const bpdCollection = collection(db, 'bpd');
        const q = query(bpdCollection, where("desa", "==", selectedDesa));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setBpdList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [currentUser, selectedDesa]);

    // Fetch configuration data
    useEffect(() => {
        const fetchConfig = async () => {
            setLoading(true);
            const docRef = doc(db, 'settings', 'beritaAcaraBpdConfig');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Pastikan frameUrl ada, jika tidak pakai default
                setConfig({
                    ...data,
                    frameUrl: data.frameUrl || defaultFrame
                });
            } else {
                setConfig({
                    nomor: '140 / 1502 / TAHUN 2023',
                    saksi1Nama: 'Ikin Suhendro, S.Sos',
                    saksi1Jabatan: 'Jabatan Kepala Seksi Trantibum & Pelayanan Kec. Punggelan',
                    saksi2Nama: 'Teguh Julianto, S.Sos',
                    saksi2Jabatan: 'Jabatan Kepala Seksi Tata Pemerintahan Kec. Punggelan',
                    pejabatNama: 'Moh. Julianto, S.E, M.Si.',
                    pejabatJabatan: 'Camat Punggelan',
                    rohaniawanNama: 'IKHWAN',
                    rohaniawanNip: '196701198703 1 011',
                    rohaniawanJabatan: 'Pengadministrasi Umum Kantor Kecamatan Punggelan',
                    frameUrl: defaultFrame // Default jika belum ada config
                });
            }
            setLoading(false);
        };
        fetchConfig();
    }, []);

    // Update document content when data changes
    useEffect(() => {
        if (selectedBpd && config) {
            setDocumentContent(generateInitialContent(selectedBpd, config));
        } else {
            setDocumentContent("");
        }
    }, [selectedBpd, config]);
    
    const handleConfigChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    // --- LOGIKA UPLOAD KE CLOUDINARY ---
    const handleFrameUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validasi tipe file (harus gambar)
        if (!file.type.startsWith('image/')) {
            alert("Mohon unggah file gambar (JPG/PNG).");
            return;
        }

        setIsUploadingFrame(true);
        const formData = new FormData();
        formData.append('file', file);
        // Gunakan environment variables untuk keamanan (pastikan sudah diset di .env)
        formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET); 
        formData.append('cloud_name', process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);

        try {
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
                {
                    method: 'POST',
                    body: formData,
                }
            );

            const data = await response.json();
            if (data.secure_url) {
                // Update state config dengan URL baru
                setConfig(prev => ({ ...prev, frameUrl: data.secure_url }));
                // Otomatis simpan URL baru ke database agar permanen
                await setDoc(doc(db, 'settings', 'beritaAcaraBpdConfig'), { ...config, frameUrl: data.secure_url });
                alert("Bingkai berhasil diperbarui!");
            } else {
                throw new Error("Gagal mendapatkan URL gambar.");
            }
        } catch (error) {
            console.error("Error uploading frame:", error);
            alert("Gagal mengunggah bingkai. Periksa koneksi atau konfigurasi Cloudinary.");
        } finally {
            setIsUploadingFrame(false);
            // Reset input file
            e.target.value = null;
        }
    };

    const handleResetFrame = async () => {
        if (window.confirm("Kembalikan bingkai ke pengaturan awal (default)?")) {
            setConfig(prev => ({ ...prev, frameUrl: defaultFrame }));
            await setDoc(doc(db, 'settings', 'beritaAcaraBpdConfig'), { ...config, frameUrl: defaultFrame });
        }
    };
    // -----------------------------------

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'beritaAcaraBpdConfig'), config);
            alert('Konfigurasi data pejabat berhasil disimpan!');
            setIsEditingConfig(false);
        } catch (error) {
            alert('Gagal menyimpan konfigurasi.');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleBpdSelection = (e) => {
        const bpdId = e.target.value;
        setSelectedBpd(bpdList.find(bpd => bpd.id === bpdId) || null);
    };

    const handlePrint = () => {
        if (!selectedBpd) {
            alert("Silakan pilih anggota BPD terlebih dahulu.");
            return;
        }
        window.print();
    };

    const handleExportPdf = () => {
        if (!selectedBpd) {
            alert("Silakan pilih anggota BPD terlebih dahulu.");
            return;
        }
    
        const element = document.getElementById('print-area');
        const bpdName = selectedBpd.nama.replace(/[\s,.]+/g, '_');
        const fileName = `Berita_Acara_Sumpah_${bpdName}.pdf`;
    
        const opt = {
          margin:       [0, 0, 0, 0], // Margin 0 karena margin sudah diatur oleh padding CSS di dalam bingkai
          filename:     fileName,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, letterRendering: true }, // useCORS penting untuk gambar Cloudinary
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
    
        html2pdf().from(element).set(opt).save();
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="ba-container">
            <div className="ba-controls no-print">
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 border-b pb-2">Pengaturan Dokumen</h2>
                    
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField label="Pilih Desa" type="select" value={selectedDesa} onChange={(e) => {setSelectedDesa(e.target.value); setSelectedBpd(null);}}>
                            <option value="">-- Pilih Desa --</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}

                    <InputField label="Pilih Anggota BPD" type="select" value={selectedBpd?.id || ''} onChange={handleBpdSelection} disabled={!selectedDesa || bpdList.length === 0}>
                        <option value="">-- {bpdList.length > 0 ? 'Pilih Anggota' : 'Tidak ada data BPD di desa ini'} --</option>
                        {bpdList.map(bpd => <option key={bpd.id} value={bpd.id}>{bpd.nama}</option>)}
                    </InputField>

                    <hr className="dark:border-gray-600"/>

                    {/* --- PENGATURAN BINGKAI (FITUR BARU) --- */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                            <FiImage /> Pengaturan Bingkai
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <img 
                                    src={config.frameUrl} 
                                    alt="Preview Bingkai" 
                                    className="w-16 h-20 object-cover border rounded bg-gray-200"
                                />
                                <div className="flex-1">
                                    <label className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors">
                                        {isUploadingFrame ? <Spinner size="sm" /> : <FiUploadCloud className="mr-2"/>}
                                        {isUploadingFrame ? "Mengunggah..." : "Ganti Bingkai"}
                                        <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleFrameUpload} disabled={isUploadingFrame} />
                                    </label>
                                    <p className="text-[10px] text-gray-500 mt-1">*Gunakan format PNG transparan agar isi terlihat.</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleResetFrame}
                                className="w-full flex items-center justify-center px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
                            >
                                <FiRefreshCw className="mr-1.5" /> Reset ke Default
                            </button>
                        </div>
                    </div>

                    <hr className="dark:border-gray-600"/>

                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Data Pejabat & Saksi</h3>
                        <button onClick={() => setIsEditingConfig(!isEditingConfig)} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                            {isEditingConfig ? 'Batal Edit' : 'Ubah Data'}
                        </button>
                    </div>

                    <div className={`space-y-3 transition-all duration-300 ${isEditingConfig ? 'opacity-100' : 'opacity-80 grayscale'}`}>
                        <InputField label="Nomor Surat" name="nomor" value={config.nomor || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        <div className="grid grid-cols-1 gap-2">
                            <InputField label="Nama Pejabat" name="pejabatNama" value={config.pejabatNama || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                            <InputField label="Jabatan Pejabat" name="pejabatJabatan" value={config.pejabatJabatan || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <InputField label="Nama Saksi 1" name="saksi1Nama" value={config.saksi1Nama || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                            <InputField label="Jabatan Saksi 1" name="saksi1Jabatan" value={config.saksi1Jabatan || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <InputField label="Nama Saksi 2" name="saksi2Nama" value={config.saksi2Nama || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                            <InputField label="Jabatan Saksi 2" name="saksi2Jabatan" value={config.saksi2Jabatan || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                             <InputField label="Nama Rohaniawan" name="rohaniawanNama" value={config.rohaniawanNama || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                            <InputField label="NIP Rohaniawan" name="rohaniawanNip" value={config.rohaniawanNip || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        </div>
                    </div>

                    {isEditingConfig && (
                        <button onClick={handleSaveConfig} disabled={isSaving} className="w-full flex justify-center items-center px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm transition-all">
                            {isSaving ? <Spinner size="sm"/> : <FiSave className="mr-2"/>}
                            Simpan Data Pejabat
                        </button>
                    )}
                </div>
                
                {/* Footer Controls */}
                <div className="p-6 mt-auto border-t bg-gray-50 dark:bg-gray-800 dark:border-gray-700 space-y-3">
                    <button onClick={handlePrint} disabled={!selectedBpd} className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all shadow-md">
                        <FiPrinter className="mr-2" size={18} /> Cetak Berita Acara
                    </button>
                    <button onClick={handleExportPdf} disabled={!selectedBpd} className="w-full flex justify-center items-center px-4 py-3 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition-all shadow-md">
                        <FiDownload className="mr-2" size={18} /> Ekspor ke PDF
                    </button>
                </div>
            </div>

            {/* Document Preview Area */}
            <div className="ba-preview">
                {/* [PERBAIKAN] Menggunakan inline style untuk background image dinamis.
                   backgroundSize 100% 100% memaksa gambar memenuhi seluruh area kertas A4.
                */}
                <div 
                    id="print-area" 
                    className="ba-paper"
                    style={{
                        backgroundImage: `url('${config.frameUrl}')`,
                        backgroundSize: '100% 100%', 
                        backgroundRepeat: 'no-repeat'
                    }}
                >
                    {selectedBpd ? (
                        <BeritaAcaraPreview 
                            config={config}
                            bpd={selectedBpd}
                            content={documentContent}
                            onContentChange={(e) => setDocumentContent(e.target.innerText)}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                            <FiPrinter size={48} className="opacity-20"/>
                            <p className="text-center">Pilih <strong>Desa</strong> dan <strong>Anggota BPD</strong> <br/>untuk melihat pratinjau dokumen.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BeritaAcaraBPDPage;