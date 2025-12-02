import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Helper Format Tanggal Indonesia
const getFormattedDate = () => {
    const date = new Date();
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

export const generateRekapDesaXLSX = async (rekapData, namaDesa) => {
    // 1. Ambil Data Kepala Desa dari Database untuk Tanda Tangan
    let allPerangkat = [];
    let namaKepalaDesa = '(...........................................)';

    try {
        const q = query(
            collection(db, 'perangkat'), 
            where('desa', '==', namaDesa)
        );
        const snapshot = await getDocs(q);
        allPerangkat = snapshot.docs.map(doc => doc.data());
        
        // Cari Kepala Desa untuk Tanda Tangan
        const kades = allPerangkat.find(p => p.jabatan && (p.jabatan.toLowerCase().includes('kepala desa') || p.jabatan.toLowerCase().includes('pj. kepala desa')));
        if (kades && kades.nama) {
            namaKepalaDesa = kades.nama.toUpperCase();
        }
    } catch (error) {
        console.error("Gagal mengambil data Perangkat Desa:", error);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`REKAP ${namaDesa}`.toUpperCase().substring(0, 30)); 
    const currentYear = new Date().getFullYear();

    // --- STYLES ---
    const fontBase = { name: 'Arial', size: 9 }; // Font diperkecil agar muat
    const fontSmall = { name: 'Arial', size: 7 }; // Khusus Dusun & Dukuh
    const fontRed = { name: 'Arial', size: 8, color: { argb: 'FFFF0000' } }; // Rumus KET Merah

    const borderStyle = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 11, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: borderStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } };
    
    const centerStyle = { font: fontBase, alignment: { vertical: 'middle', horizontal: 'center' }, border: borderStyle };
    const leftStyle = { font: fontBase, alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }, border: borderStyle };
    const leftSmallStyle = { font: fontSmall, alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }, border: borderStyle };
    
    // Style Khusus KET: Angka Merah, Tanpa Border
    const ketStyle = { font: fontRed, alignment: { vertical: 'middle', horizontal: 'center' } }; 
    
    const totalStyle = { font: { name: 'Arial', size: 9, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' }, border: borderStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } } };

    // --- PAGE SETUP ---
    worksheet.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, // A4
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        fitToPage: true, 
        printArea: 'A:J' // Print sampai kolom J (KET) - meskipun tanpa border, tetap area print
    };

    // --- JUDUL ---
    worksheet.mergeCells('A1:I1'); // Merge sampai I (DUKUH) agar rapi tanpa KET
    worksheet.getCell('A1').value = `REKAP DATA RT RW DAN DUSUN DESA ${namaDesa.toUpperCase()}`;
    worksheet.getCell('A1').style = titleStyle;

    worksheet.mergeCells('A2:I2');
    worksheet.getCell('A2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('A2').style = titleStyle;

    worksheet.addRow([]); // Spacer Baris 3

    // --- HEADER TABEL (Baris 4 & 5) ---
    const startRow = 4;
    const nextRow = 5;
    
    // Header Baris 1
    worksheet.getCell(`A${startRow}`).value = "NO";
    worksheet.getCell(`B${startRow}`).value = "DUSUN";
    worksheet.getCell(`C${startRow}`).value = "RW";
    worksheet.getCell(`D${startRow}`).value = "NAMA KETUA RW";
    worksheet.getCell(`E${startRow}`).value = "RT";
    worksheet.getCell(`F${startRow}`).value = "NAMA KETUA RT";
    worksheet.getCell(`G${startRow}`).value = "NAMA SEKRETARIS";
    worksheet.getCell(`H${startRow}`).value = "NAMA BENDAHARA";
    worksheet.getCell(`I${startRow}`).value = "DUKUH";
    worksheet.getCell(`J${startRow}`).value = ""; // Kolom J (Tanpa Border)

    // Header Baris 2 (Sub-headers) - Tidak ada subheader di desain baru (berdasarkan file yang dibagikan terakhir, tidak ada split JK/Pendidikan di file desa, hanya data RT murni)
    // Namun jika tetap ingin split header untuk kerapian visual kolom lain, kita biarkan kosong atau merge vertical.
    // File "Rekap RT RW dan Dusun Per Desa.xlsx" HANYA 1 Baris Header.
    // Jadi kita HAPUS baris `nextRow` dan pakai Single Header Row.
    
    // --- REVISI HEADER (SINGLE ROW) ---
    // Hapus logika double header sebelumnya
    worksheet.spliceRows(5, 1); // Hapus baris 5 kosong jika ada
    
    // Apply Header Style (A-I pakai border)
    for (let c = 1; c <= 9; c++) {
        worksheet.getCell(4, c).style = headerStyle;
    }
    // Header KET (J) - Font Bold, Merah/Hitam, Tanpa Border
    worksheet.getCell(4, 10).style = { 
        font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFF0000' } }, 
        alignment: { horizontal: 'center', vertical: 'middle' } 
    };

    // --- ISI DATA ---
    // Data rekapData berisi list RT lengkap (Ketua, Sek, Ben sudah di-join di Page)
    rekapData.forEach((item, index) => {
        const row = worksheet.addRow([
            index + 1,                      // A: NO
            item.dusun || '',               // B: DUSUN
            item.no_rw || '',               // C: RW
            item.namaKetuaRw || '',         // D: NAMA KETUA RW
            item.no_rt || '',               // E: RT
            item.Ketua || '',               // F: NAMA KETUA RT
            item.Sekretaris !== '-' ? item.Sekretaris : '', // G: SEKRETARIS
            item.Bendahara !== '-' ? item.Bendahara : '',   // H: BENDAHARA
            item.dukuh || '',               // I: DUKUH
            null                            // J: KET (Rumus)
        ]);

        // Rumus KET: =IF(E..>=1;"1";...) -> Cek Kolom RT (E/5)
        const rIdx = row.number;
        row.getCell(10).value = { 
            formula: `IF(E${rIdx}>=1,"1",IF(E${rIdx}>=1,"1",IF(E${rIdx}>=1,"1",IF(E${rIdx}>=1,"1","0"))))` 
        };

        // Styling
        row.height = 20;
        
        // A (NO)
        row.getCell(1).style = centerStyle;
        // B (DUSUN) - Small Font
        row.getCell(2).style = leftSmallStyle;
        // C (RW)
        row.getCell(3).style = centerStyle;
        // D (KETUA RW)
        row.getCell(4).style = leftStyle;
        // E (RT)
        row.getCell(5).style = centerStyle;
        // F (KETUA RT)
        row.getCell(6).style = leftStyle;
        // G (SEKRETARIS)
        row.getCell(7).style = leftStyle;
        // H (BENDAHARA)
        row.getCell(8).style = leftStyle;
        // I (DUKUH) - Small Font
        row.getCell(9).style = leftSmallStyle;
        
        // J (KET) - Merah, Tanpa Border
        row.getCell(10).style = ketStyle;
    });

    const lastDataRow = worksheet.lastRow.number;

    // --- BARIS JUMLAH TOTAL ---
    // "JUMLAH TOTAL" diletakkan di bawah Kolom D (NAMA KETUA RW) agar nilai jumlah ada di bawah RT (Kolom E)
    const totalRow = worksheet.addRow(['', '', '', 'JUMLAH TOTAL', '', '', '', '', '', '']);
    
    // Merge A-C (Kosong) atau biarkan kosong?
    // Di file contoh, "JUMLAH TOTAL" ada di kolom D, nilai jumlah di kolom E (RT).
    
    // Rumus Penjumlahan Kolom RT (E) berdasarkan KET (J)
    // Karena KET berisi "1" jika ada RT, kita sum KET atau countif.
    // Tapi user minta "jumlahnya di taruh di bawah kolom RT", dan nilainya dari rumus KET.
    // Rumus: COUNTIF(J...:J..., "1")
    
    totalRow.getCell(5).value = { 
        formula: `COUNTIF(J5:J${lastDataRow}, "1")` 
    };

    // Styling Baris Total
    // Border hanya untuk sel yang ada isinya? Atau full row sampai I?
    // Biasanya full row A-I diberi border agar rapi.
    
    // Merge A-C agar bersih
    worksheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);
    totalRow.getCell(1).style = totalStyle; // A-C
    
    totalRow.getCell(4).style = totalStyle; // D (Label "JUMLAH TOTAL")
    totalRow.getCell(5).style = totalStyle; // E (Nilai Jumlah)
    totalRow.getCell(6).style = totalStyle; // F
    totalRow.getCell(7).style = totalStyle; // G
    totalRow.getCell(8).style = totalStyle; // H
    totalRow.getCell(9).style = totalStyle; // I
    
    // Kolom J (KET) di baris total dibiarkan kosong & tanpa border

    worksheet.addRow([]); // Spacer

    // --- TANDA TANGAN KEPALA DESA ---
    const currentRow = worksheet.lastRow.number + 3;
    
    const addSignatureBlock = (rowNum, { location, jabatan, nama }) => {
        // Posisi Tanda Tangan: Kolom G-I (Kanan)
        const startCol = 'G';
        const endCol = 'I';
        
        worksheet.mergeCells(`${startCol}${rowNum}:${endCol}${rowNum}`);
        const lCell = worksheet.getCell(`${startCol}${rowNum}`);
        lCell.value = `${location}, ${getFormattedDate()}`;
        lCell.alignment = { horizontal: 'center' }; 
        lCell.font = { name: 'Arial', size: 11 };

        worksheet.mergeCells(`${startCol}${rowNum + 1}:${endCol}${rowNum + 1}`);
        const jCell = worksheet.getCell(`${startCol}${rowNum + 1}`);
        jCell.value = jabatan;
        jCell.alignment = { horizontal: 'center' }; 
        jCell.font = { name: 'Arial', size: 11 };

        const nameRow = rowNum + 5;
        worksheet.mergeCells(`${startCol}${nameRow}:${endCol}${nameRow}`);
        const nCell = worksheet.getCell(`${startCol}${nameRow}`);
        nCell.value = nama;
        nCell.alignment = { horizontal: 'center' }; 
        nCell.font = { name: 'Arial', size: 11, bold: true, underline: true };
    };

    // Panggil Helper
    addSignatureBlock(currentRow, {
        location: namaDesa,
        jabatan: 'Kepala Desa',
        nama: namaKepalaDesa
    });

    // --- ATUR LEBAR KOLOM ---
    worksheet.getColumn(1).width = 5;   // NO
    worksheet.getColumn(2).width = 15;  // DUSUN
    worksheet.getColumn(3).width = 5;   // RW
    worksheet.getColumn(4).width = 25;  // NAMA KETUA RW
    worksheet.getColumn(5).width = 5;   // RT
    worksheet.getColumn(6).width = 25;  // NAMA KETUA RT
    worksheet.getColumn(7).width = 25;  // NAMA SEKRETARIS
    worksheet.getColumn(8).width = 25;  // NAMA BENDAHARA
    worksheet.getColumn(9).width = 15;  // DUKUH
    worksheet.getColumn(10).width = 5;  // KET

    const fileName = `Rekap_RT_RW_Dusun_${namaDesa.replace(/\s+/g, '_')}_${currentYear}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
};