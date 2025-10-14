import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DESA_LIST } from './constants';

export const generateRtRwXLSX = async (exportData) => {
    const { dataToExport, role, desa, exportConfig, allPerangkat } = exportData;

    if (!dataToExport || dataToExport.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data RT-RW');
    const currentYear = new Date().getFullYear();

    // --- Pengaturan Halaman & Cetak ---
    worksheet.pageSetup = {
        orientation: 'portrait',
        paperSize: 9, // A4
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    };

    // --- Definisi Styles ---
    const titleStyle = { font: { name: 'Arial', size: 14, bold: true }, alignment: { horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const cellStyle = { font: { name: 'Arial', size: 10 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle', wrapText: true } };

    let currentRow = 1;
    const headers = ['NO', 'NAMA KETUA', 'JABATAN', 'NOMOR', 'DUSUN/DUKUH', 'PERIODE'];
    const numColumns = headers.length;
    
    // --- Judul ---
    const mainTitle = desa === 'all' ? `DATA KETUA RT/RW SE-KECAMATAN PUNGGELAN` : `DATA KETUA RT/RW DESA ${desa.toUpperCase()}`;
    worksheet.mergeCells(currentRow, 1, currentRow, numColumns);
    worksheet.getCell(currentRow, 1).value = mainTitle;
    worksheet.getCell(currentRow, 1).style = titleStyle;
    currentRow += 2;

    // --- Header Tabel ---
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = headers;
    headerRow.eachCell({ includeEmpty: true }, cell => cell.style = headerStyle);
    currentRow++;

    // --- Isi Data ---
    const sortedData = [...dataToExport].sort((a, b) => (a.nomor || '').localeCompare(b.nomor || ''));
    sortedData.forEach((item, index) => {
        const row = worksheet.addRow([
            index + 1,
            item.nama || '',
            item.jabatan || '',
            item.nomor || '',
            item.dusun || '',
            item.periode || ''
        ]);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.style = cellStyle;
            if ([1, 3, 4].includes(colNumber)) cell.alignment.horizontal = 'center';
        });
    });
    currentRow += sortedData.length;

    // --- Blok Tanda Tangan ---
    // ... (Logika tanda tangan bisa ditambahkan di sini, mirip dengan generateLpmXLSX)

    // --- Lebar Kolom ---
    worksheet.columns = [
        { width: 5 },   // NO
        { width: 30 },  // NAMA KETUA
        { width: 15 },  // JABATAN
        { width: 15 },  // NOMOR
        { width: 25 },  // DUSUN/DUKUH
        { width: 20 }   // PERIODE
    ];

    // --- Simpan File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = desa === 'all' ? `Data_RTRW_Kec_Punggelan_${currentYear}.xlsx` : `Data_RTRW_Desa_${desa}_${currentYear}.xlsx`;
    saveAs(blob, fileName);
};
