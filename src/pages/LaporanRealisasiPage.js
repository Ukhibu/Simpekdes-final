import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { DESA_LIST, BIDANG_BELANJA, KATEGORI_PENDAPATAN } from '../utils/constants';
import { FiDownload, FiFilter } from 'react-icons/fi';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import InputField from '../components/common/InputField';
import { generateRealisasiXLSX } from '../utils/generateRealisasiXLSX';

// --- Helper Function ---
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(number || 0);
};

// --- Komponen Pratinjau ---
const LaporanRealisasiPreview = ({ data, desa, tahun }) => {
    if (!data || (Object.keys(data.pendapatan).length === 0 && Object.keys(data.belanja).length === 0)) {
        return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">Tidak ada data untuk ditampilkan pada {desa} tahun {tahun}.</p>;
    }

    let totalAnggaranPendapatan = 0;
    let totalRealisasiPendapatan = 0;
    let totalAnggaranBelanja = 0;
    let totalRealisasiBelanja = 0;

    const renderSection = (title, sectionData, isBelanja = false) => {
        let sectionAnggaran = 0;
        let sectionRealisasi = 0;

        const rows = Object.entries(sectionData).flatMap(([bidang, items]) => {
            if (items.length === 0) return [];
            
            const bidangAnggaran = items.reduce((acc, item) => acc + item.anggaran, 0);
            const bidangRealisasi = items.reduce((acc, item) => acc + item.realisasi, 0);

            sectionAnggaran += bidangAnggaran;
            sectionRealisasi += bidangRealisasi;

            return [
                <tr key={bidang} className="bg-gray-50 dark:bg-gray-700">
                    <td colSpan="5" className="px-4 py-2 font-bold text-gray-800 dark:text-gray-200">{bidang}</td>
                </tr>,
                ...items.map((item, index) => {
                    const sisa = item.anggaran - item.realisasi;
                    const persentase = item.anggaran > 0 ? (item.realisasi / item.anggaran) * 100 : 0;
                    return (
                        <tr key={`${bidang}-${index}`} className="border-b dark:border-gray-700">
                            <td className="pl-8 pr-4 py-2">{item.kategori}</td>
                            <td className="px-4 py-2 text-right">{formatRupiah(item.anggaran)}</td>
                            <td className="px-4 py-2 text-right">{formatRupiah(item.realisasi)}</td>
                            <td className="px-4 py-2 text-right">{formatRupiah(sisa)}</td>
                            <td className="px-4 py-2 text-center">{persentase.toFixed(2)}%</td>
                        </tr>
                    );
                })
            ];
        });

        if (isBelanja) {
            totalAnggaranBelanja += sectionAnggaran;
            totalRealisasiBelanja += sectionRealisasi;
        } else {
            totalAnggaranPendapatan += sectionAnggaran;
            totalRealisasiPendapatan += sectionRealisasi;
        }

        const totalSisa = sectionAnggaran - sectionRealisasi;
        const totalPersentase = sectionAnggaran > 0 ? (sectionRealisasi / sectionAnggaran) * 100 : 0;

        return (
            <>
                <tr className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <th colSpan="5" className="px-4 py-2 text-left font-bold text-lg text-gray-900 dark:text-white">{title}</th>
                </tr>
                {rows}
                <tr className="bg-gray-200 dark:bg-gray-600 font-bold">
                    <td className="px-4 py-2">JUMLAH {title}</td>
                    <td className="px-4 py-2 text-right">{formatRupiah(sectionAnggaran)}</td>
                    <td className="px-4 py-2 text-right">{formatRupiah(sectionRealisasi)}</td>
                    <td className="px-4 py-2 text-right">{formatRupiah(totalSisa)}</td>
                    <td className="px-4 py-2 text-center">{totalPersentase.toFixed(2)}%</td>
                </tr>
            </>
        );
    };
    
    // Panggil renderSection untuk mengisi totalAnggaran dan totalRealisasi
    renderSection('PENDAPATAN', data.pendapatan, false);
    renderSection('BELANJA', data.belanja, true);

    const surplusDefisitAnggaran = totalAnggaranPendapatan - totalAnggaranBelanja;
    const surplusDefisitRealisasi = totalRealisasiPendapatan - totalRealisasiBelanja;
    const surplusSisa = surplusDefisitAnggaran - surplusDefisitRealisasi;
    const surplusPersentase = surplusDefisitAnggaran !== 0 ? (surplusDefisitRealisasi / surplusDefisitAnggaran) * 100 : 0;


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
                    {renderSection('PENDAPATAN', data.pendapatan)}
                    <tr className="h-4"></tr>
                    {renderSection('BELANJA', data.belanja, true)}
                     <tr className="h-4"></tr>
                    <tr className="bg-gray-800 dark:bg-black text-white font-bold text-base">
                        <td className="px-4 py-3">SURPLUS / (DEFISIT)</td>
                        <td className="px-4 py-3 text-right">{formatRupiah(surplusDefisitAnggaran)}</td>
                        <td className="px-4 py-3 text-right">{formatRupiah(surplusDefisitRealisasi)}</td>
                        <td className="px-4 py-3 text-right">{formatRupiah(surplusSisa)}</td>
                        <td className="px-4 py-3 text-center">{surplusPersentase.toFixed(2)}%</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};


