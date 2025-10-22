import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import { DESA_LIST, KODE_DESA_MAP } from '../utils/constants';
import { FiDownload } from 'react-icons/fi';
import Button from '../components/common/Button';
import InputField from '../components/common/InputField';
import { generateRekapKecamatanXLSX } from '../utils/generateRekapKecamatanXLSX';
import { generateRekapDesaXLSX } from '../utils/generateRekapDesaXLSX';
import { generateRekapLengkapKecamatanXLSX } from '../utils/generateRekapLengkapKecamatanXLSX';

// --- Sub-Komponen untuk Tampilan Tabel ---

const RekapPokokView = ({ data }) => (
    <table className="w-full table-fixed text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
            <tr>
                <th className="px-6 py-3 w-16">NO</th>
                <th className="px-6 py-3">NAMA DESA</th>
                <th className="px-6 py-3 w-32 text-center">JUMLAH RW</th>
                <th className="px-6 py-3 w-32 text-center">JUMLAH RT</th>
                <th className="px-6 py-3 w-32 text-center">JUMLAH DUSUN</th>
                <th className="px-6 py-3 w-32 text-center">JUMLAH DUKUH</th>
            </tr>
        </thead>
        <tbody>
            {data.map((row, index) => (
                <tr key={row.namaDesa} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                    <td className="px-6 py-4 text-center">{index + 1}</td>
                    <td className="px-6 py-4 font-medium">{row.namaDesa}</td>
                    <td className="px-6 py-4 text-center">{row.jumlahRw}</td>
                    <td className="px-6 py-4 text-center">{row.jumlahRt}</td>
                    <td className="px-6 py-4 text-center">{row.jumlahDusun}</td>
                    <td className="px-6 py-4 text-center">{row.jumlahDukuh}</td>
                </tr>
            ))}
             <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                <td colSpan="2" className="px-6 py-4 text-center">JUMLAH</td>
                <td className="px-6 py-4 text-center">{data.reduce((sum, row) => sum + row.jumlahRw, 0)}</td>
                <td className="px-6 py-4 text-center">{data.reduce((sum, row) => sum + row.jumlahRt, 0)}</td>
                <td className="px-6 py-4 text-center">{data.reduce((sum, row) => sum + row.jumlahDusun, 0)}</td>
                <td className="px-6 py-4 text-center">{data.reduce((sum, row) => sum + row.jumlahDukuh, 0)}</td>
            </tr>
        </tbody>
    </table>
);

const RekapDesaView = ({ data }) => (
     <table className="w-full table-fixed text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
            <tr>
                <th className="px-4 py-3 w-12">NO</th>
                <th className="px-4 py-3 w-40">DUSUN</th>
                <th className="px-4 py-3 w-16">RW</th>
                <th className="px-4 py-3">NAMA KETUA RW</th>
                <th className="px-4 py-3 w-16">RT</th>
                <th className="px-4 py-3">NAMA KETUA RT</th>
                <th className="px-4 py-3">NAMA SEKRETARIS</th>
                <th className="px-4 py-3">NAMA BENDAHARA</th>
                <th className="px-4 py-3 w-40">DUKUH</th>
            </tr>
        </thead>
        <tbody>
            {data.length > 0 ? data.map((row, index) => (
                <tr key={`${row.no_rw}-${row.no_rt}`} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                    <td className="px-4 py-2 text-center">{index + 1}</td>
                    <td className="px-4 py-2">{row.dusun}</td>
                    <td className="px-4 py-2 text-center">{row.no_rw}</td>
                    <td className="px-4 py-2">{row.namaKetuaRw}</td>
                    <td className="px-4 py-2 text-center">{row.no_rt}</td>
                    <td className="px-4 py-2">{row.Ketua}</td>
                    <td className="px-4 py-2">{row.Sekretaris}</td>
                    <td className="px-4 py-2">{row.Bendahara}</td>
                    <td className="px-4 py-2">{row.dukuh}</td>
                </tr>
            )) : (
                <tr><td colSpan="9" className="text-center py-10">Data tidak ditemukan untuk desa ini.</td></tr>
            )}
        </tbody>
        <tfoot className="bg-gray-100 dark:bg-gray-700 font-bold">
            <tr>
                <td colSpan="8" className="px-4 py-2 text-right">JUMLAH RT</td>
                <td className="px-4 py-2 text-left">{data.length}</td>
            </tr>
        </tfoot>
    </table>
);

