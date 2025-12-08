import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where, doc, getDoc, collectionGroup } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { DESA_LIST } from '../utils/constants';
// [PERBAIKAN] Menambahkan FiDollarSign ke import
import { FiDownload, FiFilter, FiFileText, FiTrendingUp, FiTrendingDown, FiActivity, FiSearch, FiPrinter, FiDollarSign } from 'react-icons/fi';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import InputField from '../components/common/InputField';
import { generateRealisasiXLSX } from '../utils/generateRealisasiXLSX';

// --- HELPER FORMATTING ---
const formatCurrency = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`;

const formatRupiahKompak = (value) => {
    const num = Number(value);
    if (isNaN(num)) return 'Rp 0';
    if (Math.abs(num) >= 1e12) return `Rp ${(num / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T`;
    if (Math.abs(num) >= 1e9) return `Rp ${(num / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
    if (Math.abs(num) >= 1e6) return `Rp ${(num / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Jt`;
    return `Rp ${num.toLocaleString('id-ID')}`;
};

// --- KOMPONEN SUMMARY CARD (DALAM LAPORAN) ---
const SummaryCard = ({ title, value, subTitle, colorClass, icon }) => (
    <div className={`p-4 rounded-xl border ${colorClass} bg-opacity-10 shadow-sm flex items-start gap-3`}>
        <div className={`p-2 rounded-lg text-white shadow-sm ${colorClass.replace('border-', 'bg-').replace('/30', '')}`}>
            {icon}
        </div>
        <div>
            <p className="text-xs font-bold uppercase opacity-70 text-gray-600 dark:text-gray-300">{title}</p>
            <p className="text-lg md:text-xl font-bold text-gray-800 dark:text-white">{formatCurrency(value)}</p>
            <p className="text-xs opacity-60 text-gray-500 dark:text-gray-400">{subTitle}</p>
        </div>
    </div>
);

// --- PREVIEW LAPORAN ---
const LaporanRealisasiPreview = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500 dark:text-gray-400">
                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                    <FiFileText size={40} className="opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200">Tidak ada data anggaran</h3>
                <p className="text-sm mt-1">Belum ada anggaran yang disahkan untuk periode ini.</p>
            </div>
        );
    }

    // Proses Data: Mengelompokkan berdasarkan Jenis dan Bidang
    const processedData = data.reduce((acc, item) => {
        const isPendapatan = item.jenis === 'Pendapatan';
        const target = isPendapatan ? acc.pendapatan : acc.belanja;
        
        if (!target[item.bidang]) target[item.bidang] = [];
        target[item.bidang].push(item);
        
        if (isPendapatan) {
            acc.totalAnggaranPendapatan += (item.jumlah || 0);
            acc.totalRealisasiPendapatan += (item.totalRealisasi || 0);
        } else {
            acc.totalAnggaranBelanja += (item.jumlah || 0);
            acc.totalRealisasiBelanja += (item.totalRealisasi || 0);
        }
        return acc;
    }, { 
        pendapatan: {}, 
        belanja: {}, 
        totalAnggaranPendapatan: 0, 
        totalRealisasiPendapatan: 0, 
        totalAnggaranBelanja: 0, 
        totalRealisasiBelanja: 0 
    });

    const surplusDefisitAnggaran = processedData.totalAnggaranPendapatan - processedData.totalAnggaranBelanja;
    const surplusDefisitRealisasi = processedData.totalRealisasiPendapatan - processedData.totalRealisasiBelanja;

    // Helper render section tabel
    const renderTableSection = (title, sectionData, totalAnggaran, totalRealisasi, themeColor) => (
        <div className="mb-8 last:mb-0 animate-fadeIn">
            {/* Section Header */}
            <div className={`px-5 py-3 rounded-t-xl font-bold text-lg flex flex-col md:flex-row justify-between md:items-center gap-2 border-b border-gray-200 dark:border-gray-700
                ${themeColor === 'green' 
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300' 
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300'}`
            }>
                <span className="flex items-center gap-2">
                    {themeColor === 'green' ? <FiTrendingUp/> : <FiTrendingDown/>}
                    {title}
                </span>
                <span className="text-xs md:text-sm font-normal opacity-90 bg-white dark:bg-gray-800 px-3 py-1 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                    Realisasi: <span className="font-bold">{formatCurrency(totalRealisasi)}</span>
                </span>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto border-x border-b border-gray-200 dark:border-gray-700 rounded-b-xl bg-white dark:bg-gray-800">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 uppercase text-xs font-semibold border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="px-5 py-3 min-w-[250px]">Uraian</th>
                            <th className="px-5 py-3 text-right">Anggaran</th>
                            <th className="px-5 py-3 text-right">Realisasi</th>
                            <th className="px-5 py-3 text-right">Sisa</th>
                            <th className="px-5 py-3 text-center">%</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {Object.entries(sectionData).map(([bidang, items]) => (
                            <React.Fragment key={bidang}>
                                <tr className="bg-gray-50/50 dark:bg-gray-800">
                                    <td colSpan="5" className="px-5 py-2 font-bold text-gray-700 dark:text-gray-300 text-xs tracking-wide uppercase border-l-4 border-gray-300 dark:border-gray-600">
                                        {bidang}
                                    </td>
                                </tr>
                                {items.map(item => {
                                    const sisa = (item.jumlah || 0) - (item.totalRealisasi || 0);
                                    const persentase = item.jumlah > 0 ? (item.totalRealisasi / item.jumlah) * 100 : 0;
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-5 py-3 pl-8 text-gray-900 dark:text-gray-100 font-medium">{item.uraian}</td>
                                            <td className="px-5 py-3 text-right font-mono text-gray-600 dark:text-gray-400">{formatCurrency(item.jumlah)}</td>
                                            <td className="px-5 py-3 text-right font-mono font-medium text-gray-800 dark:text-gray-200">{formatCurrency(item.totalRealisasi)}</td>
                                            <td className={`px-5 py-3 text-right font-mono ${sisa < 0 ? 'text-red-500' : 'text-gray-500 dark:text-gray-500'}`}>{formatCurrency(sisa)}</td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${persentase >= 100 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : persentase >= 50 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                                    {persentase.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                         <tr className={`font-bold border-t-2 ${themeColor === 'green' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900'}`}>
                            <td className="px-5 py-3 text-right uppercase text-xs tracking-wider text-gray-600 dark:text-gray-300">Total {title}</td>
                            <td className="px-5 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(totalAnggaran)}</td>
                            <td className="px-5 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(totalRealisasi)}</td>
                            <td className="px-5 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(totalAnggaran - totalRealisasi)}</td>
                            <td className="px-5 py-3 text-center text-gray-900 dark:text-white">{(totalAnggaran > 0 ? (totalRealisasi / totalAnggaran) * 100 : 0).toFixed(2)}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="mt-6">
            {/* Mini Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <SummaryCard 
                    title="Total Pendapatan" 
                    value={processedData.totalRealisasiPendapatan} 
                    subTitle={`Target: ${formatRupiahKompak(processedData.totalAnggaranPendapatan)}`}
                    colorClass="border-emerald-500 bg-emerald-500"
                    icon={<FiTrendingUp size={20} />}
                />
                <SummaryCard 
                    title="Total Belanja" 
                    value={processedData.totalRealisasiBelanja} 
                    subTitle={`Pagu: ${formatRupiahKompak(processedData.totalAnggaranBelanja)}`}
                    colorClass="border-rose-500 bg-rose-500"
                    icon={<FiTrendingDown size={20} />}
                />
                <SummaryCard 
                    title="Surplus / (Defisit)" 
                    value={surplusDefisitRealisasi} 
                    subTitle="Selisih Realisasi"
                    colorClass={surplusDefisitRealisasi >= 0 ? "border-blue-500 bg-blue-500" : "border-orange-500 bg-orange-500"}
                    icon={<FiActivity size={20} />}
                />
            </div>

            {/* Tabel Detail - [PERBAIKAN] Menggunakan nama fungsi yang benar: renderTableSection */}
            {renderTableSection('PENDAPATAN', processedData.pendapatan, processedData.totalAnggaranPendapatan, processedData.totalRealisasiPendapatan, 'green')}
            {renderTableSection('BELANJA', processedData.belanja, processedData.totalAnggaranBelanja, processedData.totalRealisasiBelanja, 'red')}
            
            {/* Grand Summary Footer */}
            <div className="bg-gray-800 dark:bg-black text-white p-5 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center mt-6">
                 <div className="flex items-center gap-3">
                     <div className="p-2 bg-gray-700 rounded-lg"><FiDollarSign size={24}/></div>
                     <div>
                        <p className="text-sm opacity-80 font-medium">Sisa Lebih Pembiayaan Anggaran (SiLPA)</p>
                        <p className="text-xs opacity-50">Tahun Anggaran {data[0]?.tahun || ''}</p>
                     </div>
                 </div>
                 <span className={`text-2xl md:text-3xl font-mono font-bold mt-2 md:mt-0 ${surplusDefisitRealisasi < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatCurrency(surplusDefisitRealisasi)}
                 </span>
            </div>
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
                where('tahun', '==', Number(selectedTahun)),
                where('status', 'in', ['Disahkan', 'Perubahan']) // Pastikan hanya yang disahkan
            );
            const anggaranSnapshot = await getDocs(anggaranQuery);
            const anggaranItems = anggaranSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Ambil semua realisasi untuk desa & tahun ini sekaligus (Optimasi)
            // Menggunakan parentDesa untuk filter cepat
            const realisasiQuery = query(
                collectionGroup(db, 'realisasi'),
                where('parentDesa', '==', selectedDesa)
            );
            const realisasiSnapshot = await getDocs(realisasiQuery);
            const allRealisasi = realisasiSnapshot.docs.map(doc => doc.data());

            // Map Realisasi ke Anggaran
            const fullData = anggaranItems.map(anggaran => {
                const relatedRealisasi = allRealisasi.filter(r => r.parentAnggaranId === anggaran.id);
                // Filter tahun realisasi jika perlu (meski biasanya ikut tahun anggaran)
                const validRealisasi = relatedRealisasi.filter(r => {
                     const rYear = r.tanggal?.toDate ? r.tanggal.toDate().getFullYear() : new Date(r.tanggal).getFullYear();
                     return rYear === Number(selectedTahun);
                });
                
                const totalRealisasi = validRealisasi.reduce((sum, r) => sum + (Number(r.jumlah) || 0), 0);
                return { ...anggaran, totalRealisasi };
            });

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
        <div className="space-y-8 pb-12">
            
            {/* --- HEADER & FILTERS --- */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <FiFileText className="text-blue-600"/> Laporan Realisasi APBDes
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Rekapitulasi pelaksanaan anggaran desa.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
                    {currentUser.role === 'admin_kecamatan' && (
                        <div className="w-full md:w-48">
                            <InputField 
                                type="select" 
                                value={selectedDesa} 
                                onChange={(e) => setSelectedDesa(e.target.value)} 
                                className="bg-gray-50 border-none"
                                icon={<FiFilter />}
                            >
                                <option value="all">-- Pilih Desa --</option>
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                            </InputField>
                        </div>
                    )}
                    <div className="w-full md:w-32">
                         <InputField type="select" value={selectedTahun} onChange={(e) => setSelectedTahun(parseInt(e.target.value, 10))} className="bg-gray-50 border-none">
                              {tahunOptions.map(th => <option key={th} value={th}>{th}</option>)}
                         </InputField>
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button onClick={handleGenerateReport} disabled={loading || selectedDesa === 'all'} variant="primary" className="whitespace-nowrap flex-1 md:flex-none justify-center">
                            <FiSearch className="mr-1"/> Tampilkan
                        </Button>
                        <Button onClick={handleExport} variant="success" disabled={!laporanData} className="whitespace-nowrap flex-1 md:flex-none justify-center">
                            <FiDownload className="mr-1"/> Ekspor
                        </Button>
                    </div>
                </div>
            </div>
            
            {/* --- REPORT CONTENT AREA --- */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[400px]">
                {loading && (
                    <div className="flex flex-col justify-center items-center h-64 text-gray-500">
                        <Spinner size="lg" />
                        <p className="mt-4 text-sm animate-pulse">Mengolah data realisasi...</p>
                    </div>
                )}
                
                {!loading && laporanData && (
                    <div className="animate-fadeIn">
                        <div className="text-center mb-8 border-b pb-4 dark:border-gray-700">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-wide">Laporan Realisasi APBDes</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Pemerintah Desa {selectedDesa} Tahun Anggaran {selectedTahun}</p>
                        </div>
                        <LaporanRealisasiPreview data={laporanData} />
                    </div>
                )}
                
                {!loading && !laporanData && (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400 dark:text-gray-500">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-full mb-4">
                            <FiFileText size={48} className="opacity-40" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300">Belum ada laporan ditampilkan</h3>
                        <p className="text-sm mt-2 max-w-md mx-auto">Silakan pilih Desa dan Tahun Anggaran pada panel filter di atas, lalu klik tombol <strong>"Tampilkan"</strong> untuk melihat laporan.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LaporanRealisasiPage;