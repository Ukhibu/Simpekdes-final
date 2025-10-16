import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DESA_LIST } from './constants';

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

        // Mengoreksi zona waktu agar tanggal di Excel tidak bergeser
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset);
    } catch (error) {
        return null;
    }
};

/**
 * [PENULISAN ULANG TOTAL]
 * Membuat file XLSX khusus untuk data LPM sesuai format yang diminta.
 * @param {object} exportData - Data yang dibutuhkan untuk ekspor.
 */
export const generateLpmXLSX = async (exportData) => {
    const {
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
    const worksheet = workbook.addWorksheet('Data LPM');
    const currentYear = new Date().getFullYear();

    // --- Pengaturan Halaman & Cetak ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    };

    // --- Definisi Styles ---
    const titleStyle = { font: { name: 'Arial', size: 14, bold: true }, alignment: { horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } };
    const cellStyle = { font: { name: 'Arial', size: 9 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle' } };
    const centerCellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' } };
    const totalRowStyle = { ...cellStyle, font: { ...cellStyle.font, bold: true }, alignment: { ...cellStyle.alignment, horizontal: 'center' } };

    let currentRow = 1;
    const TOTAL_COLUMNS = 22;

    // --- Judul ---
    const mainTitle = desa === 'all'
        ? `DATA LEMBAGA PEMBERDAYAAN MASYARAKAT (LPM) SE-KECAMATAN PUNGGELAN`
        : `DATA LEMBAGA PEMBERDAYAAN MASYARAKAT (LPM) DESA ${desa.toUpperCase()}`;
    
    worksheet.mergeCells(currentRow, 1, currentRow, TOTAL_COLUMNS);
    worksheet.getCell(currentRow, 1).value = mainTitle;
    worksheet.getCell(currentRow, 1).style = titleStyle;
    currentRow++;

    worksheet.mergeCells(currentRow, 1, currentRow, TOTAL_COLUMNS);
    worksheet.getCell(currentRow, 1).value = `TAHUN ${currentYear}`;
    worksheet.getCell(currentRow, 1).style = titleStyle;
    currentRow += 2;

    // --- Header Tabel ---
    const headerRow1 = worksheet.getRow(currentRow);
    const headerRow2 = worksheet.getRow(currentRow + 1);

    headerRow1.values = ["NO", "DESA", "N A M A", "Jenis Kelamin", null, "J A B A T A N", "TEMPAT, TGL LAHIR", null, "PENDIDIKAN", null, null, null, null, null, null, null, "NO SK", "TANGGAL PELANTIKAN", "Masa Bakti (Tahun)", "AKHIR MASA JABATAN", "No. HP / WA", "N I K"];
    headerRow2.values = [null, null, null, 'L', 'P', null, "TEMPAT LAHIR", "TANGGAL LAHIR", 'SD', 'SMP', 'SLTA', 'D1', 'D2', 'D3', 'S1', 'S2', 'S3', null, null, null, null, null];
    
    // Merge cells untuk header
    worksheet.mergeCells(`A${currentRow}:A${currentRow + 1}`);
    worksheet.mergeCells(`B${currentRow}:B${currentRow + 1}`);
    worksheet.mergeCells(`C${currentRow}:C${currentRow + 1}`);
    worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
    worksheet.mergeCells(`F${currentRow}:F${currentRow + 1}`);
    worksheet.mergeCells(`G${currentRow}:H${currentRow}`);
    worksheet.mergeCells(`I${currentRow}:Q${currentRow}`);
    worksheet.mergeCells(`R${currentRow}:R${currentRow + 1}`);
    worksheet.mergeCells(`S${currentRow}:S${currentRow + 1}`);
    worksheet.mergeCells(`T${currentRow}:T${currentRow + 1}`);
    worksheet.mergeCells(`U${currentRow}:U${currentRow + 1}`);
    worksheet.mergeCells(`V${currentRow}:V${currentRow + 1}`);
    worksheet.mergeCells(`W${currentRow}:W${currentRow + 1}`); // Kolom tambahan untuk NIK
    
    [headerRow1, headerRow2].forEach(row => {
        row.height = 20;
        row.eachCell({ includeEmpty: true }, cell => cell.style = headerStyle);
    });
    
    currentRow += 2;
    const firstDataRow = currentRow;

    // --- Isi Data ---
    const pendidikanMap = { 'SD': 9, 'SLTP': 10, 'SLTA': 11, 'D1': 12, 'D2': 13, 'D3': 14, 'S1': 15, 'S2': 16, 'S3': 17 };
    const sortedData = [...dataToExport].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    
    sortedData.forEach((item, index) => {
        const rowData = new Array(TOTAL_COLUMNS).fill(null);
        rowData[0] = index + 1;
        rowData[1] = item.desa || '';
        rowData[2] = item.nama || '';
        rowData[3] = item.jenis_kelamin === 'L' ? 1 : null;
        rowData[4] = item.jenis_kelamin === 'P' ? 1 : null;
        rowData[5] = item.jabatan || '';
        rowData[6] = item.tempat_lahir || '';
        rowData[7] = formatDateForExcel(item.tgl_lahir);
        
        const pendidikanCol = pendidikanMap[item.pendidikan];
        if (pendidikanCol) rowData[pendidikanCol - 1] = 1;

        rowData[17] = item.no_sk || '';
        rowData[18] = formatDateForExcel(item.tgl_pelantikan);
        rowData[19] = item.masa_bakti ? parseInt(item.masa_bakti, 10) : null;
        rowData[20] = formatDateForExcel(item.akhir_jabatan);
        rowData[21] = item.no_hp || '';
        
        const row = worksheet.addRow(rowData);
        row.height = 20;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.style = (colNumber === 3 || colNumber === 6 || colNumber > 20) ? cellStyle : centerCellStyle;
            if (colNumber === 8 || colNumber === 19 || colNumber === 21) {
                 cell.numFmt = 'dd/mm/yyyy';
            }
             if (colNumber === 22) { // NIK as text
                cell.numFmt = '@';
            }
        });
    });

    currentRow += sortedData.length;
    const lastDataRow = currentRow - 1;

    // --- Baris Jumlah ---
    if (lastDataRow >= firstDataRow) {
        const totalRow = worksheet.addRow([]);
        totalRow.getCell('A').value = 'JUMLAH';
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        
        const sumCols = ['D', 'E', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'];
        sumCols.forEach(col => {
            totalRow.getCell(col).value = { formula: `SUM(${col}${firstDataRow}:${col}${lastDataRow})` };
        });
        totalRow.eachCell({ includeEmpty: true }, cell => cell.style = totalRowStyle);
        currentRow += 3;
    }


    // --- Blok Tanda Tangan Dinamis ---
    const addSignatureBlock = (signer, startCol) => {
        worksheet.getCell(currentRow, startCol).value = `${signer.location}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.getCell(currentRow + 1, startCol).value = signer.jabatan;
        worksheet.getCell(currentRow + 5, startCol).value = (signer.nama || '(....................................)').toUpperCase();
        worksheet.getCell(currentRow + 5, startCol).font = { name: 'Arial', size: 10, bold: true, underline: true };
        if (signer.nip) {
            worksheet.getCell(currentRow + 6, startCol).value = `NIP. ${signer.nip}`;
        }
        for (let i = 0; i <= 6; i++) {
            worksheet.getCell(currentRow + i, startCol).alignment = { horizontal: 'center' };
        }
    };
    
    if (desa === 'all') {
        // Tanda tangan Camat untuk rekap kecamatan
        addSignatureBlock({
            location: 'Punggelan',
            jabatan: exportConfig?.jabatanPenandaTangan || 'Camat Punggelan',
            nama: exportConfig?.namaPenandaTangan,
            nip: exportConfig?.nipPenandaTangan
        }, 18); // Kolom R
    } else {
        // Tanda tangan Ketua LPM untuk laporan per desa
        const ketuaLPM = dataToExport.find(p => p.jabatan && p.jabatan.toLowerCase() === 'ketua');
        addSignatureBlock({
            location: desa,
            jabatan: `Ketua LPM Desa ${desa}`,
            nama: ketuaLPM?.nama
        }, 18); // Kolom R
    }


    // --- Lebar Kolom ---
    worksheet.columns = [
        { width: 4 },   // A: NO
        { width: 20 },  // B: DESA
        { width: 25 },  // C: Nama
        { width: 4 },   // D: L
        { width: 4 },   // E: P
        { width: 25 },  // F: Jabatan
        { width: 20 },  // G: Tempat Lahir
        { width: 15 },  // H: Tgl Lahir
        { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 }, // I-Q: Pendidikan
        { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 },
        { width: 25 },  // R: No SK
        { width: 15 },  // S: Tgl Pelantikan
        { width: 10 },  // T: Masa Bakti
        { width: 15 },  // U: Akhir Jabatan
        { width: 18 }   // V: No. HP
    ];

    // --- Simpan File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = desa === 'all'
        ? `Data_LPM_Kecamatan_Punggelan_${currentYear}.xlsx`
        : `Data_LPM_Desa_${desa}_${currentYear}.xlsx`;
    saveAs(blob, fileName);
};
