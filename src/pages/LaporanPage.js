import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { 
    generateDemografiPDF, 
    generateAsetPDF,
    generateRekapLembagaPDF,
    generateRekapRtRwPDF,
    generateRealisasiPDF 
} from '../utils/reportGenerators';
import { FiDownload, FiBarChart2 } from 'react-icons/fi';
import { useNotification } from '../context/NotificationContext';

const DESA_LIST = [ "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga" ];

const reportConfigs = {
  demografi_perangkat: { label: 'Demografi Usia Perangkat', collection: 'perangkat', type: 'demografi' },
  demografi_bpd: { label: 'Demografi Usia BPD', collection: 'bpd', type: 'demografi' },
  demografi_lpm: { label: 'Demografi Usia LPM', collection: 'lpm', type: 'demografi' },
  demografi_pkk: { label: 'Demografi Usia PKK', collection: 'pkk', type: 'demografi' },
  demografi_karang_taruna: { label: 'Demografi Usia Karang Taruna', collection: 'karang_taruna', type: 'demografi' },
  demografi_rt_rw: { label: 'Demografi Usia RT/RW', collection: 'rt_rw', type: 'demografi' },
  laporan_realisasi: { label: 'Laporan Realisasi APBDes', collection: 'anggaran_tahunan', type: 'realisasi' },
  inventaris_aset: { label: 'Inventaris Aset Desa', collection: 'aset', type: 'aset' },
  rekap_rt_rw: { label: 'Rekap Data RT/RW per Desa', collection: 'rt_rw', type: 'rekap_rt_rw' },
  rekap_jumlah_lembaga: { label: 'Jumlah Kelembagaan per Desa', collection: null, type: 'agregat' },
};

// --- Fungsi Bantuan ---
const formatCurrency = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);
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

const formatDate = (input) => {
    if (!input) return '';
    try {
        const d = (typeof input.toDate === 'function') ? input.toDate() : (input instanceof Date ? input : new Date(input));
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) {
        return '';
    }
};

const safeFormatDate = (dateField) => dateField ? formatDate(dateField) : '-';

// --- Komponen Tabel Pratinjau ---

const DemografiPreviewTable = ({ data, showDesa }) => (
    <table className="w-full text-sm border-collapse">
      <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
        <tr>
          <th className="px-4 py-3 border dark:border-gray-600">No</th>
          <th className="px-4 py-3 border dark:border-gray-600">Nama</th>
          {showDesa && <th className="px-4 py-3 border dark:border-gray-600">Desa</th>}
          <th className="px-4 py-3 border dark:border-gray-600">Jabatan</th>
          <th className="px-4 py-3 border dark:border-gray-600">Pendidikan</th>
          <th className="px-4 py-3 border dark:border-gray-600">Usia</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
            <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{index + 1}</td>
            <td className="px-4 py-2 border dark:border-gray-600 font-medium text-gray-900 dark:text-white">{item.nama}</td>
            {showDesa && <td className="px-4 py-2 border dark:border-gray-600 text-gray-800 dark:text-gray-300">{item.desa}</td>}
            <td className="px-4 py-2 border dark:border-gray-600 text-gray-800 dark:text-gray-300">{item.jabatan}</td>
            <td className="px-4 py-2 border dark:border-gray-600 text-gray-800 dark:text-gray-300">{item.pendidikan || '-'}</td>
            <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{getAge(item)}</td>
          </tr>
        ))}
      </tbody>
    </table>
);

