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
    const cellStyle = { font: { name: 'Arial', size: 9 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'top' } };
    const centerCellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' } };
    const subHeaderStyle = { ...centerCellStyle, font: { ...cellStyle.font, size: 10 } };
    const separatorRowStyle = { font: { name: 'Arial', size: 9 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'top', horizontal: 'center' } };


    // --- Judul Utama ---
    worksheet.mergeCells('B1:K1');
    worksheet.getCell('B1').value = 'REKAP DATA RT RW DAN DUSUN SE-KECAMATAN PUNGGELAN';
    worksheet.getCell('B1').style = titleStyle;
    worksheet.mergeCells('B2:K2');
    worksheet.getCell('B2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('B2').style = titleStyle;
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
        // Apply border to the empty merged cell as well
        if (colNumber === 5) {
            cell.border = { 
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' }
            };
        } else {
            cell.style = subHeaderStyle;
        }
    });
    subHeaderRow.height = 20;
    
    // --- Isi Data ---
    data.forEach(desa => {
        // Group entries by dusun within each desa
        const groupedByDusun = desa.entries.reduce((acc, entry) => {
            const dusun = entry.dusun || 'Tanpa Dusun';
            if (!acc[dusun]) {
                acc[dusun] = [];
            }
            acc[dusun].push(entry);
            return acc;
        }, {});

        let isFirstRowOfDesa = true;

        for (const dusunName in groupedByDusun) {
            const entriesInDusun = groupedByDusun[dusunName];

            entriesInDusun.forEach(entry => {
                let rowData;
                if (isFirstRowOfDesa) {
                    rowData = [
                        KODE_DESA_MAP[desa.namaDesa], 'BANJARNEGARA', 'PUNGGELAN', desa.namaDesa, null,
                        entry.dusun, entry.no_rw, entry.namaKetuaRw, entry.no_rt, entry.namaKetuaRt, entry.dukuh ? 1 : null
                    ];
                    isFirstRowOfDesa = false;
                } else {
                    rowData = [
                        null, null, null, null, null,
                        entry.dusun, entry.no_rw, entry.namaKetuaRw, entry.no_rt, entry.namaKetuaRt, entry.dukuh ? 1 : null
                    ];
                }
                const row = worksheet.addRow(rowData);
                row.eachCell({ includeEmpty: true }, (cell, col) => {
                    if (col !== 5) {
                        cell.style = cellStyle;
                        if ([1, 2, 3, 7, 9, 11].includes(col)) cell.alignment = { ...cell.style.alignment, horizontal: 'center' };
                    } else {
                        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
                    }
                });
            });

            // Add the separator/total row with '0' after each dusun group
            const separatorRow = worksheet.addRow([null, null, null, null, null, null, null, null, null, null, 0]);
            worksheet.mergeCells(`A${separatorRow.number}:J${separatorRow.number}`);
            separatorRow.getCell('K').style = separatorRowStyle;
            separatorRow.getCell('A').style = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }} };
            separatorRow.getCell('J').style = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }} };
        }
    });
    
    // --- Atur Lebar Kolom ---
    worksheet.columns = [
        { width: 5 },  // A
        { width: 12 }, // B
        { width: 12 }, // C
        { width: 12 }, // D
        { width: 1 },  // E
        { width: 12 }, // F
        { width: 5 },  // G
        { width: 18 }, // H
        { width: 5 },  // I
        { width: 18 }, // J
        { width: 12 }  // K
    ];

    // --- Tulis File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Rekap_Lengkap_RT_RW_Dusun_Kecamatan_${currentYear}.xlsx`);
};

