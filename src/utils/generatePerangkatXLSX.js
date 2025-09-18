import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper to safely parse dates from various string formats
const parseDate = (dateString) => {
    if (!dateString) return null;
    try {
        let date;
        if (dateString instanceof Date) {
            // Already a date object
            date = dateString;
        } else {
            // Handles YYYY-MM-DD and DD-MM-YYYY by replacing separators
            const cleanedString = dateString.toString().replace(/[/]/g, '-');
            const parts = cleanedString.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) { // YYYY-MM-DD
                    date = new Date(cleanedString);
                } else { // DD-MM-YYYY
                    date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }
            } else {
                 date = new Date(dateString);
            }
        }
        
        // Check if the parsed date is valid
        if (isNaN(date.getTime())) return null;

        // Adjust for timezone offset to prevent date shifts
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset);

    } catch (error) {
        console.error("Date parsing error:", error);
        return null;
    }
};


export const generatePerangkatXLSX = async (groupedData, exportConfig) => {
    const workbook = new ExcelJS.Workbook();

    // --- Definisi Styles ---
    const titleStyle = {
        font: { name: 'Arial', size: 12, bold: true },
        alignment: { vertical: 'middle', horizontal: 'center' }
    };
    const headerStyle = {
        font: { name: 'Arial', size: 10, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
    };
    // Style untuk sel dengan perataan kiri dan tengah vertikal (untuk teks)
    const leftCellStyle = {
        font: { name: 'Arial', size: 10 },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }
    };
    // Style untuk sel dengan perataan tengah (untuk angka)
    const centerCellStyle = { ...leftCellStyle, alignment: { ...leftCellStyle.alignment, horizontal: 'center' } };
    
    const totalRowStyle = {
        font: { name: 'Arial', size: 10, bold: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };

    for (const [index, group] of groupedData.entries()) {
        const desaName = group.desa.toUpperCase();
        const sheetName = `${index + 1}. ${desaName}`.substring(0, 31).replace(/[\\/*?[\]:]/g, "");
        const worksheet = workbook.addWorksheet(sheetName);

        // --- PENGATURAN HALAMAN UNTUK PRINT ---
        worksheet.pageSetup = {
            paperSize: 9, // 9 untuk A4
            orientation: 'landscape',
            margins: {
                left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2
            },
            fitToPage: true,
            fitToWidth: 1, // Memaksa semua kolom masuk dalam satu halaman
            fitToHeight: 0 // Membiarkan baris mengalir ke halaman berikutnya
        };

        // --- Judul ---
        worksheet.mergeCells('A1:V1');
        worksheet.getCell('A1').value = `DATA PERANGKAT DESA ${desaName} KECAMATAN PUNGGELAN`;
        worksheet.getCell('A1').style = titleStyle;

        worksheet.mergeCells('A2:V2');
        worksheet.getCell('A2').value = `TAHUN ${new Date().getFullYear()}`;
        worksheet.getCell('A2').style = titleStyle;
        worksheet.addRow([]);

        // --- Header Tabel ---
        const headerRowDefs = [
            ["NO", "N A M A", "Jenis Kelamin", null, "JABATAN", "TEMPAT, TGL LAHIR", null, "PENDIDIKAN", null, null, null, null, null, null, null, null, "NO SK", "TANGGAL SK", "TANGGAL PELANTIKAN", "AKHIR MASA JABATAN", "No. HP / WA", "N I K"],
            [null, null, 'L', 'P', null, null, null, 'SD', 'SLTP', 'SLTA', 'D1', 'D2', 'D3', 'S1', 'S2', 'S3', null, null, null, null, null, null]
        ];
        worksheet.addRows(headerRowDefs);

        worksheet.mergeCells('A4:A5'); worksheet.mergeCells('B4:B5');
        worksheet.mergeCells('C4:D4'); worksheet.mergeCells('E4:E5');
        worksheet.mergeCells('F4:G4'); 
        // --- Header Pendidikan diperluas ---
        worksheet.mergeCells('H4:P4'); 
        worksheet.mergeCells('Q4:Q5'); worksheet.mergeCells('R4:R5');
        worksheet.mergeCells('S4:S5'); worksheet.mergeCells('T4:T5');
        worksheet.mergeCells('U4:U5'); worksheet.mergeCells('V4:V5');

        // --- Daftar sel header diperbarui ---
        const headerCells = [
            'A4', 'B4', 'C4', 'E4', 'F4', 'H4', 'Q4', 'R4', 'S4', 'T4', 'U4', 'V4', 
            'C5', 'D5', 'H5', 'I5', 'J5', 'K5', 'L5', 'M5', 'N5', 'O5', 'P5'
        ];
        headerCells.forEach(cellRef => {
            worksheet.getCell(cellRef).style = headerStyle;
        });
        
        // --- Isi Data ---
        group.perangkat.forEach((p, i) => {
            const rowNumber = 6 + i;
            const tglLahirDate = parseDate(p.tgl_lahir);
            
            const getDateFormula = (dateObj) => {
                if (!dateObj) return null;
                return { formula: `DATE(${dateObj.getFullYear()}, ${dateObj.getMonth() + 1}, ${dateObj.getDate()})` };
            };

            const rowData = [
                i + 1,
                p.nama || '',
                p.jenis_kelamin === 'L' ? 1 : null,
                p.jenis_kelamin === 'P' ? 1 : null,
                p.jabatan || '',
                p.tempat_lahir || '',
                getDateFormula(tglLahirDate),
                p.pendidikan === 'SD' ? 1 : null,
                p.pendidikan === 'SMP' || p.pendidikan === 'SLTP' ? 1 : null,
                p.pendidikan === 'SLTA' ? 1 : null,
                // --- KOLOM PENDIDIKAN DIPISAH ---
                p.pendidikan === 'D1' ? 1 : null,
                p.pendidikan === 'D2' ? 1 : null,
                p.pendidikan === 'D3' ? 1 : null,
                p.pendidikan === 'S1' ? 1 : null,
                p.pendidikan === 'S2' ? 1 : null,
                p.pendidikan === 'S3' ? 1 : null,
                p.no_sk || '',
                getDateFormula(parseDate(p.tgl_sk)),
                getDateFormula(parseDate(p.tgl_pelantikan)),
                tglLahirDate ? { formula: `EDATE(G${rowNumber}, 720)` } : null,
                p.no_hp ? String(p.no_hp).replace(/\D/g, '') : null,
                p.nik ? `'${p.nik}` : ''
            ];
            const row = worksheet.addRow(rowData);

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.style = leftCellStyle;
                if ([1, 3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16].includes(colNumber)) {
                    cell.alignment.horizontal = 'center';
                }
                if (colNumber === 1) cell.numFmt = '0';
                if (colNumber === 7) cell.numFmt = '[$-id-ID]d mmmm yyyy;@';
                if ([18, 19, 20].includes(colNumber)) cell.numFmt = 'dd-mm-yyyy';
                if ([21, 22].includes(colNumber)) cell.numFmt = '@';
            });
        });

        // --- Baris Jumlah (Total) ---
        const firstDataRow = 6;
        const lastDataRow = worksheet.lastRow.number;
        if (lastDataRow >= firstDataRow) {
            const totalRow = worksheet.addRow([]);
            const totalRowNum = totalRow.number;

            worksheet.mergeCells(`A${totalRowNum}:B${totalRowNum}`);
            
            worksheet.getRow(totalRowNum).eachCell({ includeEmpty: true }, (cell, colNumber) => {
                 cell.style = totalRowStyle;
                 if (colNumber > 16) {
                    cell.value = null; 
                 }
            });

            worksheet.getCell(`A${totalRowNum}`).value = 'JUMLAH';
            
            // --- Kolom penjumlahan diperbarui ---
            ['C','D','H','I','J','K','L','M','N','O','P'].forEach(col => {
                const cell = worksheet.getCell(`${col}${totalRowNum}`);
                cell.value = { formula: `SUM(${col}${firstDataRow}:${col}${lastDataRow})` };
            });
        }


        // --- Blok Tanda Tangan (posisi disesuaikan) ---
        const sigRowIndex = worksheet.lastRow.number + 3;
        
        worksheet.mergeCells(`S${sigRowIndex}:V${sigRowIndex}`);
        worksheet.getCell(`S${sigRowIndex}`).value = `Punggelan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.getCell(`S${sigRowIndex}`).alignment = { horizontal: 'center' };

        worksheet.mergeCells(`S${sigRowIndex + 1}:V${sigRowIndex + 1}`);
        worksheet.getCell(`S${sigRowIndex + 1}`).value = exportConfig?.jabatanPenandaTangan || 'Camat Punggelan';
        worksheet.getCell(`S${sigRowIndex + 1}`).alignment = { horizontal: 'center' };

        worksheet.mergeCells(`S${sigRowIndex + 5}:V${sigRowIndex + 5}`);
        const kadesNamaCell = worksheet.getCell(`S${sigRowIndex + 5}`);
        kadesNamaCell.value = exportConfig?.namaPenandaTangan || '(...........................................)';
        kadesNamaCell.font = { name: 'Arial', size: 10, bold: true, underline: true };
        kadesNamaCell.alignment = { horizontal: 'center' };

        worksheet.mergeCells(`S${sigRowIndex + 6}:V${sigRowIndex + 6}`);
        worksheet.getCell(`S${sigRowIndex + 6}`).value = exportConfig?.pangkatPenandaTangan || 'Pangkat / Golongan';
        worksheet.getCell(`S${sigRowIndex + 6}`).alignment = { horizontal: 'center' };

        worksheet.mergeCells(`S${sigRowIndex + 7}:V${sigRowIndex + 7}`);
        worksheet.getCell(`S${sigRowIndex + 7}`).value = `NIP. ${exportConfig?.nipPenandaTangan || '...'}`;
        worksheet.getCell(`S${sigRowIndex + 7}`).alignment = { horizontal: 'center' };

        // --- Atur Lebar Kolom (disesuaikan) ---
        worksheet.columns = [
            { width: 4 },   // A: NO
            { width: 22 },  // B: Nama
            { width: 3.5 }, // C: L
            { width: 3.5 }, // D: P
            { width: 22 },  // E: Jabatan
            { width: 15 },  // F: Tempat Lahir
            { width: 18 },  // G: Tgl Lahir
            { width: 4 },   // H: SD
            { width: 4 },   // I: SLTP
            { width: 4 },   // J: SLTA
            { width: 4 },   // K: D1
            { width: 4 },   // L: D2
            { width: 4 },   // M: D3
            { width: 4 },   // N: S1
            { width: 4 },   // O: S2
            { width: 4 },   // P: S3
            { width: 22 },  // Q: No SK
            { width: 12 },  // R: Tgl SK
            { width: 12 },  // S: Tgl Pelantikan
            { width: 12 },  // T: Akhir Jabatan
            { width: 15 },  // U: No. HP
            { width: 20 }   // V: NIK
        ];
    }
    
    // --- Generate & Download File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Data_Perangkat_Desa_Kec_Punggelan_${new Date().getFullYear()}.xlsx`;
    saveAs(blob, fileName);
};

