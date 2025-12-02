import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { collection, query, where, getDocs } from 'firebase/firestore';

const formatDateIndo = (dateString) => {
    if (!dateString) return "";
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
    } catch (e) {
        return dateString;
    }
};

// Helper untuk mengurutkan jabatan (Ketua -> Sekretaris -> Bendahara -> Anggota -> Lainnya)
const getJabatanOrder = (jabatan) => {
    if (!jabatan) return 99;
    const j = jabatan.toLowerCase();
    if (j.includes('ketua')) return 1;
    if (j.includes('sekretaris')) return 2;
    if (j.includes('bendahara')) return 3;
    if (j.includes('anggota')) return 4;
    return 99;
};

export const generateRtXLSX = async (dataList, db, exportConfig, currentUser) => {
    // Validasi Data
    const validData = dataList.filter(item => item.desa);
    const uniqueDesa = [...new Set(validData.map(item => item.desa))];
    
    if (validData.length === 0) {
        throw new Error("Tidak ada data valid untuk diekspor.");
    }
    
    if (uniqueDesa.length > 1) {
        throw new Error("Gagal Ekspor: Terdeteksi data dari " + uniqueDesa.length + " desa berbeda. Harap filter tampilan menjadi '1 Desa' spesifik terlebih dahulu sebelum melakukan ekspor.");
    }

    const desaName = uniqueDesa[0];
    const currentYear = new Date().getFullYear();
    const workbook = new ExcelJS.Workbook();
    
    const worksheet = workbook.addWorksheet(`Data RT ${desaName}`);

    // --- STYLES ---
    const fontBase = { name: 'Arial', size: 9 };
    // Font khusus untuk Dusun dan Dukuh (Ukuran 7)
    const fontSmall = { name: 'Arial', size: 7 };
    
    const borderStyle = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: borderStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } };
    
    // Style Standar (Ukuran 9)
    const centerStyle = { font: fontBase, alignment: { vertical: 'middle', horizontal: 'center' }, border: borderStyle };
    const leftStyle = { font: fontBase, alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }, border: borderStyle };
    
    // Style Khusus Kecil (Ukuran 7)
    const centerSmallStyle = { font: fontSmall, alignment: { vertical: 'middle', horizontal: 'center' }, border: borderStyle };
    const leftSmallStyle = { font: fontSmall, alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }, border: borderStyle };

    const totalStyle = { font: { name: 'Arial', size: 9, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' }, border: borderStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } } };

    // --- PAGE SETUP ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, // A4
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        printArea: 'A:T'
    };

    // --- Judul Utama ---
    worksheet.mergeCells('A1:T1');
    worksheet.getCell('A1').value = `DATA RT DESA ${desaName.toUpperCase()}`;
    worksheet.getCell('A1').style = titleStyle;

    worksheet.mergeCells('A2:T2');
    worksheet.getCell('A2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('A2').style = titleStyle;
    
    worksheet.addRow([]); // Spacer Baris 3

    // --- Header Tabel (Baris 4 & 5) ---
    const startRow = 4;
    
    // Header Baris 1
    worksheet.getCell(`A${startRow}`).value = "NO";
    worksheet.getCell(`B${startRow}`).value = "N A M A";
    worksheet.getCell(`C${startRow}`).value = "Jenis Kelamin";
    worksheet.getCell(`E${startRow}`).value = "JABATAN";
    worksheet.getCell(`F${startRow}`).value = "TEMPAT, TGL LAHIR";
    worksheet.getCell(`H${startRow}`).value = "PENDIDIKAN";
    worksheet.getCell(`P${startRow}`).value = "NO RT";
    worksheet.getCell(`Q${startRow}`).value = "DUSUN";
    worksheet.getCell(`R${startRow}`).value = "DUKUH";
    worksheet.getCell(`S${startRow}`).value = "PRIODE";
    worksheet.getCell(`T${startRow}`).value = "No. HP / WA";

    // Header Baris 2 (Sub-headers)
    const nextRow = startRow + 1;
    worksheet.getCell(`C${nextRow}`).value = "L";
    worksheet.getCell(`D${nextRow}`).value = "P";
    worksheet.getCell(`F${nextRow}`).value = "TEMPAT LAHIR";
    worksheet.getCell(`G${nextRow}`).value = "TANGGAL LAHIR";
    // Pisahkan Header Pendidikan
    worksheet.getCell(`H${nextRow}`).value = "SD";
    worksheet.getCell(`I${nextRow}`).value = "SLTP";
    worksheet.getCell(`J${nextRow}`).value = "SLTA";
    worksheet.getCell(`K${nextRow}`).value = "D1";
    worksheet.getCell(`L${nextRow}`).value = "D2";
    worksheet.getCell(`M${nextRow}`).value = "D3";
    worksheet.getCell(`N${nextRow}`).value = "S1";
    worksheet.getCell(`O${nextRow}`).value = "S2";

    // Merge Cells Header
    worksheet.mergeCells(`A${startRow}:A${nextRow}`);
    worksheet.mergeCells(`B${startRow}:B${nextRow}`);
    worksheet.mergeCells(`C${startRow}:D${startRow}`);
    worksheet.mergeCells(`E${startRow}:E${nextRow}`);
    worksheet.mergeCells(`F${startRow}:G${startRow}`);
    worksheet.mergeCells(`H${startRow}:O${startRow}`);
    worksheet.mergeCells(`P${startRow}:P${nextRow}`);
    worksheet.mergeCells(`Q${startRow}:Q${nextRow}`);
    worksheet.mergeCells(`R${startRow}:R${nextRow}`);
    worksheet.mergeCells(`S${startRow}:S${nextRow}`);
    worksheet.mergeCells(`T${startRow}:T${nextRow}`);

    // Apply Style ke Header
    for (let r = startRow; r <= nextRow; r++) {
        const row = worksheet.getRow(r);
        row.height = 25;
        for (let c = 1; c <= 20; c++) { 
            row.getCell(c).style = headerStyle;
        }
    }

    // --- SORTING & GROUPING ---
    validData.sort((a, b) => {
        // 1. Sort by Dusun
        const dusunA = (a.dusun || "").toLowerCase();
        const dusunB = (b.dusun || "").toLowerCase();
        if (dusunA < dusunB) return -1;
        if (dusunA > dusunB) return 1;

        // 2. Sort by Dukuh
        const dukuhA = (a.dukuh || "").toLowerCase();
        const dukuhB = (b.dukuh || "").toLowerCase();
        if (dukuhA < dukuhB) return -1;
        if (dukuhA > dukuhB) return 1;

        // 3. Sort by RT Number
        const rtA = parseInt(a.no_rt) || 0;
        const rtB = parseInt(b.no_rt) || 0;
        if (rtA !== rtB) {
            return rtA - rtB;
        }
        
        // 4. If RT same, Sort by Jabatan Rank
        const jabatanA = getJabatanOrder(a.jabatan);
        const jabatanB = getJabatanOrder(b.jabatan);
        return jabatanA - jabatanB;
    });

    // --- ISI DATA ---
    let firstDataRow = nextRow + 1;

    validData.forEach((item, i) => {
        const row = worksheet.addRow([
            i + 1,                                      // A: NO
            item.nama,                                  // B: NAMA
            // C: L
            (item.jenis_kelamin || '').toLowerCase().includes('l') ? 1 : null,
            // D: P
            (item.jenis_kelamin || '').toLowerCase().includes('p') ? 1 : null,
            item.jabatan,                               // E: JABATAN
            item.tempat_lahir,                          // F: TEMPAT LAHIR
            formatDateIndo(item.tanggal_lahir),         // G: TGL LAHIR
            // H-O: PENDIDIKAN
            (item.pendidikan || '').toUpperCase() === 'SD' ? 1 : null,
            (item.pendidikan || '').toUpperCase() === 'SLTP' ? 1 : null,
            (item.pendidikan || '').toUpperCase() === 'SLTA' ? 1 : null,
            (item.pendidikan || '').toUpperCase() === 'D1' ? 1 : null,
            (item.pendidikan || '').toUpperCase() === 'D2' ? 1 : null,
            (item.pendidikan || '').toUpperCase() === 'D3' ? 1 : null,
            (item.pendidikan || '').toUpperCase() === 'S1' ? 1 : null,
            (item.pendidikan || '').toUpperCase() === 'S2' ? 1 : null,
            item.no_rt,                                 // P: NO RT (Nilai Asli)
            item.dusun,                                 // Q: DUSUN
            item.dukuh,                                 // R: DUKUH
            item.periode,                               // S: PRIODE
            item.no_hp                                  // T: HP
        ]);

        // Apply Styles per Cell agar border tidak hilang
        row.height = 20; // Set tinggi baris konsisten
        for(let c=1; c<=20; c++) {
             // Alignment: Nama, Jabatan, Tempat, Dusun, Dukuh (Left)
             
             // Tentukan Style Dasar (Normal vs Small Font)
             // Kolom Q (17) = DUSUN, Kolom R (18) = DUKUH -> Pakai font kecil
             let cellStyle;
             
             if ([17, 18].includes(c)) {
                 // Khusus Dusun & Dukuh -> Font Size 7, Align Left
                 cellStyle = leftSmallStyle; 
             } else if ([2, 5, 6].includes(c)) {
                 // Nama, Jabatan, Tempat Lahir -> Font Size 9, Align Left
                 cellStyle = leftStyle;
             } else {
                 // Sisanya -> Font Size 9, Align Center
                 cellStyle = centerStyle;
             }

             row.getCell(c).style = cellStyle;
        }
    });
    
    let lastDataRow = worksheet.lastRow.number;

    // --- Baris JUMLAH ---
    const jumlahRow = worksheet.addRow([]);
    worksheet.mergeCells(`A${jumlahRow.number}:B${jumlahRow.number}`);
    jumlahRow.getCell(1).value = "JUMLAH";
    
    // Rumus Sum untuk L, P (C, D)
    for (let col = 3; col <= 4; col++) {
        const colLetter = worksheet.getColumn(col).letter;
        jumlahRow.getCell(col).value = { formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})` };
    }

    // Kosongkan Jabatan, Tempat Lahir, Tanggal Lahir (E, F, G) - Tidak dijumlah
    for (let col = 5; col <= 7; col++) {
        jumlahRow.getCell(col).value = null;
    }

    // Rumus Sum untuk Pendidikan (H - O)
    for (let col = 8; col <= 15; col++) {
        const colLetter = worksheet.getColumn(col).letter;
        jumlahRow.getCell(col).value = { formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})` };
    }

    // Kolom RT (P) dan seterusnya KOSONG (Tidak dijumlah)
    for (let col = 16; col <= 20; col++) {
        jumlahRow.getCell(col).value = null;
    }

    // Apply Style Jumlah & Border ke SEMUA sel (1-20)
    for(let c=1; c<=20; c++) {
        jumlahRow.getCell(c).style = totalStyle;
    }

    // --- Baris JUMLAH TOTAL ---
    const totalRow = worksheet.addRow([]);
    worksheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
    totalRow.getCell(1).value = "JUMLAH TOTAL";
    
    // Merge untuk L+P (C+D)
    worksheet.mergeCells(`C${totalRow.number}:D${totalRow.number}`);
    totalRow.getCell(3).value = { formula: `SUM(C${jumlahRow.number}:D${jumlahRow.number})` };
    
    // Merge untuk Pendidikan (H-O)
    worksheet.mergeCells(`H${totalRow.number}:O${totalRow.number}`);
    totalRow.getCell(8).value = { formula: `SUM(H${jumlahRow.number}:O${jumlahRow.number})` };

    // Apply Style Total & Border ke SEMUA sel
    for(let c=1; c<=20; c++) {
         totalRow.getCell(c).style = totalStyle;
    }
    // Re-apply border khusus untuk sel yang di-merge agar garis tidak hilang
    totalRow.getCell(1).style = totalStyle; 
    totalRow.getCell(3).style = totalStyle;
    totalRow.getCell(8).style = totalStyle;

    worksheet.addRow([]); // Jarak 3 baris sebelum TTD

    // --- LOGIKA TANDA TANGAN KEPALA DESA ---
    const currentRow = worksheet.lastRow.number + 1;
    const dateNow = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    
    let namaKades = '(....................................)';
    
    try {
        // Query ke koleksi 'perangkat' (bukan 'perangkat_desa' agar konsisten dengan Perangkat.js)
        const q = query(
            collection(db, 'perangkat'), 
            where('desa', '==', desaName)
        );
        
        const snapshot = await getDocs(q);
        // Filter manual untuk case-insensitive jabatan
        const kadesDoc = snapshot.docs
            .map(doc => doc.data())
            .find(p => p.jabatan && (p.jabatan.toLowerCase().includes('kepala desa') || p.jabatan.toLowerCase().includes('pj. kepala desa')));
            
        if (kadesDoc && kadesDoc.nama) {
            namaKades = kadesDoc.nama.toUpperCase();
        }
    } catch (error) {
        console.error("Error fetching Kepala Desa:", error);
    }

    const addSignatureBlock = (rowNum, { location, jabatan, nama }) => {
        // Posisi TTD di kanan (Kolom Q-T)
        const startCol = 'Q';
        const endCol = 'T';
        
        worksheet.mergeCells(`${startCol}${rowNum}:${endCol}${rowNum}`);
        worksheet.getCell(`${startCol}${rowNum}`).value = `${location}, ${dateNow}`;
        worksheet.getCell(`${startCol}${rowNum}`).alignment = { horizontal: 'center' };
        worksheet.getCell(`${startCol}${rowNum}`).font = { name: 'Arial', size: 11 };

        worksheet.mergeCells(`${startCol}${rowNum + 1}:${endCol}${rowNum + 1}`);
        worksheet.getCell(`${startCol}${rowNum + 1}`).value = jabatan;
        worksheet.getCell(`${startCol}${rowNum + 1}`).alignment = { horizontal: 'center' };
        worksheet.getCell(`${startCol}${rowNum + 1}`).font = { name: 'Arial', size: 11 };

        // Jarak TTD (4 baris)
        const nameRow = rowNum + 5;
        worksheet.mergeCells(`${startCol}${nameRow}:${endCol}${nameRow}`);
        worksheet.getCell(`${startCol}${nameRow}`).value = nama;
        worksheet.getCell(`${startCol}${nameRow}`).alignment = { horizontal: 'center' };
        worksheet.getCell(`${startCol}${nameRow}`).font = { name: 'Arial', size: 11, bold: true, underline: true };
    };

    addSignatureBlock(currentRow, {
        location: desaName,
        jabatan: 'Kepala Desa',
        nama: namaKades
    });

    // --- Atur Lebar Kolom ---
    worksheet.getColumn(1).width = 5;  // No
    worksheet.getColumn(2).width = 30; // Nama
    worksheet.getColumn(3).width = 4;  // L
    worksheet.getColumn(4).width = 4;  // P
    worksheet.getColumn(5).width = 20; // Jabatan
    worksheet.getColumn(6).width = 15; // Tempat Lahir
    worksheet.getColumn(7).width = 15; // Tgl Lahir
    for(let c=8; c<=15; c++) worksheet.getColumn(c).width = 5; // Pendidikan
    worksheet.getColumn(16).width = 8; // RT
    worksheet.getColumn(17).width = 15; // Dusun
    worksheet.getColumn(18).width = 15; // Dukuh
    worksheet.getColumn(19).width = 12; // Periode
    worksheet.getColumn(20).width = 15; // HP

    const fileName = `Data_RT_${desaName.replace(/\s+/g, '_')}_${currentYear}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
};