import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import BeritaAcaraPreview from '../components/bpd/BeritaAcaraPreview';
import { FiPrinter } from 'react-icons/fi';
import { formatDate } from '../utils/dateFormatter';

const DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

const generateInitialContent = (bpd, formData) => {
    const memberName = bpd?.nama || '[Nama Anggota BPD]';
    const memberSK = bpd?.no_sk_bupati || '[Nomor SK Bupati]';
    const memberTglSK = bpd?.tgl_sk_bupati ? formatDate(bpd.tgl_sk_bupati, 'long') : '[Tanggal SK Bupati]';
    const memberPeriode = bpd?.periode || '[Periode Jabatan]';
    const pelantikanDate = bpd?.tgl_pelantikan 
        ? formatDate(bpd.tgl_pelantikan, 'long') 
        : '[Hari, Tanggal Bulan Tahun Pelantikan]';

    return `Pada hari ini ${pelantikanDate}, dengan mengambil tempat di Aula Kantor Kecamatan Punggelan, saya, nama ${formData.pejabatNama} Jabatan ${formData.pejabatJabatan} Kabupaten Banjarnegara berdasarkan Peraturan Bupati Banjarnegara Nomor 29 Tahun 2018 tentang Petunjuk Pelaksanaan Peraturan Daerah Kabupaten Banjarnegara Nomor 18 Tahun 2017 tentang Badan Permusyawaratan Desa, dengan disaksikan oleh 2 (dua) saksi masing-masing:

1. Nama\t\t: ${formData.saksi1Nama}
   Jabatan\t: ${formData.saksi1Jabatan}

2. Nama\t\t: ${formData.saksi2Nama}
   Jabatan\t: ${formData.saksi2Jabatan}

Telah mengambil sumpah Jabatan Anggota Badan Permusyawaratan Desa nama ${memberName} yang dengan Keputusan Bupati Banjarnegara NOMOR: ${memberSK} Tanggal ${memberTglSK} diangkat dalam Jabatan sebagai Anggota Badan Permusyawaratan Desa Aula Kantor Kecamatan Punggelan Kecamatan Punggelan Kabupaten Banjarnegara Periode Tahun ${memberPeriode}.

Anggota Badan Permusyawaratan Desa yang mengangkat sumpah jabatan tersebut didampingi oleh seorang Rohaniawan, nama IKHWAN NIP. 196701198703 1 011 Jabatan Pengadministrasi Umum Kantor Kecamatan Punggelan.

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
    const [selectedDesa, setSelectedDesa] = useState(currentUser?.role === 'admin_desa' ? currentUser.desa : 'all');
    const [selectedBpd, setSelectedBpd] = useState(null);
    const [formData, setFormData] = useState({
        nomor: '140 / 1502 / TAHUN 2023',
        saksi1Nama: 'Ikin Suhendro, S. Sos',
        saksi1Jabatan: 'Jabatan Kepala Seksi Trantibum & Pelayanan Kec. Punggelan',
        saksi2Nama: 'Teguh Julianto, S. Sos',
        saksi2Jabatan: 'Jabatan Kepala Seksi Tata Pemerintahan Kec. Punggelan',
        pejabatNama: 'Moh. Julianto, S.E, M.Si.',
        pejabatJabatan: 'Camat Punggelan',
    });
    const [documentContent, setDocumentContent] = useState('');

    useEffect(() => {
        if (!currentUser) { setLoading(false); return; }
        
        const bpdCollection = collection(db, 'bpd');
        let q;
        if (currentUser.role === 'admin_kecamatan') {
            q = selectedDesa === 'all' ? query(bpdCollection) : query(bpdCollection, where("desa", "==", selectedDesa));
        } else {
            q = query(bpdCollection, where("desa", "==", currentUser.desa));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setBpdList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser, selectedDesa]);

    useEffect(() => {
        setDocumentContent(generateInitialContent(selectedBpd, formData));
    }, [selectedBpd, formData]);

    const handleDataChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };
    
    const handleContentChange = (e) => {
        setDocumentContent(e.target.value);
    };

    const handleBpdSelection = (e) => {
        const bpdId = e.target.value;
        setSelectedBpd(bpdList.find(bpd => bpd.id === bpdId));
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            {/* --- FIX: Menggunakan pendekatan CSS yang lebih andal untuk mencetak --- */}
            <style>
                {`
                    @media print {
                        body > #root {
                            /* Sembunyikan semua elemen di root saat mencetak */
                            display: none;
                        }
                        /* Tampilkan HANYA container cetak */
                        body > .print-container {
                            display: block !important;
                        }
                        @page {
                           size: A4;
                           margin: 2cm; 
                        }
                    }
                `}
            </style>
            
            <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow-md flex flex-col max-h-[calc(100vh-150px)]">
                    <div className="p-6 border-b dark:border-gray-700 flex-shrink-0">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Kontrol Berita Acara</h2>
                    </div>
                    <div className="p-6 space-y-6 overflow-y-auto flex-grow">
                        {currentUser.role === 'admin_kecamatan' && (
                            <InputField label="Pilih Desa" type="select" value={selectedDesa} onChange={(e) => {setSelectedDesa(e.target.value); setSelectedBpd(null);}}>
                                <option value="all">-- Semua Desa --</option>
                                {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                            </InputField>
                        )}

                        <InputField label="Pilih Anggota BPD" type="select" value={selectedBpd?.id || ''} onChange={handleBpdSelection} disabled={loading || bpdList.length === 0}>
                            <option value="">-- {bpdList.length > 0 ? 'Pilih Anggota' : 'Tidak ada data'} --</option>
                            {bpdList.map(bpd => <option key={bpd.id} value={bpd.id}>{bpd.nama}</option>)}
                        </InputField>

                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Data Dokumen</h3>
                            <InputField label="Nomor Surat" name="nomor" value={formData.nomor} onChange={handleDataChange} />
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 pt-2">Saksi-saksi</h3>
                            <InputField label="Nama Saksi 1" name="saksi1Nama" value={formData.saksi1Nama} onChange={handleDataChange} />
                            <InputField label="Jabatan Saksi 1" name="saksi1Jabatan" value={formData.saksi1Jabatan} onChange={handleDataChange} />
                            <InputField label="Nama Saksi 2" name="saksi2Nama" value={formData.saksi2Nama} onChange={handleDataChange} />
                            <InputField label="Jabatan Saksi 2" name="saksi2Jabatan" value={formData.saksi2Jabatan} onChange={handleDataChange} />
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 pt-2">Pejabat</h3>
                            <InputField label="Nama Pejabat" name="pejabatNama" value={formData.pejabatNama} onChange={handleDataChange} />
                            <InputField label="Jabatan Pejabat" name="pejabatJabatan" value={formData.pejabatJabatan} onChange={handleDataChange} />
                        </div>
                    </div>
                    <div className="p-6 mt-auto border-t dark:border-gray-700 flex-shrink-0">
                        <button onClick={handlePrint} disabled={!selectedBpd} className="w-full flex justify-center items-center px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed">
                            <FiPrinter className="mr-2" /> Cetak Berita Acara
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-md flex flex-col max-h-[calc(100vh-150px)]">
                    <div className="p-6 border-b dark:border-gray-700 flex-shrink-0">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pratinjau Dokumen</h2>
                    </div>
                    <div className="p-6 flex-grow overflow-y-auto">
                        {loading ? <Spinner /> : (
                            <BeritaAcaraPreview 
                                isPrinting={false}
                                data={formData}
                                bpd={selectedBpd}
                                content={documentContent}
                                onContentChange={handleContentChange}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Area ini tidak terlihat di layar, tapi akan menjadi satu-satunya yang tercetak */}
            <div className="print-container" style={{ display: 'none' }}>
                 <BeritaAcaraPreview 
                    isPrinting={true}
                    data={formData}
                    bpd={selectedBpd}
                    content={documentContent}
                    onContentChange={handleContentChange}
                />
            </div>
        </>
    );
};

export default BeritaAcaraBPDPage;

