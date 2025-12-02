import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { collection, query, where, getDocs } from 'firebase/firestore';

const formatDateIndo = (dateString) => {
    if (!dateString) return "";
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
    } catch (e) { return dateString; }
};

export const generateRwXLSX = async (dataList, db, exportConfig, currentUser) => {
    const validData = dataList.filter(item => item.desa);
    const uniqueDesa = [...new Set(validData.map(item => item.desa))];
    
    if (validData.length === 0) throw new Error("Tidak ada data valid.");
    if (uniqueDesa.length > 1) throw new Error("Gagal Ekspor: Harap filter 1 Desa.");

    const desaName = uniqueDesa[0];
    const currentYear = new Date().getFullYear();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Data RW ${desaName}`);

    // --- STYLES ---
    const fontBase = { name: 'Arial', size: 9 };
    const fontSmall = { name: 'Arial', size: 7 }; // Khusus Dusun
    const borderStyle = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: borderStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } };
    
    const centerStyle = { font: fontBase, alignment: { vertical: 'middle', horizontal: 'center' }, border: borderStyle };
    const leftStyle = { font: fontBase, alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }, border: borderStyle };
    const leftSmallStyle = { font: fontSmall, alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }, border: borderStyle };
    const totalStyle = { font: { name: 'Arial', size: 9, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' }, border: borderStyle, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } } };

    // --- PAGE SETUP ---
    worksheet.pageSetup = { orientation: 'landscape', paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }, fitToPage: true, printArea: 'A:S' };

    // --- JUDUL ---
    worksheet.mergeCells('A1:S1');
    worksheet.getCell('A1').value = `DATA RW DESA ${desaName.toUpperCase()}`;
    worksheet.getCell('A1').style = titleStyle;

    worksheet.mergeCells('A2:S2');
    worksheet.getCell('A2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('A2').style = titleStyle;
    worksheet.addRow([]);

    // --- HEADER ---
    const startRow = 4;
    const nextRow = 5;
    const headers1 = { A: "NO", B: "N A M A", C: "Jenis Kelamin", E: "JABATAN", F: "TEMPAT, TGL LAHIR", H: "PENDIDIKAN", P: "DUSUN", Q: "NO RW", R: "PRIODE", S: "No. HP / WA" };
    const headers2 = { C: "L", D: "P", F: "TEMPAT LAHIR", G: "TANGGAL LAHIR", H: "SD", I: "SLTP", J: "SLTA", K: "D1", L: "D2", M: "D3", N: "S1", O: "S2" };

    for (const [c, v] of Object.entries(headers1)) worksheet.getCell(`${c}${startRow}`).value = v;
    for (const [c, v] of Object.entries(headers2)) worksheet.getCell(`${c}${nextRow}`).value = v;

    ['A', 'B', 'E', 'P', 'Q', 'R', 'S'].forEach(c => worksheet.mergeCells(`${c}${startRow}:${c}${nextRow}`));
    worksheet.mergeCells(`C${startRow}:D${startRow}`);
    worksheet.mergeCells(`F${startRow}:G${startRow}`);
    worksheet.mergeCells(`H${startRow}:O${startRow}`);

    for (let r = startRow; r <= nextRow; r++) {
        worksheet.getRow(r).height = 25;
        for (let c = 1; c <= 19; c++) worksheet.getCell(r, c).style = headerStyle;
    }

    // --- SORTING ---
    // Urutkan RW (Asc) -> Dusun (Asc). Jabatan tidak perlu sort karena RW biasanya cuma Ketua.
    validData.sort((a, b) => {
        const rwA = parseInt(a.no_rw) || 0; const rwB = parseInt(b.no_rw) || 0;
        if (rwA !== rwB) return rwA - rwB;
        const dsnA = (a.dusun || '').toLowerCase(); const dsnB = (b.dusun || '').toLowerCase();
        return dsnA.localeCompare(dsnB);
    });

    // --- ISI DATA ---
    let firstDataRow = nextRow + 1;
    validData.forEach((item, i) => {
        const jkL = (item.jenis_kelamin || '').toLowerCase().includes('l') ? 1 : null;
        const jkP = (item.jenis_kelamin || '').toLowerCase().includes('p') ? 1 : null;
        const pend = (item.pendidikan || '').toUpperCase();

        const row = worksheet.addRow([
            i + 1, item.nama, jkL, jkP, item.jabatan, item.tempat_lahir, formatDateIndo(item.tanggal_lahir),
            pend === 'SD' ? 1 : null, pend === 'SLTP' ? 1 : null, pend === 'SLTA' ? 1 : null,
            pend === 'D1' ? 1 : null, pend === 'D2' ? 1 : null, pend === 'D3' ? 1 : null,
            pend === 'S1' ? 1 : null, pend === 'S2' ? 1 : null,
            item.dusun, item.no_rw, item.periode, item.no_hp
        ]);

        row.height = 20;
        for (let c = 1; c <= 19; c++) {
            if (c === 16) row.getCell(c).style = leftSmallStyle; // Dusun Font 7
            else if ([2, 5, 6].includes(c)) row.getCell(c).style = leftStyle;
            else row.getCell(c).style = centerStyle;
        }
    });

    let lastDataRow = worksheet.lastRow.number;

    // --- JUMLAH ---
    const jumlahRow = worksheet.addRow(['JUMLAH']);
    worksheet.mergeCells(`A${jumlahRow.number}:B${jumlahRow.number}`);
    
    // Sum L-P & Pendidikan
    [3,4, 8,9,10,11,12,13,14,15].forEach(c => {
        const colChar = worksheet.getColumn(c).letter;
        jumlahRow.getCell(c).value = { formula: `SUM(${colChar}${firstDataRow}:${colChar}${lastDataRow})` };
    });
    
    for(let c=1; c<=19; c++) jumlahRow.getCell(c).style = totalStyle;

    // --- JUMLAH TOTAL ---
    const totalRow = worksheet.addRow(['JUMLAH TOTAL']);
    worksheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
    
    worksheet.mergeCells(`C${totalRow.number}:D${totalRow.number}`);
    totalRow.getCell(3).value = { formula: `SUM(C${jumlahRow.number}:D${jumlahRow.number})` };
    
    worksheet.mergeCells(`H${totalRow.number}:O${totalRow.number}`);
    totalRow.getCell(8).value = { formula: `SUM(H${jumlahRow.number}:O${jumlahRow.number})` };

    for(let c=1; c<=19; c++) totalRow.getCell(c).style = totalStyle;
    [1,3,8].forEach(c => totalRow.getCell(c).style = totalStyle);

    worksheet.addRow([]);

    // --- TANDA TANGAN KADES ---
    const currentRow = worksheet.lastRow.number + 1;
    const dateNow = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    let namaKades = '(....................................)';

    try {
        const q = query(collection(db, 'perangkat'), where('desa', '==', desaName));
        const snapshot = await getDocs(q);
        const allPerangkat = snapshot.docs.map(d => d.data());
        const kades = allPerangkat.find(p => p.jabatan?.toLowerCase().includes('kepala desa'));
        if (kades && kades.nama) namaKades = kades.nama.toUpperCase();
        // Logic simpel permintaan user:
        // const kades = allPerangkat.find(p => p.desa === desa && p.jabatan?.toLowerCase().includes('kepala desa'));
        // Karena kita sudah query where desa, tidak perlu cek p.desa lagi di find, tapi aman saja.
    } catch (e) { console.error("Err Kades:", e); }

    const addSignatureBlock = (rowNum, { location, jabatan, nama }) => {
        const startCol = 'Q'; const endCol = 'S'; // Kanan
        worksheet.mergeCells(`${startCol}${rowNum}:${endCol}${rowNum}`);
        const l = worksheet.getCell(`${startCol}${rowNum}`);
        l.value = `${location}, ${dateNow}`; l.alignment = {horizontal:'center'}; l.font = {name:'Arial', size:11};

        worksheet.mergeCells(`${startCol}${rowNum+1}:${endCol}${rowNum+1}`);
        const j = worksheet.getCell(`${startCol}${rowNum+1}`);
        j.value = jabatan; j.alignment = {horizontal:'center'}; j.font = {name:'Arial', size:11};

        const nr = rowNum+5;
        worksheet.mergeCells(`${startCol}${nr}:${endCol}${nr}`);
        const n = worksheet.getCell(`${startCol}${nr}`);
        n.value = nama; n.alignment = {horizontal:'center'}; n.font = {name:'Arial', size:11, bold:true, underline:true};
    };

    addSignatureBlock(currentRow, { location: desaName, jabatan: 'Kepala Desa', nama: namaKades });

    // Widths
    const widths = [5, 25, 4,4, 18, 15,15, 4,4,4,4,4,4,4,4, 15, 8, 12, 15];
    widths.forEach((w, i) => worksheet.getColumn(i+1).width = w);

    const fileName = `Data_RW_${desaName.replace(/\s+/g, '_')}_${currentYear}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
};