const RealisasiPreviewTable = ({ data }) => {
    const { pendapatan, belanja, totalAnggaranPendapatan, totalRealisasiPendapatan, totalAnggaranBelanja, totalRealisasiBelanja } = data.reduce((acc, item) => {
        const isPendapatan = item.jenis === 'Pendapatan';
        const target = isPendapatan ? acc.pendapatan : acc.belanja;
        if (!target[item.bidang]) target[item.bidang] = [];
        target[item.bidang].push(item);
        if (isPendapatan) {
            acc.totalAnggaranPendapatan += item.jumlah;
            acc.totalRealisasiPendapatan += item.totalRealisasi;
        } else {
            acc.totalAnggaranBelanja += item.jumlah;
            acc.totalRealisasiBelanja += item.totalRealisasi;
        }
        return acc;
    }, { pendapatan: {}, belanja: {}, totalAnggaranPendapatan: 0, totalRealisasiPendapatan: 0, totalAnggaranBelanja: 0, totalRealisasiBelanja: 0 });

    const renderSection = (items) => (
        items.map(item => {
            const sisa = item.jumlah - item.totalRealisasi;
            const persentase = item.jumlah > 0 ? (item.totalRealisasi / item.jumlah) * 100 : 0;
            return (
                <tr key={item.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="pl-8 pr-4 py-2 border dark:border-gray-600 text-gray-800 dark:text-gray-300">{item.uraian}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-right text-gray-800 dark:text-gray-300">{formatCurrency(item.jumlah)}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-right text-gray-800 dark:text-gray-300">{formatCurrency(item.totalRealisasi)}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-right text-gray-800 dark:text-gray-300">{formatCurrency(sisa)}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{persentase.toFixed(2)}%</td>
                </tr>
            );
        })
    );
    
    return (
        <table className="w-full text-sm border-collapse">
            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-200 dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                    <th className="px-4 py-3 border dark:border-gray-600 text-left">Uraian</th>
                    <th className="px-4 py-3 border dark:border-gray-600 text-right">Anggaran</th>
                    <th className="px-4 py-3 border dark:border-gray-600 text-right">Realisasi</th>
                    <th className="px-4 py-3 border dark:border-gray-600 text-right">Sisa</th>
                    <th className="px-4 py-3 border dark:border-gray-600 text-center">%</th>
                </tr>
            </thead>
            <tbody>
                <tr className="bg-gray-100 dark:bg-gray-800 border dark:border-gray-600"><th colSpan="5" className="px-4 py-2 border dark:border-gray-600 text-left font-bold text-lg text-gray-900 dark:text-white">PENDAPATAN</th></tr>
                {Object.entries(pendapatan).map(([bidang, items]) => <React.Fragment key={bidang}><tr className="bg-gray-50 dark:bg-gray-700"><td colSpan="5" className="px-4 py-2 border dark:border-gray-600 font-bold text-gray-800 dark:text-gray-200">{bidang}</td></tr>{renderSection(items)}</React.Fragment>)}
                <tr className="bg-gray-200 dark:bg-gray-600 font-bold text-gray-900 dark:text-white">
                    <td className="px-4 py-2 border dark:border-gray-600">JUMLAH PENDAPATAN</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-right">{formatCurrency(totalAnggaranPendapatan)}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-right">{formatCurrency(totalRealisasiPendapatan)}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-right">{formatCurrency(totalAnggaranPendapatan - totalRealisasiPendapatan)}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-center">{(totalAnggaranPendapatan > 0 ? (totalRealisasiPendapatan / totalAnggaranPendapatan) * 100 : 0).toFixed(2)}%</td>
                </tr>
                <tr className="h-4 bg-white dark:bg-gray-900 border-none"><td colSpan="5" className="border-none"></td></tr>
                <tr className="bg-gray-100 dark:bg-gray-800 border dark:border-gray-600"><th colSpan="5" className="px-4 py-2 border dark:border-gray-600 text-left font-bold text-lg text-gray-900 dark:text-white">BELANJA</th></tr>
                {Object.entries(belanja).map(([bidang, items]) => <React.Fragment key={bidang}><tr className="bg-gray-50 dark:bg-gray-700"><td colSpan="5" className="px-4 py-2 border dark:border-gray-600 font-bold text-gray-800 dark:text-gray-200">{bidang}</td></tr>{renderSection(items)}</React.Fragment>)}
                <tr className="bg-gray-200 dark:bg-gray-600 font-bold text-gray-900 dark:text-white">
                    <td className="px-4 py-2 border dark:border-gray-600">JUMLAH BELANJA</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-right">{formatCurrency(totalAnggaranBelanja)}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-right">{formatCurrency(totalRealisasiBelanja)}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-right">{formatCurrency(totalAnggaranBelanja - totalRealisasiBelanja)}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-center">{(totalAnggaranBelanja > 0 ? (totalRealisasiBelanja / totalAnggaranBelanja) * 100 : 0).toFixed(2)}%</td>
                </tr>
                <tr className="h-4 bg-white dark:bg-gray-900 border-none"><td colSpan="5" className="border-none"></td></tr>
                <tr className="bg-gray-800 dark:bg-black text-white font-bold text-base">
                    <td className="px-4 py-3 border border-gray-700">SURPLUS / (DEFISIT)</td>
                    <td className="px-4 py-3 border border-gray-700 text-right">{formatCurrency(totalAnggaranPendapatan - totalAnggaranBelanja)}</td>
                    <td className="px-4 py-3 border border-gray-700 text-right">{formatCurrency(totalRealisasiPendapatan - totalRealisasiBelanja)}</td>
                    <td colSpan="2" className="border border-gray-700"></td>
                </tr>
            </tbody>
        </table>
    );
};

const AsetPreviewTable = ({ data, showDesa }) => (
    <table className="w-full text-sm border-collapse">
       <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
        <tr>
          <th className="px-4 py-3 border dark:border-gray-600">No</th>
          {showDesa && <th className="px-4 py-3 border dark:border-gray-600">Desa</th>}
          <th className="px-4 py-3 border dark:border-gray-600">Nama Aset</th>
          <th className="px-4 py-3 border dark:border-gray-600">Kategori</th>
          <th className="px-4 py-3 border dark:border-gray-600">Tgl Perolehan</th>
          <th className="px-4 py-3 border dark:border-gray-600 text-right">Nilai (Rp)</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, index) => (
          <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
            <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{index + 1}</td>
            {showDesa && <td className="px-4 py-2 border dark:border-gray-600 text-gray-800 dark:text-gray-300">{item.desa}</td>}
            <td className="px-4 py-2 border dark:border-gray-600 text-gray-800 dark:text-gray-300">{item.namaAset}</td>
            <td className="px-4 py-2 border dark:border-gray-600 text-gray-800 dark:text-gray-300">{item.kategori}</td>
            <td className="px-4 py-2 border dark:border-gray-600 text-gray-800 dark:text-gray-300">{safeFormatDate(item.tanggalPerolehan)}</td>
            <td className="px-4 py-2 border dark:border-gray-600 text-right text-gray-800 dark:text-gray-300">{formatCurrency(Number(item.nilaiAset))}</td>
          </tr>
        ))}
      </tbody>
    </table>
);

