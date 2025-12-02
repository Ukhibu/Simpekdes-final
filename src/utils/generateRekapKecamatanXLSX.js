import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

// Konstanta Urutan Desa (Sesuai File Anda)
const DESA_ORDER = [
    "SAMBONG", "TRIBUANA", "SAWANGAN", "SIDARATA", "BADAKARYA", "BONDOLHARJO",
    "PUNGGELAN", "KARANGSARI", "KECEPIT", "DANAKERTA", "KLAPA", "JEMBANGAN",
    "PURWASANA", "PETUGURAN", "TANJUNGTIRTA", "TLAGA", "MLAYA"
];

// Helper Format Tanggal Indonesia (contoh: 17 Oktober 2025)
const getFormattedDate = () => {
    const date = new Date();
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

export const generateRekapKecamatanXLSX = async (rekapData) => {
    // 1. Ambil Config Tanda Tangan dari Firestore
    let exportConfig = {
        namaPenandaTangan: 'MOH.JULIANTO, S.E, M.SI.',
        jabatanPenandaTangan: 'Camat Punggelan',
        pangkatPenandaTangan: 'Pembina Tk.1',
        nipPenandaTangan: '19720714 199203 1 006'
    };

    try {
        const docRef = doc(db, 'settings', 'exportConfig');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            // Update default jika ada data di DB
            if (data.namaPenandaTangan) exportConfig.namaPenandaTangan = data.namaPenandaTangan;
            if (data.jabatanPenandaTangan) exportConfig.jabatanPenandaTangan = data.jabatanPenandaTangan;
            if (data.pangkatPenandaTangan) exportConfig.pangkatPenandaTangan = data.pangkatPenandaTangan;
            if (data.nipPenandaTangan) exportConfig.nipPenandaTangan = data.nipPenandaTangan;
        }
    } catch (error) {
        console.error("Gagal mengambil config tanda tangan:", error);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('REKAP RT RW');
    const currentYear = new Date().getFullYear();

    // --- STYLES ---
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const centerStyle = { font: { name: 'Arial', size: 10 }, alignment: { vertical: 'middle', horizontal: 'center' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const leftStyle = { font: { name: 'Arial', size: 10 }, alignment: { vertical: 'middle', horizontal: 'left', indent: 1 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const boldCenterStyle = { ...centerStyle, font: { name: 'Arial', size: 10, bold: true } };

    // --- PAGE SETUP ---
    worksheet.pageSetup = {
        orientation: 'portrait',
        paperSize: 9, // A4
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
        fitToPage: true, 
        printArea: 'A:F'
    };

    // --- JUDUL ---
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'REKAPITULASI DATA RT RW DAN DUSUN SE-KECAMATAN PUNGGELAN';
    worksheet.getCell('A1').style = titleStyle;

    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('A2').style = titleStyle;

    worksheet.addRow([]); // Spacer Baris 3

    // --- HEADER TABEL (Baris 4 & 5) ---
    const headerRow = worksheet.getRow(4);
    headerRow.values = ['NO', 'NAMA DESA', 'JUMLAH RW', 'JUMLAH RT', 'JUMLAH DUSUN', 'JUMLAH DUKUH'];
    headerRow.height = 30;
    headerRow.eachCell({ includeEmpty: true }, cell => cell.style = headerStyle);

    const subHeaderRow = worksheet.getRow(5);
    subHeaderRow.values = ['1', '2', '3', '4', '5', '6'];
    subHeaderRow.eachCell({ includeEmpty: true }, cell => cell.style = centerStyle);

    // --- ISI DATA ---
    // 1. Map data yang ada ke object biar gampang diambil by nama desa
    const dataMap = rekapData.reduce((acc, item) => {
        acc[item.namaDesa.toUpperCase()] = item;
        return acc;
    }, {});

    let totalRw = 0;
    let totalRt = 0;
    let totalDusun = 0;
    let totalDukuh = 0;

    // 2. Loop sesuai urutan desa standar (DESA_ORDER)
    DESA_ORDER.forEach((namaDesa, index) => {
        const item = dataMap[namaDesa] || { jumlahRw: 0, jumlahRt: 0, jumlahDusun: 0, jumlahDukuh: 0 };
        
        totalRw += item.jumlahRw;
        totalRt += item.jumlahRt;
        totalDusun += item.jumlahDusun;
        totalDukuh += item.jumlahDukuh;

        const row = worksheet.addRow([
            index + 1,
            namaDesa,
            item.jumlahRw || '',
            item.jumlahRt || '',
            item.jumlahDusun || '',
            item.jumlahDukuh || ''
        ]);

        row.getCell(1).style = centerStyle;
        row.getCell(2).style = leftStyle;
        row.getCell(3).style = centerStyle;
        row.getCell(4).style = centerStyle;
        row.getCell(5).style = centerStyle;
        row.getCell(6).style = centerStyle;
    });

    // --- BARIS JUMLAH ---
    const totalRow = worksheet.addRow([
        'JUMLAH', '', totalRw, totalRt, totalDusun, totalDukuh
    ]);
    worksheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
    
    totalRow.getCell(1).style = boldCenterStyle; // Kolom A (Merged)
    // Kolom B merged, style ikut A
    totalRow.getCell(3).style = boldCenterStyle;
    totalRow.getCell(4).style = boldCenterStyle;
    totalRow.getCell(5).style = boldCenterStyle;
    totalRow.getCell(6).style = boldCenterStyle;

    worksheet.addRow([]); // Spacer

    // --- TANDA TANGAN ---
    const startSigRow = worksheet.lastRow.number + 1;
    
    // Tempat Tanggal
    worksheet.mergeCells(`D${startSigRow}:F${startSigRow}`);
    const dateCell = worksheet.getCell(`D${startSigRow}`);
    dateCell.value = `Punggelan, ${getFormattedDate()}`;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { name: 'Arial', size: 11 };

    // Jabatan
    worksheet.mergeCells(`D${startSigRow + 1}:F${startSigRow + 1}`);
    const jabCell = worksheet.getCell(`D${startSigRow + 1}`);
    jabCell.value = exportConfig.jabatanPenandaTangan;
    jabCell.alignment = { horizontal: 'center' };
    jabCell.font = { name: 'Arial', size: 11 };

    // Spacer Tanda Tangan (4 Baris)
    
    // Nama Pejabat
    const nameRowIndex = startSigRow + 5;
    worksheet.mergeCells(`D${nameRowIndex}:F${nameRowIndex}`);
    const nameCell = worksheet.getCell(`D${nameRowIndex}`);
    nameCell.value = exportConfig.namaPenandaTangan;
    nameCell.alignment = { horizontal: 'center' };
    nameCell.font = { name: 'Arial', size: 11, bold: true, underline: true };

    // Pangkat
    const pangkatRowIndex = nameRowIndex + 1;
    worksheet.mergeCells(`D${pangkatRowIndex}:F${pangkatRowIndex}`);
    const pangkatCell = worksheet.getCell(`D${pangkatRowIndex}`);
    pangkatCell.value = exportConfig.pangkatPenandaTangan;
    pangkatCell.alignment = { horizontal: 'center' };
    pangkatCell.font = { name: 'Arial', size: 11 };

    // NIP
    const nipRowIndex = pangkatRowIndex + 1;
    worksheet.mergeCells(`D${nipRowIndex}:F${nipRowIndex}`);
    const nipCell = worksheet.getCell(`D${nipRowIndex}`);
    nipCell.value = `NIP. ${exportConfig.nipPenandaTangan}`;
    nipCell.alignment = { horizontal: 'center' };
    nipCell.font = { name: 'Arial', size: 11 };

    // --- ATUR LEBAR KOLOM ---
    worksheet.getColumn(1).width = 5;  // NO
    worksheet.getColumn(2).width = 25; // NAMA DESA
    worksheet.getColumn(3).width = 12; // RW
    worksheet.getColumn(4).width = 12; // RT
    worksheet.getColumn(5).width = 15; // DUSUN
    worksheet.getColumn(6).width = 15; // DUKUH

    // Simpan File
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Rekapitulasi_Data_RT_RW_Dusun_Kec_Punggelan_${currentYear}.xlsx`);
};