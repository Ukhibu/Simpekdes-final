import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

// Helper to fetch Camat info from Firestore
const getCamatInfo = async () => {
    try {
        const docRef = doc(db, 'pengaturan', 'aplikasi');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().camat) {
            const { namaCamat, pangkatCamat, nipCamat } = docSnap.data().camat;
            return {
                nama: namaCamat || '________________',
                pangkat: pangkatCamat || '________________',
                nip: nipCamat ? `NIP. ${nipCamat}` : '________________'
            };
        }
        return { nama: '________________', pangkat: '________________', nip: '________________' };
    } catch (error) {
        console.error("Failed to fetch Camat info:", error);
        return { nama: '________________', pangkat: '________________', nip: '________________' };
    }
};

export const generateRekapKecamatanXLSX = async (data) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekapitulasi Kecamatan');
    const currentYear = new Date().getFullYear();

    // --- Style Definitions ---
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 11, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const cellStyle = { font: { name: 'Arial', size: 10 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle' } };
    const centerCellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' } };
    const totalRowStyle = { font: { name: 'Arial', size: 11, bold: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const signatureStyle = { font: { name: 'Arial', size: 11 }, alignment: { horizontal: 'center' } };

    // --- Page Setup ---
    worksheet.pageSetup = {
        orientation: 'portrait',
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        paperSize: 9, // A4
        margins: { left: 0.5, right: 0.5, top: 0.7, bottom: 0.7 },
        horizontalCentered: true,
    };

    // --- Main Title ---
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'REKAPITULASI DATA RT RW DAN DUSUN SE-KECAMATAN PUNGGELAN';
    worksheet.getCell('A1').style = titleStyle;
    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('A2').style = titleStyle;
    worksheet.addRow([]);

    // --- Table Header ---
    const headerRow = worksheet.addRow(['NO', 'NAMA DESA', 'JUMLAH RW', 'JUMLAH RT', 'JUMLAH DUSUN', 'JUMLAH DUKUH']);
    headerRow.eachCell(cell => cell.style = headerStyle);
    headerRow.height = 25;

    // --- Data Rows ---
    const firstDataRow = worksheet.lastRow.number + 1;
    data.forEach((item, index) => {
        const row = worksheet.addRow([
            index + 1,
            item.namaDesa,
            item.jumlahRw,
            item.jumlahRt,
            item.jumlahDusun,
            item.jumlahDukuh,
        ]);
        row.getCell(1).style = centerCellStyle;
        row.getCell(2).style = cellStyle;
        row.getCell(3).style = centerCellStyle;
        row.getCell(4).style = centerCellStyle;
        row.getCell(5).style = centerCellStyle;
        row.getCell(6).style = centerCellStyle;
    });
    const lastDataRow = worksheet.lastRow.number;
    
    // --- Total Row ---
    const totalRow = worksheet.addRow([]);
    worksheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
    totalRow.getCell('A').value = 'JUMLAH';
    totalRow.getCell('C').value = { formula: `SUM(C${firstDataRow}:C${lastDataRow})` };
    totalRow.getCell('D').value = { formula: `SUM(D${firstDataRow}:D${lastDataRow})` };
    totalRow.getCell('E').value = { formula: `SUM(E${firstDataRow}:E${lastDataRow})` };
    totalRow.getCell('F').value = { formula: `SUM(F${firstDataRow}:F${lastDataRow})` };
    totalRow.eachCell({ includeEmpty: true }, cell => cell.style = totalRowStyle);
    totalRow.height = 20;

    // --- Signature Block ---
    const camatInfo = await getCamatInfo();
    const sigRowStart = worksheet.lastRow.number + 3;
    worksheet.mergeCells(`D${sigRowStart}:F${sigRowStart}`);
    worksheet.getCell(`D${sigRowStart}`).value = `Punggelan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    worksheet.mergeCells(`D${sigRowStart + 1}:F${sigRowStart + 1}`);
    worksheet.getCell(`D${sigRowStart + 1}`).value = 'Camat Punggelan,';
    worksheet.mergeCells(`D${sigRowStart + 5}:F${sigRowStart + 5}`);
    worksheet.getCell(`D${sigRowStart + 5}`).value = camatInfo.nama;
    worksheet.mergeCells(`D${sigRowStart + 6}:F${sigRowStart + 6}`);
    worksheet.getCell(`D${sigRowStart + 6}`).value = camatInfo.pangkat;
    worksheet.mergeCells(`D${sigRowStart + 7}:F${sigRowStart + 7}`);
    worksheet.getCell(`D${sigRowStart + 7}`).value = camatInfo.nip;

    for (let i = 0; i < 8; i++) {
        const cell = worksheet.getCell(`D${sigRowStart + i}`);
        cell.style = signatureStyle;
        if(i === 5) cell.font = { ...signatureStyle.font, bold: true, underline: true, name: 'Arial', size: 11 };
    }

    // --- Column Widths ---
    worksheet.columns = [ { width: 5 }, { width: 25 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 }];

    // --- Write File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Rekapitulasi_Data_Pokok_Kecamatan_${currentYear}.xlsx`);
};

