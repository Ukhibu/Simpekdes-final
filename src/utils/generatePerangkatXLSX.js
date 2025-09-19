import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper to safely parse dates from various string formats
const parseDate = (dateString) => {
    if (!dateString) return null;
    try {
        let date;
        if (dateString instanceof Date) {
            date = dateString;
        } else {
            const cleanedString = dateString.toString().replace(/[/]/g, '-');
            const parts = cleanedString.split('-');
            if (parts.length === 3) {
                date = parts[0].length === 4 
                    ? new Date(cleanedString) 
                    : new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
                date = new Date(dateString);
            }
        }
        
        if (isNaN(date.getTime())) return null;

        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset);

    } catch (error) {
        console.error("Date parsing error:", error);
        return null;
    }
};

export const generatePerangkatXLSX = async (groupedData, exportConfig) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekapitulasi Perangkat Desa');

    // --- Definisi Styles ---
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const desaTitleStyle = { font: { name: 'Arial', size: 11, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } };
    // --- UKURAN FONT DATA DIUBAH MENJADI 8 ---
    const leftCellStyle = { font: { name: 'Arial', size: 8 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle', horizontal: 'left', wrapText: true } };
    const centerCellStyle = { ...leftCellStyle, alignment: { ...leftCellStyle.alignment, horizontal: 'center' } };
    const totalRowStyle = { font: { name: 'Arial', size: 8, bold: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center', vertical: 'middle' } };
    const subTotalStyle = { ...totalRowStyle, font: { ...totalRowStyle.font, color: { argb: 'FF888888' } } };
    const grandTotalStyle = { ...totalRowStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC5E0B4' } } };

    // --- PENGATURAN HALAMAN & AREA CETAK ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9, // A4 default
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        printArea: 'A:T', // Cetak hingga kolom Akhir Jabatan
        horizontalCentered: true,
        verticalCentered: true,
    };

    // --- Judul Utama ---
    worksheet.mergeCells('A1:V1');
    worksheet.getCell('A1').value = `DATA PERANGKAT DESA SE-KECAMATAN PUNGGELAN`;
    worksheet.getCell('A1').style = titleStyle;
    worksheet.mergeCells('A2:V2');
    worksheet.getCell('A2').value = `TAHUN ${new Date().getFullYear()}`;
    worksheet.getCell('A2').style = titleStyle;
    
    // --- Loop untuk setiap desa ---
    for (const [groupIndex, group] of groupedData.entries()) {
        if (groupIndex > 0) {
            worksheet.addRow([]);
            worksheet.lastRow.addPageBreak();
        }
        
        const desaTitleRow = worksheet.addRow([]);
        worksheet.mergeCells(`A${desaTitleRow.number}:V${desaTitleRow.number}`);
        desaTitleRow.getCell('A').value = `DATA PERANGKAT DESA ${group.desa.toUpperCase()}`;
        desaTitleRow.getCell('A').style = desaTitleStyle;

        // --- Header Tabel ---
        const headerRowDefs = [
            ["NO", "N A M A", "Jenis Kelamin", null, "JABATAN", "TEMPAT, TGL LAHIR", null, "PENDIDIKAN", null, null, null, null, null, null, null, null, "NO SK", "TANGGAL SK", "TANGGAL PELANTIKAN", "AKHIR MASA JABATAN", "No. HP / WA", "N I K"],
            [null, null, 'L', 'P', null, "TEMPAT LAHIR", "TANGGAL LAHIR", 'SD', 'SLTP', 'SLTA', 'D1', 'D2', 'D3', 'S1', 'S2', 'S3', null, null, null, null, null, null]
        ];
        const headerStartRowNumber = worksheet.lastRow.number + 1;
        worksheet.addRows(headerRowDefs);

        worksheet.mergeCells(`A${headerStartRowNumber}:A${headerStartRowNumber + 1}`);
        worksheet.mergeCells(`B${headerStartRowNumber}:B${headerStartRowNumber + 1}`);
        worksheet.mergeCells(`C${headerStartRowNumber}:D${headerStartRowNumber}`);
        worksheet.mergeCells(`E${headerStartRowNumber}:E${headerStartRowNumber + 1}`);
        worksheet.mergeCells(`F${headerStartRowNumber}:G${headerStartRowNumber}`);
        worksheet.mergeCells(`H${headerStartRowNumber}:P${headerStartRowNumber}`);
        worksheet.mergeCells(`Q${headerStartRowNumber}:Q${headerStartRowNumber + 1}`);
        worksheet.mergeCells(`R${headerStartRowNumber}:R${headerStartRowNumber + 1}`);
        worksheet.mergeCells(`S${headerStartRowNumber}:S${headerStartRowNumber + 1}`);
        worksheet.mergeCells(`T${headerStartRowNumber}:T${headerStartRowNumber + 1}`);
        worksheet.mergeCells(`U${headerStartRowNumber}:U${headerStartRowNumber + 1}`);
        worksheet.mergeCells(`V${headerStartRowNumber}:V${headerStartRowNumber + 1}`);
        
        for (let i = 0; i < 2; i++) {
            worksheet.getRow(headerStartRowNumber + i).eachCell({ includeEmpty: true }, cell => cell.style = headerStyle);
        }

        // --- Isi Data ---
        const firstDataRowNumber = worksheet.lastRow.number + 1;
        group.perangkat.forEach((p, i) => {
            worksheet.addRow([
                i + 1, p.nama || '', p.jenis_kelamin === 'L' ? 1 : null, p.jenis_kelamin === 'P' ? 1 : null,
                p.jabatan || '', 
                p.tempat_lahir || '',
                parseDate(p.tgl_lahir),
                p.pendidikan === 'SD' ? 1 : null, p.pendidikan === 'SLTP' ? 1 : null, p.pendidikan === 'SLTA' ? 1 : null,
                p.pendidikan === 'D1' ? 1 : null, p.pendidikan === 'D2' ? 1 : null, p.pendidikan === 'D3' ? 1 : null,
                p.pendidikan === 'S1' ? 1 : null, p.pendidikan === 'S2' ? 1 : null, p.pendidikan === 'S3' ? 1 : null,
                p.no_sk || '', 
                parseDate(p.tgl_sk), 
                parseDate(p.tgl_pelantikan),
                p.akhir_jabatan ? parseDate(p.akhir_jabatan) : null,
                p.no_hp ? String(p.no_hp) : null, 
                p.nik ? String(p.nik) : null
            ]).eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if ([1, 3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16].includes(colNumber)) cell.style = centerCellStyle;
                else cell.style = leftCellStyle;

                if (colNumber === 1) cell.numFmt = '0';
                if ([7, 18, 19, 20].includes(colNumber)) cell.numFmt = 'dd-mm-yyyy';
                if ([21, 22].includes(colNumber)) cell.numFmt = '@';
            });
        });

        // --- Baris Jumlah ---
        const lastDataRowNumber = worksheet.lastRow.number;
        if (lastDataRowNumber >= firstDataRowNumber) {
            worksheet.addRow([]);
            const subTotalRow = worksheet.addRow([]);
            const grandTotalRow = worksheet.addRow([]);
            
            subTotalRow.getCell('A').value = 'JUMLAH';
            worksheet.mergeCells(`A${subTotalRow.number}:B${subTotalRow.number}`);
            grandTotalRow.getCell('A').value = 'JUMLAH TOTAL';
            worksheet.mergeCells(`A${grandTotalRow.number}:B${grandTotalRow.number}`);
            
            for(let col = 1; col <= 22; col++) {
                subTotalRow.getCell(col).style = subTotalStyle;
                grandTotalRow.getCell(col).style = grandTotalStyle;
            }

            ['C','D','H','I','J','K','L','M','N','O','P'].forEach(col => {
                subTotalRow.getCell(col).value = { formula: `SUM(${col}${firstDataRowNumber}:${col}${lastDataRowNumber})` };
            });

            worksheet.mergeCells(`C${grandTotalRow.number}:G${grandTotalRow.number}`);
            grandTotalRow.getCell('C').value = { formula: `SUM(C${subTotalRow.number}:D${subTotalRow.number})` };
            worksheet.mergeCells(`H${grandTotalRow.number}:P${grandTotalRow.number}`);
            grandTotalRow.getCell('H').value = { formula: `SUM(H${subTotalRow.number}:P${subTotalRow.number})` };
        }

        // --- Blok Tanda Tangan ---
        const sigRowIndex = worksheet.lastRow.number + 3;
        worksheet.mergeCells(`Q${sigRowIndex}:T${sigRowIndex}`);
        worksheet.getCell(`Q${sigRowIndex}`).value = `Punggelan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.mergeCells(`Q${sigRowIndex + 1}:T${sigRowIndex + 1}`);
        worksheet.getCell(`Q${sigRowIndex + 1}`).value = exportConfig?.jabatanPenandaTangan || 'Camat Punggelan';
        worksheet.mergeCells(`Q${sigRowIndex + 5}:T${sigRowIndex + 5}`);
        const kadesNamaCell = worksheet.getCell(`Q${sigRowIndex + 5}`);
        kadesNamaCell.value = exportConfig?.namaPenandaTangan || '(...........................................)';
        kadesNamaCell.font = { name: 'Arial', size: 10, bold: true, underline: true };
        worksheet.mergeCells(`Q${sigRowIndex + 6}:T${sigRowIndex + 6}`);
        worksheet.getCell(`Q${sigRowIndex + 6}`).value = exportConfig?.pangkatPenandaTangan || 'Pangkat / Golongan';
        worksheet.mergeCells(`Q${sigRowIndex + 7}:T${sigRowIndex + 7}`);
        worksheet.getCell(`Q${sigRowIndex + 7}`).value = `NIP. ${exportConfig?.nipPenandaTangan || '...'}`;
        
        for(let i = 0; i < 8; i++) {
             const cell = worksheet.getCell(`Q${sigRowIndex + i}`);
             if (cell.value) cell.alignment = { horizontal: 'center' };
        }
    }

    // --- Atur Lebar Kolom ---
    worksheet.columns = [
        { width: 4 },  // A: NO
        { width: 22 }, // B: Nama
        { width: 4 },  // C: L
        { width: 4 },  // D: P
        { width: 22 }, // E: Jabatan
        { width: 15 }, // F: Tempat Lahir
        { width: 12 }, // G: Tgl Lahir
        { width: 4 },  // H-P: Pendidikan
        { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 },
        { width: 22 }, // Q: No SK
        { width: 12 }, // R: Tgl SK
        { width: 12 }, // S: Tgl Pelantikan
        { width: 12 }, // T: Akhir Jabatan
        { width: 15 }, // U: No. HP
        { width: 20 }  // V: NIK
    ];

    // --- Nama File Dinamis ---
    const fileName = groupedData.length > 1
        ? `Rekap_Perangkat_Desa_Kec_Punggelan_${new Date().getFullYear()}.xlsx`
        : `Data_Perangkat_Desa_${groupedData[0]?.desa.replace(/\s/g, '_') || 'Export'}_${new Date().getFullYear()}.xlsx`;
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
};

