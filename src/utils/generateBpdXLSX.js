import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper untuk memformat tanggal (jika diperlukan)
const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        // Coba parsing tanggal yang mungkin dalam format YYYY-MM-DD atau DD-MM-YYYY
        const parts = dateString.split(/[-/]/);
        let date;
        if (parts[0].length === 4) { // YYYY-MM-DD
            date = new Date(dateString);
        } else { // DD-MM-YYYY
            date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        
        if (isNaN(date.getTime())) return dateString; // Kembalikan string asli jika tidak valid
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (error) {
        return dateString; // Fallback
    }
};


export const generateBpdXLSX = async (groupedData, periodeFilter) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data BPD');

    // --- Judul Dinamis ---
    const title = periodeFilter 
        ? `BPD PERIODE ${periodeFilter.toUpperCase()}` 
        : `BPD TAHUN ${new Date().getFullYear()}`;
    
    // Baris Judul 1
    worksheet.mergeCells('A1:P1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Arial', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Baris Judul 2
    worksheet.mergeCells('A2:P2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = "TP. Pemerintahan Kec. Punggelan";
    subtitleCell.font = { name: 'Arial', size: 12, bold: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    worksheet.addRow([]); // Baris kosong

    // --- Header Tabel ---
    const headerRow1 = worksheet.addRow([
        "NO", "NO. SK Bupati", "Tgl. SK Bupati", "PERIODE", "Tgl Pelantikan/Pengambilan Sumpah",
        "Wil Pmlhn", "NAMA", "Tempat Lahir", "Tgl Lahir", "Pekerjaan", "Pendidikan",
        "Agama", "ALAMAT", null, null, "Jabatan"
    ]);

    const headerRow2 = worksheet.addRow([
        null, null, null, null, null, null, null, null, null, null, null, null,
        "DESA", "RT", "RW", null
    ]);

    // Menggabungkan sel header vertikal
    worksheet.mergeCells('A4:A5'); worksheet.mergeCells('B4:B5'); worksheet.mergeCells('C4:C5');
    worksheet.mergeCells('D4:D5'); worksheet.mergeCells('E4:E5'); worksheet.mergeCells('F4:F5');
    worksheet.mergeCells('G4:G5'); worksheet.mergeCells('H4:H5'); worksheet.mergeCells('I4:I5');
    worksheet.mergeCells('J4:J5'); worksheet.mergeCells('K4:K5'); worksheet.mergeCells('L4:L5');
    worksheet.mergeCells('P4:P5');
    // Menggabungkan sel header horizontal
    worksheet.mergeCells('M4:O4');
    
    // --- Styling Header ---
    const headerStyle = {
        font: { name: 'Arial', size: 11, bold: true },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } // Warna abu-abu muda
    };
    [headerRow1, headerRow2].forEach(row => {
        row.eachCell({ includeEmpty: true }, cell => {
            cell.style = headerStyle;
        });
        row.height = 30;
    });


    // --- Isi Data ---
    let overallIndex = 1;
    const dataCellStyle = {
        font: { name: 'Arial', size: 10 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
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

                row.eachCell({ includeEmpty: true }, cell => {
                    cell.style = dataCellStyle;
                });
            });
        }
    }

    // Atur Lebar Kolom
    worksheet.columns = [
        { width: 5 },   // NO
        { width: 20 },  // NO SK
        { width: 15 },  // Tgl SK
        { width: 15 },  // Periode
        { width: 20 },  // Tgl Pelantikan
        { width: 15 },  // Wil Pmlhn
        { width: 25 },  // Nama
        { width: 20 },  // Tempat Lahir
        { width: 15 },  // Tgl Lahir
        { width: 20 },  // Pekerjaan
        { width: 15 },  // Pendidikan
        { width: 15 },  // Agama
        { width: 18 },  // Desa
        { width: 5 },   // RT
        { width: 5 },   // RW
        { width: 20 }   // Jabatan
    ];

    // --- Generate & Download File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Data_BPD_${periodeFilter || new Date().getFullYear()}.xlsx`;
    saveAs(blob, fileName);
};
