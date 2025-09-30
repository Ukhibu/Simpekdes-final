import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import { FiDownload } from 'react-icons/fi';
import { DESA_LIST, BIDANG_BELANJA, KATEGORI_PENDAPATAN } from '../utils/constants';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const LaporanRealisasiPage = () => {
    const { currentUser } = useAuth();
    const [anggaranList, setAnggaranList] = useState([]);
    const [transaksiList, setTransaksiList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_desa' ? currentUser.desa : 'all');
    
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [exportConfig, setExportConfig] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser || (currentUser.role === 'admin_kecamatan' && filterDesa === 'all')) {
                setAnggaranList([]);
                setTransaksiList([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            const desa = currentUser.role === 'admin_desa' ? currentUser.desa : filterDesa;
            const tahun = Number(filterTahun);

            const anggaranQuery = query(
                collection(db, "anggaran"),
                where("desa", "==", desa),
                where("tahunAnggaran", "==", tahun)
            );
            const transaksiQuery = query(
                collection(db, "keuangan"),
                where("desa", "==", desa),
                where("tahunAnggaran", "==", tahun)
            );

            const unsubAnggaran = onSnapshot(anggaranQuery, snapshot => {
                setAnggaranList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            const unsubTransaksi = onSnapshot(transaksiQuery, snapshot => {
                setTransaksiList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            try {
                const exportRef = doc(db, 'settings', 'exportConfig');
                const exportSnap = await getDoc(exportRef);
                if (exportSnap.exists()) setExportConfig(exportSnap.data());

                const perangkatQuery = query(collection(db, 'perangkat'));
                const perangkatSnap = await getDocs(perangkatQuery);
                setAllPerangkat(perangkatSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Gagal mengambil data ekspor:", error);
            }

            setLoading(false);
            return () => {
                unsubAnggaran();
                unsubTransaksi();
            };
        };
        fetchData();
    }, [currentUser, filterTahun, filterDesa]);

    const laporanData = useMemo(() => {
        const data = { pendapatan: [], belanja: [] };

        // --- PERBAIKAN: Gunakan kategori.nama bukan seluruh objek ---
        KATEGORI_PENDAPATAN.forEach(kategori => {
            const anggaran = anggaranList.find(a => a.kategori === kategori.nama && a.jenis === 'Pendapatan');
            const realisasi = transaksiList
                .filter(t => t.kategori === kategori.nama && t.jenis === 'Pemasukan')
                .reduce((sum, t) => sum + Number(t.jumlah), 0);
            data.pendapatan.push({ kategori: kategori.nama, anggaran: anggaran?.jumlah || 0, realisasi });
        });
        
        BIDANG_BELANJA.forEach(item => {
             const anggaran = anggaranList.find(a => a.kategori === item.nama && a.jenis === 'Belanja');
             const realisasi = transaksiList
                .filter(t => t.kategori === item.nama && t.jenis === 'Pengeluaran')
                .reduce((sum, t) => sum + Number(t.jumlah), 0);
            data.belanja.push({ kategori: item.nama, bidang: item.bidang, anggaran: anggaran?.jumlah || 0, realisasi });
        });

        return data;
    }, [anggaranList, transaksiList]);

    const handleExport = async () => {
        if (filterDesa === 'all') {
            alert("Silakan pilih desa terlebih dahulu untuk mengekspor laporan.");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Realisasi');

        const titleStyle = { font: { name: 'Arial', size: 14, bold: true }, alignment: { horizontal: 'center' } };
        const headerStyle = { font: { bold: true }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: {style: 'thin'}, right: {style: 'thin'} } };
        const cellStyle = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: {style: 'thin'}, right: {style: 'thin'} } };
        const numberStyle = { ...cellStyle, numFmt: '"Rp"#,##0.00;[Red]-"Rp"#,##0.00' };
        const boldStyle = { font: { bold: true } };

        worksheet.mergeCells('A1:F1');
        worksheet.getCell('A1').value = `LAPORAN REALISASI ANGGARAN PENDAPATAN DAN BELANJA DESA`;
        worksheet.getCell('A1').style = titleStyle;
        worksheet.mergeCells('A2:F2');
        worksheet.getCell('A2').value = `DESA ${filterDesa.toUpperCase()} TAHUN ANGGARAN ${filterTahun}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };
        
        let currentRow = 4;
        worksheet.getRow(currentRow).values = ['KODE REKENING', 'URAIAN', 'ANGGARAN (Rp)', 'REALISASI (Rp)', 'LEBIH / KURANG (Rp)', 'PERSENTASE (%)'];
        worksheet.getRow(currentRow).eachCell(cell => cell.style = headerStyle);
        currentRow++;

        worksheet.getCell(`B${currentRow}`).value = 'PENDAPATAN';
        worksheet.getCell(`B${currentRow}`).font = { bold: true };
        let totalAnggaranPendapatan = 0;
        let totalRealisasiPendapatan = 0;

        laporanData.pendapatan.forEach(item => {
            totalAnggaranPendapatan += item.anggaran;
            totalRealisasiPendapatan += item.realisasi;
            const selisih = item.realisasi - item.anggaran;
            const persentase = item.anggaran > 0 ? (item.realisasi / item.anggaran) : 0;
            worksheet.getRow(currentRow).values = [null, `  ${item.kategori}`, item.anggaran, item.realisasi, selisih, persentase];
            worksheet.getRow(currentRow).getCell('C').style = numberStyle;
            worksheet.getRow(currentRow).getCell('D').style = numberStyle;
            worksheet.getRow(currentRow).getCell('E').style = numberStyle;
            worksheet.getRow(currentRow).getCell('F').style = {...cellStyle, numFmt: '0.00%'};
            worksheet.getRow(currentRow).getCell('B').style = cellStyle;
            currentRow++;
        });
        
        worksheet.getRow(currentRow).values = [null, 'JUMLAH PENDAPATAN', totalAnggaranPendapatan, totalRealisasiPendapatan, totalRealisasiPendapatan - totalAnggaranPendapatan];
        worksheet.getRow(currentRow).eachCell(cell => cell.style = {...cellStyle, ...boldStyle});
        worksheet.getRow(currentRow).getCell('C').style = {...numberStyle, ...boldStyle};
        worksheet.getRow(currentRow).getCell('D').style = {...numberStyle, ...boldStyle};
        worksheet.getRow(currentRow).getCell('E').style = {...numberStyle, ...boldStyle};
        currentRow+=2;

        worksheet.getCell(`B${currentRow}`).value = 'BELANJA';
        worksheet.getCell(`B${currentRow}`).font = { bold: true };
        let totalAnggaranBelanja = 0;
        let totalRealisasiBelanja = 0;
        
        const belanjaByBidang = BIDANG_BELANJA.reduce((acc, curr) => {
            const items = laporanData.belanja.filter(b => b.bidang === curr.bidang);
            if (items.some(i => i.anggaran > 0 || i.realisasi > 0)) {
                acc[curr.bidang] = items;
            }
            return acc;
        }, {});

        Object.keys(belanjaByBidang).forEach(bidang => {
            worksheet.getRow(currentRow).values = [null, bidang];
            worksheet.getRow(currentRow).getCell('B').style = {...cellStyle, font: {italic: true}};
            currentRow++;
            
            belanjaByBidang[bidang].forEach(item => {
                totalAnggaranBelanja += item.anggaran;
                totalRealisasiBelanja += item.realisasi;
                const selisih = item.realisasi - item.anggaran;
                const persentase = item.anggaran > 0 ? (item.realisasi / item.anggaran) : 0;
                worksheet.getRow(currentRow).values = [null, `  ${item.kategori}`, item.anggaran, item.realisasi, selisih, persentase];
                worksheet.getRow(currentRow).getCell('C').style = numberStyle;
                worksheet.getRow(currentRow).getCell('D').style = numberStyle;
                worksheet.getRow(currentRow).getCell('E').style = numberStyle;
                worksheet.getRow(currentRow).getCell('F').style = {...cellStyle, numFmt: '0.00%'};
                worksheet.getRow(currentRow).getCell('B').style = cellStyle;
                currentRow++;
            });
        });
        
        worksheet.getRow(currentRow).values = [null, 'JUMLAH BELANJA', totalAnggaranBelanja, totalRealisasiBelanja, totalRealisasiBelanja - totalAnggaranBelanja];
        worksheet.getRow(currentRow).eachCell(cell => cell.style = {...cellStyle, ...boldStyle});
        worksheet.getRow(currentRow).getCell('C').style = {...numberStyle, ...boldStyle};
        worksheet.getRow(currentRow).getCell('D').style = {...numberStyle, ...boldStyle};
        worksheet.getRow(currentRow).getCell('E').style = {...numberStyle, ...boldStyle};
        currentRow++;

        const surplusDefisitAnggaran = totalAnggaranPendapatan - totalAnggaranBelanja;
        const surplusDefisitRealisasi = totalRealisasiPendapatan - totalRealisasiBelanja;
        worksheet.getRow(currentRow).values = [null, 'SURPLUS / (DEFISIT)', surplusDefisitAnggaran, surplusDefisitRealisasi, surplusDefisitRealisasi - surplusDefisitAnggaran];
        worksheet.getRow(currentRow).eachCell(cell => cell.style = {...cellStyle, ...boldStyle});
        worksheet.getRow(currentRow).getCell('C').style = {...numberStyle, ...boldStyle};
        worksheet.getRow(currentRow).getCell('D').style = {...numberStyle, ...boldStyle};
        worksheet.getRow(currentRow).getCell('E').style = {...numberStyle, ...boldStyle};
        currentRow+=3;

        const signerCol = 'E';
        const kades = allPerangkat.find(p => p.desa === filterDesa && p.jabatan?.toLowerCase() === 'kepala desa');
        worksheet.getCell(`${signerCol}${currentRow}`).value = `${filterDesa}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.getCell(`${signerCol}${currentRow + 1}`).value = 'Kepala Desa';
        worksheet.getCell(`${signerCol}${currentRow + 5}`).value = (kades?.nama || '(....................................)').toUpperCase();
        worksheet.getCell(`${signerCol}${currentRow + 5}`).font = { bold: true, underline: true };
        for (let i = 0; i < 6; i++) {
            worksheet.getCell(`${signerCol}${currentRow + i}`).alignment = { horizontal: 'center' };
        }

        worksheet.columns = [{width: 15}, {width: 40}, {width: 20}, {width: 20}, {width: 20}, {width: 15}];
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileName = `Laporan_Realisasi_${filterDesa}_${filterTahun}.xlsx`;
        saveAs(blob, fileName);
    };

    const renderTableSection = (title, data, isBelanja = false) => {
        const totalAnggaran = data.reduce((sum, item) => sum + (item.anggaran || 0), 0);
        const totalRealisasi = data.reduce((sum, item) => sum + (item.realisasi || 0), 0);

        return (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-2">Uraian</th>
                                <th className="px-4 py-2 text-right">Anggaran (Rp)</th>
                                <th className="px-4 py-2 text-right">Realisasi (Rp)</th>
                                <th className="px-4 py-2 text-right">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, index) => {
                                const persentase = item.anggaran > 0 ? (item.realisasi / item.anggaran) * 100 : 0;
                                return (
                                    <tr key={index} className="border-b dark:border-gray-700">
                                        <td className="px-4 py-2">{item.kategori}</td>
                                        <td className="px-4 py-2 text-right">{item.anggaran.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-2 text-right">{item.realisasi.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-2 text-right">{persentase.toFixed(2)}%</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="font-bold bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <td className="px-4 py-2">TOTAL</td>
                                <td className="px-4 py-2 text-right">{totalAnggaran.toLocaleString('id-ID')}</td>
                                <td className="px-4 py-2 text-right">{totalRealisasi.toLocaleString('id-ID')}</td>
                                <td className="px-4 py-2 text-right">
                                    {totalAnggaran > 0 ? ((totalRealisasi / totalAnggaran) * 100).toFixed(2) : '0.00'}%
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };
    
    if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;

    return (
        <div className="space-y-6">
             <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-2xl font-bold">Laporan Realisasi Anggaran</h1>
                <div className="flex items-center gap-4">
                    <InputField label="Tahun" type="number" value={filterTahun} onChange={e => setFilterTahun(e.target.value)} />
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField label="Desa" type="select" value={filterDesa} onChange={e => setFilterDesa(e.target.value)}>
                            <option value="all">Pilih Desa</option>
                            {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                        </InputField>
                    )}
                    <Button onClick={handleExport} variant="success" className="self-end" disabled={filterDesa === 'all'}>
                        <FiDownload/> Ekspor XLSX
                    </Button>
                </div>
            </div>

            {filterDesa === 'all' ? (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-500">Silakan pilih desa untuk menampilkan laporan.</p>
                </div>
            ) : (
                 <div className="space-y-4">
                    {renderTableSection("Pendapatan", laporanData.pendapatan)}
                    {renderTableSection("Belanja", laporanData.belanja, true)}
                 </div>
            )}
        </div>
    );
};

export default LaporanRealisasiPage;

