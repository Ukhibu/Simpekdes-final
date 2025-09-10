import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, addYears } from 'date-fns';

// Helper to safely parse and format dates
const parseAndFormatDate = (dateString) => {
    if (!dateString) return null;
    try {
        let date;
        if (dateString instanceof Date) {
            date = dateString;
        } else {
            // Handles YYYY-MM-DD and DD-MM-YYYY by replacing separators
            const cleanedString = dateString.replace(/[/]/g, '-');
            const parts = cleanedString.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) { // YYYY-MM-DD
                    date = new Date(dateString);
                } else { // DD-MM-YYYY
                    date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }
            } else {
                 date = new Date(dateString);
            }
        }
        
        if (isNaN(date.getTime())) return null;
        return date;
    } catch (error) {
        console.error("Date parsing error:", error);
        return null;
    }
};


export const generatePerangkatXLSX = async (groupedData, exportConfig) => {
    const workbook = new ExcelJS.Workbook();

    // --- Definisi Styles ---
    const titleStyle = {
        font: { name: 'Arial', size: 12, bold: true },
        alignment: { vertical: 'middle', horizontal: 'center' }
    };
    const headerStyle = {
        font: { name: 'Arial', size: 10, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
    };
    const cellStyle = {
        font: { name: 'Arial', size: 10 },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }
    };
    const centerCellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' } };
    const totalRowStyle = {
        font: { name: 'Arial', size: 10, bold: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };

    for (const [index, group] of groupedData.entries()) {
        const desaName = group.desa.toUpperCase();
        const sheetName = `${index + 1}. ${desaName}`.substring(0, 31).replace(/[\\/*?[\]:]/g, "");
        const worksheet = workbook.addWorksheet(sheetName);

        // --- Judul ---
        worksheet.mergeCells('A1:T1');
        worksheet.getCell('A1').value = `DATA PERANGKAT DESA ${desaName} KECAMATAN PUNGGELAN`;
        worksheet.getCell('A1').style = titleStyle;

        worksheet.mergeCells('A2:T2');
        worksheet.getCell('A2').value = `TAHUN ${new Date().getFullYear()}`;
        worksheet.getCell('A2').style = titleStyle;
        worksheet.addRow([]);

        // --- Header Tabel ---
        const headerRowDefs = [
            ["NO", "N A M A", "Jenis Kelamin", null, "JABATAN", "TEMPAT, TGL LAHIR", null, "PENDIDIKAN", null, null, null, null, null, null, "NO SK", "TANGGAL SK", "TANGGAL PELANTIKAN", "AKHIR MASA JABATAN", "No. HP / WA", "N I K"],
            [null, null, 'L', 'P', null, null, null, 'SD', 'SMP', 'SLTA', 'D1-D3', 'S1', 'S2', 'S3', null, null, null, null, null, null]
        ];
        worksheet.addRows(headerRowDefs);

        worksheet.mergeCells('A4:A5'); worksheet.mergeCells('B4:B5');
        worksheet.mergeCells('C4:D4'); worksheet.mergeCells('E4:E5');
        worksheet.mergeCells('F4:G4'); worksheet.mergeCells('H4:N4');
        worksheet.mergeCells('O4:O5'); worksheet.mergeCells('P4:P5');
        worksheet.mergeCells('Q4:Q5'); worksheet.mergeCells('R4:R5');
        worksheet.mergeCells('S4:S5'); worksheet.mergeCells('T4:T5');

        ['A4', 'B4', 'C4', 'E4', 'F4', 'H4', 'O4', 'P4', 'Q4', 'R4', 'S4', 'T4'].forEach(cell => worksheet.getCell(cell).style = headerStyle);
        ['C5', 'D5', 'H5', 'I5', 'J5', 'K5', 'L5', 'M5', 'N5'].forEach(cell => worksheet.getCell(cell).style = headerStyle);
        
        // --- Isi Data ---
        group.perangkat.forEach((p, i) => {
            let akhirJabatan = parseAndFormatDate(p.akhir_jabatan);
            if (!akhirJabatan && p.tgl_lahir) {
                const tglLahirDate = parseAndFormatDate(p.tgl_lahir);
                if (tglLahirDate) {
                    akhirJabatan = addYears(tglLahirDate, 60);
                }
            }

            const rowData = [
                i + 1,
                p.nama || '',
                p.jenis_kelamin === 'L' ? 1 : null,
                p.jenis_kelamin === 'P' ? 1 : null,
                p.jabatan || '',
                p.tempat_lahir || '',
                parseAndFormatDate(p.tgl_lahir),
                p.pendidikan === 'SD' ? 1 : null,
                p.pendidikan === 'SMP' || p.pendidikan === 'SLTP' ? 1 : null,
                p.pendidikan === 'SLTA' ? 1 : null,
                ['D1', 'D2', 'D3'].includes(p.pendidikan) ? 1 : null,
                p.pendidikan === 'S1' ? 1 : null,
                p.pendidikan === 'S2' ? 1 : null,
                p.pendidikan === 'S3' ? 1 : null,
                p.no_sk || '',
                parseAndFormatDate(p.tgl_sk),
                parseAndFormatDate(p.tgl_pelantikan),
                akhirJabatan,
                p.no_hp ? Number(String(p.no_hp).replace(/\D/g, '')) : null,
                p.nik ? `'${p.nik}` : ''
            ];
            const row = worksheet.addRow(rowData);

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                 if ([2, 5, 15].includes(colNumber)) {
                    cell.style = cellStyle;
                } else {
                    cell.style = centerCellStyle;
                }
                // Terapkan format spesifik
                if ([7, 16, 17, 18].includes(colNumber)) cell.numFmt = 'dd-mm-yyyy';
                if (colNumber === 19) cell.numFmt = '0';
            });
        });

        // --- Baris Jumlah (Total) dengan Rumus ---
        const firstDataRow = 6;
        const lastDataRow = worksheet.lastRow.number;
        if (lastDataRow >= firstDataRow) {
            const totalRowData = [
                null, 'JUMLAH',
                { formula: `SUM(C${firstDataRow}:C${lastDataRow})` }, { formula: `SUM(D${firstDataRow}:D${lastDataRow})` },
                null, null, null,
                { formula: `SUM(H${firstDataRow}:H${lastDataRow})` }, { formula: `SUM(I${firstDataRow}:I${lastDataRow})` },
                { formula: `SUM(J${firstDataRow}:J${lastDataRow})` }, { formula: `SUM(K${firstDataRow}:K${lastDataRow})` },
                { formula: `SUM(L${firstDataRow}:L${lastDataRow})` }, { formula: `SUM(M${firstDataRow}:M${lastDataRow})` },
                { formula: `SUM(N${firstDataRow}:N${lastDataRow})` },
            ];
            const totalRow = worksheet.addRow(totalRowData);
            totalRow.eachCell({ includeEmpty: true }, cell => {
                cell.style = totalRowStyle;
            });
            worksheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
            totalRow.getCell('B').value = 'JUMLAH';
        }

        // --- Blok Tanda Tangan ---
        const sigRowIndex = worksheet.lastRow.number + 3;
        
        worksheet.mergeCells(`P${sigRowIndex}:S${sigRowIndex}`);
        worksheet.getCell(`P${sigRowIndex}`).value = `Punggelan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.getCell(`P${sigRowIndex}`).alignment = { horizontal: 'center' };

        worksheet.mergeCells(`P${sigRowIndex + 1}:S${sigRowIndex + 1}`);
        worksheet.getCell(`P${sigRowIndex + 1}`).value = exportConfig?.jabatanPenandaTangan || 'Camat Punggelan';
        worksheet.getCell(`P${sigRowIndex + 1}`).alignment = { horizontal: 'center' };

        worksheet.mergeCells(`P${sigRowIndex + 5}:S${sigRowIndex + 5}`);
        const kadesNamaCell = worksheet.getCell(`P${sigRowIndex + 5}`);
        kadesNamaCell.value = exportConfig?.namaPenandaTangan || '(...........................................)';
        kadesNamaCell.font = { name: 'Arial', size: 10, bold: true, underline: true };
        kadesNamaCell.alignment = { horizontal: 'center' };

        worksheet.mergeCells(`P${sigRowIndex + 6}:S${sigRowIndex + 6}`);
        worksheet.getCell(`P${sigRowIndex + 6}`).value = exportConfig?.pangkatPenandaTangan || 'Pangkat / Golongan';
        worksheet.getCell(`P${sigRowIndex + 6}`).alignment = { horizontal: 'center' };

        worksheet.mergeCells(`P${sigRowIndex + 7}:S${sigRowIndex + 7}`);
        worksheet.getCell(`P${sigRowIndex + 7}`).value = `NIP. ${exportConfig?.nipPenandaTangan || '...'}`;
        worksheet.getCell(`P${sigRowIndex + 7}`).alignment = { horizontal: 'center' };

        // --- Atur Lebar Kolom ---
        worksheet.columns = [
            { width: 5 }, { width: 25 }, { width: 4 }, { width: 4 }, { width: 22 },
            { width: 15 }, { width: 15 }, { width: 5 }, { width: 5 }, { width: 5 },
            { width: 7 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 25 },
            { width: 15 }, { width: 18 }, { width: 20 }, { width: 18 }, { width: 22 }
        ];
    }
    
    // --- Generate & Download File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Data_Perangkat_Desa_Kec_Punggelan_${new Date().getFullYear()}.xlsx`;
    saveAs(blob, fileName);
};