const LaporanRealisasiPage = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [penganggaran, setPenganggaran] = useState([]);
    const [penatausahaan, setPenatausahaan] = useState([]);
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [exportConfig, setExportConfig] = useState(null);
    const [selectedDesa, setSelectedDesa] = useState('all');
    const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());

    useEffect(() => {
        if (!currentUser) return;

        setLoading(true);
        const fetchData = async () => {
            try {
                const [penganggaranSnapshot, penatausahaanSnapshot, perangkatSnapshot, configDoc] = await Promise.all([
                    getDocs(collection(db, 'penganggaran')),
                    getDocs(collection(db, 'penatausahaan')),
                    getDocs(collection(db, 'perangkat')),
                    getDoc(doc(db, 'settings', 'exportConfig'))
                ]);

                setPenganggaran(penganggaranSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setPenatausahaan(penatausahaanSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setAllPerangkat(perangkatSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                
                if (configDoc.exists()) {
                    setExportConfig(configDoc.data());
                }

            } catch (error) {
                console.error("Gagal memuat data laporan:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        
        if (currentUser.role === 'admin_desa') {
            setSelectedDesa(currentUser.desa);
        }

    }, [currentUser]);

    const laporanData = useMemo(() => {
        const dataByDesa = {};
        const desaListToProcess = selectedDesa === 'all' ? DESA_LIST : [selectedDesa];

        desaListToProcess.forEach(desa => {
            const anggaranDesa = penganggaran.filter(p => p.desa === desa && p.tahun === selectedTahun);
            
            const realisasiDesa = penatausahaan.filter(p => {
                if (p.desa !== desa) return false;
                let itemDate;
                if (p.tanggal && typeof p.tanggal.toDate === 'function') {
                    itemDate = p.tanggal.toDate();
                } else if (p.tanggal) {
                    itemDate = new Date(p.tanggal);
                } else {
                    return false;
                }
                return !isNaN(itemDate.getTime()) && itemDate.getFullYear() === selectedTahun;
            });

            const data = { pendapatan: {}, belanja: {} };

            // Gabungkan semua kategori dari konstanta dan data aktual
            const allKategoriAnggaran = new Map(anggaranDesa.map(item => [item.kategori, item]));
            const allKategoriRealisasi = penatausahaan.map(item => item.kategori);
            const allUniqueKategoriNames = [...new Set([...KATEGORI_PENDAPATAN.map(k => k.nama), ...allKategoriAnggaran.keys(), ...allKategoriRealisasi])];
            
            const kategoriDetails = new Map(KATEGORI_PENDAPATAN.map(k => [k.nama, { bidang: k.bidang, jenis: k.jenis }]));

            allUniqueKategoriNames.forEach(katNama => {
                const details = kategoriDetails.get(katNama);
                if (!details) return;

                const anggaran = anggaranDesa.find(a => a.jenis === details.jenis && a.kategori === katNama)?.jumlah || 0;
                const realisasi = realisasiDesa.filter(r => r.jenis === details.jenis && r.kategori === katNama).reduce((acc, curr) => acc + curr.jumlah, 0);

                if (anggaran > 0 || realisasi > 0) {
                    const targetSection = details.jenis === 'Pendapatan' ? data.pendapatan : data.belanja;
                    if (!targetSection[details.bidang]) {
                        targetSection[details.bidang] = [];
                    }
                    targetSection[details.bidang].push({ kategori: katNama, anggaran, realisasi });
                }
            });
            
            dataByDesa[desa] = data;
        });
        
        return dataByDesa;
    }, [penganggaran, penatausahaan, selectedTahun, selectedDesa]);
    
    const handleExport = () => {
        if (loading) {
            alert("Data masih dimuat, mohon tunggu sebentar.");
            return;
        }
        
        const dataToExport = laporanData[selectedDesa];
        if (!dataToExport) {
            alert("Tidak ada data untuk desa dan tahun yang dipilih.");
            return;
        }

        generateRealisasiXLSX({
            laporanData: dataToExport,
            tahun: selectedTahun,
            desa: selectedDesa,
            exportConfig,
            allPerangkat
        });
    };

    const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-xl font-semibold text-gray-800 dark:text-white">Laporan Realisasi APBDes</h1>
                <div className="flex items-center gap-4 flex-wrap">
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField
                            type="select"
                            value={selectedDesa}
                            onChange={(e) => setSelectedDesa(e.target.value)}
                            icon={<FiFilter />}
                        >
                            <option value="all" disabled>Pilih Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                     <InputField
                        type="select"
                        value={selectedTahun}
                        onChange={(e) => setSelectedTahun(parseInt(e.target.value, 10))}
                        icon={<FiFilter />}
                    >
                        {tahunOptions.map(tahun => <option key={tahun} value={tahun}>{tahun}</option>)}
                    </InputField>
                    <Button onClick={handleExport} variant="success" disabled={loading || selectedDesa === 'all'}>
                        <FiDownload className="mr-2" /> {loading ? 'Memuat...' : 'Ekspor Laporan'}
                    </Button>
                </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Spinner /></div>
                ) : selectedDesa === 'all' ? (
                     <div className="text-center text-gray-500 dark:text-gray-400">
                        <h2 className="text-lg font-bold mb-4">Silakan Pilih Desa</h2>
                        <p>Pilih salah satu desa dari daftar untuk melihat pratinjau laporan realisasi.</p>
                    </div>
                ) : (
                    <LaporanRealisasiPreview data={laporanData[selectedDesa]} desa={selectedDesa} tahun={selectedTahun} />
                )}
            </div>
        </div>
    );
};

export default LaporanRealisasiPage;

