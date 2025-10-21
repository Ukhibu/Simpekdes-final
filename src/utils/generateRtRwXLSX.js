import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { DESA_LIST } from './constants';

const addCell = (ws, address, value, type = 's', style = {}) => {
    ws[address] = { t: type, v: value, s: style };
};

export const generateRtRwXLSX = ({ dataToExport }) => {
    const wb = XLSX.utils.book_new();
    const ws = {};

    // --- Styling ---
    const centerStyle = { alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
    const leftStyle = { alignment: { horizontal: 'left', vertical: 'center', wrapText: true } };
    const boldCenterStyle = { ...centerStyle, font: { bold: true } };
    const boldLeftStyle = { ...leftStyle, font: { bold: true } };
    const borderAll = {
        border: {
            top: { style: "thin" }, bottom: { style: "thin" },
            left: { style: "thin" }, right: { style: "thin" }
        }
    };
    
    // --- Set Column Widths ---
    ws['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 3 },
        { wch: 15 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 20 },
        { wch: 18 }, { wch: 12 }
    ];
    
    // --- Header Keterangan (Top Right) ---
    addCell(ws, 'L1', 'KETERANGAN :', 's', { font: { bold: true, underline: true } });
    addCell(ws, 'L2', 'No. 4. Diisi Nama Dukuh');
    addCell(ws, 'L3', 'No. 5. Diisi Nama DuSun');
    addCell(ws, 'L4', 'No. 6. Diisi Nama/ Nomor RW');
    addCell(ws, 'L5', 'No. 7. Diisi Nama/ Nomor RT');

    // --- Main Title ---
    const currentYear = new Date().getFullYear();
    addCell(ws, 'A7', `REKAP DATA RT DAN RW SE-KECAMATAN PUNGGELAN TAHUN ${currentYear}`, 's', { ...boldCenterStyle, font: { sz: 14, bold: true } });
    
    // --- Table Headers ---
    const headers = [
        ['KODE DESA', 'KABUPATEN', 'KECAMATAN', 'DESA', '', 'DUSUN', 'RW', 'NAMA KETUA Rw.', 'RT', 'NAMA KETUA Rt.', 'DUKUH', 'KET.'],
        ['', '1', '2', '3', '', '5', '6', '', '7', '', '4', '']
    ];

    headers.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const cellAddress = XLSX.utils.encode_cell({ r: 9 + rowIndex, c: colIndex });
            addCell(ws, cellAddress, cell, 's', { ...boldCenterStyle, ...borderAll });
        });
    });

    // --- Merged Cells ---
    ws['!merges'] = [
        { s: { r: 6, c: 0 }, e: { r: 6, c: 11 } }, // Main Title
        // Headers
        { s: { r: 9, c: 0 }, e: { r: 10, c: 0 } }, { s: { r: 9, c: 1 }, e: { r: 9, c: 2 } }, 
        { s: { r: 9, c: 3 }, e: { r: 10, c: 4 } }, { s: { r: 9, c: 5 }, e: { r: 10, c: 5 } },
        { s: { r: 9, c: 6 }, e: { r: 10, c: 6 } }, { s: { r: 9, c: 7 }, e: { r: 10, c: 7 } },
        { s: { r: 9, c: 8 }, e: { r: 10, c: 8 } }, { s: { r: 9, c: 9 }, e: { r: 10, c: 9 } },
        { s: { r: 9, c: 10 }, e: { r: 10, c: 10 } }, { s: { r: 9, c: 11 }, e: { r: 10, c: 11 } }
    ];

    // --- Data Processing ---
    let currentRow = 11;
    const desaDataMap = DESA_LIST.reduce((acc, desa) => {
        acc[desa] = dataToExport.filter(item => item.desa === desa);
        return acc;
    }, {});

    DESA_LIST.forEach((desaName, desaIndex) => {
        const desaItems = desaDataMap[desaName] || [];
        if (desaItems.length === 0) return;

        let rtCount = 0;
        const rwSet = new Set();
        
        const dusunMap = desaItems.reduce((acc, item) => {
            const key = item.dusun || 'Tanpa Dusun';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});
        
        let isFirstRowOfDesa = true;

        Object.keys(dusunMap).forEach(dusunName => {
            const itemsInDusun = dusunMap[dusunName];

            itemsInDusun.forEach(item => {
                const rowData = [
                    isFirstRowOfDesa ? `${String(desaIndex + 1).padStart(2, '0')}` : '',
                    isFirstRowOfDesa ? 'BANJARNEGARA' : '',
                    isFirstRowOfDesa ? 'PUNGGELAN' : '',
                    desaName, '', dusunName, item.no_rw || '',
                    item.jabatan === 'Ketua RW' ? item.nama : '',
                    item.no_rt || '',
                    item.jabatan === 'Ketua RT' ? item.nama : '',
                    item.dukuh || '',
                    1 // Keterangan
                ];

                rowData.forEach((val, i) => addCell(ws, XLSX.utils.encode_cell({ r: currentRow, c: i }), val, typeof val === 'number' ? 'n' : 's', { ...leftStyle, ...borderAll }));
                
                // Merge cell 'DESA'
                ws['!merges'].push({ s: { r: currentRow, c: 3 }, e: { r: currentRow, c: 4 } });

                if (item.jabatan === 'Ketua RT') rtCount++;
                if (item.no_rw) rwSet.add(item.no_rw);

                isFirstRowOfDesa = false;
                currentRow++;
            });

            // Dusun separator row
             const separatorRow = ['', '', '', desaName, '', '', '', '', '', '', '', 0];
             separatorRow.forEach((val, i) => addCell(ws, XLSX.utils.encode_cell({ r: currentRow, c: i }), val, typeof val === 'number' ? 'n' : 's', { ...leftStyle, ...borderAll }));
             ws['!merges'].push({ s: { r: currentRow, c: 3 }, e: { r: currentRow, c: 4 } });
             currentRow++;
        });

        // JUMLAH row for the desa
        const jumlahRow = [
            '', 'J U M L A H', '', '', '', '', rwSet.size, '', rtCount, '', '', ''
        ];
        jumlahRow.forEach((val, i) => {
             const style = (i === 1) ? { ...boldCenterStyle, ...borderAll } : { ...centerStyle, ...borderAll };
             addCell(ws, XLSX.utils.encode_cell({ r: currentRow, c: i }), val, typeof val === 'number' ? 'n' : 's', style);
        });
        ws['!merges'].push({ s: { r: currentRow, c: 1 }, e: { r: currentRow, c: 5 } });
        ws['!merges'].push({ s: { r: currentRow, c: 9 }, e: { r: currentRow, c: 11 } });
        currentRow++;
    });

    const range = { s: { c: 0, r: 0 }, e: { c: 11, r: currentRow } };
    ws['!ref'] = XLSX.utils.encode_range(range);

    XLSX.utils.book_append_sheet(wb, ws, "Rekap RT RW");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Rekap Data RT dan RW se-Kecamatan Punggelan tahun ${currentYear}.xlsx`);
};
