import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DESA_LIST } from './constants';

// Helper untuk memformat tanggal dengan aman
const formatDate = (dateField, formatType = 'default') => {
    if (!dateField) return null;
    try {
        const date = dateField.toDate ? dateField.toDate() : new Date(dateField);
        if (isNaN(date.getTime())) return null;

        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() + userTimezoneOffset);

        if (formatType === 'birthdate') {
            return localDate.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        }
        // Default format for Excel date object
        return localDate;
    } catch (error) {
        console.error("Gagal mem-parsing tanggal:", dateField, error);
        return null;
    }
};

/**
 * Membuat file XLSX untuk data BPD dengan format yang disesuaikan untuk Admin Desa dan Admin Kecamatan.
 * @param {object} exportData - Data yang dibutuhkan untuk ekspor.
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
    const tableHeaderStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } };
    // --- PERBAIKAN: Menghapus wrapText untuk memastikan satu baris ---
    const cellStyle = { font: { name: 'Arial', size: 8 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle' } };

    let currentRow = 1;
    const TOTAL_COLUMNS = 16; // Jumlah total kolom dari A sampai P

    // --- Judul Global ---
    const mainTitle = role === 'admin_kecamatan'
        ? 'DATA ANGGOTA BADAN PERMUSYAWARATAN DESA (BPD) SE-KECAMATAN PUNGGELAN'
        : `DATA ANGGOTA BADAN PERMUSYAWARATAN DESA (BPD) DESA ${desa.toUpperCase()}`;
    
    worksheet.mergeCells(currentRow, 1, currentRow, TOTAL_COLUMNS);
    worksheet.getCell(currentRow, 1).value = mainTitle;
    worksheet.getCell(currentRow, 1).style = titleStyle;
    currentRow++;

    const subTitle = periodeFilter ? `PERIODE ${periodeFilter}` : `TAHUN ${currentYear}`;
    worksheet.mergeCells(currentRow, 1, currentRow, TOTAL_COLUMNS);
    worksheet.getCell(currentRow, 1).value = subTitle;
    worksheet.getCell(currentRow, 1).style = subTitleStyle;
    currentRow += 2;

    const addTableHeader = (startRow) => {
        const headerRow1 = worksheet.getRow(startRow);
        const headerRow2 = worksheet.getRow(startRow + 1);
        headerRow1.values = ["NO", "NO. SK Bupati", "Tgl. SK Bupati", "PERIODE", "Tgl Pelantikan", "Wilayah Pemilihan", "NAMA", "Tempat Lahir", "Tgl Lahir", "Pekerjaan", "Pendidikan", "Agama", "ALAMAT", null, null, "Jabatan"];
        headerRow2.values = [null, null, null, null, null, null, null, null, null, null, null, null, "DESA", "RT", "RW", null];
        
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
        
        [headerRow1, headerRow2].forEach(row => {
            row.height = 25;
            row.eachCell({ includeEmpty: true }, cell => cell.style = tableHeaderStyle);
        });
        
        return startRow + 2;
    };
    
    const addDataRow = (bpd, index) => {
        const row = worksheet.addRow([
            index,
            bpd.no_sk_bupati || '',
            formatDate(bpd.tgl_sk_bupati),
            bpd.periode || '',
            formatDate(bpd.tgl_pelantikan),
            bpd.wil_pmlhn || '',
            `${bpd.nama || ''}${bpd.gelar ? ', ' + bpd.gelar : ''}`,
            bpd.tempat_lahir || '',
            formatDate(bpd.tgl_lahir, 'birthdate'),
            bpd.pekerjaan || '',
            bpd.pendidikan || '',
            bpd.agama || '',
            bpd.desa || '',
            bpd.rt || '',
            bpd.rw || '',
            bpd.jabatan || ''
        ]);
        // --- PERBAIKAN: Menyeragamkan tinggi baris data ---
        row.height = 20;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.style = { ...cellStyle };
            cell.alignment = { ...cell.alignment, horizontal: 'left', vertical: 'middle', indent: 1 };
            
            if ([1, 3, 4, 5, 6, 11, 12, 14, 15, 16].includes(colNumber)) {
                cell.alignment.horizontal = 'center';
            }
            
            if ([3, 5].includes(colNumber)) {
                cell.numFmt = 'dd/mm/yyyy';
            }
        });
    };
    
    const addSignatureBlock = (startRow, signer) => {
        const signatureColStart = 'M';
        const signatureColEnd = 'P';
        
        worksheet.mergeCells(`${signatureColStart}${startRow}:${signatureColEnd}${startRow}`);
        worksheet.getCell(`${signatureColStart}${startRow}`).value = `${signer.location}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        worksheet.mergeCells(`${signatureColStart}${startRow + 1}:${signatureColEnd}${startRow + 1}`);
        worksheet.getCell(`${signatureColStart}${startRow + 1}`).value = signer.jabatan;
        
        worksheet.mergeCells(`${signatureColStart}${startRow + 5}:${signatureColEnd}${startRow + 5}`);
        const nameCell = worksheet.getCell(`${signatureColStart}${startRow + 5}`);
        nameCell.value = (signer.nama || '(....................................)').toUpperCase();
        nameCell.font = { name: 'Arial', size: 10, bold: true, underline: true };
        
        for (let i = 0; i <= 7; i++) {
            const row = worksheet.getRow(startRow + i);
            if (row) {
                const cell = row.getCell(signatureColStart);
                cell.alignment = { ...cell.alignment, horizontal: 'center' };
                 if(i > 1 && i < 5) row.height = 15;
            }
        }

        if(signer.pangkat) {
             worksheet.mergeCells(`${signatureColStart}${startRow + 6}:${signatureColEnd}${startRow + 6}`);
             worksheet.getCell(`${signatureColStart}${startRow + 6}`).value = signer.pangkat;
        }
        if(signer.nip) {
            worksheet.mergeCells(`${signatureColStart}${startRow + 7}:${signatureColEnd}${startRow + 7}`);
            worksheet.getCell(`${signatureColStart}${startRow + 7}`).value = `NIP. ${signer.nip}`;
        }
    }

    currentRow = addTableHeader(currentRow);

    if (role === 'admin_kecamatan') {
        const JABATAN_BPD_ORDER = ["KETUA", "WAKIL KETUA", "SEKRETARIS", "ANGGOTA"];
        const upperCaseDesaList = DESA_LIST.map(d => d.toUpperCase());
        
        // --- PERBAIKAN: Logika pengurutan yang lebih presisi ---
        const sortedData = [...bpdData].sort((a, b) => {
            const desaA = (a.desa || '').trim().toUpperCase();
            const desaB = (b.desa || '').trim().toUpperCase();
            
            const indexA = upperCaseDesaList.indexOf(desaA);
            const indexB = upperCaseDesaList.indexOf(desaB);
            
            // Urutan pertama: berdasarkan urutan desa
            if (indexA !== indexB) {
                 if (indexA === -1) return 1;
                 if (indexB === -1) return -1;
                 return indexA - indexB;
            }

            // Urutan kedua: berdasarkan jabatan
            const jabatanA = (a.jabatan || '').toUpperCase();
            const jabatanB = (b.jabatan || '').toUpperCase();
            const indexJabatanA = JABATAN_BPD_ORDER.indexOf(jabatanA);
            const indexJabatanB = JABATAN_BPD_ORDER.indexOf(jabatanB);
            
            if(indexJabatanA !== indexJabatanB){
                if (indexJabatanA === -1) return 1;
                if (indexJabatanB === -1) return -1;
                return indexJabatanA - indexJabatanB;
            }

            // Urutan ketiga: berdasarkan nama jika desa dan jabatan sama
            return (a.nama || '').localeCompare(b.nama || '');
        });
        
        // --- PERBAIKAN: Langsung render data tanpa header pemisah ---
        sortedData.forEach((bpd, index) => {
            addDataRow(bpd, index + 1);
        });
        
        currentRow = worksheet.lastRow.number + 3;
        addSignatureBlock(currentRow, {
            location: 'Punggelan',
            jabatan: exportConfig?.jabatanPenandaTangan || 'Camat Punggelan',
            nama: exportConfig?.namaPenandaTangan,
            pangkat: exportConfig?.pangkatPenandaTangan,
            nip: exportConfig?.nipPenandaTangan
        });

    } else { // admin_desa
        bpdData.forEach((bpd, index) => {
            addDataRow(bpd, index + 1);
        });
        
        currentRow = worksheet.lastRow.number + 3;
        const kades = allPerangkat.find(p => p.desa === desa && p.jabatan?.toLowerCase().includes('kepala desa'));
        addSignatureBlock(currentRow, {
            location: desa,
            jabatan: 'Kepala Desa',
            nama: kades ? kades.nama : '(....................................)'
        });
    }

    // --- PERBAIKAN: Menyesuaikan lebar kolom agar lebih optimal ---
    worksheet.columns = [
        { width: 5 },   // NO
        { width: 22 },  // No SK
        { width: 12 },  // Tgl SK
        { width: 12 },  // Periode
        { width: 12 },  // Tgl Pelantikan
        { width: 18 },  // Wil Pemilihan
        { width: 30 },  // Nama
        { width: 20 },  // Tempat Lahir
        { width: 18 },  // Tgl Lahir
        { width: 20 },  // Pekerjaan
        { width: 12 },  // Pendidikan
        { width: 12 },  // Agama
        { width: 18 },  // Desa (Alamat)
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

