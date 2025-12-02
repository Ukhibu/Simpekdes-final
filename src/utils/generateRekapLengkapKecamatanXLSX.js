import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DESA_LIST, KODE_DESA_MAP } from '../utils/constants';

export const generateRekapLengkapKecamatanXLSX = async (rekapData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('REKAP DATA RT RW');
    const currentYear = new Date().getFullYear();

    // --- CONFIG STYLES ---
    const BORDER_THIN = { style: 'thin', color: { argb: 'FF000000' } };
    
    // 1. Header Style (B-J)
    const headerStyle = { 
        font: { name: 'Arial', size: 10, bold: true }, 
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, 
        border: { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN }, 
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } // Abu-abu
    };

    // 2. Header Khusus A & K (Merah, No Border/Fill)
    const headerSpecialStyle = {
        font: { name: 'Arial', size: 9, color: { argb: 'FFFF0000' } }, // Merah
        alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // 3. Isi Tabel (B-J)
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
        font: { name: 'Arial', size: 7 }, // Ukuran 7 untuk Dusun
        alignment: { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }, 
        border: { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN } 
    };
    const cellSmallLeftDukuh = { 
        font: { name: 'Arial', size: 7 }, // Ukuran 7 untuk Dukuh
        alignment: { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }, 
        border: { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN } 
    };

    // 4. Isi Khusus A & K (Merah, No Border)
    const cellRedNoBorder = { 
        font: { name: 'Arial', size: 9, color: { argb: 'FFFF0000' } }, 
        alignment: { vertical: 'middle', horizontal: 'center' } 
    };
    const noBorderRedStyle = { 
        font: { name: 'Arial', size: 9, color: { argb: 'FFFF0000' } }, 
        alignment: { vertical: 'middle', horizontal: 'center' } 
    };

    // 5. Warna Fill Khusus
    const fillBlue = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }; // Biru Muda (Awal Desa - Kolom B,C,D)
    const fillGreen = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // Hijau (Data & Jumlah)
    const fillWhite = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Putih (Default)

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
                cell.style = headerSpecialStyle; // Merah, No Border
                if(c===11 && row === headerRow) cell.value = ''; // Pastikan label KET muncul
            } else {
                cell.style = headerStyle; // Abu-abu, Border
            }
        }
    });

    // --- DATA PROCESSING ---
    const sortedDesa = rekapData.sort((a, b) => {
        const codeA = parseInt(KODE_DESA_MAP[a.namaDesa] || 99);
        const codeB = parseInt(KODE_DESA_MAP[b.namaDesa] || 99);
        return codeA - codeB;
    });

    sortedDesa.forEach(desa => {
        const kodeDesa = KODE_DESA_MAP[desa.namaDesa] || '';
        let isFirstRowOfDesa = true;
        let startRowForSum = worksheet.lastRow.number + 1;

        // Flatten & Sort Entries (Dusun -> RW -> RT)
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

            const row = worksheet.addRow([
                isFirstRowOfDesa ? kodeDesa : '',       // A: KODE
                isFirstRowOfDesa ? 'BANJARNEGARA' : '', // B: KAB
                isFirstRowOfDesa ? 'PUNGGELAN' : '',    // C: KEC
                isFirstRowOfDesa ? desa.namaDesa : '',  // D: DESA
                entry.dusun,                            // E: DUSUN
                entry.no_rw,                            // F: RW
                entry.namaKetuaRw || '',                // G: KETUA RW
                entry.no_rt,                            // H: RT
                entry.namaKetuaRt,                      // I: KETUA RT
                entry.dukuh,                            // J: DUKUH
                null                                    // K: KET (Rumus)
            ]);

            const rIdx = row.number;
            row.getCell(11).value = {
                formula: `IF(H${rIdx}>=1,"1",IF(H${rIdx}>=1,"1",IF(H${rIdx}>=1,"1",IF(H${rIdx}>=1,"1","0"))))`
            };

            // --- STYLING BARIS ---
            row.height = 20;
            
            // Kolom A & K (Merah, No Border)
            row.getCell(1).style = noBorderRedStyle;
            row.getCell(11).style = noBorderRedStyle;

            // Kolom B-J (Border Penuh)
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

                // Warna Fill: 
                // - Baris Pertama Desa Kolom B-J: Biru
                // - Baris Data Lainnya: Putih
                if (isFirstRowOfDesa) {
                    cell.fill = fillBlue; // Biru untuk seluruh baris pertama desa
                } else {
                    cell.fill = fillWhite; // Putih untuk baris data lainnya
                }
            }

            // --- SEPARATOR RW ---
            if (nextEntry) {
                const isRwChanged = entry.no_rw !== nextEntry.no_rw;
                const isDusunChanged = entry.dusun !== nextEntry.dusun;

                if (isRwChanged || isDusunChanged) {
                    const sepRow = worksheet.addRow(['', '', '', '', '', '', '', '', '', '', { formula: '"0"' }]);
                    sepRow.height = 20;
                    // Style Separator (B-J Putih, A/K No Border)
                    for (let c = 2; c <= 10; c++) {
                        sepRow.getCell(c).style = cellCenter;
                        sepRow.getCell(c).fill = fillWhite; // Putih untuk separator
                    }
                    sepRow.getCell(1).style = noBorderRedStyle;
                    sepRow.getCell(11).style = noBorderRedStyle;
                }
            }

            isFirstRowOfDesa = false;
        }

        const endRowForSum = worksheet.lastRow.number;

        // --- BARIS JUMLAH (HIJAU) ---
        // Letak "JUMLAH" di kolom G (Ketua RW), Nilai di kolom H (RT)
        const sumRow = worksheet.addRow([
            '', '', '', '', '', '', 
            'JUMLAH', // G
            { formula: `COUNTIF(K${startRowForSum}:K${endRowForSum}, "1")` }, // H (Rumus)
            '', '', 
            '' // K (Kosong)
        ]);
        sumRow.height = 20;

        // Merge A-F Kosong (Opsional, atau biarkan kosong ber-border)
        // Agar rapi, kita beri border kosong ke A-F
        
        // Styling Baris Jumlah
        for (let c = 2; c <= 10; c++) {
            const cell = sumRow.getCell(c);
            cell.style = cellCenter;
            cell.fill = fillGreen; // Warna Hijau untuk kolom B-J
            if (c === 7 || c === 8) cell.font = { ...cellCenter.font, bold: true }; // Bold untuk Label & Nilai
        }
        
        // A & K tetap Style Merah No Border (Kosong) dengan fill Putih
        sumRow.getCell(1).style = noBorderRedStyle;
        sumRow.getCell(11).style = noBorderRedStyle;
        sumRow.getCell(1).fill = fillWhite;
        sumRow.getCell(11).fill = fillWhite;

        // Separator Antar Desa (Opsional, jarak 1 baris kosong TANPA border apapun untuk pemisah jelas)
        // worksheet.addRow([]); 
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

    // Simpan File
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Rekap_Data_RT_RW_Dusun_Kec_Punggelan_${currentYear}.xlsx`);
};