import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const parts = dateString.split(/[-/]/);
        let date;
        if (parts[0].length === 4) { // YYYY-MM-DD
            date = new Date(dateString);
        } else { // DD-MM-YYYY
            date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        
        if (isNaN(date.getTime())) return dateString;
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (error) {
        return dateString;
    }
};


export const generateBpdXLSX = async (groupedData, periodeFilter) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data BPD');

    const title = periodeFilter 
        ? `BPD PERIODE ${periodeFilter.toUpperCase()}` 
        : `BPD TAHUN ${new Date().getFullYear()}`;
    
    worksheet.mergeCells('A1:P1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Arial', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:P2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = "TP. Pemerintahan Kec. Punggelan";
    subtitleCell.font = { name: 'Arial', size: 12, bold: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    worksheet.addRow([]);

    const headerRow1 = worksheet.addRow([
        "NO", "NO. SK Bupati", "Tgl. SK Bupati", "PERIODE", "Tgl Pelantikan/Pengambilan Sumpah",
        "Wil Pmlhn", "NAMA", "Tempat Lahir", "Tgl Lahir", "Pekerjaan", "Pendidikan",
        "Agama", "ALAMAT", null, null, "Jabatan"
    ]);

    const headerRow2 = worksheet.addRow([
        null, null, null, null, null, null, null, null, null, null, null, null,
        "DESA", "RT", "RW", null
    ]);

    worksheet.mergeCells('A4:A5'); worksheet.mergeCells('B4:B5'); worksheet.mergeCells('C4:C5');
    worksheet.mergeCells('D4:D5'); worksheet.mergeCells('E4:E5'); worksheet.mergeCells('F4:F5');
    worksheet.mergeCells('G4:G5'); worksheet.mergeCells('H4:H5'); worksheet.mergeCells('I4:I5');
    worksheet.mergeCells('J4:J5'); worksheet.mergeCells('K4:K5'); worksheet.mergeCells('L4:L5');
    worksheet.mergeCells('P4:P5');
    worksheet.mergeCells('M4:O4');
    
    const headerStyle = {
        font: { name: 'Arial', size: 11, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }
    };
    [headerRow1, headerRow2].forEach(row => {
        row.eachCell({ includeEmpty: true }, cell => {
            cell.style = headerStyle;
        });
        row.height = 30;
    });

    let overallIndex = 1;
    // PERBAIKAN: Mendefinisikan gaya sel data untuk perataan yang lebih baik.
    const dataCellStyle = {
        font: { name: 'Arial', size: 10 },
        alignment: { vertical: 'middle', wrapText: true }, // Perataan vertikal
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };

    for (const desa in groupedData) {
        if (Object.hasOwnProperty.call(groupedData, desa)) {
            const bpdList = groupedData[desa];

            bpdList.forEach((bpd) => {
                const row = worksheet.addRow([
                    overallIndex++,
                    bpd.no_sk_bupati || '',
                    formatDate(bpd.tgl_sk_bupati),
                    bpd.periode || '',
                    formatDate(bpd.tgl_pelantikan),
                    bpd.wil_pmlhn || '',
                    `${bpd.nama || ''}${bpd.gelar ? ', ' + bpd.gelar : ''}`,
                    bpd.tempat_lahir || '',
                    formatDate(bpd.tgl_lahir),
                    bpd.pekerjaan || '',
                    bpd.pendidikan || '',
                    bpd.agama || '',
                    bpd.desa || '',
                    bpd.rt || '',
                    bpd.rw || '',
                    bpd.jabatan || ''
                ]);

                // PERBAIKAN: Menerapkan gaya sel secara konsisten.
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.style = { ...dataCellStyle };
                    if (colNumber === 1) { // Kolom 'NO'
                        cell.alignment.horizontal = 'center';
                    } else { // Kolom lainnya
                        cell.alignment.horizontal = 'left';
                    }
                });
            });
        }
    }

    worksheet.columns = [
        { width: 5 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 20 },
        { width: 15 }, { width: 25 }, { width: 20 }, { width: 15 }, { width: 20 },
        { width: 15 }, { width: 15 }, { width: 18 }, { width: 5 }, { width: 5 },
        { width: 20 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Data_BPD_${periodeFilter || new Date().getFullYear()}.xlsx`;
    saveAs(blob, fileName);
};
