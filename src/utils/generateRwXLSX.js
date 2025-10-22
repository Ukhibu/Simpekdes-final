import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Helper untuk mengambil nama Kepala Desa dari database
const getNamaKepalaDesa = async (namaDesa) => {
    try {
        const q = query(
            collection(db, 'perangkat_desa'),
            where('desa', '==', namaDesa),
            where('jabatan', '==', 'Kepala Desa')
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data().nama.toUpperCase() || '________________';
        }
        return '________________';
    } catch (error) {
        console.error("Error fetching Kepala Desa:", error);
        return '________________';
    }
};

// Helper untuk mem-parsing tanggal dengan aman
const parseDate = (dateString) => {
    if (!dateString || dateString === '-') return null;
    try {
        let date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        // Adjust for timezone offset to ensure correct date is stored in Excel
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset);
    } catch (e) {
        return null;
    }
};

export const generateRwXLSX = async (data) => {
    if (!data || data.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const namaDesa = data[0]?.desa || "Unknown";
    const worksheet = workbook.addWorksheet(`Data RW Desa ${namaDesa}`);
    const currentYear = new Date().getFullYear();

    // --- Definisi Styles ---
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const baseCellStyle = { font: { name: 'Arial', size: 8 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle' } };
    const totalRowStyle = { font: { name: 'Arial', size: 8, bold: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center', vertical: 'middle' } };
    const grandTotalStyle = { ...totalRowStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC5E0B4' } } };
    
    // --- Pengaturan Halaman ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        paperSize: 9, // A4
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5 },
    };
    
    // --- Judul Utama ---
    worksheet.mergeCells('A1:T1');
    worksheet.getCell('A1').value = `DATA RW DESA ${namaDesa.toUpperCase()}`;
    worksheet.getCell('A1').style = titleStyle;
    worksheet.mergeCells('A2:T2');
    worksheet.getCell('A2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('A2').style = titleStyle;
    worksheet.addRow([]);

    // --- Header Tabel ---
    const headerRowDefs = [
        ["NO", "N A M A", "Jenis Kelamin", null, "JABATAN", "TEMPAT, TGL LAHIR", null, "PENDIDIKAN", null, null, null, null, null, null, null, "DUSUN", "NO RW", "PRIODE", "No. HP / WA"],
        [null, null, 'L', 'P', null, "TEMPAT LAHIR", "TANGGAL LAHIR", 'SD', 'SLTP', 'SLTA', 'D1', 'D2', 'D3', 'S1', 'S2', null, null, null, null]
    ];
    const headerStartRow = worksheet.lastRow.number + 1;
    worksheet.addRows(headerRowDefs);

    // Merge cells for headers
    worksheet.mergeCells(`A${headerStartRow}:A${headerStartRow + 1}`);
    worksheet.mergeCells(`B${headerStartRow}:B${headerStartRow + 1}`);
    worksheet.mergeCells(`C${headerStartRow}:D${headerStartRow}`);
    worksheet.mergeCells(`E${headerStartRow}:E${headerStartRow + 1}`);
    worksheet.mergeCells(`F${headerStartRow}:G${headerStartRow}`);
    worksheet.mergeCells(`H${headerStartRow}:O${headerStartRow}`);
    worksheet.mergeCells(`P${headerStartRow}:P${headerStartRow + 1}`);
    worksheet.mergeCells(`Q${headerStartRow}:Q${headerStartRow + 1}`);
    worksheet.mergeCells(`R${headerStartRow}:R${headerStartRow + 1}`);
    worksheet.mergeCells(`S${headerStartRow}:S${headerStartRow + 1}`);

    // Apply header style
    worksheet.getRow(headerStartRow).eachCell({ includeEmpty: true }, cell => cell.style = headerStyle);
    worksheet.getRow(headerStartRow + 1).eachCell({ includeEmpty: true }, cell => cell.style = headerStyle);

    // --- Isi Data ---
    const firstDataRow = worksheet.lastRow.number + 1;
    data.forEach((p, i) => {
        const row = worksheet.addRow([
            i + 1,
            p.nama || '',
            p.jenis_kelamin === 'Laki-Laki' ? 1 : null,
            p.jenis_kelamin === 'Perempuan' ? 1 : null,
            p.jabatan || '',
            p.tempat_lahir || '',
            parseDate(p.tanggal_lahir),
            p.pendidikan === 'SD' ? 1 : null,
            p.pendidikan === 'SLTP' ? 1 : null,
            p.pendidikan === 'SLTA' ? 1 : null,
            p.pendidikan === 'D1' ? 1 : null,
            p.pendidikan === 'D2' ? 1 : null,
            p.pendidikan === 'D3' ? 1 : null,
            p.pendidikan === 'S1' ? 1 : null,
            p.pendidikan === 'S2' ? 1 : null,
            p.dusun || '',
            p.no_rw || '',
            p.periode || '',
            p.no_hp ? String(p.no_hp) : '',
        ]);
        
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.style = baseCellStyle;
             if ([1, 3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 17].includes(colNumber)) {
                cell.alignment = { ...cell.alignment, horizontal: 'center' };
            }
            if (colNumber === 7) cell.numFmt = 'dd mmmm yyyy';
        });
    });
    const lastDataRow = worksheet.lastRow.number;

    // --- Baris Jumlah ---
    worksheet.addRow([]);
    const totalRow = worksheet.addRow([]);
    totalRow.getCell('A').value = 'JUMLAH';
    worksheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);

    const grandTotalRow = worksheet.addRow([]);
    grandTotalRow.getCell('A').value = 'JUMLAH TOTAL';
    worksheet.mergeCells(`A${grandTotalRow.number}:B${grandTotalRow.number}`);
    
    ['C','D','H','I','J','K','L','M','N','O'].forEach(col => {
        totalRow.getCell(col).value = { formula: `SUM(${col}${firstDataRow}:${col}${lastDataRow})` };
    });

    grandTotalRow.getCell('C').value = { formula: `SUM(C${totalRow.number}:D${totalRow.number})` };
    worksheet.mergeCells(`C${grandTotalRow.number}:G${grandTotalRow.number}`);
    grandTotalRow.getCell('H').value = { formula: `SUM(H${totalRow.number}:O${totalRow.number})` };
    worksheet.mergeCells(`H${grandTotalRow.number}:O${grandTotalRow.number}`);

    totalRow.eachCell({ includeEmpty: true }, cell => cell.style = totalRowStyle);
    grandTotalRow.eachCell({ includeEmpty: true }, cell => cell.style = grandTotalStyle);
    
    // --- Blok Tanda Tangan ---
    const namaKades = await getNamaKepalaDesa(namaDesa);
    const sigRowStart = worksheet.lastRow.number + 3;
    worksheet.mergeCells(`P${sigRowStart}:S${sigRowStart}`);
    worksheet.getCell(`P${sigRowStart}`).value = `${namaDesa}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    worksheet.mergeCells(`P${sigRowStart + 1}:S${sigRowStart + 1}`);
    worksheet.getCell(`P${sigRowStart + 1}`).value = 'Kepala Desa';
    worksheet.mergeCells(`P${sigRowStart + 5}:S${sigRowStart + 5}`);
    const kadesCell = worksheet.getCell(`P${sigRowStart + 5}`);
    kadesCell.value = namaKades;
    kadesCell.font = { name: 'Arial', size: 10, bold: true, underline: true };
    
    for(let i of [0, 1, 5]) {
       worksheet.getCell(`P${sigRowStart + i}`).alignment = { horizontal: 'center' };
    }

    // --- Atur Lebar Kolom ---
    worksheet.columns = [
        { width: 4 }, { width: 22 }, { width: 4 }, { width: 4 }, { width: 18 }, { width: 15 },
        { width: 15 }, { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 },
        { width: 4 }, { width: 4 }, { width: 4 }, { width: 15 }, { width: 8 }, { width: 12 },
        { width: 15 }
    ];

    // --- Tulis File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Data_RW_Desa_${namaDesa.replace(/\s/g, '_')}_${currentYear}.xlsx`);
};

