import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DESA_LIST } from './constants'; // <-- BARIS INI DIPERBAIKI

/**
 * Fungsi utilitas untuk memformat tanggal dengan aman untuk Excel.
 * @param {*} dateField - Nilai tanggal yang bisa berupa Timestamp Firestore, string, atau Date.
 * @returns {Date|null} Objek Date yang valid atau null.
 */
const formatDateForExcel = (dateField) => {
    if (!dateField) return null;
    try {
        const date = dateField.toDate ? dateField.toDate() : new Date(dateField);
        if (isNaN(date.getTime())) return null;
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset);
    } catch (error) {
        return null;
    }
};

/**
 * Membuat file XLSX untuk data organisasi desa (LPM, PKK, dll.).
 * @param {object} exportData - Objek berisi semua data dan konfigurasi untuk ekspor.
 */
export const generateOrganisasiXLSX = async (exportData) => {
    const {
        config,
        dataToExport,
        role,
        desa,
        exportConfig,
        allPerangkat
    } = exportData;

    if (!dataToExport || dataToExport.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Data ${config.title}`);
    const currentYear = new Date().getFullYear();

    // --- Pengaturan Halaman & Cetak ---
    worksheet.pageSetup = {
        orientation: 'portrait',
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
            left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3
        },
        horizontalCentered: true,
    };

    // --- Definisi Styles ---
    const titleStyle = { font: { name: 'Arial', size: 14, bold: true }, alignment: { horizontal: 'center' } };
    const subTitleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { horizontal: 'center' } };
    const desaHeaderStyle = { font: { name: 'Arial', size: 11, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }, alignment: { horizontal: 'center', vertical: 'middle' } };
    const tableHeaderStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const cellStyle = { font: { name: 'Arial', size: 10 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle', wrapText: true } };

    // --- Fungsi Bantuan Internal ---
    const addHeader = (startRow) => {
        const headerRow = worksheet.getRow(startRow);
        const headers = ['NO', ...config.formFields.map(f => f.label.toUpperCase())];
        if (role === 'admin_kecamatan') headers.splice(1, 0, 'DESA');
        headerRow.values = headers;
        headerRow.eachCell({ includeEmpty: true }, cell => cell.style = tableHeaderStyle);
        headerRow.height = 25;
        return startRow + 1;
    };
    
    const addDataRows = (data, startRow) => {
        data.forEach((item, index) => {
            const row = worksheet.getRow(startRow + index);
            const rowData = [index + 1, ...config.formFields.map(f => item[f.name] || '')];
            if (role === 'admin_kecamatan') rowData.splice(1, 0, item.desa || '');
            row.values = rowData;
            row.height = 20;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.style = cellStyle;
                if (colNumber === 1) cell.alignment.horizontal = 'center';
            });
        });
        return startRow + data.length;
    };

    const addSignatureBlock = (startRow, signer) => {
        const sigColStart = worksheet.columns.length - 2; // Mulai dari 2 kolom sebelum akhir
        const sigColEnd = worksheet.columns.length;
        worksheet.mergeCells(startRow, sigColStart, startRow, sigColEnd);
        worksheet.getCell(startRow, sigColStart).value = `${signer.location}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.mergeCells(startRow + 1, sigColStart, startRow + 1, sigColEnd);
        worksheet.getCell(startRow + 1, sigColStart).value = signer.jabatan;

        worksheet.mergeCells(startRow + 5, sigColStart, startRow + 5, sigColEnd);
        const nameCell = worksheet.getCell(startRow + 5, sigColStart);
        nameCell.value = (signer.nama || '(....................................)').toUpperCase();
        nameCell.font = { name: 'Arial', size: 10, bold: true, underline: true };

        if(signer.pangkat) {
            worksheet.mergeCells(startRow + 6, sigColStart, startRow + 6, sigColEnd);
            worksheet.getCell(startRow + 6, sigColStart).value = signer.pangkat;
        }
        if(signer.nip) {
            worksheet.mergeCells(startRow + 7, sigColStart, startRow + 7, sigColEnd);
            worksheet.getCell(startRow + 7, sigColStart).value = `NIP. ${signer.nip}`;
        }
        
        // Center alignment for signature block
        for(let i = 0; i <= 7; i++) {
             const row = worksheet.getRow(startRow + i);
             const cell = row.getCell(sigColStart);
             cell.alignment = { ...cell.alignment, horizontal: 'center' };
             if(i > 1 && i < 5) row.height = 15;
        }
    };

    // --- Logika Pembuatan Laporan ---
    let currentRow = 1;

    // Judul Utama
    const mainTitle = role === 'admin_kecamatan'
        ? `DATA ${config.title.toUpperCase()} SE-KECAMATAN PUNGGELAN`
        : `DATA ${config.title.toUpperCase()} DESA ${desa.toUpperCase()}`;
    
    worksheet.mergeCells(currentRow, 1, currentRow, config.formFields.length + (role === 'admin_kecamatan' ? 2 : 1));
    worksheet.getCell(currentRow, 1).value = mainTitle;
    worksheet.getCell(currentRow, 1).style = titleStyle;
    currentRow++;
    
    worksheet.mergeCells(currentRow, 1, currentRow, config.formFields.length + (role === 'admin_kecamatan' ? 2 : 1));
    worksheet.getCell(currentRow, 1).value = `TAHUN ${currentYear}`;
    worksheet.getCell(currentRow, 1).style = subTitleStyle;
    currentRow += 2;

    // Logika untuk Admin Kecamatan (laporan per desa)
    if (role === 'admin_kecamatan') {
        const dataByDesa = DESA_LIST.reduce((acc, namaDesa) => {
            const desaData = dataToExport.filter(item => item.desa === namaDesa);
            if (desaData.length > 0) acc[namaDesa] = desaData;
            return acc;
        }, {});

        Object.keys(dataByDesa).forEach((namaDesa, index) => {
            if (index > 0) {
                 worksheet.getRow(currentRow).addPageBreak();
                 currentRow += 2;
            }
            worksheet.mergeCells(currentRow, 1, currentRow, config.formFields.length + 2);
            worksheet.getCell(currentRow, 1).value = `Desa ${namaDesa.toUpperCase()}`;
            worksheet.getCell(currentRow, 1).style = desaHeaderStyle;
            currentRow++;
            
            currentRow = addHeader(currentRow);
            currentRow = addDataRows(dataByDesa[namaDesa], currentRow);
            currentRow += 2; // Spacing
        });
        
        // Tanda tangan Camat di akhir
        addSignatureBlock(currentRow, {
            location: 'Punggelan',
            jabatan: exportConfig?.jabatanPenandaTangan || 'Camat Punggelan',
            nama: exportConfig?.namaPenandaTangan,
            pangkat: exportConfig?.pangkatPenandaTangan,
            nip: exportConfig?.nipPenandaTangan
        });

    } else { // Logika untuk Admin Desa (satu laporan)
        currentRow = addHeader(currentRow);
        currentRow = addDataRows(dataToExport, currentRow);
        
        // Tanda tangan Kepala Desa
        const kades = allPerangkat.find(p => p.desa === desa && p.jabatan?.toLowerCase() === 'kepala desa');
        addSignatureBlock(currentRow + 2, {
            location: desa,
            jabatan: 'Kepala Desa',
            nama: kades?.nama
        });
    }
    
    // Atur Lebar Kolom
    worksheet.columns.forEach((column, i) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            let columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 15 ? 15 : maxLength + 2;
    });
    worksheet.getColumn(1).width = 5; // Kolom "NO"

    // Simpan file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = role === 'admin_kecamatan' 
        ? `Data_${config.collectionName}_Kec_Punggelan_${currentYear}.xlsx`
        : `Data_${config.collectionName}_Desa_${desa}_${currentYear}.xlsx`;
    saveAs(blob, fileName);
};

