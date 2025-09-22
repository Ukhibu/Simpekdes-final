import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Daftar urutan jabatan dari tertinggi ke terendah
const JABATAN_ORDER = [
    "Kepala Desa",
    "Sekretaris Desa",
    "Kasi Pemerintahan",
    "Kasi Kesejahteraan",
    "Kasi Pelayanan",
    "Kaur Tata Usaha dan Umum",
    "Kaur Keuangan",
    "Kaur Perencanaan",
    "Kepala Dusun",
    "Staf Desa",
];
const jabatanSortOrder = new Map(JABATAN_ORDER.map((jabatan, index) => [jabatan.toLowerCase(), index]));


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
    const isSingleDesa = groupedData.length === 1;
    const currentYear = new Date().getFullYear();
    
    const worksheet = workbook.addWorksheet(
        isSingleDesa ? `Data Desa ${groupedData[0].desa}` : 'Rekapitulasi Perangkat Desa'
    );

    // --- Definisi Styles ---
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const desaTitleStyle = { font: { name: 'Arial', size: 11, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } };
    const baseCellStyle = { font: { name: 'Arial', size: 8 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle', wrapText: true } };
    const totalRowStyle = { font: { name: 'Arial', size: 8, bold: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center', vertical: 'middle' } };
    const subTotalStyle = { ...totalRowStyle };
    const grandTotalStyle = { ...totalRowStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC5E0B4' } } };
    
    // --- PENGATURAN HALAMAN & AREA CETAK ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        paperSize: 9, // A4
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        printArea: 'A:T', // Cetak hanya sampai kolom 'AKHIR MASA JABATAN'
        horizontalCentered: true,
        verticalCentered: true,
    };
    
    // --- Judul Utama ---
    const titleText = isSingleDesa 
        ? `DATA PERANGKAT DESA ${groupedData[0].desa.toUpperCase()}`
        : `DATA PERANGKAT DESA SE-KECAMATAN PUNGGELAN`;
    
    worksheet.mergeCells('A1:V1');
    worksheet.getCell('A1').value = titleText;
    worksheet.getCell('A1').style = titleStyle;
    worksheet.mergeCells('A2:V2');
    worksheet.getCell('A2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('A2').style = titleStyle;
    worksheet.addRow([]); 

    // --- Loop untuk setiap desa ---
    for (const [groupIndex, group] of groupedData.entries()) {
        if (!isSingleDesa) {
            if (groupIndex > 0) worksheet.addRow([]).addPageBreak();
            
            const desaTitleRow = worksheet.addRow([]);
            worksheet.mergeCells(`A${desaTitleRow.number}:V${desaTitleRow.number}`);
            desaTitleRow.getCell('A').value = `DATA PERANGKAT DESA ${group.desa.toUpperCase()}`;
            desaTitleRow.getCell('A').style = desaTitleStyle;
        }

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
            const row = worksheet.getRow(headerStartRowNumber + i);
            row.height = 20; 
            row.eachCell({ includeEmpty: true }, cell => cell.style = headerStyle);
        }

        // --- Urutkan data berdasarkan jabatan ---
        group.perangkat.sort((a, b) => {
            const orderA = jabatanSortOrder.get(a.jabatan?.toLowerCase()) ?? 99;
            const orderB = jabatanSortOrder.get(b.jabatan?.toLowerCase()) ?? 99;
            return orderA - orderB;
        });

        // --- Isi Data ---
        const firstDataRowNumber = worksheet.lastRow.number + 1;
        group.perangkat.forEach((p, i) => {
            const rowData = [
                i + 1, p.nama || '', 
                p.jenis_kelamin === 'L' ? 1 : null, 
                p.jenis_kelamin === 'P' ? 1 : null,
                p.jabatan || '', 
                p.tempat_lahir || '',
                parseDate(p.tgl_lahir),
                p.pendidikan === 'SD' ? 1 : null, 
                p.pendidikan === 'SLTP' ? 1 : null, 
                p.pendidikan === 'SLTA' ? 1 : null,
                p.pendidikan === 'D1' ? 1 : null, 
                p.pendidikan === 'D2' ? 1 : null, 
                p.pendidikan === 'D3' ? 1 : null,
                p.pendidikan === 'S1' ? 1 : null, 
                p.pendidikan === 'S2' ? 1 : null, 
                p.pendidikan === 'S3' ? 1 : null,
                p.no_sk || '', 
                parseDate(p.tgl_sk), 
                parseDate(p.tgl_pelantikan),
                p.akhir_jabatan ? parseDate(p.akhir_jabatan) : null,
                p.no_hp ? String(p.no_hp) : null, 
                p.nik ? String(p.nik) : null
            ];
            const row = worksheet.addRow(rowData);
            row.height = 25;

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const style = { ...baseCellStyle };
                if ([1, 3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16].includes(colNumber)) {
                    style.alignment = { ...style.alignment, horizontal: 'center' };
                } else {
                    style.alignment = { ...style.alignment, horizontal: 'left' };
                }

                if (colNumber === 1) style.numFmt = '0';
                if (colNumber === 2) style.numFmt = '@';
                if (colNumber === 7) style.numFmt = 'dd mmmm yyyy';
                if ([18, 19, 20].includes(colNumber)) style.numFmt = 'dd/mm/yyyy';
                if ([21, 22].includes(colNumber)) style.numFmt = '@';

                cell.style = style;
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

            const sumFormula = (col) => ({ formula: `SUM(${col}${firstDataRowNumber}:${col}${lastDataRowNumber})` });
            
            ['C','D','H','I','J','K','L','M','N','O','P'].forEach(col => {
                subTotalRow.getCell(col).value = sumFormula(col);
            });

            worksheet.mergeCells(`C${grandTotalRow.number}:G${grandTotalRow.number}`);
            grandTotalRow.getCell('C').value = { formula: `SUM(C${subTotalRow.number}:D${subTotalRow.number})` };
            worksheet.mergeCells(`H${grandTotalRow.number}:P${grandTotalRow.number}`);
            grandTotalRow.getCell('H').value = { formula: `SUM(H${subTotalRow.number}:P${subTotalRow.number})` };
        }
    }

    // --- Blok Tanda Tangan (di luar loop) ---
    const currentDateFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const signatureStartCol = 'Q';
    const signatureEndCol = 'T';
    const sigRowIndex = worksheet.lastRow.number + 3;
    
    if (isSingleDesa) {
        const group = groupedData[0];
        const kepalaDesa = group.perangkat.find(p => p.jabatan && p.jabatan.toLowerCase() === 'kepala desa');
        
        worksheet.mergeCells(`${signatureStartCol}${sigRowIndex}:${signatureEndCol}${sigRowIndex}`);
        worksheet.getCell(`${signatureStartCol}${sigRowIndex}`).value = `${group.desa}, ${currentDateFormatted}`;
        worksheet.mergeCells(`${signatureStartCol}${sigRowIndex + 1}:${signatureEndCol}${sigRowIndex + 1}`);
        worksheet.getCell(`${signatureStartCol}${sigRowIndex + 1}`).value = 'Kepala Desa';
        worksheet.mergeCells(`${signatureStartCol}${sigRowIndex + 5}:${signatureEndCol}${sigRowIndex + 5}`);
        const kadesNamaCell = worksheet.getCell(`${signatureStartCol}${sigRowIndex + 5}`);
        kadesNamaCell.value = kepalaDesa ? kepalaDesa.nama.toUpperCase() : '(...........................................)';
        kadesNamaCell.font = { name: 'Arial', size: 10, bold: true, underline: true };

        for(let i of [0, 1, 5]) {
            worksheet.getCell(`${signatureStartCol}${sigRowIndex + i}`).alignment = { horizontal: 'center' };
        }
    } else {
        worksheet.mergeCells(`${signatureStartCol}${sigRowIndex}:${signatureEndCol}${sigRowIndex}`);
        worksheet.getCell(`${signatureStartCol}${sigRowIndex}`).value = `Punggelan, ${currentDateFormatted}`;
        worksheet.mergeCells(`${signatureStartCol}${sigRowIndex + 1}:${signatureEndCol}${sigRowIndex + 1}`);
        worksheet.getCell(`${signatureStartCol}${sigRowIndex + 1}`).value = exportConfig?.jabatanPenandaTangan || 'Camat Punggelan';
        worksheet.mergeCells(`${signatureStartCol}${sigRowIndex + 5}:${signatureEndCol}${sigRowIndex + 5}`);
        const namaCell = worksheet.getCell(`${signatureStartCol}${sigRowIndex + 5}`);
        namaCell.value = exportConfig?.namaPenandaTangan ? exportConfig.namaPenandaTangan.toUpperCase() : '(...........................................)';
        namaCell.font = { name: 'Arial', size: 10, bold: true, underline: true };
        worksheet.mergeCells(`${signatureStartCol}${sigRowIndex + 6}:${signatureEndCol}${sigRowIndex + 6}`);
        worksheet.getCell(`${signatureStartCol}${sigRowIndex + 6}`).value = exportConfig?.pangkatPenandaTangan || 'Pangkat / Golongan';
        worksheet.mergeCells(`${signatureStartCol}${sigRowIndex + 7}:${signatureEndCol}${sigRowIndex + 7}`);
        worksheet.getCell(`${signatureStartCol}${sigRowIndex + 7}`).value = `NIP. ${exportConfig?.nipPenandaTangan || '.....................................'}`;
        
        for(let i = 0; i < 8; i++) {
            const cell = worksheet.getCell(`${signatureStartCol}${sigRowIndex + i}`);
            if (cell.value) cell.alignment = { horizontal: 'center' };
        }
    }
    
    // --- Atur Lebar Kolom ---
    worksheet.columns = [
        { width: 4 },   // A: NO
        { width: 22 },  // B: Nama
        { width: 4 },   // C: L
        { width: 4 },   // D: P
        { width: 22 },  // E: Jabatan
        { width: 15 },  // F: Tempat Lahir
        { width: 15 },  // G: Tgl Lahir
        { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 }, // H-P: Pendidikan
        { width: 4 }, { width: 4 }, { width: 4 }, { width: 4 },
        { width: 22 },  // Q: No SK
        { width: 12 },  // R: Tgl SK
        { width: 12 },  // S: Tgl Pelantikan
        { width: 12 },  // T: Akhir Jabatan
        { width: 15 },  // U: No. HP
        { width: 20 }   // V: NIK
    ];

    // --- Nama File Dinamis ---
    const fileName = isSingleDesa
        ? `Data_Perangkat_Desa_${groupedData[0]?.desa.replace(/\s/g, '_') || 'Export'}_${currentYear}.xlsx`
        : `Rekap_Perangkat_Desa_Kec_Punggelan_${currentYear}.xlsx`;
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
};

