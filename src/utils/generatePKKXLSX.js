import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Fungsi utilitas untuk memformat tanggal dengan aman untuk Excel.
 * Mengembalikan objek Date yang disesuaikan timezone-nya.
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
 * Generator File Excel untuk Data PKK (Diadaptasi dari LPM)
 */
export const generatePKKXLSX = async (exportData) => {
    const {
        dataToExport,
        desa,
        exportConfig
    } = exportData;

    if (!dataToExport || dataToExport.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data PKK');
    const currentYear = new Date().getFullYear();

    // --- 1. PENGATURAN HALAMAN ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true, 
        fitToWidth: 1, 
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    };

    // --- 2. DEFINISI STYLE ---
    const borderStyle = {
        top: { style: 'thin' }, 
        left: { style: 'thin' }, 
        bottom: { style: 'thin' }, 
        right: { style: 'thin' }
    };

    const titleStyle = { 
        font: { name: 'Arial', size: 14, bold: true }, 
        alignment: { horizontal: 'center' } 
    };

    const headerStyle = { 
        font: { name: 'Arial', size: 10, bold: true }, 
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, 
        border: borderStyle, 
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } // Abu-abu
    };

    const dataCellStyle = { 
        font: { name: 'Arial', size: 9 }, 
        border: borderStyle, 
        alignment: { vertical: 'middle', wrapText: true } 
    };

    const centerCellStyle = { 
        ...dataCellStyle, 
        alignment: { ...dataCellStyle.alignment, horizontal: 'center' } 
    };

    // Style Hijau untuk Baris Jumlah
    const totalRowStyle = { 
        font: { name: 'Arial', size: 10, bold: true }, 
        border: borderStyle,
        alignment: { vertical: 'middle', horizontal: 'center' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } } // Hijau Muda
    };

    // --- 3. JUDUL LAPORAN ---
    const TOTAL_COLUMNS = 22; // A sampai V
    let currentRow = 1;

    const titleText = desa === 'all' || !desa
        ? `DATA PEMBERDAYAAN KESEJAHTERAAN KELUARGA (PKK) SE-KECAMATAN PUNGGELAN`
        : `DATA PEMBERDAYAAN KESEJAHTERAAN KELUARGA (PKK) DESA ${desa.toUpperCase()}`;
    
    worksheet.mergeCells(currentRow, 1, currentRow, TOTAL_COLUMNS);
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = titleText;
    titleCell.style = titleStyle;
    currentRow++;

    worksheet.mergeCells(currentRow, 1, currentRow, TOTAL_COLUMNS);
    const yearCell = worksheet.getCell(currentRow, 1);
    yearCell.value = `TAHUN ${currentYear}`;
    yearCell.style = titleStyle;
    currentRow += 2; // Spasi sebelum tabel

    // --- 4. HEADER TABEL ---
    const headerRowStart = currentRow;
    
    // Set Header Values (Baris 1)
    const row1 = worksheet.getRow(currentRow);
    row1.values = [
        "NO", "DESA", "NAMA LENGKAP", "JENIS KELAMIN", null, "JABATAN", 
        "TEMPAT, TANGGAL LAHIR", null, "PENDIDIKAN TERAKHIR", null, null, null, null, null, null, null, null,
        "NO SK", "TANGGAL PELANTIKAN", "MASA BAKTI (Thn)", "AKHIR JABATAN", "NO. HP / WA"
    ];

    // Set Header Values (Baris 2 - Sub Header)
    const row2 = worksheet.getRow(currentRow + 1);
    row2.values = [
        null, null, null, "L", "P", null, 
        "TEMPAT LAHIR", "TANGGAL LAHIR", 
        "SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3",
        null, null, null, null, null
    ];

    // Merge Header Cells
    worksheet.mergeCells(`A${headerRowStart}:A${headerRowStart + 1}`); // NO
    worksheet.mergeCells(`B${headerRowStart}:B${headerRowStart + 1}`); // DESA
    worksheet.mergeCells(`C${headerRowStart}:C${headerRowStart + 1}`); // NAMA
    worksheet.mergeCells(`D${headerRowStart}:E${headerRowStart}`);     // JK Parent
    worksheet.mergeCells(`F${headerRowStart}:F${headerRowStart + 1}`); // JABATAN
    worksheet.mergeCells(`G${headerRowStart}:H${headerRowStart}`);     // TTL Parent
    worksheet.mergeCells(`I${headerRowStart}:Q${headerRowStart}`);     // PENDIDIKAN Parent
    worksheet.mergeCells(`R${headerRowStart}:R${headerRowStart + 1}`); // NO SK
    worksheet.mergeCells(`S${headerRowStart}:S${headerRowStart + 1}`); // TGL LANTIK
    worksheet.mergeCells(`T${headerRowStart}:T${headerRowStart + 1}`); // MASA BAKTI
    worksheet.mergeCells(`U${headerRowStart}:U${headerRowStart + 1}`); // AKHIR
    worksheet.mergeCells(`V${headerRowStart}:V${headerRowStart + 1}`); // HP

    // Apply Style to Header
    [row1, row2].forEach(row => {
        row.height = 25;
        for(let i = 1; i <= TOTAL_COLUMNS; i++) {
            row.getCell(i).style = headerStyle;
        }
    });

    currentRow += 2;

    // --- 5. ISI DATA ---
    const pendidikanMap = { 
        'SD': 9, 'SLTP': 10, 'SLTA': 11, 
        'D1': 12, 'D2': 13, 'D3': 14, 
        'S1': 15, 'S2': 16, 'S3': 17 
    };

    const sortedData = [...dataToExport].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    const firstDataRowIndex = currentRow;

    sortedData.forEach((item, index) => {
        const row = worksheet.getRow(currentRow);
        
        // A: No (Pastikan Angka)
        row.getCell(1).value = index + 1;
        
        // B: Desa
        row.getCell(2).value = item.desa || '';
        
        // C: Nama
        row.getCell(3).value = item.nama || '';
        
        // D-E: Jenis Kelamin (Angka 1 agar bisa dijumlah)
        if (item.jenis_kelamin === 'L' || item.jenis_kelamin === 'Laki-Laki') {
            row.getCell(4).value = 1;
            row.getCell(5).value = null;
        } else if (item.jenis_kelamin === 'P' || item.jenis_kelamin === 'Perempuan') {
            row.getCell(4).value = null;
            row.getCell(5).value = 1;
        }

        // F: Jabatan
        row.getCell(6).value = item.jabatan || '';
        
        // G: Tempat Lahir
        row.getCell(7).value = item.tempat_lahir || '';
        
        // H: Tanggal Lahir
        row.getCell(8).value = formatDateForExcel(item.tgl_lahir);

        // I-Q: Pendidikan (Angka 1 agar bisa dijumlah)
        // Reset kolom pendidikan dulu
        for (let c = 9; c <= 17; c++) row.getCell(c).value = null;
        
        if (item.pendidikan && pendidikanMap[item.pendidikan]) {
            row.getCell(pendidikanMap[item.pendidikan]).value = 1;
        }

        // R: No SK
        row.getCell(18).value = item.no_sk || '';
        
        // S: Tgl Pelantikan
        row.getCell(19).value = formatDateForExcel(item.tgl_pelantikan);
        
        // T: Masa Bakti
        row.getCell(20).value = item.masa_bakti ? parseInt(item.masa_bakti, 10) : '';
        
        // U: Akhir Jabatan
        row.getCell(21).value = formatDateForExcel(item.akhir_jabatan);
        
        // V: HP
        row.getCell(22).value = item.no_hp || '';

        // --- Styling Per Sel ---
        for(let i = 1; i <= TOTAL_COLUMNS; i++) {
            const cell = row.getCell(i);
            
            // Border di semua sel (agar tidak hilang)
            cell.border = borderStyle;

            // Alignment
            if ([3, 6, 7].includes(i)) { // Nama, Jabatan, Tempat Lahir -> Kiri
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            } else { // Sisanya -> Tengah
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            }

            // Font
            cell.font = { name: 'Arial', size: 9 };

            // Format Tanggal Khusus Indonesia (02-November-2000)
            if ([8, 19, 21].includes(i)) {
                // [$-421] adalah kode locale untuk Indonesia
                cell.numFmt = '[$-421]dd-mmmm-yyyy;@';
            }
        }

        currentRow++;
    });

    const lastDataRowIndex = currentRow - 1;

    // --- 6. BARIS JUMLAH & JUMLAH TOTAL ---

    // 1. Baris JUMLAH per Kolom
    const totalRow = worksheet.getRow(currentRow);
    const totalRowIndex = currentRow; 
    
    totalRow.getCell(1).value = 'JUMLAH';
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`); 

    // Rumus Sum untuk JK (D, E) dan Pendidikan (I - Q)
    const columnsToSum = [4, 5, 9, 10, 11, 12, 13, 14, 15, 16, 17];
    
    columnsToSum.forEach(colIndex => {
        const colLetter = worksheet.getColumn(colIndex).letter;
        totalRow.getCell(colIndex).value = { formula: `SUM(${colLetter}${firstDataRowIndex}:${colLetter}${lastDataRowIndex})` };
    });

    // Terapkan Style Hijau & Border
    for (let i = 1; i <= TOTAL_COLUMNS; i++) {
        const cell = totalRow.getCell(i);
        cell.style = totalRowStyle; 
    }
    
    currentRow++;

    // 2. Baris JUMLAH TOTAL (Gabungan)
    const grandTotalRow = worksheet.getRow(currentRow);
    
    grandTotalRow.getCell(1).value = 'JUMLAH TOTAL';
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);

    // Total JK (L + P) -> Merge D-E
    worksheet.mergeCells(`D${currentRow}:E${currentRow}`);
    grandTotalRow.getCell(4).value = { formula: `SUM(D${totalRowIndex}:E${totalRowIndex})` };
    
    // Total Pendidikan -> Merge I-Q
    worksheet.mergeCells(`I${currentRow}:Q${currentRow}`);
    grandTotalRow.getCell(9).value = { formula: `SUM(I${totalRowIndex}:Q${totalRowIndex})` };

    // Style untuk baris JUMLAH TOTAL
    for (let i = 1; i <= TOTAL_COLUMNS; i++) {
        const cell = grandTotalRow.getCell(i);
        cell.style = totalRowStyle;
        
        if (i === 4) cell.border = borderStyle;
        if (i === 9) cell.border = borderStyle;
    }

    currentRow += 3; // Spasi untuk Tanda Tangan

    // --- 7. TANDA TANGAN ---
    const signer = {
        location: desa === 'all' ? 'Punggelan' : (desa || ''),
        jabatan: desa === 'all' 
            ? (exportConfig?.jabatanPenandaTangan || 'Camat Punggelan') 
            : `Ketua TP PKK Desa ${desa}`, // Sesuaikan dengan jabatan PKK
        nama: desa === 'all'
            ? (exportConfig?.namaPenandaTangan || '')
            : (dataToExport.find(p => (p.jabatan || '').toLowerCase().includes('ketua'))?.nama || ''),
        nip: desa === 'all' ? (exportConfig?.nipPenandaTangan || '') : null
    };

    const signColStart = 17; // Kolom Q
    const dateNow = new Date();
    const dateString = dateNow.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    worksheet.getCell(currentRow, signColStart).value = `${signer.location}, ${dateString}`;
    worksheet.getCell(currentRow + 1, signColStart).value = signer.jabatan;
    
    // Nama Penanda Tangan
    const nameCell = worksheet.getCell(currentRow + 5, signColStart);
    nameCell.value = (signer.nama || '....................................').toUpperCase();
    nameCell.font = { name: 'Arial', size: 10, bold: true, underline: true };

    // NIP (Jika ada)
    if (signer.nip) {
        worksheet.getCell(currentRow + 6, signColStart).value = `NIP. ${signer.nip}`;
    }

    // Styling Blok Tanda Tangan
    for (let r = 0; r <= 6; r++) {
        worksheet.mergeCells(currentRow + r, signColStart, currentRow + r, TOTAL_COLUMNS);
        const cell = worksheet.getCell(currentRow + r, signColStart);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (r !== 5) cell.font = { name: 'Arial', size: 10 };
    }

    // --- 8. LEBAR KOLOM ---
    worksheet.columns = [
        { width: 5 },   // A: No
        { width: 18 },  // B: Desa
        { width: 28 },  // C: Nama
        { width: 5 },   // D: L
        { width: 5 },   // E: P
        { width: 20 },  // F: Jabatan
        { width: 18 },  // G: Tempat Lahir
        { width: 18 },  // H: Tgl Lahir
        { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 }, // I-M
        { width: 5 }, { width: 5 }, { width: 5 }, { width: 5 },               // N-Q
        { width: 22 },  // R: No SK
        { width: 18 },  // S: Tgl Pelantikan
        { width: 10 },  // T: Masa Bakti
        { width: 18 },  // U: Akhir
        { width: 16 }   // V: HP
    ];

    // --- 9. SIMPAN FILE ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Data_PKK_${desa === 'all' ? 'Kecamatan_Punggelan' : `Desa_${desa}`}_${currentYear}.xlsx`;
    
    saveAs(blob, fileName);
};