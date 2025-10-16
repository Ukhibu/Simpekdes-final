import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DESA_LIST } from './constants'; // Asumsi DESA_LIST ada di constants

/**
 * [PENULISAN ULANG TOTAL]
 * Membuat file XLSX Rekapitulasi RT/RW dan Dusun sesuai format yang diminta.
 * @param {object} exportData - Data yang dibutuhkan untuk ekspor.
 */
export const generateRtRwXLSX = async (exportData) => {
    const {
        dataToExport,
        role, // 'admin_desa' atau 'admin_kecamatan'
        desa, // Nama desa spesifik atau 'all'
    } = exportData;

    if (!dataToExport || dataToExport.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap RT RW');

    // --- Pengaturan Halaman & Cetak ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };

    // --- Definisi Styles ---
    const defaultFont = { name: 'Arial', size: 10 };
    const titleStyle = { font: { ...defaultFont, size: 14, bold: true }, alignment: { horizontal: 'center' } };
    const headerStyle = { font: { ...defaultFont, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const cellStyle = { font: defaultFont, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle', wrapText: true } };
    const centerCellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' } };
    const keteranganStyle = { font: { ...defaultFont, italic: true } };
    
    let currentRow = 1;

    // --- Judul Laporan ---
    const mainTitle = desa === 'all'
        ? `REKAPITULASI RT, RW DAN DUSUN SE-KECAMATAN PUNGGELAN`
        : `REKAPITULASI RT, RW DAN DUSUN DESA ${desa.toUpperCase()}`;
    worksheet.mergeCells(currentRow, 1, currentRow, 11);
    worksheet.getCell(currentRow, 1).value = mainTitle;
    worksheet.getCell(currentRow, 1).style = titleStyle;
    currentRow++;

    worksheet.mergeCells(currentRow, 1, currentRow, 11);
    worksheet.getCell(currentRow, 1).value = `TAHUN ${new Date().getFullYear()}`;
    worksheet.getCell(currentRow, 1).style = titleStyle;
    currentRow += 2;

    const headerStartRow = currentRow;

    // --- Header Tabel ---
    const headerRow1 = worksheet.getRow(headerStartRow);
    const headerRow2 = worksheet.getRow(headerStartRow + 1);
    headerRow1.values = ['KODE DESA', 'KABUPATEN', 'KECAMATAN', 'DESA', 'DUSUN', 'RW', 'NAMA KETUA Rw.', 'RT', 'NAMA KETUA Rt.', 'DUKUH', 'KET'];
    headerRow2.values = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
    
    [headerRow1, headerRow2].forEach(row => {
        row.height = 20;
        row.eachCell({ includeEmpty: true }, cell => cell.style = headerStyle);
    });
    
    currentRow += 2;
    
    // --- Strukturisasi Data ---
    const structuredData = {}; // { desa: { dusun: { rw: { ketua: {}, rts: [] } } } }

    dataToExport.forEach(item => {
        if (!item.desa || !item.dusun) return;
        
        if (!structuredData[item.desa]) structuredData[item.desa] = {};
        if (!structuredData[item.desa][item.dusun]) structuredData[item.desa][item.dusun] = {};
        
        const rwKey = item.no_rw || 'N/A';
        if (!structuredData[item.desa][item.dusun][rwKey]) {
            structuredData[item.desa][item.dusun][rwKey] = { ketua: null, rts: [] };
        }

        if (item.jabatan === 'Ketua RW') {
            structuredData[item.desa][item.dusun][rwKey].ketua = item;
        } else if (item.jabatan === 'Ketua RT') {
            structuredData[item.desa][item.dusun][rwKey].rts.push(item);
        }
    });

    // --- Isi Data ---
    const desaListToRender = desa === 'all' ? DESA_LIST : [desa];

    desaListToRender.forEach((namaDesa, desaIndex) => {
        const desaData = structuredData[namaDesa] || {};
        const dusunKeys = Object.keys(desaData).sort();

        let isFirstRowOfDesa = true;

        dusunKeys.forEach((namaDusun) => {
            const dusunData = desaData[namaDusun];
            const rwKeys = Object.keys(dusunData).sort();

            rwKeys.forEach((noRw) => {
                const rwData = dusunData[noRw];
                const { ketua, rts } = rwData;
                
                // Baris Ketua RW
                const rwRow = [];
                if (isFirstRowOfDesa) {
                    rwRow[0] = String(desaIndex + 1).padStart(2, '0');
                    rwRow[1] = 'BANJARNEGARA';
                    rwRow[2] = 'PUNGGELAN';
                    rwRow[3] = namaDesa;
                    isFirstRowOfDesa = false;
                } else {
                     rwRow[0] = rwRow[1] = rwRow[2] = rwRow[3] = null;
                }
                rwRow[4] = namaDusun;
                rwRow[5] = noRw !== 'N/A' ? noRw : '';
                rwRow[6] = ketua?.nama || '';
                rwRow[7] = ''; // RT
                rwRow[8] = ''; // Nama Ketua RT
                rwRow[9] = ketua?.dukuh || ''; // Dukuh dari Ketua RW
                rwRow[10] = '';
                
                const addedRwRow = worksheet.addRow(rwRow);
                addedRwRow.eachCell({ includeEmpty: true }, (cell, col) => {
                   cell.style = (col <= 4) ? cellStyle : centerCellStyle;
                });
                
                // Baris Ketua RT
                rts.sort((a,b) => (a.no_rt || '').localeCompare(b.no_rt || '')).forEach(rt => {
                    const rtRowData = new Array(11).fill(null);
                    rtRowData[7] = rt.no_rt || '';
                    rtRowData[8] = rt.nama || '';
                    rtRowData[9] = rt.dukuh || '';

                    const addedRtRow = worksheet.addRow(rtRowData);
                    addedRtRow.eachCell({ includeEmpty: true }, (cell, col) => {
                       cell.style = (col <= 4) ? cellStyle : centerCellStyle;
                    });
                });
            });

             // Baris pemisah antar dusun jika perlu
             const separatorRow = worksheet.addRow(new Array(11).fill(null));
             separatorRow.getCell(8).value = 0; // Sesuai contoh, angka 0 ada di kolom RT
             separatorRow.getCell(8).style = centerCellStyle;
             separatorRow.eachCell({ includeEmpty: true}, (cell, col) => cell.style = cellStyle)

        });
    });


    // --- Lebar Kolom ---
    worksheet.columns = [
        { width: 5 },  // Kode Desa
        { width: 15 }, // Kabupaten
        { width: 15 }, // Kecamatan
        { width: 20 }, // Desa
        { width: 20 }, // Dusun
        { width: 8 },  // RW
        { width: 25 }, // Nama Ketua RW
        { width: 8 },  // RT
        { width: 25 }, // Nama Ketua RT
        { width: 20 }, // Dukuh
        { width: 10 }  // Ket
    ];

    // --- Simpan File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = desa === 'all'
        ? `Rekap_RT_RW_Kecamatan_Punggelan.xlsx`
        : `Rekap_RT_RW_Desa_${desa}.xlsx`;
    saveAs(blob, fileName);
};
