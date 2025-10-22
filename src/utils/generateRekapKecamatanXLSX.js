import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const generateRekapKecamatanXLSX = async (allDesa, allRw, allRt, branding, camatData) => {
  // Safety checks to prevent crashes if data is not ready
  const safeAllDesa = Array.isArray(allDesa) ? allDesa : [];
  const safeAllRw = Array.isArray(allRw) ? allRw : [];
  const safeAllRt = Array.isArray(allRt) ? allRt : [];
  const safeBranding = branding || {};
  const safeCamatData = camatData || {};

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Simpekdes';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Rekapitulasi Kecamatan', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      margins: {
        top: 0.5, left: 0.5, bottom: 0.5, right: 0.5
      },
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    }
  });

  // [FIXED] Dynamic title and filename based on filtering
  const reportScope = safeAllDesa.length === 1 
    ? `DESA ${safeAllDesa[0].nama.toUpperCase()}` 
    : `SE-KECAMATAN ${safeBranding?.kecamatan?.toUpperCase() || ''}`;
  const title = `REKAPITULASI DATA RT, RW DAN DUSUN ${reportScope}`;
  const yearTitle = `TAHUN ${new Date().getFullYear()}`;

  // === STYLING ===
  const fontBold = { name: 'Arial', size: 11, bold: true };
  const textCenter = { vertical: 'middle', horizontal: 'center' };
  const borderThin = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // === HEADER ===
  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { name: 'Arial', size: 12, bold: true };
  titleCell.alignment = textCenter;

  worksheet.mergeCells('A2:F2');
  const yearCell = worksheet.getCell('A2');
  yearCell.value = yearTitle;
  yearCell.font = fontBold;
  yearCell.alignment = textCenter;

  worksheet.getRow(4).values = ['NO', 'NAMA DESA', 'JUMLAH RW', 'JUMLAH RT', 'JUMLAH DUSUN', 'JUMLAH DUKUH'];
  worksheet.getRow(5).values = ['1', '2', '3', '4', '5', '6'];

  // Style header table
  ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'A5', 'B5', 'C5', 'D5', 'E5', 'F5'].forEach(cell => {
    worksheet.getCell(cell).font = fontBold;
    worksheet.getCell(cell).alignment = textCenter;
    worksheet.getCell(cell).border = borderThin;
  });

  // === DATA PROCESSING ===
  const reportData = safeAllDesa.map((desa, index) => {
    const rwsInDesa = safeAllRw.filter(rw => rw.desa === desa.nama);
    const rtsInDesa = safeAllRt.filter(rt => rt.desa === desa.nama);
    const dusunsInDesa = [...new Set(rtsInDesa.map(rt => rt.dusun).filter(Boolean))];
    const dukuhsInDesa = [...new Set(rtsInDesa.map(rt => rt.dukuh).filter(Boolean))];
    return {
      no: index + 1,
      namaDesa: desa.nama,
      jumlahRw: rwsInDesa.length,
      jumlahRt: rtsInDesa.length,
      jumlahDusun: dusunsInDesa.length,
      jumlahDukuh: dukuhsInDesa.length
    };
  });

  // === TABLE BODY ===
  const startRowData = 6;
  reportData.forEach((data, index) => {
    const row = worksheet.getRow(startRowData + index);
    row.values = [
      data.no,
      data.namaDesa,
      data.jumlahRw > 0 ? data.jumlahRw : '',
      data.jumlahRt > 0 ? data.jumlahRt : '',
      data.jumlahDusun > 0 ? data.jumlahDusun : '',
      data.jumlahDukuh > 0 ? data.jumlahDukuh : ''
    ];
    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      if (colNumber === 1 || colNumber >= 3) {
        cell.alignment = textCenter;
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // === TABLE FOOTER (JUMLAH) ===
  const totalRowNumber = startRowData + reportData.length;
  const totalRow = worksheet.getRow(totalRowNumber);
  worksheet.mergeCells(`A${totalRowNumber}:B${totalRowNumber}`);
  const jumlahCell = worksheet.getCell(`A${totalRowNumber}`);
  jumlahCell.value = 'JUMLAH';
  jumlahCell.font = fontBold;
  jumlahCell.alignment = textCenter;
  jumlahCell.border = borderThin;
  worksheet.getCell(`B${totalRowNumber}`).border = borderThin; // Right border for merged cell

  const formulaCells = ['C', 'D', 'E', 'F'];
  formulaCells.forEach(col => {
    const cell = worksheet.getCell(`${col}${totalRowNumber}`);
    // [FIXED] Handle SUM formula for empty data
    if (reportData.length > 0) {
      cell.value = { formula: `SUM(${col}${startRowData}:${col}${totalRowNumber - 1})` };
    } else {
      cell.value = 0; // If no data, the sum is 0
    }
    cell.font = fontBold;
    cell.alignment = textCenter;
    cell.border = borderThin;
  });

  // === SIGNATORY BLOCK ===
  const signStartRow = totalRowNumber + 3;
  worksheet.mergeCells(`D${signStartRow}:F${signStartRow}`);
  const dateCell = worksheet.getCell(`D${signStartRow}`);
  dateCell.value = `${safeBranding?.kecamatan || 'Punggelan'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  dateCell.alignment = textCenter;
  
  worksheet.mergeCells(`D${signStartRow + 1}:F${signStartRow + 1}`);
  const camatTitleCell = worksheet.getCell(`D${signStartRow + 1}`);
  camatTitleCell.value = `Camat ${safeBranding?.kecamatan || 'Punggelan'}`;
  camatTitleCell.alignment = textCenter;

  worksheet.mergeCells(`D${signStartRow + 5}:F${signStartRow + 5}`);
  const camatNameCell = worksheet.getCell(`D${signStartRow + 5}`);
  camatNameCell.value = safeCamatData?.namaLengkap || '.........................................';
  camatNameCell.font = { ...fontBold, underline: true };
  camatNameCell.alignment = textCenter;
  
  worksheet.mergeCells(`D${signStartRow + 6}:F${signStartRow + 6}`);
  const camatPangkatCell = worksheet.getCell(`D${signStartRow + 6}`);
  camatPangkatCell.value = safeCamatData?.pangkat || '.........................................';
  camatPangkatCell.alignment = textCenter;

  worksheet.mergeCells(`D${signStartRow + 7}:F${signStartRow + 7}`);
  const camatNipCell = worksheet.getCell(`D${signStartRow + 7}`);
  camatNipCell.value = `NIP. ${safeCamatData?.nip || '.........................................'}`;
  camatNipCell.alignment = textCenter;

  // === COLUMN WIDTHS ===
  worksheet.columns = [
    { key: 'no', width: 5 },
    { key: 'namaDesa', width: 25 },
    { key: 'jumlahRw', width: 15 },
    { key: 'jumlahRt', width: 15 },
    { key: 'jumlahDusun', width: 15 },
    { key: 'jumlahDukuh', width: 15 }
  ];

  // --- SAVE ---
  const filenameScope = safeAllDesa.length === 1 ? safeAllDesa[0].nama : `Kecamatan ${safeBranding?.kecamatan || ''}`;
  const filename = `Rekapitulasi RT RW Dusun ${filenameScope} - ${new Date().getFullYear()}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob(buffer), filename);
};

