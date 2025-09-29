import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { FiDownload, FiFilter } from 'react-icons/fi';
import { KATEGORI_PENDAPATAN, KATEGORI_BELANJA, DESA_LIST } from '../utils/constants';

const LaporanRealisasiPage = () => {
    const { currentUser } = useAuth();
    const [anggaranData, setAnggaranData] = useState([]);
    const [transaksiData, setTransaksiData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [filterDesa, setFilterDesa] = useState('all');

    useEffect(() => {
        if (currentUser) {
            setFilterDesa(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        const createQuery = (collName) => {
            let constraints = [where("tahunAnggaran", "==", Number(filterTahun))];
            if (currentUser.role === 'admin_desa') {
                constraints.push(where("desa", "==", currentUser.desa));
            } else if (filterDesa !== 'all') {
                constraints.push(where("desa", "==", filterDesa));
            }
            return query(collection(db, collName), ...constraints);
        };

        const unsubAnggaran = onSnapshot(createQuery('anggaran'), (snapshot) => {
            setAnggaranData(snapshot.docs.map(doc => doc.data()));
        });
        const unsubTransaksi = onSnapshot(createQuery('keuangan'), (snapshot) => {
            setTransaksiData(snapshot.docs.map(doc => doc.data()));
        });
        
        const timer = setTimeout(() => setLoading(false), 500);

        return () => {
            unsubAnggaran();
            unsubTransaksi();
            clearTimeout(timer);
        };
    }, [currentUser, filterTahun, filterDesa]);

    const laporanData = useMemo(() => {
        const calculateData = (kategoriList, jenis) => {
            return kategoriList.map(kat => {
                const anggaran = anggaranData
                    .filter(a => a.kategori === kat.nama && a.jenis === jenis)
                    .reduce((sum, a) => sum + a.jumlah, 0);
                const realisasi = transaksiData
                    .filter(t => t.kategori === kat.nama && t.jenis === jenis)
                    .reduce((sum, t) => sum + t.jumlah, 0);
                const sisa = anggaran - realisasi;
                const persentase = anggaran > 0 ? (realisasi / anggaran) * 100 : 0;
                return { kategori: kat.nama, bidang: kat.bidang, anggaran, realisasi, sisa, persentase };
            });
        };
        
        return {
            pendapatan: calculateData(KATEGORI_PENDAPATAN, 'Pendapatan'),
            belanja: calculateData(KATEGORI_BELANJA, 'Belanja'),
        };
    }, [anggaranData, transaksiData]);

    const formatCurrency = (value) => new Intl.NumberFormat('id-ID').format(value || 0);

    const renderTable = (title, data, colorClass) => (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h2 className={`text-xl font-bold ${colorClass} mb-4`}>{title}</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-4 py-2">Uraian</th>
                            <th className="px-4 py-2 text-right">Anggaran (Rp)</th>
                            <th className="px-4 py-2 text-right">Realisasi (Rp)</th>
                            <th className="px-4 py-2 text-right">Sisa (Rp)</th>
                            <th className="px-4 py-2 text-center">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from(new Set(data.map(d => d.bidang))).map(bidang => (
                            <React.Fragment key={bidang}>
                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                    <td colSpan="5" className="px-4 py-2 font-bold text-gray-800 dark:text-gray-200">{bidang}</td>
                                </tr>
                                {data.filter(d => d.bidang === bidang).map((item, idx) => (
                                    <tr key={idx} className="border-b dark:border-gray-700">
                                        <td className="px-4 py-2 pl-8">{item.kategori}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(item.anggaran)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(item.realisasi)}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(item.sisa)}</td>
                                        <td className="px-4 py-2 text-center">{item.persentase.toFixed(2)}%</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    if (loading) return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Laporan Realisasi Anggaran</h1>
                <div className="flex items-center gap-4">
                    <InputField label="Tahun" type="number" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} />
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField label="Desa" type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                    <button className="px-4 py-2 mt-6 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                        <FiDownload /> Ekspor
                    </button>
                </div>
            </div>

            {renderTable("Realisasi Pendapatan", laporanData.pendapatan, "text-green-600 dark:text-green-400")}
            {renderTable("Realisasi Belanja", laporanData.belanja, "text-red-600 dark:text-red-400")}

        </div>
    );
};

export default LaporanRealisasiPage;

