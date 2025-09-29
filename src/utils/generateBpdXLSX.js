import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper untuk memformat tanggal dengan aman
const formatDateForExcel = (dateField) => {
    if (!dateField) return null;
    try {
        const date = dateField.toDate ? dateField.toDate() : new Date(dateField);
        if (isNaN(date.getTime())) return null;
        // Menyesuaikan dengan zona waktu lokal untuk menghindari tanggal bergeser
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset);
    } catch (error) {
        return null;
    }
};

/**
 * Membuat file XLSX untuk data BPD dengan format yang disesuaikan untuk Admin Desa dan Admin Kecamatan.
 * @param {object} exportData - Data yang dibutuhkan untuk ekspor.
 * @param {Array<object>} exportData.bpdData - Array data anggota BPD yang akan diekspor.
 * @param {string} exportData.role - Peran pengguna ('admin_desa' atau 'admin_kecamatan').
 * @param {string} exportData.desa - Nama desa (untuk Admin Desa) atau 'all' (untuk Admin Kecamatan).
 * @param {string} exportData.periodeFilter - Filter periode yang sedang aktif.
 * @param {object} exportData.exportConfig - Konfigurasi tanda tangan Camat.
 * @param {Array<object>} exportData.allPerangkat - Semua data perangkat untuk mencari Kepala Desa.
 */
export const generateBpdXLSX = async (exportData) => {
    const { bpdData, role, desa, periodeFilter, exportConfig, allPerangkat } = exportData;

    if (!bpdData || bpdData.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data BPD');
    const currentYear = new Date().getFullYear();

    // --- Pengaturan Halaman & Cetak ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
            left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3
        },
        horizontalCentered: true,
        verticalCentered: true,
    };

    // --- Definisi Styles ---
    const titleStyle = { font: { name: 'Arial', size: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' } };
    const subTitleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' } };
    const desaHeaderStyle = { font: { name: 'Arial', size: 11, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }, alignment: { horizontal: 'center', vertical: 'middle' } };
    const tableHeaderStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } };
    const cellStyle = { font: { name: 'Arial', size: 9 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle', wrapText: true } };

    let currentRow = 1;

    // --- Judul Global ---
    const mainTitle = role === 'admin_kecamatan'
        ? 'DATA ANGGOTA BADAN PERMUSYAWARATAN DESA (BPD) SE-KECAMATAN PUNGGELAN'
        : `DATA ANGGOTA BADAN PERMUSYAWARATAN DESA (BPD) DESA ${desa.toUpperCase()}`;
    
    worksheet.mergeCells(`A${currentRow}:P${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = mainTitle;
    worksheet.getCell(`A${currentRow}`).style = titleStyle;
    currentRow++;

    const subTitle = periodeFilter ? `PERIODE ${periodeFilter}` : `TAHUN ${currentYear}`;
    worksheet.mergeCells(`A${currentRow}:P${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = subTitle;
    worksheet.getCell(`A${currentRow}`).style = subTitleStyle;
    currentRow += 2;

    const addTableHeader = (startRow) => {
        const headerRow1 = worksheet.getRow(startRow);
        const headerRow2 = worksheet.getRow(startRow + 1);
        headerRow1.values = ["NO", "NO. SK Bupati", "Tgl. SK Bupati", "PERIODE", "Tgl Pelantikan", "Wilayah Pemilihan", "NAMA", "Tempat Lahir", "Tgl Lahir", "Pekerjaan", "Pendidikan", "Agama", "ALAMAT", null, null, "Jabatan"];
        headerRow2.values = [null, null, null, null, null, null, null, null, null, null, null, null, "DESA", "RT", "RW", null];
        
        // Merge Cells for Headers
        worksheet.mergeCells(`A${startRow}:A${startRow + 1}`);
        worksheet.mergeCells(`B${startRow}:B${startRow + 1}`);
        worksheet.mergeCells(`C${startRow}:C${startRow + 1}`);
        worksheet.mergeCells(`D${startRow}:D${startRow + 1}`);
        worksheet.mergeCells(`E${startRow}:E${startRow + 1}`);
        worksheet.mergeCells(`F${startRow}:F${startRow + 1}`);
        worksheet.mergeCells(`G${startRow}:G${startRow + 1}`);
        worksheet.mergeCells(`H${startRow}:H${startRow + 1}`);
        worksheet.mergeCells(`I${startRow}:I${startRow + 1}`);
        worksheet.mergeCells(`J${startRow}:J${startRow + 1}`);
        worksheet.mergeCells(`K${startRow}:K${startRow + 1}`);
        worksheet.mergeCells(`L${startRow}:L${startRow + 1}`);
        worksheet.mergeCells(`M${startRow}:O${startRow}`);
        worksheet.mergeCells(`P${startRow}:P${startRow + 1}`);
        
        // Apply Style
        [headerRow1, headerRow2].forEach(row => {
            row.height = 30;
            row.eachCell({ includeEmpty: true }, cell => cell.style = tableHeaderStyle);
        });
        
        return startRow + 2; // Return next starting row index
    };
    
    const addDataRows = (data, startRow, startIndex = 1) => {
        data.forEach((bpd, index) => {
            const row = worksheet.getRow(startRow + index);
            row.values = [
                startIndex + index,
                bpd.no_sk_bupati || '',
                formatDateForExcel(bpd.tgl_sk_bupati),
                bpd.periode || '',
                formatDateForExcel(bpd.tgl_pelantikan),
                bpd.wil_pmlhn || '',
                `${bpd.nama || ''}${bpd.gelar ? ', ' + bpd.gelar : ''}`,
                bpd.tempat_lahir || '',
                formatDateForExcel(bpd.tgl_lahir),
                bpd.pekerjaan || '',
                bpd.pendidikan || '',
                bpd.agama || '',
                bpd.desa || '',
                bpd.rt || '',
                bpd.rw || '',
                bpd.jabatan || ''
            ];
            row.height = 20;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.style = { ...cellStyle };
                if ([1, 14, 15].includes(colNumber)) cell.alignment.horizontal = 'center';
                if ([3, 5, 9].includes(colNumber)) cell.numFmt = 'dd/mm/yyyy';
            });
        });
        return startRow + data.length;
    };
    
    const addSignatureBlock = (startRow, signer) => {
        worksheet.mergeCells(`M${startRow}:P${startRow}`);
        worksheet.getCell(`M${startRow}`).value = `${signer.location}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.mergeCells(`M${startRow + 1}:P${startRow + 1}`);
        worksheet.getCell(`M${startRow + 1}`).value = signer.jabatan;
        worksheet.mergeCells(`M${startRow + 5}:P${startRow + 5}`);
        const nameCell = worksheet.getCell(`M${startRow + 5}`);
        nameCell.value = signer.nama.toUpperCase();
        nameCell.font = { name: 'Arial', size: 10, bold: true, underline: true };
        
        for (let i = 0; i <= 7; i++) {
            const cell = worksheet.getCell(`M${startRow + i}`);
            cell.alignment = { ...cell.alignment, horizontal: 'center' };
            if(i > 1 && i < 5) worksheet.getRow(startRow + i).height = 15; // Spasi untuk TTD
        }

        if(signer.pangkat) {
             worksheet.mergeCells(`M${startRow + 6}:P${startRow + 6}`);
             worksheet.getCell(`M${startRow + 6}`).value = signer.pangkat;
        }
        if(signer.nip) {
            worksheet.mergeCells(`M${startRow + 7}:P${startRow + 7}`);
            worksheet.getCell(`M${startRow + 7}`).value = `NIP. ${signer.nip}`;
        }
    }

    if (role === 'admin_kecamatan') {
        const dataByDesa = bpdData.reduce((acc, bpd) => {
            (acc[bpd.desa] = acc[bpd.desa] || []).push(bpd);
            return acc;
        }, {});

        Object.keys(dataByDesa).sort().forEach((namaDesa, index) => {
            if(index > 0) {
                worksheet.getRow(currentRow).addPageBreak();
                currentRow += 2;
            }
            worksheet.mergeCells(`A${currentRow}:P${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = `DESA ${namaDesa.toUpperCase()}`;
            worksheet.getCell(`A${currentRow}`).style = desaHeaderStyle;
            currentRow++;
            
            currentRow = addTableHeader(currentRow);
            currentRow = addDataRows(dataByDesa[namaDesa], currentRow);
            currentRow += 2; // Spacing before next table
        });
        
        // Tanda Tangan Camat di akhir
        addSignatureBlock(currentRow, {
            location: 'Punggelan',
            jabatan: exportConfig?.jabatanPenandaTangan || 'Camat Punggelan',
            nama: exportConfig?.namaPenandaTangan || '(....................................)',
            pangkat: exportConfig?.pangkatPenandaTangan,
            nip: exportConfig?.nipPenandaTangan
        });

    } else { // admin_desa
        currentRow = addTableHeader(currentRow);
        currentRow = addDataRows(bpdData, currentRow);

        // Tanda Tangan Kepala Desa
        const kades = allPerangkat.find(p => p.desa === desa && p.jabatan?.toLowerCase() === 'kepala desa');
        addSignatureBlock(currentRow + 2, {
            location: desa,
            jabatan: 'Kepala Desa',
            nama: kades ? kades.nama : '(....................................)'
        });
    }

    // Atur Lebar Kolom
    worksheet.columns = [
        { width: 5 },   // NO
        { width: 20 },  // No SK
        { width: 12 },  // Tgl SK
        { width: 12 },  // Periode
        { width: 12 },  // Tgl Pelantikan
        { width: 15 },  // Wil Pemilihan
        { width: 25 },  // Nama
        { width: 15 },  // Tempat Lahir
        { width: 12 },  // Tgl Lahir
        { width: 15 },  // Pekerjaan
        { width: 12 },  // Pendidikan
        { width: 12 },  // Agama
        { width: 15 },  // Desa (Alamat)
        { width: 5 },   // RT
        { width: 5 },   // RW
        { width: 18 }   // Jabatan
    ];

    // Simpan File
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = role === 'admin_kecamatan' ? `Data_BPD_Kecamatan_Punggelan_${currentYear}.xlsx` : `Data_BPD_Desa_${desa}_${currentYear}.xlsx`;
    saveAs(blob, fileName);
};