// --- PERBAIKAN: Tabel Rekap RT RW ---
// Menyamakan tampilan dan logika jumlah dengan RekapitulasiRtRwPage.js
const RekapRtRwPreviewTable = ({ data }) => (
    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 border-collapse">
        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
                <th className="px-6 py-4 text-center w-16 border dark:border-gray-600">NO</th>
                <th className="px-6 py-4 whitespace-nowrap border dark:border-gray-600">NAMA DESA</th>
                <th className="px-6 py-4 text-center border dark:border-gray-600">JML RW</th>
                <th className="px-6 py-4 text-center border dark:border-gray-600">JML RT</th>
                <th className="px-6 py-4 text-center border dark:border-gray-600">JML DUSUN</th>
                <th className="px-6 py-4 text-center border dark:border-gray-600">JML DUKUH</th>
            </tr>
        </thead>
        <tbody>
            {data.map((row, index) => (
                <tr key={row.namaDesa} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                    <td className="px-6 py-4 text-center border dark:border-gray-600 text-gray-900 dark:text-white">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap border dark:border-gray-600">{row.namaDesa}</td>
                    <td className="px-6 py-4 text-center border dark:border-gray-600 text-gray-800 dark:text-gray-300">{row.jumlahRw}</td>
                    <td className="px-6 py-4 text-center border dark:border-gray-600 text-gray-800 dark:text-gray-300">{row.jumlahRt}</td>
                    <td className="px-6 py-4 text-center border dark:border-gray-600 text-gray-800 dark:text-gray-300">{row.jumlahDusun}</td>
                    <td className="px-6 py-4 text-center border dark:border-gray-600 text-gray-800 dark:text-gray-300">{row.jumlahDukuh}</td>
                </tr>
            ))}
            <tr className="bg-gray-200 dark:bg-gray-900 font-bold text-gray-900 dark:text-white border-t-2 border-gray-300 dark:border-gray-500">
                <td colSpan="2" className="px-6 py-4 text-center border dark:border-gray-600">TOTAL KECAMATAN</td>
                <td className="px-6 py-4 text-center border dark:border-gray-600">{data.reduce((sum, row) => sum + row.jumlahRw, 0)}</td>
                <td className="px-6 py-4 text-center border dark:border-gray-600">{data.reduce((sum, row) => sum + row.jumlahRt, 0)}</td>
                <td className="px-6 py-4 text-center border dark:border-gray-600">{data.reduce((sum, row) => sum + row.jumlahDusun, 0)}</td>
                <td className="px-6 py-4 text-center border dark:border-gray-600">{data.reduce((sum, row) => sum + row.jumlahDukuh, 0)}</td>
            </tr>
        </tbody>
    </table>
);

