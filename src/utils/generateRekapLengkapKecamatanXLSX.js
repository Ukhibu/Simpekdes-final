import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DESA_LIST, KODE_DESA_MAP } from '../utils/constants';

export const generateRekapLengkapKecamatanXLSX = async (rekapData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('REKAP DATA RT RW');
    const currentYear = new Date().getFullYear();

    // --- CONFIG STYLES ---
    const BORDER_THIN = { style: 'thin', color: { argb: 'FF000000' } };
    
    // 1. Header Style (B-J) - Abu-abu
    const headerStyle = { 
        font: { name: 'Arial', size: 10, bold: true }, 
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, 
        border: { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN }, 
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } 
    };

    // 2. Isi Tabel (B-J)
    const cellCenter = { 
        font: { name: 'Arial', size: 9 }, 
        alignment: { vertical: 'middle', horizontal: 'center' }, 
        border: { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN } 
    };
    const cellLeft = { 
        font: { name: 'Arial', size: 9 }, 
        alignment: { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }, 
        border: { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN } 
    };
    const cellSmallLeft = { 
        font: { name: 'Arial', size: 7 }, 
        alignment: { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }, 
        border: { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN } 
    };
    const cellSmallLeftDukuh = { 
        font: { name: 'Arial', size: 7 }, 
        alignment: { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }, 
        border: { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN } 
    };

    // 3. Isi Khusus A & K (Merah, No Border)
    const noBorderRedStyle = { 
        font: { name: 'Arial', size: 9, color: { argb: 'FFFF0000' } }, 
        alignment: { vertical: 'middle', horizontal: 'center' } 
    };

    // --- PAGE SETUP ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, 
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
        fitToPage: true, 
        printArea: 'A:K'
    };

    // --- JUDUL ---
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    worksheet.mergeCells('B1:J1');
    worksheet.getCell('B1').value = 'REKAP DATA RT RW DAN DUSUN SE-KECAMATAN PUNGGELAN';
    worksheet.getCell('B1').style = titleStyle;

    worksheet.mergeCells('B2:J2');
    worksheet.getCell('B2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('B2').style = titleStyle;

    worksheet.addRow([]); 

    // --- HEADER TABEL (Baris 4) ---
    const headerRow = worksheet.getRow(4);
    headerRow.values = ['KODE DESA', 'KABUPATEN', 'KECAMATAN', 'DESA', 'DUSUN', 'RW', 'NAMA KETUA RW', 'RT', 'NAMA KETUA RT', 'DUKUH', ''];
    headerRow.height = 30;

    // --- SUB HEADER (Baris 5) ---
    const subHeaderRow = worksheet.getRow(5);
    subHeaderRow.values = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', '']; // A & K kosong angka
    subHeaderRow.height = 20;

    // Apply Header Styles (Baris 4 & 5)
    [headerRow, subHeaderRow].forEach(row => {
        for (let c = 1; c <= 11; c++) {
            const cell = row.getCell(c);
            if (c === 1 || c === 11) {
                cell.style = noBorderRedStyle; // Merah, No Border, No Fill
                if(c===11 && row === headerRow) cell.value = ''; 
            } else {
                cell.style = headerStyle; // Abu-abu, Border
            }
        }
    });

    // --- SPASI SATU BARIS SETELAH HEADER (Baris 6) ---
    const spacerRow = worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '']);
    spacerRow.height = 15;
    
    // Style Spacer Row (Border B-J, A & K No Border)
    spacerRow.getCell(1).style = noBorderRedStyle; 
    spacerRow.getCell(11).style = noBorderRedStyle; 
    for (let c = 2; c <= 10; c++) {
        spacerRow.getCell(c).style = cellCenter; 
        delete spacerRow.getCell(c).fill; 
    }

    // --- DATA PROCESSING ---
    const sortedDesa = rekapData.sort((a, b) => {
        const codeA = parseInt(KODE_DESA_MAP[a.namaDesa] || 99);
        const codeB = parseInt(KODE_DESA_MAP[b.namaDesa] || 99);
        return codeA - codeB;
    });

    sortedDesa.forEach(desa => {
        const kodeDesa = KODE_DESA_MAP[desa.namaDesa] || '';
        let isFirstRowOfDesa = true;
        
        let startDataRow = worksheet.lastRow.number + 1;

        // Flatten & Sort Entries
        let allEntries = [];
        desa.dusunGroups.forEach(group => {
            const sortedGroupEntries = group.entries.sort((a, b) => {
                const rwA = parseInt(a.no_rw) || 0; const rwB = parseInt(b.no_rw) || 0;
                if (rwA !== rwB) return rwA - rwB;
                const rtA = parseInt(a.no_rt) || 0; const rtB = parseInt(b.no_rt) || 0;
                return rtA - rtB;
            });
            allEntries = [...allEntries, ...sortedGroupEntries];
        });

        // Loop Entries
        for (let i = 0; i < allEntries.length; i++) {
            const entry = allEntries[i];
            const nextEntry = i < allEntries.length - 1 ? allEntries[i+1] : null;

            // Nama Desa: Uppercase
            const namaDesaDisplay = desa.namaDesa ? desa.namaDesa.toUpperCase() : '';

            const row = worksheet.addRow([
                isFirstRowOfDesa ? kodeDesa : '',       // A: KODE
                isFirstRowOfDesa ? 'BANJARNEGARA' : '', // B: KAB
                isFirstRowOfDesa ? 'PUNGGELAN' : '',    // C: KEC
                isFirstRowOfDesa ? namaDesaDisplay : '', // D: DESA (UPPERCASE)
                entry.dusun,                            // E: DUSUN
                entry.no_rw,                            // F: RW
                entry.namaKetuaRw || '',                // G: KETUA RW
                entry.no_rt,                            // H: RT
                entry.namaKetuaRt,                      // I: KETUA RT
                entry.dukuh,                            // J: DUKUH
                null                                    // K: KET
            ]);

            const rIdx = row.number;
            row.getCell(11).value = {
                formula: `IF(H${rIdx}>=1,"1",IF(H${rIdx}>=1,"1",IF(H${rIdx}>=1,"1",IF(H${rIdx}>=1,"1","0"))))`
            };

            // --- STYLING BARIS ---
            row.height = 20;
            
            // Kolom A & K
            row.getCell(1).style = noBorderRedStyle;
            row.getCell(11).style = noBorderRedStyle;

            // Kolom B-J (Border Penuh, NO FILL)
            for (let c = 2; c <= 10; c++) {
                const cell = row.getCell(c);
                
                // Alignment Logic
                if (c === 5) { // DUSUN -> Font 7
                    cell.style = cellSmallLeft;
                } else if (c === 10) { // DUKUH -> Font 7
                    cell.style = cellSmallLeftDukuh;
                } else if ([4, 7, 9].includes(c)) { // Desa, Ketua RW, Ketua RT -> Left
                    cell.style = cellLeft;
                } else { // Kab, Kec, RW, RT -> Center
                    cell.style = cellCenter;
                }
                
                // Jika Baris Pertama Desa & Kolom Desa (D), beri Bold
                if (isFirstRowOfDesa && c === 4) {
                    cell.font = { name: 'Arial', size: 9, bold: true };
                }

                // Hapus Fill (Default Putih/No Color)
                delete cell.fill;
            }

            // --- SEPARATOR RW ---
            if (nextEntry) {
                const isRwChanged = entry.no_rw !== nextEntry.no_rw;
                const isDusunChanged = entry.dusun !== nextEntry.dusun;

                if (isRwChanged || isDusunChanged) {
                    const sepRow = worksheet.addRow(['', '', '', '', '', '', '', '', '', '', { formula: '"0"' }]);
                    sepRow.height = 20;
                    for (let c = 2; c <= 10; c++) {
                        sepRow.getCell(c).style = cellCenter; // Border
                        delete sepRow.getCell(c).fill; // No Fill
                    }
                    sepRow.getCell(1).style = noBorderRedStyle;
                    sepRow.getCell(11).style = noBorderRedStyle;
                }
            }

            isFirstRowOfDesa = false;
        }

        const endDataRow = worksheet.lastRow.number;

        // --- BARIS JUMLAH ---
        const sumRow = worksheet.addRow([
            '',         // A
            'JUMLAH',   // B
            '', '', '', // C, D, E
            '',         // F 
            '',         // G
            { formula: `COUNTIF(K${startDataRow}:K${endDataRow}, "1")` }, // H: Count RT
            '', '',     // I, J
            ''          // K
        ]);
        sumRow.height = 20;

        // Styling Baris Jumlah
        for (let c = 2; c <= 10; c++) {
            const cell = sumRow.getCell(c);
            cell.style = cellCenter; // Border
            cell.font = { name: 'Arial', size: 9, bold: true }; // Bold
            
            // Hapus Fill untuk semua kolom di baris jumlah
            delete cell.fill; 

            if (c === 2) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        }
        
        sumRow.getCell(1).style = noBorderRedStyle;
        sumRow.getCell(11).style = noBorderRedStyle;
    });

    // --- COLUMN WIDTHS ---
    worksheet.getColumn(1).width = 10; // KODE
    worksheet.getColumn(2).width = 15; // KAB
    worksheet.getColumn(3).width = 15; // KEC
    worksheet.getColumn(4).width = 15; // DESA
    worksheet.getColumn(5).width = 15; // DUSUN
    worksheet.getColumn(6).width = 5;  // RW
    worksheet.getColumn(7).width = 25; // KETUA RW
    worksheet.getColumn(8).width = 5;  // RT
    worksheet.getColumn(9).width = 25; // KETUA RT
    worksheet.getColumn(10).width = 15;// DUKUH
    worksheet.getColumn(11).width = 5; // KET

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Rekap_Data_RT_RW_Dusun_Kec_Punggelan_${currentYear}.xlsx`);
};