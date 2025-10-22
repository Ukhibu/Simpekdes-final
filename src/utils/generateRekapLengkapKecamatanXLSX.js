import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { KODE_DESA_MAP } from './constants';

export const generateRekapLengkapKecamatanXLSX = async (data) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Lengkap Kecamatan');
    const currentYear = new Date().getFullYear();

    // --- Definisi Styles ---
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const cellStyle = { font: { name: 'Arial', size: 9 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'top', wrapText: true } };
    const centerCellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' } };
    const subHeaderStyle = { ...centerCellStyle, font: { ...cellStyle.font, size: 10 } };
    const totalRtRowStyle = { font: { name: 'Arial', size: 9, bold: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const totalDesaRowStyle = { ...totalRtRowStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } } };


    // --- Judul Utama ---
    worksheet.mergeCells('A1:K1');
    worksheet.getCell('A1').value = 'REKAP DATA RT RW DAN DUSUN SE-KECAMATAN PUNGGELAN';
    worksheet.getCell('A1').style = titleStyle;
    worksheet.mergeCells('A2:K2');
    worksheet.getCell('A2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('A2').style = titleStyle;
    worksheet.addRow([]); // Spacer

    // --- Header Tabel ---
    const headerRowDef = ['KODE DESA', 'KABUPATEN', 'KECAMATAN', 'DESA', null, 'DUSUN', 'RW', 'NAMA KETUA RW', 'RT', 'NAMA KETUA RT', 'DUKUH'];
    const subHeaderRowDef = [null, '1', '2', '3', null, '4', '5', '6', '7', '8', '9'];

    const headerRow = worksheet.addRow(headerRowDef);
    worksheet.mergeCells(`D${headerRow.number}:E${headerRow.number}`);
    headerRow.eachCell({ includeEmpty: true }, cell => cell.style = headerStyle);
    headerRow.height = 25;
    
    const subHeaderRow = worksheet.addRow(subHeaderRowDef);
    subHeaderRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber === 5) {
             cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        } else {
            cell.style = subHeaderStyle;
        }
    });
    subHeaderRow.height = 20;
    
    // --- Isi Data ---
    data.forEach(desa => {
        if (!desa.dusunGroups) return; // Safety check

        let isFirstRowOfDesa = true;

        desa.dusunGroups.forEach(dusunGroup => {
            if (!dusunGroup.entries || dusunGroup.entries.length === 0) return;

            dusunGroup.entries.forEach(entry => {
                const rowData = isFirstRowOfDesa
                    ? [ KODE_DESA_MAP[desa.namaDesa], 'BANJARNEGARA', 'PUNGGELAN', desa.namaDesa, null, entry.dusun, entry.no_rw, entry.namaKetuaRw, entry.no_rt, entry.namaKetuaRt, entry.dukuh ]
                    : [ null, null, null, null, null, entry.dusun, entry.no_rw, entry.namaKetuaRw, entry.no_rt, entry.namaKetuaRt, entry.dukuh ];
                
                if (isFirstRowOfDesa) isFirstRowOfDesa = false;

                const row = worksheet.addRow(rowData);
                row.eachCell({ includeEmpty: true }, (cell, col) => {
                    if (col !== 5) {
                        cell.style = cellStyle;
                        if ([1, 2, 3, 7, 9].includes(col)) cell.alignment.horizontal = 'center';
                    } else {
                        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
                    }
                });
            });

            // --- Baris Jumlah RT per Dusun ---
            const totalDusunRow = worksheet.addRow([null, null, null, null, null, null, null, 'JUMLAH RT', dusunGroup.rtCount, null, null]);
            worksheet.mergeCells(`A${totalDusunRow.number}:G${totalDusunRow.number}`);
            worksheet.mergeCells(`J${totalDusunRow.number}:K${totalDusunRow.number}`);
            totalDusunRow.getCell('H').style = totalRtRowStyle;
            totalDusunRow.getCell('I').style = totalRtRowStyle;
        });
        
        // --- Baris Jumlah TOTAL RT per Desa ---
        const totalDesaRow = worksheet.addRow([null, null, null, null, null, null, null, `JUMLAH TOTAL RT DESA ${desa.namaDesa.toUpperCase()}`, desa.totalRtDesa, null, null]);
        worksheet.mergeCells(`A${totalDesaRow.number}:G${totalDesaRow.number}`);
        worksheet.mergeCells(`J${totalDesaRow.number}:K${totalDesaRow.number}`);
        totalDesaRow.getCell('H').style = totalDesaRowStyle;
        totalDesaRow.getCell('I').style = totalDesaRowStyle;
    });
    
    // --- Atur Lebar Kolom ---
    worksheet.columns = [
        { width: 5 },  // A: KODE DESA
        { width: 12 }, // B: KABUPATEN
        { width: 12 }, // C: KECAMATAN
        { width: 14 }, // D: DESA
        { width: 1 },  // E: null
        { width: 14 }, // F: DUSUN
        { width: 5 },  // G: RW
        { width: 22 }, // H: NAMA KETUA RW
        { width: 5 },  // I: RT
        { width: 22 }, // J: NAMA KETUA RT
        { width: 15 }  // K: DUKUH
    ];

    // --- Tulis File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Rekap_Lengkap_RT_RW_Dusun_Kecamatan_${currentYear}.xlsx`);
};

