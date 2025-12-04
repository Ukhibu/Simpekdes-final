import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DESA_LIST } from './constants';

/**
 * Membuat file XLSX generik untuk data organisasi desa (LPM, PKK, dll.).
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
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
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
        if (role === 'admin_kecamatan' && desa === 'all') headers.splice(1, 0, 'DESA');
        
        headerRow.values = headers;
        headerRow.eachCell({ includeEmpty: true }, cell => cell.style = tableHeaderStyle);
        headerRow.height = 25;
        return startRow + 1;
    };
    
    const addDataRows = (data, startRow) => {
        data.forEach((item, index) => {
            const row = worksheet.getRow(startRow + index);
            let rowData = [index + 1];
            if (role === 'admin_kecamatan' && desa === 'all') {
                rowData.push(item.desa || '');
            }
            config.formFields.forEach(f => {
                rowData.push(item[f.name] || '');
            });
            
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
        const sigColStart = worksheet.columns.length - 2;
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
        
        for(let i = 0; i <= 7; i++) {
             const row = worksheet.getRow(startRow + i);
             if (row) {
                const cell = row.getCell(sigColStart);
                cell.alignment = { ...cell.alignment, horizontal: 'center' };
                if(i > 1 && i < 5) row.height = 15;
             }
        }
    };

    let currentRow = 1;
    const numColumns = config.formFields.length + 1 + (role === 'admin_kecamatan' && desa === 'all' ? 1 : 0);

    const mainTitle = desa === 'all'
        ? `DATA ${config.title.toUpperCase()} SE-KECAMATAN PUNGGELAN`
        : `DATA ${config.title.toUpperCase()} DESA ${desa.toUpperCase()}`;
    
    worksheet.mergeCells(currentRow, 1, currentRow, numColumns);
    worksheet.getCell(currentRow, 1).value = mainTitle;
    worksheet.getCell(currentRow, 1).style = titleStyle;
    currentRow++;
    
    worksheet.mergeCells(currentRow, 1, currentRow, numColumns);
    worksheet.getCell(currentRow, 1).value = `TAHUN ${currentYear}`;
    worksheet.getCell(currentRow, 1).style = subTitleStyle;
    currentRow += 2;

    if (role === 'admin_kecamatan' && desa === 'all') {
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
            worksheet.mergeCells(currentRow, 1, currentRow, numColumns);
            worksheet.getCell(currentRow, 1).value = `Desa ${namaDesa.toUpperCase()}`;
            worksheet.getCell(currentRow, 1).style = desaHeaderStyle;
            currentRow++;
            
            currentRow = addHeader(currentRow);
            currentRow = addDataRows(dataByDesa[namaDesa], currentRow);
            currentRow += 2;
        });
        
        addSignatureBlock(currentRow, {
            location: 'Punggelan',
            jabatan: exportConfig?.jabatanPenandaTangan || 'Camat Punggelan',
            nama: exportConfig?.namaPenandaTangan,
            pangkat: exportConfig?.pangkatPenandaTangan,
            nip: exportConfig?.nipPenandaTangan
        });

    } else {
        currentRow = addHeader(currentRow);
        currentRow = addDataRows(dataToExport, currentRow);
        
        const kades = allPerangkat.find(p => p.desa === desa && p.jabatan?.toLowerCase().includes('kepala desa'));
        addSignatureBlock(currentRow + 2, {
            location: desa,
            jabatan: 'Kepala Desa',
            nama: kades?.nama
        });
    }
    
    worksheet.columns.forEach((column, i) => {
        if (i === 0) {
            column.width = 5;
        } else if (i === 1 && role === 'admin_kecamatan' && desa === 'all') {
            column.width = 20;
        } else {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                let columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 20 ? 20 : maxLength + 2;
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = desa === 'all'
        ? `Data_${config.collectionName}_Kec_Punggelan_${currentYear}.xlsx`
        : `Data_${config.collectionName}_Desa_${desa}_${currentYear}.xlsx`;
    saveAs(blob, fileName);
};