const RekapLembagaPreviewTable = ({ data }) => (
    <table className="w-full text-sm border-collapse">
        <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
                <th className="px-4 py-3 border dark:border-gray-600">No</th>
                <th className="px-4 py-3 border dark:border-gray-600">Nama Desa</th>
                <th className="px-4 py-3 text-center border dark:border-gray-600">Perangkat</th>
                <th className="px-4 py-3 text-center border dark:border-gray-600">BPD</th>
                <th className="px-4 py-3 text-center border dark:border-gray-600">LPM</th>
                <th className="px-4 py-3 text-center border dark:border-gray-600">PKK</th>
                <th className="px-4 py-3 text-center border dark:border-gray-600">Karang Taruna</th>
                <th className="px-4 py-3 text-center border dark:border-gray-600">RT/RW</th>
            </tr>
        </thead>
        <tbody>
            {data.map((item, index) => (
                <tr key={item.desa} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td className="px-4 py-2 border dark:border-gray-600 text-gray-800 dark:text-gray-300">{index + 1}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 font-medium text-gray-900 dark:text-white">{item.desa}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{item.perangkat}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{item.bpd}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{item.lpm}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{item.pkk}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{item.karang_taruna}</td>
                    <td className="px-4 py-2 border dark:border-gray-600 text-center text-gray-800 dark:text-gray-300">{item.rt_rw}</td>
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
    const [filters, setFilters] = useState({ desa: currentUser.role === 'admin_kecamatan' ? 'Punggelan' : currentUser.desa });
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [exportConfig, setExportConfig] = useState(null);
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [isDataReady, setIsDataReady] = useState(false);
    const { showNotification } = useNotification();

    useEffect(() => {
        const fetchPrerequisites = async () => {
            setIsDataReady(false);
            try {
                const [perangkatSnapshot, exportSnap] = await Promise.all([
                    getDocs(query(collection(db, 'perangkat'))),
                    getDoc(doc(db, 'settings', 'exportConfig'))
                ]);
                setAllPerangkat(perangkatSnapshot.docs.map(d => d.data()));
                if (exportSnap.exists()) setExportConfig(exportSnap.data());
            } catch (error) {
                console.error("Gagal memuat data prasyarat:", error);
                showNotification(`Gagal memuat data prasyarat: ${error.message}`, 'error');
            } finally {
                setIsDataReady(true);
            }
        };
        fetchPrerequisites();
    }, []);
    
    useEffect(() => {
        setReportData(null);
    }, [reportType, filters.desa, filterTahun]);

    const handleGenerateReport = async () => {
        setLoading(true);
        setReportData(null);
        const config = reportConfigs[reportType];
        if (!config) {
            showNotification("Jenis laporan tidak valid.", "error");
            setLoading(false);
            return;
        }

        try {
            if (config.type === 'realisasi') {
                if (filters.desa === 'all' && currentUser.role === 'admin_kecamatan') {
                    showNotification('Silakan pilih satu desa spesifik untuk Laporan Realisasi.', 'warning');
                    setLoading(false);
                    return;
                }
                const anggaranQuery = query(
                    collection(db, 'anggaran_tahunan'),
                    where('desa', '==', filters.desa),
                    where('tahun', '==', Number(filterTahun)),
                    where('status', 'in', ["Disahkan", "Perubahan"])
                );
                const anggaranSnapshot = await getDocs(anggaranQuery);
                const anggaranItems = anggaranSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

                const realisasiPromises = anggaranItems.map(async (anggaran) => {
                    const realisasiQuery = query(collection(db, `anggaran_tahunan/${anggaran.id}/realisasi`));
                    const realisasiSnapshot = await getDocs(realisasiQuery);
                    const totalRealisasi = realisasiSnapshot.docs.reduce((sum, doc) => sum + doc.data().jumlah, 0);
                    return { ...anggaran, totalRealisasi };
                });
                const fullData = await Promise.all(realisasiPromises);
                setReportData(fullData);

            } else if (config.type === 'agregat') {
                const collectionsToFetch = ['perangkat', 'bpd', 'lpm', 'pkk', 'karang_taruna', 'rt_rw'];
                const promises = collectionsToFetch.map(coll => getDocs(query(collection(db, coll))));
                const snapshots = await Promise.all(promises);
                
                const allData = {};
                snapshots.forEach((snap, index) => {
                    allData[collectionsToFetch[index]] = snap.docs.map(d => d.data());
                });

                const rekapData = DESA_LIST.map(desaName => {
                    const counts = {};
                    collectionsToFetch.forEach(coll => {
                        counts[coll] = allData[coll].filter(item => item.desa === desaName).length;
                    });
                    return { desa: desaName, ...counts };
                });
                setReportData(rekapData);
                
            } else if (config.type === 'rekap_rt_rw') {
                // PERBAIKAN: Logika hitung yang sinkron dengan RekapitulasiRtRwPage.js
                // RT: jumlah Ketua RT; RW: gunakan nilai MAX dari no_rw sebagai jumlah RW
                const q = query(collection(db, 'rt_rw'));
                const snapshot = await getDocs(q);
                const rawData = snapshot.docs.map(doc => doc.data());

                const rekapPokokData = DESA_LIST.map(desaName => {
                    const desaData = rawData.filter(item => item.desa === desaName);
                    
                    // Filter RT: Punya no_rt, bukan rw_only
                    const rtList = desaData.filter(item => item.no_rt && !item.no_rw_only);
                    // Untuk RW kita akan gunakan max no_rw
                    
                    // HITUNG Jumlah Ketua RT
                    const countRt = rtList.filter(p => p.jabatan && p.jabatan.toLowerCase().includes('ketua')).length;

                    // HITUNG Jumlah RW sebagai MAX no_rw (numeric)
                    let maxRw = 0;
                    desaData.forEach(item => {
                        if (item.no_rw) {
                            const rwNum = parseInt(item.no_rw, 10);
                            if (!isNaN(rwNum) && rwNum > maxRw) maxRw = rwNum;
                        }
                    });
                    const countRw = maxRw;

                    return {
                        namaDesa: desaName,
                        jumlahRw: countRw,
                        jumlahRt: countRt,
                        jumlahDusun: new Set(desaData.filter(d => d.dusun).map(d => d.dusun)).size,
                        jumlahDukuh: new Set(desaData.filter(d => d.dukuh).map(d => d.dukuh)).size,
                    };
                });
                setReportData(rekapPokokData);

            } else { // demografi, aset
                let q;
                if (filters.desa === 'all' && currentUser.role === 'admin_kecamatan') {
                    q = query(collection(db, config.collection));
                } else {
                    q = query(collection(db, config.collection), where('desa', '==', filters.desa));
                }
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setReportData(data);
            }
        } catch (error) {
            console.error("Gagal membuat laporan:", error);
            if (error.code === 'permission-denied') {
                showNotification('Izin ditolak. Aturan keamanan Firestore mungkin perlu disesuaikan.', 'error', 8000);
            } else if (error.code === 'failed-precondition') {
                 showNotification('Kueri memerlukan indeks. Harap buat indeks di Firebase Console seperti yang disarankan pada pesan error di konsol.', 'error', 10000);
            } else {
                showNotification(`Terjadi kesalahan: ${error.message}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!reportData) return;
        const config = reportConfigs[reportType];
        
        switch (config.type) {
            case 'demografi':
                generateDemografiPDF(reportData, filters.desa, exportConfig, config.label, allPerangkat);
                break;
            case 'realisasi':
                generateRealisasiPDF({laporanData: reportData, tahun: filterTahun, desa: filters.desa, exportConfig, allPerangkat});
                break;
            case 'aset':
                generateAsetPDF(reportData, filters.desa, exportConfig, allPerangkat);
                break;
            case 'rekap_rt_rw':
                 generateRekapRtRwPDF(reportData, exportConfig, allPerangkat);
                break;
            case 'agregat':
                generateRekapLembagaPDF(reportData, exportConfig, allPerangkat);
                break;
            default:
                showNotification('Jenis laporan ini tidak didukung untuk diunduh.', 'warning');
        }
    };
    
    const renderPreviewTable = () => {
        if (!reportData) return null;
        if (reportData.length === 0) {
            return <p className="text-center text-gray-500 dark:text-gray-400 py-10">Tidak ada data yang ditemukan untuk filter yang dipilih.</p>;
        }
        const config = reportConfigs[reportType];
        const showDesa = currentUser.role === 'admin_kecamatan' && filters.desa === 'all';
        
        switch (config.type) {
            case 'demografi': return <DemografiPreviewTable data={reportData} showDesa={showDesa} />;
            case 'realisasi': return <RealisasiPreviewTable data={reportData} />;
            case 'aset': return <AsetPreviewTable data={reportData} showDesa={showDesa} />;
            case 'rekap_rt_rw': return <RekapRtRwPreviewTable data={reportData} />;
            case 'agregat': return <RekapLembagaPreviewTable data={reportData} />;
            default: return null;
        }
    };

    const currentConfig = reportConfigs[reportType];
    const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Generator Laporan PDF</h1>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <InputField label="Jenis Laporan" name="reportType" type="select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                        {Object.entries(reportConfigs).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
                    </InputField>

                    {currentUser.role === 'admin_kecamatan' && !['agregat', 'rekap_rt_rw'].includes(currentConfig.type) && (
                        <InputField label="Filter Desa" name="desa" type="select" value={filters.desa} onChange={(e) => setFilters({...filters, desa: e.target.value})}>
                            {currentConfig.type === 'realisasi' ? null : <option value="all">Semua Desa</option>}
                            {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                        </InputField>
                    )}
                    
                    {currentConfig.type === 'realisasi' && (
                         <InputField label="Tahun Anggaran" type="select" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}>
                            {tahunOptions.map(th => <option key={th} value={th}>{th}</option>)}
                        </InputField>
                    )}

                    <div className="md:col-start-2 lg:col-start-4">
                        <button onClick={handleGenerateReport} disabled={loading || !isDataReady} className="w-full h-11 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:bg-blue-400">
                            <FiBarChart2 /> {loading || !isDataReady ? 'Memuat Prasyarat...' : 'Buat Pratinjau'}
                        </button>
                    </div>
                </div>
            </div>

            {loading && <Spinner />}

            {reportData && isDataReady && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pratinjau: {currentConfig.label}</h2>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">{reportData.length} baris data ditemukan.</p>
                        </div>
                        {reportData.length > 0 && (
                            <button onClick={handleDownloadPDF} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 self-start md:self-center">
                                <FiDownload /> Unduh PDF
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto max-h-[70vh] border dark:border-gray-700 rounded-lg">
                        {renderPreviewTable()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LaporanPage;