import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where, Timestamp, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { 
    generateDemografiPDF, 
    generateKeuanganPDF, 
    generateAsetPDF,
    generateRekapLembagaPDF,
    generateRekapRtRwPDF
} from '../utils/reportGenerators';
import { FiDownload, FiBarChart2 } from 'react-icons/fi';
import { formatDate } from '../utils/dateFormatter';

const DESA_LIST = [ "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga" ];

// --- Objek Konfigurasi untuk setiap jenis laporan ---
const reportConfigs = {
  demografi_perangkat: { label: 'Demografi Usia Perangkat', collection: 'perangkat', dateField: 'tgl_pelantikan', dateLabel: 'Tgl Pelantikan', type: 'demografi' },
  demografi_bpd: { label: 'Demografi Usia BPD', collection: 'bpd', dateField: 'tgl_pelantikan', dateLabel: 'Tgl Pelantikan', type: 'demografi' },
  demografi_lpm: { label: 'Demografi Usia LPM', collection: 'lpm', dateField: null, dateLabel: 'Periode', type: 'demografi' },
  demografi_pkk: { label: 'Demografi Usia PKK', collection: 'pkk', dateField: null, dateLabel: 'Periode', type: 'demografi' },
  demografi_karang_taruna: { label: 'Demografi Usia Karang Taruna', collection: 'karang_taruna', dateField: null, dateLabel: 'Periode', type: 'demografi' },
  demografi_rt_rw: { label: 'Demografi Usia RT/RW', collection: 'rt_rw', dateField: null, dateLabel: 'Periode', type: 'demografi' },
  rekap_keuangan: { label: 'Rekapitulasi Keuangan', collection: 'keuangan', dateField: 'tanggal', dateLabel: 'Tanggal Transaksi', type: 'keuangan' },
  inventaris_aset: { label: 'Inventaris Aset Desa', collection: 'aset', dateField: 'tanggalPerolehan', dateLabel: 'Tanggal Perolehan', type: 'aset' },
  rekap_rt_rw: { label: 'Jumlah RT/RW per Desa', collection: 'rt_rw', dateField: null, dateLabel: 'Periode', type: 'rekap_rt_rw' },
  rekap_jumlah_lembaga: { label: 'Jumlah Kelembagaan per Desa', collection: null, dateField: null, dateLabel: 'Periode', type: 'agregat' },
};

// --- Fungsi Bantuan ---
const getAge = (item) => {
    const dateString = item.tgl_lahir;
    if (!dateString) return '-';
    const birthDate = typeof dateString.toDate === 'function' ? dateString.toDate() : new Date(dateString);
    if (isNaN(birthDate.getTime())) return '-';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
};
const formatCurrency = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);
const safeFormatDate = (dateField) => dateField ? formatDate(dateField.toDate ? dateField.toDate() : dateField) : '-';

// --- Komponen Tabel Pratinjau ---
const DemografiPreviewTable = ({ data, showDesa, title }) => (
  <table className="w-full text-sm">
    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
      <tr>
        <th className="px-4 py-2">No</th>
        <th className="px-4 py-2">Nama</th>
        {showDesa && <th className="px-4 py-2">Desa</th>}
        <th className="px-4 py-2">Jabatan</th>
        <th className="px-4 py-2">Pendidikan</th>
        <th className="px-4 py-2">Usia</th>
      </tr>
    </thead>
    <tbody>
      {data.map((item, index) => (
        <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
          <td className="px-4 py-2">{index + 1}</td>
          <td className="px-4 py-2 font-medium">{item.nama}</td>
          {showDesa && <td className="px-4 py-2">{item.desa}</td>}
          <td className="px-4 py-2">{item.jabatan}</td>
          <td className="px-4 py-2">{item.pendidikan || '-'}</td>
          <td className="px-4 py-2">{getAge(item)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
const KeuanganPreviewTable = ({ data, showDesa }) => (
    <table className="w-full text-sm">
      <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
        <tr>
          <th className="px-4 py-2">No</th>
          {showDesa && <th className="px-4 py-2">Desa</th>}
          <th className="px-4 py-2">Tanggal</th>
          <th className="px-4 py-2">Uraian</th>
          <th className="px-4 py-2 text-right">Pemasukan</th>
          <th className="px-4 py-2 text-right">Pengeluaran</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
            <td className="px-4 py-2">{index + 1}</td>
            {showDesa && <td className="px-4 py-2">{item.desa}</td>}
            <td className="px-4 py-2">{safeFormatDate(item.tanggal)}</td>
            <td className="px-4 py-2">{item.uraian}</td>
            <td className="px-4 py-2 text-right">{item.jenis === 'Pemasukan' ? formatCurrency(item.jumlah) : '-'}</td>
            <td className="px-4 py-2 text-right">{item.jenis === 'Pengeluaran' ? formatCurrency(item.jumlah) : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
);
const AsetPreviewTable = ({ data, showDesa }) => (
    <table className="w-full text-sm">
       <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
        <tr>
          <th className="px-4 py-2">No</th>
          {showDesa && <th className="px-4 py-2">Desa</th>}
          <th className="px-4 py-2">Nama Aset</th>
          <th className="px-4 py-2">Kategori</th>
          <th className="px-4 py-2">Tgl Perolehan</th>
          <th className="px-4 py-2 text-right">Nilai (Rp)</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
            <td className="px-4 py-2">{index + 1}</td>
            {showDesa && <td className="px-4 py-2">{item.desa}</td>}
            <td className="px-4 py-2">{item.namaAset}</td>
            <td className="px-4 py-2">{item.kategori}</td>
            <td className="px-4 py-2">{safeFormatDate(item.tanggalPerolehan)}</td>
            <td className="px-4 py-2 text-right">{formatCurrency(item.nilaiAset)}</td>
          </tr>
        ))}
      </tbody>
    </table>
);
const RekapRtRwPreviewTable = ({ data }) => (
    <table className="w-full text-sm">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
            <tr>
                <th className="px-4 py-2">No</th>
                <th className="px-4 py-2">Desa</th>
                <th className="px-4 py-2">Jabatan</th>
                <th className="px-4 py-2">Nomor</th>
                <th className="px-4 py-2">Nama Ketua</th>
                <th className="px-4 py-2">Dusun/Dukuh</th>
            </tr>
        </thead>
        <tbody>
            {data.map((item, index) => (
                <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                    <td className="px-4 py-2">{index + 1}</td>
                    <td className="px-4 py-2">{item.desa}</td>
                    <td className="px-4 py-2">{item.jabatan}</td>
                    <td className="px-4 py-2">{item.nomor}</td>
                    <td className="px-4 py-2">{item.nama}</td>
                    <td className="px-4 py-2">{item.dusun || '-'}</td>
                </tr>
            ))}
        </tbody>
    </table>
);
const RekapLembagaPreviewTable = ({ data }) => (
    <table className="w-full text-sm">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
            <tr>
                <th className="px-4 py-2">No</th>
                <th className="px-4 py-2">Nama Desa</th>
                <th className="px-4 py-2 text-center">Perangkat</th>
                <th className="px-4 py-2 text-center">BPD</th>
                <th className="px-4 py-2 text-center">LPM</th>
                <th className="px-4 py-2 text-center">PKK</th>
                <th className="px-4 py-2 text-center">Karang Taruna</th>
                <th className="px-4 py-2 text-center">RT/RW</th>
            </tr>
        </thead>
        <tbody>
            {data.map((item, index) => (
                <tr key={item.desa} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                    <td className="px-4 py-2">{index + 1}</td>
                    <td className="px-4 py-2 font-medium">{item.desa}</td>
                    <td className="px-4 py-2 text-center">{item.perangkat}</td>
                    <td className="px-4 py-2 text-center">{item.bpd}</td>
                    <td className="px-4 py-2 text-center">{item.lpm}</td>
                    <td className="px-4 py-2 text-center">{item.pkk}</td>
                    <td className="px-4 py-2 text-center">{item.karang_taruna}</td>
                    <td className="px-4 py-2 text-center">{item.rt_rw}</td>
                </tr>
            ))}
        </tbody>
    </table>
);


// --- Komponen Utama ---
const LaporanPage = () => {
    const { currentUser } = useAuth();
    const [reportType, setReportType] = useState('demografi_perangkat');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [filters, setFilters] = useState({ desa: 'all', startDate: '', endDate: '' });
    const [exportConfig, setExportConfig] = useState(null);

    useEffect(() => {
        if (currentUser.role === 'admin_desa') {
            setFilters(prev => ({ ...prev, desa: currentUser.desa }));
        }
        const fetchConfig = async () => {
            const docRef = doc(db, 'settings', 'exportConfig');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) setExportConfig(docSnap.data());
        };
        fetchConfig();
    }, [currentUser]);
    
    useEffect(() => {
        setReportData(null);
    }, [reportType, filters.desa]);

    const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

    const handleGenerateReport = async () => {
        setLoading(true);
        setReportData(null);

        const config = reportConfigs[reportType];
        if (!config) {
            alert("Jenis laporan tidak valid.");
            setLoading(false);
            return;
        }

        try {
            if (config.type === 'agregat') {
                const collectionsToFetch = ['perangkat', 'bpd', 'lpm', 'pkk', 'karang_taruna', 'rt_rw'];
                const promises = collectionsToFetch.map(coll => getDocs(query(collection(db, coll))));
                const snapshots = await Promise.all(promises);
                
                const allData = {};
                snapshots.forEach((snap, index) => {
                    allData[collectionsToFetch[index]] = snap.docs.map(d => d.data());
                });

                const rekapData = DESA_LIST.map(desa => {
                    const counts = {};
                    collectionsToFetch.forEach(coll => {
                        counts[coll] = allData[coll].filter(item => item.desa === desa).length;
                    });
                    return { desa, ...counts };
                });
                setReportData(rekapData);

            } else {
                const dataCollection = collection(db, config.collection);
                let constraints = [];

                if (currentUser.role === 'admin_desa') {
                    constraints.push(where("desa", "==", currentUser.desa));
                } else if (filters.desa !== 'all') {
                    constraints.push(where("desa", "==", filters.desa));
                }

                if (config.dateField && filters.startDate) {
                    constraints.push(where(config.dateField, ">=", Timestamp.fromDate(new Date(filters.startDate))));
                }
                if (config.dateField && filters.endDate) {
                    const end = new Date(filters.endDate);
                    end.setDate(end.getDate() + 1);
                    constraints.push(where(config.dateField, "<", Timestamp.fromDate(end)));
                }

                const q = query(dataCollection, ...constraints);
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setReportData(data);
            }
        } catch (error) {
            console.error("Gagal membuat laporan:", error);
            alert("Terjadi kesalahan. Jika menggunakan filter tanggal, pastikan indeks komposit telah dibuat di Firestore.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!reportData) return;
        const desaFilter = currentUser.role === 'admin_desa' ? currentUser.desa : filters.desa;
        const config = reportConfigs[reportType];
        
        switch (config.type) {
            case 'demografi':
                generateDemografiPDF(reportData, desaFilter, exportConfig, config.label);
                break;
            case 'keuangan':
                generateKeuanganPDF(reportData, desaFilter, exportConfig);
                break;
            case 'aset':
                generateAsetPDF(reportData, desaFilter, exportConfig);
                break;
            case 'rekap_rt_rw':
                generateRekapRtRwPDF(reportData, exportConfig);
                break;
            case 'agregat':
                generateRekapLembagaPDF(reportData, exportConfig);
                break;
            default:
                alert('Jenis laporan ini tidak didukung untuk diunduh.');
        }
    };
    
    const renderPreviewTable = () => {
        if (!reportData) return null;
        if (reportData.length === 0) {
            return <p className="text-center text-gray-500 py-10">Tidak ada data yang ditemukan untuk filter yang dipilih.</p>;
        }

        const config = reportConfigs[reportType];
        const showDesa = currentUser.role === 'admin_kecamatan' && filters.desa === 'all';
        
        switch (config.type) {
            case 'demografi':
                return <DemografiPreviewTable data={reportData} showDesa={showDesa} title={config.label} />;
            case 'keuangan':
                return <KeuanganPreviewTable data={reportData} showDesa={showDesa} />;
            case 'aset':
                return <AsetPreviewTable data={reportData} showDesa={showDesa} />;
            case 'rekap_rt_rw':
                return <RekapRtRwPreviewTable data={reportData} />;
            case 'agregat':
                return <RekapLembagaPreviewTable data={reportData} />;
            default:
                return null;
        }
    };

    const currentConfig = reportConfigs[reportType];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Generator Laporan PDF</h1>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <InputField label="Jenis Laporan" name="reportType" type="select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                        {Object.entries(reportConfigs).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                        ))}
                    </InputField>

                    {currentUser.role === 'admin_kecamatan' && currentConfig.type !== 'agregat' && (
                        <InputField label="Filter Desa" name="desa" type="select" value={filters.desa} onChange={handleFilterChange}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                        </InputField>
                    )}

                    {currentConfig.dateField && (
                        <>
                            <InputField label={`Dari ${currentConfig.dateLabel}`} name="startDate" type="date" value={filters.startDate} onChange={handleFilterChange} />
                            <InputField label={`Sampai ${currentConfig.dateLabel}`} name="endDate" type="date" value={filters.endDate} onChange={handleFilterChange} />
                        </>
                    )}

                    <button
                        onClick={handleGenerateReport}
                        disabled={loading}
                        className="w-full h-11 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 lg:col-start-5"
                    >
                        <FiBarChart2 /> {loading ? 'Memproses...' : 'Buat Pratinjau'}
                    </button>
                </div>
            </div>

            {loading && <Spinner />}

            {reportData && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pratinjau: {currentConfig.label}</h2>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                {reportData.length} data ditemukan. Klik "Unduh PDF" untuk menyimpan laporan.
                            </p>
                        </div>
                        {reportData.length > 0 && (
                            <button onClick={handleDownloadPDF} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 self-start md:self-center">
                                <FiDownload /> Unduh PDF
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto mt-4 max-h-[60vh] border dark:border-gray-700 rounded-lg">
                        {renderPreviewTable()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LaporanPage;

