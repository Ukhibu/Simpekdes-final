import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import BeritaAcaraPreview from '../components/bpd/BeritaAcaraPreview';
import { FiPrinter, FiSave, FiDownload } from 'react-icons/fi';
import { formatDate } from '../utils/dateFormatter';
import html2pdf from 'html2pdf.js';
import '../styles/BeritaAcara.css'; // Impor CSS khusus

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
    
    // Menggabungkan nama dan gelar jika ada
    const namaLengkap = `${bpd.nama || '[Nama Anggota BPD]'}${bpd.gelar ? `, ${bpd.gelar}` : ''}`;

    return `Pada hari ini ${pelantikanDate}, dengan mengambil tempat di Aula Kantor Kecamatan Punggelan, saya, nama ${config.pejabatNama || '[Nama Pejabat]'} Jabatan ${config.pejabatJabatan || '[Jabatan Pejabat]'} Kabupaten Banjarnegara berdasarkan Peraturan Bupati Banjarnegara Nomor 29 Tahun 2018 tentang Petunjuk Pelaksanaan Peraturan Daerah Kabupaten Banjarnegara Nomor 18 Tahun 2017 tentang Badan Permusyawaratan Desa, dengan disaksikan oleh 2 (dua) saksi masing-masing:

1. Nama\t\t: ${config.saksi1Nama || '[Nama Saksi 1]'}
   Jabatan\t: ${config.saksi1Jabatan || '[Jabatan Saksi 1]'}

2. Nama\t\t: ${config.saksi2Nama || '[Nama Saksi 2]'}
   Jabatan\t: ${config.saksi2Jabatan || '[Jabatan Saksi 2]'}

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
                setConfig(docSnap.data());
            } else {
                // Default config inspired by the image
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
                    rohaniawanJabatan: 'Pengadministrasi Umum Kantor Kecamatan Punggelan'
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

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'beritaAcaraBpdConfig'), config);
            alert('Konfigurasi berhasil disimpan!');
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
        // Cukup panggil window.print(), sisanya diurus oleh CSS
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
          margin:       [2, 2, 2, 2],
          filename:     fileName,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
          jsPDF:        { unit: 'cm', format: 'a4', orientation: 'portrait' }
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
            {/* Control Panel - Disembunyikan saat print oleh kelas 'no-print' */}
            <div className="ba-controls no-print">
                <div className="p-6 space-y-6 overflow-y-auto">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pengaturan Dokumen</h2>
                    
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

                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Data Tambahan</h3>
                        <button onClick={() => setIsEditingConfig(!isEditingConfig)} className="text-sm text-blue-600 dark:text-blue-400">
                            {isEditingConfig ? 'Batal' : 'Ubah'}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <InputField label="Nomor Surat" name="nomor" value={config.nomor || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        <InputField label="Nama Saksi 1" name="saksi1Nama" value={config.saksi1Nama || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        <InputField label="Jabatan Saksi 1" name="saksi1Jabatan" value={config.saksi1Jabatan || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        <InputField label="Nama Saksi 2" name="saksi2Nama" value={config.saksi2Nama || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        <InputField label="Jabatan Saksi 2" name="saksi2Jabatan" value={config.saksi2Jabatan || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        <InputField label="Nama Pejabat" name="pejabatNama" value={config.pejabatNama || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        <InputField label="Jabatan Pejabat" name="pejabatJabatan" value={config.pejabatJabatan || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                         <InputField label="Nama Rohaniawan" name="rohaniawanNama" value={config.rohaniawanNama || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        <InputField label="NIP Rohaniawan" name="rohaniawanNip" value={config.rohaniawanNip || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                        <InputField label="Jabatan Rohaniawan" name="rohaniawanJabatan" value={config.rohaniawanJabatan || ''} onChange={handleConfigChange} disabled={!isEditingConfig} />
                    </div>

                    {isEditingConfig && (
                        <button onClick={handleSaveConfig} disabled={isSaving} className="w-full flex justify-center items-center px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700">
                            {isSaving ? <Spinner size="sm"/> : <FiSave className="mr-2"/>}
                            Simpan Konfigurasi
                        </button>
                    )}
                </div>
                <div className="p-6 mt-auto border-t dark:border-gray-700 space-y-2">
                    <button onClick={handlePrint} disabled={!selectedBpd} className="w-full flex justify-center items-center px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed">
                        <FiPrinter className="mr-2" /> Cetak Berita Acara
                    </button>
                    <button onClick={handleExportPdf} disabled={!selectedBpd} className="w-full flex justify-center items-center px-4 py-3 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed">
                        <FiDownload className="mr-2" /> Ekspor ke PDF
                    </button>
                </div>
            </div>

            {/* Document Preview Area */}
            <div className="ba-preview">
                {/* ID ini penting untuk ditargetkan oleh CSS print */}
                <div id="print-area" className="ba-paper">
                    {selectedBpd ? (
                        <BeritaAcaraPreview 
                            config={config}
                            bpd={selectedBpd}
                            content={documentContent}
                            onContentChange={(e) => setDocumentContent(e.target.innerText)}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <p>Pilih desa dan anggota BPD untuk melihat pratinjau dokumen.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BeritaAcaraBPDPage;

