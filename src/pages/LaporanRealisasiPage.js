import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where, collectionGroup, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { DESA_LIST } from '../utils/constants';
import { FiDownload, FiFilter } from 'react-icons/fi';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import InputField from '../components/common/InputField';
import { generateRealisasiXLSX } from '../utils/generateRealisasiXLSX';

const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);

const LaporanRealisasiPreview = ({ data, desa, tahun }) => {
    if (!data) {
        return <p className="text-center text-gray-500 mt-8">Memuat data...</p>;
    }
    if (data.length === 0) {
        return <p className="text-center text-gray-500 mt-8">Tidak ada data anggaran untuk {desa} tahun {tahun}.</p>;
    }

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

    const renderSection = (title, sectionData, totalAnggaran, totalRealisasi) => (
        <>
            <tr className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                <th colSpan="5" className="px-4 py-2 text-left font-bold text-lg text-gray-900 dark:text-white">{title}</th>
            </tr>
            {Object.entries(sectionData).map(([bidang, items]) => (
                <React.Fragment key={bidang}>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                        <td colSpan="5" className="px-4 py-2 font-bold text-gray-800 dark:text-gray-200">{bidang}</td>
                    </tr>
                    {items.map(item => {
                        const sisa = item.jumlah - item.totalRealisasi;
                        const persentase = item.jumlah > 0 ? (item.totalRealisasi / item.jumlah) * 100 : 0;
                        return (
                            <tr key={item.id} className="border-b dark:border-gray-700">
                                <td className="pl-8 pr-4 py-2">{item.uraian}</td>
                                <td className="px-4 py-2 text-right">{formatRupiah(item.jumlah)}</td>
                                <td className="px-4 py-2 text-right">{formatRupiah(item.totalRealisasi)}</td>
                                <td className="px-4 py-2 text-right">{formatRupiah(sisa)}</td>
                                <td className="px-4 py-2 text-center">{persentase.toFixed(2)}%</td>
                            </tr>
                        );
                    })}
                </React.Fragment>
            ))}
            <tr className="bg-gray-200 dark:bg-gray-600 font-bold">
                <td className="px-4 py-2">JUMLAH {title}</td>
                <td className="px-4 py-2 text-right">{formatRupiah(totalAnggaran)}</td>
                <td className="px-4 py-2 text-right">{formatRupiah(totalRealisasi)}</td>
                <td className="px-4 py-2 text-right">{formatRupiah(totalAnggaran - totalRealisasi)}</td>
                <td className="px-4 py-2 text-center">{(totalAnggaran > 0 ? (totalRealisasi / totalAnggaran) * 100 : 0).toFixed(2)}%</td>
            </tr>
        </>
    );
    
    const surplusDefisitAnggaran = totalAnggaranPendapatan - totalAnggaranBelanja;
    const surplusDefisitRealisasi = totalRealisasiPendapatan - totalRealisasiBelanja;
    
    return (
        <div className="overflow-x-auto max-h-[60vh] mt-6 relative border rounded-lg dark:border-gray-700">
            <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-200 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-10">
                    <tr>
                        <th className="px-4 py-3 w-2/5">Uraian</th>
                        <th className="px-4 py-3 text-right">Anggaran</th>
                        <th className="px-4 py-3 text-right">Realisasi</th>
                        <th className="px-4 py-3 text-right">Lebih/(Kurang)</th>
                        <th className="px-4 py-3 text-center">%</th>
                    </tr>
                </thead>
                <tbody>
                    {renderSection('PENDAPATAN', pendapatan, totalAnggaranPendapatan, totalRealisasiPendapatan)}
                    <tr className="h-4"></tr>
                    {renderSection('BELANJA', belanja, totalAnggaranBelanja, totalRealisasiBelanja)}
                    <tr className="h-4"></tr>
                    <tr className="bg-gray-800 dark:bg-black text-white font-bold text-base">
                        <td className="px-4 py-3">SURPLUS / (DEFISIT)</td>
                        <td className="px-4 py-3 text-right">{formatRupiah(surplusDefisitAnggaran)}</td>
                        <td className="px-4 py-3 text-right">{formatRupiah(surplusDefisitRealisasi)}</td>
                        <td className="px-4 py-3 text-right">{formatRupiah(surplusDefisitRealisasi - surplusDefisitAnggaran)}</td>
                        <td className="px-4 py-3 text-center">{(surplusDefisitAnggaran !== 0 ? (surplusDefisitRealisasi / surplusDefisitAnggaran) * 100 : 0).toFixed(2)}%</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

const LaporanRealisasiPage = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [laporanData, setLaporanData] = useState(null);
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [exportConfig, setExportConfig] = useState(null);
    const [selectedDesa, setSelectedDesa] = useState('all');
    const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());

    useEffect(() => {
        if (currentUser.role === 'admin_desa') {
            setSelectedDesa(currentUser.desa);
        }
        // Fetch non-report data once
        const fetchPrerequisites = async () => {
             const [perangkatSnapshot, configDoc] = await Promise.all([
                getDocs(collection(db, 'perangkat')),
                getDoc(doc(db, 'settings', 'exportConfig'))
            ]);
            setAllPerangkat(perangkatSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            if (configDoc.exists()) {
                setExportConfig(configDoc.data());
            }
        };
        fetchPrerequisites();
    }, [currentUser]);

    const handleGenerateReport = async () => {
        if (selectedDesa === 'all') {
            alert("Silakan pilih satu desa untuk melihat laporannya.");
            return;
        }
        setLoading(true);
        setLaporanData(null);
        try {
            const anggaranQuery = query(
                collection(db, 'anggaran_tahunan'),
                where('desa', '==', selectedDesa),
                where('tahun', '==', Number(selectedTahun))
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
            setLaporanData(fullData);

        } catch (error) {
            console.error("Gagal membuat laporan:", error);
            alert("Gagal memuat data laporan.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleExport = () => {
        if (!laporanData) {
            alert("Buat pratinjau laporan terlebih dahulu.");
            return;
        }
        generateRealisasiXLSX({
            laporanData: laporanData,
            tahun: selectedTahun,
            desa: selectedDesa,
            exportConfig,
            allPerangkat
        });
    };

    const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex justify-between items-end gap-4">
                <div>
                    <h1 className="text-xl font-semibold">Laporan Realisasi APBDes</h1>
                    <div className="flex items-end gap-4 mt-2">
                        {currentUser.role === 'admin_kecamatan' && (
                            <InputField label="Pilih Desa" type="select" value={selectedDesa} onChange={(e) => setSelectedDesa(e.target.value)} icon={<FiFilter />}>
                                <option value="all">-- Pilih Desa --</option>
                                {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                            </InputField>
                        )}
                        <InputField label="Tahun Anggaran" type="select" value={selectedTahun} onChange={(e) => setSelectedTahun(parseInt(e.target.value, 10))}>
                            {tahunOptions.map(tahun => <option key={tahun} value={tahun}>{tahun}</option>)}
                        </InputField>
                        <Button onClick={handleGenerateReport} disabled={loading || selectedDesa === 'all'}>
                            Tampilkan Laporan
                        </Button>
                    </div>
                </div>
                <Button onClick={handleExport} variant="success" disabled={!laporanData}>
                    <FiDownload className="mr-2" /> Ekspor Laporan
                </Button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                {loading && <div className="flex justify-center items-center h-64"><Spinner /></div>}
                {!loading && laporanData && <LaporanRealisasiPreview data={laporanData} desa={selectedDesa} tahun={selectedTahun} />}
                {!loading && !laporanData && <p className="text-center text-gray-500 py-10">Pilih desa dan tahun, lalu klik "Tampilkan Laporan" untuk melihat pratinjau.</p>}
            </div>
        </div>
    );
};

export default LaporanRealisasiPage;

