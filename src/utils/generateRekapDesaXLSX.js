import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Helper to fetch Kepala Desa name from the database
const getNamaKepalaDesa = async (namaDesa) => {
    try {
        const q = query(
            collection(db, 'perangkat_desa'),
            where('desa', '==', namaDesa),
            where('jabatan', '==', 'Kepala Desa')
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data().nama.toUpperCase() || '________________';
        }
        return '________________';
    } catch (error) {
        console.error("Error fetching Kepala Desa:", error);
        return '________________';
    }
};

export const generateRekapDesaXLSX = async (data, namaDesa) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Rekap Desa ${namaDesa}`);
    const currentYear = new Date().getFullYear();

    // --- Style Definitions ---
    const titleStyle = { font: { name: 'Arial', size: 12, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
    const headerStyle = { font: { name: 'Arial', size: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
    const cellStyle = { font: { name: 'Arial', size: 9 }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'top', wrapText: true } };
    const centerCellStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' } };
    const signatureStyle = { font: { name: 'Arial', size: 10 }, alignment: { horizontal: 'center' } };

    // --- Page Setup ---
    worksheet.pageSetup = {
        orientation: 'portrait',
        fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        paperSize: 9, // A4
        margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6 },
        horizontalCentered: true,
    };

    // --- Main Title ---
    worksheet.mergeCells('A1:I1');
    worksheet.getCell('A1').value = `REKAP DATA RT RW DAN DUSUN DESA ${namaDesa.toUpperCase()}`;
    worksheet.getCell('A1').style = titleStyle;
    worksheet.mergeCells('A2:I2');
    worksheet.getCell('A2').value = `TAHUN ${currentYear}`;
    worksheet.getCell('A2').style = titleStyle;
    worksheet.addRow([]);

    // --- Table Header ---
    const headerRow = worksheet.addRow(['NO', 'DUSUN', 'RW', 'NAMA KETUA RW', 'RT', 'NAMA KETUA RT', 'NAMA SEKRETARIS', 'NAMA BENDAHARA', 'DUKUH']);
    headerRow.eachCell(cell => cell.style = headerStyle);
    headerRow.height = 30;

    // --- Data Rows ---
    data.forEach((item, index) => {
        const row = worksheet.addRow([
            index + 1,
            item.dusun,
            item.no_rw,
            item.namaKetuaRw,
            item.no_rt,
            item.Ketua,
            item.Sekretaris,
            item.Bendahara,
            item.dukuh,
        ]);
        row.getCell(1).style = centerCellStyle;
        row.getCell(2).style = cellStyle;
        row.getCell(3).style = centerCellStyle;
        row.getCell(4).style = cellStyle;
        row.getCell(5).style = centerCellStyle;
        row.getCell(6).style = cellStyle;
        row.getCell(7).style = cellStyle;
        row.getCell(8).style = cellStyle;
        row.getCell(9).style = cellStyle;
        row.height = 18;
    });

    // --- Signature Block ---
    const namaKades = await getNamaKepalaDesa(namaDesa);
    const sigRowStart = worksheet.lastRow.number + 3;
    worksheet.mergeCells(`F${sigRowStart}:I${sigRowStart}`);
    worksheet.getCell(`F${sigRowStart}`).value = `${namaDesa}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    worksheet.mergeCells(`F${sigRowStart + 1}:I${sigRowStart + 1}`);
    worksheet.getCell(`F${sigRowStart + 1}`).value = 'Kepala Desa';
    worksheet.mergeCells(`F${sigRowStart + 5}:I${sigRowStart + 5}`);
    const kadesCell = worksheet.getCell(`F${sigRowStart + 5}`);
    kadesCell.value = namaKades;
    kadesCell.font = { ...signatureStyle.font, bold: true, underline: true, name: 'Arial', size: 10 };

    for(let i of [0, 1, 5]) {
       worksheet.getCell(`F${sigRowStart + i}`).style = signatureStyle;
    }
    
    // --- Column Widths ---
    worksheet.columns = [ { width: 4 }, { width: 12 }, { width: 5 }, { width: 18 }, { width: 5 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 } ];

    // --- Write File ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Rekap_Detail_RT_RW_${namaDesa.replace(/\s/g, '_')}_${currentYear}.xlsx`);
};

