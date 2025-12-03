import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import { DESA_LIST, KODE_DESA_MAP } from '../utils/constants';
import { FiDownload, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Button from '../components/common/Button';
import InputField from '../components/common/InputField';
import { generateRekapKecamatanXLSX } from '../utils/generateRekapKecamatanXLSX';
import { generateRekapDesaXLSX } from '../utils/generateRekapDesaXLSX';
import { generateRekapLengkapKecamatanXLSX } from '../utils/generateRekapLengkapKecamatanXLSX';

// --- Sub-Komponen Tampilan Tabel ---

const RekapPokokView = ({ data }) => (
    <div className="overflow-hidden shadow-md sm:rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full bg-white dark:bg-gray-800">
        <div className="overflow-y-auto flex-1 relative">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 border-collapse">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="px-6 py-4 text-center w-16 bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">NO</th>
                        <th className="px-6 py-4 whitespace-nowrap bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">NAMA DESA</th>
                        <th className="px-6 py-4 text-center bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">JML RW</th>
                        <th className="px-6 py-4 text-center bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">JML RT</th>
                        <th className="px-6 py-4 text-center bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">JML DUSUN</th>
                        <th className="px-6 py-4 text-center bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">JML DUKUH</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr key={row.namaDesa} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                            <td className="px-6 py-4 text-center">{index + 1}</td>
                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{row.namaDesa}</td>
                            <td className="px-6 py-4 text-center">{row.jumlahRw}</td>
                            <td className="px-6 py-4 text-center">{row.jumlahRt}</td>
                            <td className="px-6 py-4 text-center">{row.jumlahDusun}</td>
                            <td className="px-6 py-4 text-center">{row.jumlahDukuh}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-20 bg-gray-200 dark:bg-gray-900 font-bold text-gray-900 dark:text-white shadow-[0_-2px_4px_rgba(0,0,0,0.1)] border-t dark:border-gray-600">
                    <tr>
                        <td colSpan="2" className="px-6 py-4 text-center">TOTAL KECAMATAN</td>
                        <td className="px-6 py-4 text-center">{data.reduce((sum, row) => sum + row.jumlahRw, 0)}</td>
                        <td className="px-6 py-4 text-center">{data.reduce((sum, row) => sum + row.jumlahRt, 0)}</td>
                        <td className="px-6 py-4 text-center">{data.reduce((sum, row) => sum + row.jumlahDusun, 0)}</td>
                        <td className="px-6 py-4 text-center">{data.reduce((sum, row) => sum + row.jumlahDukuh, 0)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
);

const RekapDesaView = ({ data }) => (
    <div className="overflow-hidden shadow-md sm:rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full bg-white dark:bg-gray-800">
        <div className="overflow-y-auto flex-1 relative">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 border-collapse">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="px-4 py-4 text-center w-12 bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">NO</th>
                        <th className="px-4 py-4 min-w-[120px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">DUSUN</th>
                        <th className="px-4 py-4 text-center w-16 bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">RW</th>
                        <th className="px-4 py-4 min-w-[150px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">KETUA RW</th>
                        <th className="px-4 py-4 text-center w-16 bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">RT</th>
                        <th className="px-4 py-4 min-w-[150px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">KETUA RT</th>
                        <th className="px-4 py-4 min-w-[150px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">SEKRETARIS</th>
                        <th className="px-4 py-4 min-w-[150px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">BENDAHARA</th>
                        <th className="px-4 py-4 min-w-[120px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">DUKUH</th>
                    </tr>
                </thead>
                <tbody>
                    {data.length > 0 ? data.map((row, index) => (
                        <tr key={`${row.no_rw}-${row.no_rt}-${index}`} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                            <td className="px-4 py-3 text-center">{index + 1}</td>
                            <td className="px-4 py-3">{row.dusun}</td>
                            <td className="px-4 py-3 text-center">{row.no_rw}</td>
                            <td className="px-4 py-3">{row.namaKetuaRw}</td>
                            <td className="px-4 py-3 text-center">{row.no_rt}</td>
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.Ketua}</td>
                            <td className="px-4 py-3">{row.Sekretaris}</td>
                            <td className="px-4 py-3">{row.Bendahara}</td>
                            <td className="px-4 py-3">{row.dukuh}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan="9" className="text-center py-10 text-gray-500">Data RT tidak ditemukan untuk desa ini.</td></tr>
                    )}
                </tbody>
                <tfoot className="sticky bottom-0 z-20 bg-gray-100 dark:bg-gray-700 font-bold text-gray-900 dark:text-white shadow-[0_-2px_4px_rgba(0,0,0,0.1)] border-t dark:border-gray-600">
                    <tr>
                        <td colSpan="8" className="px-4 py-3 text-right">TOTAL RT</td>
                        <td className="px-4 py-3 text-left">{data.length}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
);

const RekapLengkapView = ({ data }) => (
    <div className="overflow-hidden shadow-md sm:rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col h-full bg-white dark:bg-gray-800">
        <div className="overflow-y-auto flex-1 relative">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 border-collapse">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="px-3 py-4 w-16 text-center bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">KODE</th>
                        <th className="px-3 py-4 min-w-[100px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">DESA</th>
                        <th className="px-3 py-4 min-w-[100px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">DUSUN</th>
                        <th className="px-3 py-4 w-12 text-center bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">RW</th>
                        <th className="px-3 py-4 min-w-[150px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">KETUA RW</th>
                        <th className="px-3 py-4 w-12 text-center bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">RT</th>
                        <th className="px-3 py-4 min-w-[150px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">KETUA RT</th>
                        <th className="px-3 py-4 min-w-[100px] bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">DUKUH</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(desa => (
                        <React.Fragment key={desa.namaDesa}>
                            {desa.dusunGroups.map((dusunGroup, idx) => (
                                <React.Fragment key={`${desa.namaDesa}-${dusunGroup.dusunName}-${idx}`}>
                                    {dusunGroup.entries.map((entry, entryIndex) => (
                                        <tr key={`${desa.namaDesa}-${entry.no_rw}-${entry.no_rt}-${entryIndex}`} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <td className="px-3 py-2 text-center text-xs text-gray-400">{entryIndex === 0 && idx === 0 ? KODE_DESA_MAP[desa.namaDesa] : ''}</td>
                                            <td className="px-3 py-2 font-bold">{entryIndex === 0 && idx === 0 ? desa.namaDesa : ''}</td>
                                            <td className="px-3 py-2">{entry.dusun}</td> 
                                            <td className="px-3 py-2 text-center">{entry.no_rw}</td>
                                            <td className="px-3 py-2">{entry.namaKetuaRw}</td>
                                            <td className="px-3 py-2 text-center">{entry.no_rt}</td>
                                            <td className="px-3 py-2">{entry.namaKetuaRt}</td>
                                            <td className="px-3 py-2">{entry.dukuh}</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                            <tr className="bg-blue-50 dark:bg-blue-900/30 font-semibold text-blue-900 dark:text-blue-100 border-b dark:border-gray-700">
                                <td colSpan="7" className="px-3 py-2 text-right">TOTAL RT DESA {desa.namaDesa.toUpperCase()}</td>
                                <td className="px-3 py-2 text-left font-bold">{desa.totalRtDesa}</td>
                            </tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

// --- Komponen Utama ---

const RekapitulasiRtRwPage = () => {
    const { currentUser } = useAuth();
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const viewModes = ['pokok', 'desa', 'lengkap'];
    const [viewModeIndex, setViewModeIndex] = useState(0); 
    const viewMode = viewModes[viewModeIndex];

    const [selectedDesa, setSelectedDesa] = useState(DESA_LIST[0]);

    // Swipe State
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const minSwipeDistance = 50;

    useEffect(() => {
        setLoading(true);
        let q;
        if (currentUser.role === 'admin_desa') {
            q = query(collection(db, 'rt_rw'), where('desa', '==', currentUser.desa));
            setViewModeIndex(1); 
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

    // --- SINKRONISASI DATA LOGIC ---
    const getRtData = (data) => data.filter(item => item.no_rt && !item.no_rw_only);
    const getRwData = (data) => data.filter(item => item.no_rw && !item.no_rt);

    // --- PERBAIKAN DI SINI (RekapPokokData) ---
    // Logika Diperbarui sesuai permintaan:
    // 1. RW: Menggunakan nilai MAX dari No RW.
    // 2. RT: Menghitung jumlah Ketua RT yang ada di database.
    const rekapPokokData = useMemo(() => {
        return DESA_LIST.map(desa => {
            const desaData = allData.filter(item => item.desa === desa);
            
            // 1. Hitung RW: Cari Nilai Maksimum No RW (Numeric)
            let maxRw = 0;
            desaData.forEach(item => {
                if (item.no_rw) {
                    const rwNum = parseInt(item.no_rw, 10);
                    if (!isNaN(rwNum) && rwNum > maxRw) {
                        maxRw = rwNum;
                    }
                }
            });

            // 2. Hitung RT: Menghitung Jumlah 'Ketua RT'
            // Mengambil semua data RT, lalu filter yang jabatannya mengandung kata "Ketua"
            // Ini akan menghitung jumlah orang yang menjabat sebagai Ketua RT
            const rtList = getRtData(desaData);
            const countRt = rtList.filter(p => p.jabatan && p.jabatan.toLowerCase().includes('ketua')).length;

            // Hitung Dusun & Dukuh Unik
            const uniqueDusun = new Set();
            const uniqueDukuh = new Set();
            desaData.forEach(item => {
                if (item.dusun) uniqueDusun.add(String(item.dusun).trim());
                if (item.dukuh) uniqueDukuh.add(String(item.dukuh).trim());
            });

            return {
                namaDesa: desa,
                jumlahRw: maxRw, // Menggunakan Max RW
                jumlahRt: countRt, // Menggunakan Jumlah Ketua RT
                jumlahDusun: uniqueDusun.size,
                jumlahDukuh: uniqueDukuh.size,
            };
        });
    }, [allData]);

    // Grouping Sekretaris & Bendahara ke baris Ketua RT
    const rekapDesaData = useMemo(() => {
        const desaToFilter = currentUser.role === 'admin_desa' ? currentUser.desa : selectedDesa;
        if (!desaToFilter) return [];
        
        const desaData = allData.filter(item => item.desa === desaToFilter);
        const rtList = getRtData(desaData);
        const rwList = getRwData(desaData);

        const findPerangkatRt = (jabatan, rtRef) => {
            return desaData.find(p => 
                p.jabatan?.toLowerCase().includes(jabatan) && 
                p.no_rt === rtRef.no_rt &&
                p.no_rw === rtRef.no_rw &&
                (p.dusun || '').trim().toLowerCase() === (rtRef.dusun || '').trim().toLowerCase()
            );
        };

        const rwMap = rwList.reduce((acc, curr) => { 
            acc[curr.no_rw] = curr.nama; 
            return acc; 
        }, {});

        // Filter hanya Ketua RT sebagai baris utama
        const ketuaRtList = rtList.filter(p => p.jabatan?.toLowerCase().includes('ketua'));

        return ketuaRtList.map(rt => {
            const sekretarisData = findPerangkatRt('sekretaris', rt);
            const bendaharaData = findPerangkatRt('bendahara', rt);

            return {
                ...rt,
                Ketua: rt.nama,
                namaKetuaRw: rwMap[rt.no_rw] || '(Kosong)',
                Sekretaris: sekretarisData ? sekretarisData.nama : '-',
                Bendahara: bendaharaData ? bendaharaData.nama : '-'
            };
        }).sort((a, b) => {
            // Sort Dusun -> RW -> RT
            const dusunA = a.dusun || '';
            const dusunB = b.dusun || '';
            if (dusunA !== dusunB) return dusunA.localeCompare(dusunB);
            
            const rwA = parseInt(a.no_rw) || 0;
            const rwB = parseInt(b.no_rw) || 0;
            if (rwA !== rwB) return rwA - rwB;

            const rtA = parseInt(a.no_rt) || 0;
            const rtB = parseInt(b.no_rt) || 0;
            return rtA - rtB;
        });
    }, [allData, selectedDesa, currentUser]);

    const rekapLengkapData = useMemo(() => {
        const groupedByDesa = {};
        DESA_LIST.forEach(d => groupedByDesa[d] = []);
        allData.forEach(d => { if(groupedByDesa[d.desa]) groupedByDesa[d.desa].push(d); });

        const result = Object.keys(groupedByDesa).map(namaDesa => {
            const desaData = groupedByDesa[namaDesa];
            const rtList = getRtData(desaData); 
            // Filter hanya ketua RT untuk baris utama
            const ketuaRtOnly = rtList.filter(p => p.jabatan?.toLowerCase().includes('ketua'));
            
            const rwList = getRwData(desaData);
            const rwMap = rwList.reduce((acc, curr) => { acc[curr.no_rw] = curr.nama; return acc; }, {});
            
            const entries = ketuaRtOnly.map(rt => ({
                dusun: rt.dusun || '-',
                no_rw: rt.no_rw || '-',
                namaKetuaRw: rwMap[rt.no_rw] || '-',
                no_rt: rt.no_rt || '-',
                namaKetuaRt: rt.nama,
                dukuh: rt.dukuh || '-',
            })).sort((a, b) => {
                if(a.dusun !== b.dusun) return a.dusun.localeCompare(b.dusun);
                return (parseInt(a.no_rw)||0) - (parseInt(b.no_rw)||0) || (parseInt(a.no_rt)||0) - (parseInt(b.no_rt)||0);
            });

            const dusunGroups = entries.reduce((acc, entry) => {
                const dusunName = entry.dusun;
                if (!acc[dusunName]) acc[dusunName] = { dusunName, entries: [], rtCount: 0 };
                acc[dusunName].entries.push(entry);
                acc[dusunName].rtCount++;
                return acc;
            }, {});

            return {
                namaDesa,
                dusunGroups: Object.values(dusunGroups),
                totalRtDesa: entries.length,
            };
        });

        return result.filter(r => r.totalRtDesa > 0).sort((a, b) => (KODE_DESA_MAP[a.namaDesa] || 99) - (KODE_DESA_MAP[b.namaDesa] || 99));
    }, [allData]);

    const handleExport = async () => {
        switch (viewMode) {
            case 'pokok': await generateRekapKecamatanXLSX(rekapPokokData); break;
            case 'desa':
                const desaToExport = currentUser.role === 'admin_desa' ? currentUser.desa : selectedDesa;
                if (desaToExport) await generateRekapDesaXLSX(rekapDesaData, desaToExport);
                break;
            case 'lengkap': await generateRekapLengkapKecamatanXLSX(rekapLengkapData); break;
            default: break;
        }
    };

    // --- SWIPE LOGIC ---
    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (currentUser.role === 'admin_kecamatan') {
            if (isLeftSwipe && viewModeIndex < viewModes.length - 1) {
                setViewModeIndex(prev => prev + 1);
            }
            if (isRightSwipe && viewModeIndex > 0) {
                setViewModeIndex(prev => prev - 1);
            }
        }
    };

    const changeView = (modeName) => {
        const index = viewModes.indexOf(modeName);
        if (index !== -1) setViewModeIndex(index);
    };

    return (
        <div 
            className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] gap-4" 
            onTouchStart={onTouchStart} 
            onTouchMove={onTouchMove} 
            onTouchEnd={onTouchEnd}
        >
            {/* Page Header */}
            <div className="flex-none bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-col lg:flex-row items-center justify-between gap-4 z-10">
                {currentUser.role === 'admin_kecamatan' ? (
                    <div className="flex items-center w-full lg:w-auto justify-center lg:justify-start">
                        <div className="lg:hidden mr-2 text-gray-400"><FiChevronLeft /></div>
                        
                        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                            <button onClick={() => changeView('pokok')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'pokok' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                Pokok
                            </button>
                            <button onClick={() => changeView('desa')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'desa' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                Per Desa
                            </button>
                            <button onClick={() => changeView('lengkap')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'lengkap' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                                Lengkap
                            </button>
                        </div>

                        <div className="lg:hidden ml-2 text-gray-400"><FiChevronRight /></div>
                    </div>
                ) : (
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Rekapitulasi Desa {currentUser.desa}</h2>
                )}

                <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
                    {viewMode === 'desa' && currentUser.role === 'admin_kecamatan' && (
                        <div className="w-48">
                            <InputField type="select" value={selectedDesa} onChange={e => setSelectedDesa(e.target.value)}>
                                {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                            </InputField>
                        </div>
                    )}
                    <Button onClick={handleExport} variant="success" disabled={loading} className="whitespace-nowrap">
                        <FiDownload className="mr-2"/> Ekspor Excel
                    </Button>
                </div>
            </div>

            <div className="flex-none lg:hidden text-center text-xs text-gray-400 italic -mt-2">
                Geser layar kiri/kanan untuk ganti tampilan rekap
            </div>

            {loading ? <div className="flex justify-center py-20"><Spinner/></div> : (
                <div className="flex-1 min-h-0 relative transition-all duration-300 ease-in-out">
                    <div className="absolute inset-0">
                        {viewMode === 'pokok' && currentUser.role === 'admin_kecamatan' && (
                            <div className="animate-fade-in h-full"><RekapPokokView data={rekapPokokData} /></div>
                        )}
                        {viewMode === 'desa' && (
                            <div className="animate-fade-in h-full"><RekapDesaView data={rekapDesaData} /></div>
                        )}
                        {viewMode === 'lengkap' && currentUser.role === 'admin_kecamatan' && (
                            <div className="animate-fade-in h-full"><RekapLengkapView data={rekapLengkapData} /></div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RekapitulasiRtRwPage;