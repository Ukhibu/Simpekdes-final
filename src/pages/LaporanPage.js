import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where, Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { generateDemografiPerangkatPDF, generateKeuanganPDF, generateAsetPDF } from '../utils/reportGenerators';
import { FiDownload, FiBarChart2 } from 'react-icons/fi';
import { formatDate } from '../utils/dateFormatter';

const DESA_LIST = [ "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga" ];

// --- Objek Konfigurasi untuk setiap jenis laporan ---
const reportConfigs = {
  demografi_perangkat: {
    label: 'Demografi Perangkat Desa',
    collection: 'perangkat',
    dateField: 'tgl_pelantikan',
    dateLabel: 'Tanggal Pelantikan',
  },
  rekap_keuangan: {
    label: 'Rekapitulasi Keuangan',
    collection: 'keuangan',
    dateField: 'tanggal',
    dateLabel: 'Tanggal Transaksi',
  },
  inventaris_aset: {
    label: 'Inventaris Aset',
    collection: 'aset',
    dateField: 'tanggalPerolehan',
    dateLabel: 'Tanggal Perolehan',
  },
};

// --- Fungsi Bantuan untuk Tabel Pratinjau ---

const getAge = (dateString) => {
    if (!dateString) return '-';
    const birthDate = typeof dateString.toDate === 'function' ? dateString.toDate() : new Date(dateString);
    if (isNaN(birthDate.getTime())) return '-';
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
};

const formatCurrency = (number) => {
    if (typeof number !== 'number') return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

// --- PERBAIKAN: Fungsi aman untuk memformat tanggal dari berbagai tipe ---
const safeFormatDate = (dateField) => {
    if (!dateField) return '-';
    // Cek apakah ini objek Timestamp Firestore
    if (typeof dateField.toDate === 'function') {
        return formatDate(dateField.toDate());
    }
    // Jika sudah berupa string atau objek Date, biarkan formatDate menanganinya
    return formatDate(dateField);
};


// --- Komponen Tabel Pratinjau ---

const PerangkatPreviewTable = ({ data, showDesa }) => (
  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0">
      <tr>
        <th className="px-6 py-3">No</th>
        <th className="px-6 py-3">Nama</th>
        {showDesa && <th className="px-6 py-3">Desa</th>}
        <th className="px-6 py-3">Jabatan</th>
        <th className="px-6 py-3">Pendidikan</th>
        <th className="px-6 py-3">Usia</th>
      </tr>
    </thead>
    <tbody>
      {data.map((item, index) => (
        <tr key={index} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
          <td className="px-6 py-4">{index + 1}</td>
          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.nama}</td>
          {showDesa && <td className="px-6 py-4">{item.desa}</td>}
          <td className="px-6 py-4">{item.jabatan}</td>
          <td className="px-6 py-4">{item.pendidikan}</td>
          <td className="px-6 py-4">{getAge(item.tgl_lahir)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const KeuanganPreviewTable = ({ data }) => (
  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0">
      <tr>
        <th className="px-6 py-3">No</th>
        <th className="px-6 py-3">Tanggal</th>
        <th className="px-6 py-3">Uraian</th>
        <th className="px-6 py-3 text-right">Pemasukan (Rp)</th>
        <th className="px-6 py-3 text-right">Pengeluaran (Rp)</th>
      </tr>
    </thead>
    <tbody>
      {data.map((item, index) => (
        <tr key={index} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
          <td className="px-6 py-4">{index + 1}</td>
          <td className="px-6 py-4">{safeFormatDate(item.tanggal)}</td>
          <td className="px-6 py-4">{item.uraian}</td>
          <td className="px-6 py-4 text-right">{formatCurrency(item.pemasukan)}</td>
          <td className="px-6 py-4 text-right">{formatCurrency(item.pengeluaran)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const AsetPreviewTable = ({ data }) => (
  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0">
      <tr>
        <th className="px-6 py-3">No</th>
        <th className="px-6 py-3">Nama Aset</th>
        <th className="px-6 py-3">Kode Barang</th>
        <th className="px-6 py-3">Tgl Perolehan</th>
        <th className="px-6 py-3 text-center">Jumlah</th>
        <th className="px-6 py-3">Kondisi</th>
        <th className="px-6 py-3 text-right">Nilai (Rp)</th>
      </tr>
    </thead>
    <tbody>
      {data.map((item, index) => (
        <tr key={index} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
          <td className="px-6 py-4">{index + 1}</td>
          <td className="px-6 py-4">{item.namaAset}</td>
          <td className="px-6 py-4">{item.kodeBarang}</td>
          <td className="px-6 py-4">{safeFormatDate(item.tanggalPerolehan)}</td>
          <td className="px-6 py-4 text-center">{item.jumlah}</td>
          <td className="px-6 py-4">{item.kondisi}</td>
          <td className="px-6 py-4 text-right">{formatCurrency(item.nilaiAset)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);


// --- Komponen Utama Halaman Laporan ---
const LaporanPage = () => {
    const { currentUser } = useAuth();
    const [reportType, setReportType] = useState('demografi_perangkat');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [filters, setFilters] = useState({
        desa: 'all',
        startDate: '',
        endDate: '',
    });
    const [exportConfig, setExportConfig] = useState(null);

    useEffect(() => {
        const fetchConfig = async () => {
            const { getDoc, doc } = await import('firebase/firestore');
            const docRef = doc(db, 'settings', 'exportConfig');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) setExportConfig(docSnap.data());
        };
        fetchConfig();
    }, []);
    
    // Reset data saat jenis laporan atau filter berubah
    useEffect(() => {
        setReportData(null);
    }, [reportType, filters.desa]);


    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

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
            const dataCollection = collection(db, config.collection);
            let constraints = [];

            // Filter berdasarkan desa
            if (currentUser.role === 'admin_desa') {
                constraints.push(where("desa", "==", currentUser.desa));
            } else if (filters.desa !== 'all') {
                constraints.push(where("desa", "==", filters.desa));
            }

            // Filter berdasarkan rentang tanggal
            if (filters.startDate) {
                constraints.push(where(config.dateField, ">=", Timestamp.fromDate(new Date(filters.startDate))));
            }
            if (filters.endDate) {
                // Tambah 1 hari ke endDate agar inklusif
                const end = new Date(filters.endDate);
                end.setDate(end.getDate() + 1);
                constraints.push(where(config.dateField, "<", Timestamp.fromDate(end)));
            }

            const q = query(dataCollection, ...constraints);
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => doc.data());
            setReportData(data);

        } catch (error) {
            console.error("Gagal membuat laporan:", error);
            alert("Terjadi kesalahan saat mengambil data laporan. Pastikan rentang tanggal valid dan indeks Firestore sudah dibuat jika diperlukan.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!reportData) return;
        const desaFilter = currentUser.role === 'admin_desa' ? currentUser.desa : filters.desa;

        switch (reportType) {
            case 'demografi_perangkat':
                generateDemografiPerangkatPDF(reportData, desaFilter, exportConfig);
                break;
            case 'rekap_keuangan':
                generateKeuanganPDF(reportData, desaFilter, exportConfig);
                break;
            case 'inventaris_aset':
                generateAsetPDF(reportData, desaFilter, exportConfig);
                break;
            default:
                alert('Jenis laporan tidak didukung untuk diunduh.');
        }
    };
    
    const renderPreviewTable = () => {
        if (!reportData) return null;

        if (reportData.length === 0) {
            return <p className="text-center text-gray-500 py-10">Tidak ada data yang ditemukan untuk filter yang dipilih.</p>;
        }

        switch (reportType) {
            case 'demografi_perangkat':
                const showDesa = currentUser.role === 'admin_kecamatan' && filters.desa === 'all';
                return <PerangkatPreviewTable data={reportData} showDesa={showDesa} />;
            case 'rekap_keuangan':
                return <KeuanganPreviewTable data={reportData} />;
            case 'inventaris_aset':
                return <AsetPreviewTable data={reportData} />;
            default:
                return null;
        }
    };

    const showDesaFilter = currentUser.role === 'admin_kecamatan';
    const currentConfig = reportConfigs[reportType];

    if (currentUser.role !== 'admin_kecamatan') {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <p className="text-center text-gray-600 dark:text-gray-400">Anda tidak memiliki hak akses untuk mengakses halaman ini.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Pusat Laporan</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <InputField label="Jenis Laporan" name="reportType" type="select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                        <option value="demografi_perangkat">Demografi Perangkat Desa</option>
                        <option value="rekap_keuangan">Rekapitulasi Keuangan</option>
                        <option value="inventaris_aset">Inventaris Aset</option>
                    </InputField>

                    {showDesaFilter && (
                        <InputField label="Filter Desa" name="desa" type="select" value={filters.desa} onChange={handleFilterChange}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                        </InputField>
                    )}

                    <InputField label={`Dari ${currentConfig.dateLabel}`} name="startDate" type="date" value={filters.startDate} onChange={handleFilterChange} />
                    <InputField label={`Sampai ${currentConfig.dateLabel}`} name="endDate" type="date" value={filters.endDate} onChange={handleFilterChange} />

                    <button
                        onClick={handleGenerateReport}
                        disabled={loading}
                        className="w-full h-11 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        <FiBarChart2 /> {loading ? 'Memproses...' : 'Buat Laporan'}
                    </button>
                </div>
            </div>

            {loading && <Spinner />}

            {reportData && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pratinjau Laporan</h2>
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