const RekapLengkapView = ({ data }) => (
    <table className="w-full table-fixed text-sm text-left text-gray-500 dark:text-gray-400">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
            <tr>
                <th className="px-2 py-3 w-20">KODE DESA</th>
                <th className="px-2 py-3 w-32">DESA</th>
                <th className="px-2 py-3 w-32">DUSUN</th>
                <th className="px-2 py-3 w-12">RW</th>
                <th className="px-2 py-3">NAMA KETUA RW</th>
                <th className="px-2 py-3 w-12">RT</th>
                <th className="px-2 py-3">NAMA KETUA RT</th>
                <th className="px-2 py-3 w-40">DUKUH</th>
            </tr>
        </thead>
        <tbody>
            {data.map(desa => (
                <React.Fragment key={desa.namaDesa}>
                    {desa.dusunGroups.map(dusunGroup => (
                       <React.Fragment key={dusunGroup.dusunName}>
                            {dusunGroup.entries.map((entry, entryIndex) => (
                                <tr key={`${desa.namaDesa}-${entry.no_rw}-${entry.no_rt}`} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <td className="px-2 py-2 text-center">{entryIndex === 0 ? KODE_DESA_MAP[desa.namaDesa] : ''}</td>
                                    <td className="px-2 py-2">{entryIndex === 0 ? desa.namaDesa : ''}</td>
                                    <td className="px-2 py-2">{entry.dusun}</td>
                                    <td className="px-2 py-2 text-center">{entry.no_rw}</td>
                                    <td className="px-2 py-2">{entry.namaKetuaRw}</td>
                                    <td className="px-2 py-2 text-center">{entry.no_rt}</td>
                                    <td className="px-2 py-2">{entry.namaKetuaRt}</td>
                                    <td className="px-2 py-2">{entry.dukuh}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 dark:bg-gray-700 font-semibold">
                                <td colSpan="7" className="px-4 py-2 text-right">JUMLAH RT</td>
                                <td className="px-4 py-2 text-left">{dusunGroup.rtCount}</td>
                            </tr>
                       </React.Fragment>
                    ))}
                     <tr className="bg-blue-100 dark:bg-blue-900 font-bold text-blue-800 dark:text-blue-200">
                        <td colSpan="7" className="px-4 py-2 text-right">JUMLAH TOTAL RT DESA {desa.namaDesa.toUpperCase()}</td>
                        <td className="px-4 py-2 text-left">{desa.totalRtDesa}</td>
                    </tr>
                </React.Fragment>
            ))}
        </tbody>
    </table>
);


// --- Komponen Utama ---

const RekapitulasiRtRwPage = () => {
    const { currentUser } = useAuth();
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('pokok'); // 'pokok', 'desa', 'lengkap'
    const [selectedDesa, setSelectedDesa] = useState(DESA_LIST[0]);

    useEffect(() => {
        setLoading(true);
        let q;
        if (currentUser.role === 'admin_desa') {
            q = query(collection(db, 'rt_rw'), where('desa', '==', currentUser.desa));
            setViewMode('desa');
            setSelectedDesa(currentUser.desa);
        } else {
            q = query(collection(db, 'rt_rw'));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllData(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching data: ", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser]);

    // --- Memoized Data Processing ---

    const rekapPokokData = useMemo(() => {
        return DESA_LIST.map(desa => {
            const desaData = allData.filter(item => item.desa === desa);
            return {
                namaDesa: desa,
                jumlahRw: new Set(desaData.filter(d => d.no_rw).map(d => d.no_rw)).size,
                jumlahRt: new Set(desaData.filter(d => d.no_rt).map(d => d.no_rt)).size,
                jumlahDusun: new Set(desaData.filter(d => d.dusun).map(d => d.dusun)).size,
                jumlahDukuh: new Set(desaData.filter(d => d.dukuh).map(d => d.dukuh)).size,
            };
        });
    }, [allData]);

    const rekapDesaData = useMemo(() => {
        const desaToFilter = currentUser.role === 'admin_desa' ? currentUser.desa : selectedDesa;
        if (!desaToFilter) return [];
        
        const desaData = allData.filter(item => item.desa === desaToFilter);
        const rtData = desaData.filter(item => item.no_rt);
        const rwData = desaData.filter(item => item.no_rw);

        const rwMap = rwData.reduce((acc, curr) => { acc[curr.no_rw] = curr.nama; return acc; }, {});

        const rtGrouped = rtData.reduce((acc, curr) => {
            const key = `${curr.dusun}-${curr.no_rw}-${curr.no_rt}`;
            if (!acc[key]) {
                acc[key] = { dusun: curr.dusun, no_rw: curr.no_rw, no_rt: curr.no_rt, dukuh: curr.dukuh, Ketua: '-', Sekretaris: '-', Bendahara: '-' };
            }
            if (curr.jabatan && acc[key].hasOwnProperty(curr.jabatan)) acc[key][curr.jabatan] = curr.nama;
            return acc;
        }, {});
        
        const sortedData = Object.values(rtGrouped).sort((a, b) => (a.dusun.localeCompare(b.dusun) || parseInt(a.no_rw) - parseInt(b.no_rw) || parseInt(a.no_rt) - parseInt(b.no_rt)));

        return sortedData.map(item => ({ ...item, namaKetuaRw: rwMap[item.no_rw] || '-' }));
    }, [allData, selectedDesa, currentUser]);

    const rekapLengkapData = useMemo(() => {
        const groupedByDesa = allData.reduce((acc, item) => {
            if (!acc[item.desa]) acc[item.desa] = [];
            acc[item.desa].push(item);
            return acc;
        }, {});

        const result = Object.keys(groupedByDesa).map(namaDesa => {
            const desaData = groupedByDesa[namaDesa];
            const rwData = desaData.filter(d => d.no_rw);
            const rtData = desaData.filter(d => d.no_rt);

            const rwMap = rwData.reduce((acc, curr) => { acc[curr.no_rw] = curr.nama; return acc; }, {});
            
            const entries = rtData.map(rt => ({
                dusun: rt.dusun || '-',
                no_rw: rt.no_rw || '-',
                namaKetuaRw: rwMap[rt.no_rw] || '-',
                no_rt: rt.no_rt || '-',
                namaKetuaRt: rt.jabatan === 'Ketua' ? rt.nama : '-',
                dukuh: rt.dukuh || '-',
            })).sort((a, b) => (a.dusun.localeCompare(b.dusun) || parseInt(a.no_rw) - parseInt(b.no_rw) || parseInt(a.no_rt) - parseInt(b.no_rt)));

            const dusunGroups = entries.reduce((acc, entry) => {
                const dusunName = entry.dusun;
                if (!acc[dusunName]) acc[dusunName] = { dusunName, entries: [], rtCount: 0 };
                acc[dusunName].entries.push(entry);
                acc[dusunName].rtCount++;
                return acc;
            }, {});

            const totalRtDesa = Object.values(dusunGroups).reduce((sum, group) => sum + group.rtCount, 0);

            return {
                namaDesa,
                dusunGroups: Object.values(dusunGroups),
                totalRtDesa,
            };
        });

        return result.sort((a, b) => KODE_DESA_MAP[a.namaDesa] - KODE_DESA_MAP[b.namaDesa]);
    }, [allData]);

    const handleExport = async () => {
        switch (viewMode) {
            case 'pokok':
                await generateRekapKecamatanXLSX(rekapPokokData);
                break;
            case 'desa':
                const desaToExport = currentUser.role === 'admin_desa' ? currentUser.desa : selectedDesa;
                if (desaToExport) await generateRekapDesaXLSX(rekapDesaData, desaToExport);
                break;
            case 'lengkap':
                await generateRekapLengkapKecamatanXLSX(rekapLengkapData);
                break;
            default:
                console.error("Unknown view mode for export");
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                {currentUser.role === 'admin_kecamatan' ? (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant={viewMode === 'pokok' ? 'primary' : 'ghost'} onClick={() => setViewMode('pokok')}>Rekap Data Pokok</Button>
                        <Button variant={viewMode === 'desa' ? 'primary' : 'ghost'} onClick={() => setViewMode('desa')}>Rekap Detail Desa</Button>
                        <Button variant={viewMode === 'lengkap' ? 'primary' : 'ghost'} onClick={() => setViewMode('lengkap')}>Rekap Lengkap Kecamatan</Button>
                    </div>
                ) : (
                    <h2 className="text-xl font-semibold">Rekapitulasi Desa {currentUser.desa}</h2>
                )}
                <div className="flex items-center gap-4">
                    {viewMode === 'desa' && currentUser.role === 'admin_kecamatan' && (
                        <InputField type="select" value={selectedDesa} onChange={e => setSelectedDesa(e.target.value)}>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                    <Button onClick={handleExport} variant="success" disabled={loading}>
                        <FiDownload className="mr-2"/> Ekspor Data
                    </Button>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-10"><Spinner/></div> : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        {viewMode === 'pokok' && currentUser.role === 'admin_kecamatan' && <RekapPokokView data={rekapPokokData} />}
                        {viewMode === 'desa' && <RekapDesaView data={rekapDesaData} />}
                        {viewMode === 'lengkap' && currentUser.role === 'admin_kecamatan' && <RekapLengkapView data={rekapLengkapData} />}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RekapitulasiRtRwPage;

