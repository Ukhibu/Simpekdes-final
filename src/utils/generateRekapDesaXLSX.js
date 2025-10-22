import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const generateRekapDesaXLSX = async (rts, rws, branding, bpdKetua) => {
  // Safety checks to prevent crashes if data is not ready
  const safeRts = Array.isArray(rts) ? rts : [];
  const safeRws = Array.isArray(rws) ? rws : [];
  const safeBranding = branding || {};
  const safeBpdKetua = bpdKetua || {};
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Simpekdes';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(`Rekapitulasi Desa ${safeBranding.namaDesa || 'Tanpa Nama'}`, {
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

  const title = `REKAP DATA RT, RW DAN DUSUN DESA ${safeBranding?.namaDesa?.toUpperCase() || ''}`;
  const yearTitle = `TAHUN ${new Date().getFullYear()}`;

  // === STYLING ===
  const fontBold = { name: 'Arial', size: 11, bold: true };
  const textCenter = { vertical: 'middle', horizontal: 'center' };
  const textLeft = { vertical: 'middle', horizontal: 'left' };
  const borderThin = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // === HEADER ===
  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { name: 'Arial', size: 12, bold: true };
  titleCell.alignment = textCenter;

  worksheet.mergeCells('A2:I2');
  const yearCell = worksheet.getCell('A2');
  yearCell.value = yearTitle;
  yearCell.font = fontBold;
  yearCell.alignment = textCenter;

  // === TABLE HEADER ===
  const headerRow = worksheet.getRow(4);
  headerRow.values = ['NO', 'DUSUN', 'RW', 'NAMA KETUA RW', 'RT', 'NAMA KETUA RT', 'NAMA SEKRETARIS', 'NAMA BENDAHARA', 'DUKUH'];
  headerRow.eachCell(cell => {
    cell.font = fontBold;
    cell.alignment = textCenter;
    cell.border = borderThin;
  });
  
  // === DATA PROCESSING & BODY ===
  const sortedRts = [...safeRts].sort((a, b) => {
    const dusunCompare = (a.dusun || '').localeCompare(b.dusun || '');
    if (dusunCompare !== 0) return dusunCompare;
    const rwCompare = (a.rw || '').localeCompare(b.rw || '');
    if (rwCompare !== 0) return rwCompare;
    return (a.rt || '').localeCompare(b.rt || '');
  });

  const startRowData = 5;
  sortedRts.forEach((rt, index) => {
    const rowNumber = startRowData + index;
    const rwData = safeRws.find(rw => rw.rw === rt.rw && rw.dusun === rt.dusun);
    const row = worksheet.getRow(rowNumber);
    row.values = [
      index + 1,
      rt.dusun || '',
      rt.rw || '',
      rwData?.nama || '',
      rt.rt || '',
      rt.nama || '',
      rt.sekretaris || '',
      rt.bendahara || '',
      rt.dukuh || ''
    ];

    row.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      if ([1, 2, 3, 5, 9].includes(colNumber)) {
        cell.alignment = textCenter;
      } else {
        cell.alignment = textLeft;
      }
    });
  });

  // === [FIXED] More Robust Vertical Merge Logic ===
  if (sortedRts.length > 1) {
    const mergeCols = [2, 3, 4]; // Columns B, C, D
    mergeCols.forEach(col => {
      let mergeStartRow = startRowData;
      for (let rowNum = startRowData; rowNum < startRowData + sortedRts.length; rowNum++) {
        // Check if the next row exists and if the cell value is different
        if ((rowNum + 1 < startRowData + sortedRts.length) && 
            (worksheet.getCell(rowNum, col).value !== worksheet.getCell(rowNum + 1, col).value)) {
          if (mergeStartRow < rowNum) {
            worksheet.mergeCells(mergeStartRow, col, rowNum, col);
          }
          mergeStartRow = rowNum + 1;
        }
      }
      // Merge the last group of cells
      if (mergeStartRow < startRowData + sortedRts.length) {
        worksheet.mergeCells(mergeStartRow, col, startRowData + sortedRts.length - 1, col);
      }
    });
  }

  // === TABLE FOOTER (JUMLAH) ===
  const totalRowNumber = startRowData + sortedRts.length;
  const totalRow = worksheet.getRow(totalRowNumber);
  worksheet.mergeCells(`A${totalRowNumber}:D${totalRowNumber}`);
  const jumlahCell = worksheet.getCell(`A${totalRowNumber}`);
  jumlahCell.value = 'JUMLAH';
  jumlahCell.font = fontBold;
  jumlahCell.alignment = textCenter;
  
  // Apply borders to merged "JUMLAH" cells
  for(let i = 1; i <= 9; i++) {
    totalRow.getCell(i).border = borderThin;
  }
  
  const totalDusun = [...new Set(safeRts.map(rt => rt.dusun).filter(Boolean))].length;
  const totalRw = safeRws.length;
  const totalRt = safeRts.length;
  const totalDukuh = [...new Set(safeRts.map(rt => rt.dukuh).filter(Boolean))].length;
  
  totalRow.getCell(2).value = totalDusun;
  totalRow.getCell(3).value = totalRw;
  totalRow.getCell(5).value = totalRt;
  totalRow.getCell(9).value = totalDukuh;

  [2,3,5,9].forEach(col => {
    totalRow.getCell(col).font = fontBold;
    totalRow.getCell(col).alignment = textCenter;
  });

  // === SIGNATORY BLOCK ===
  const signStartRow = totalRowNumber + 3;

  // BPD Block (Left)
  worksheet.getCell(`B${signStartRow}`).value = 'Mengetahui,';
  worksheet.getCell(`B${signStartRow + 1}`).value = 'Ketua BPD';
  worksheet.getCell(`B${signStartRow + 5}`).value = safeBpdKetua?.nama || '.........................................';
  worksheet.getCell(`B${signStartRow + 5}`).font = { ...fontBold, underline: true };

  // Kades Block (Right)
  worksheet.mergeCells(`F${signStartRow -1}:${'H'}${signStartRow-1}`);
  const dateCell = worksheet.getCell(`F${signStartRow -1}`);
  dateCell.value = `${safeBranding?.namaDesa || ''}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  dateCell.alignment = textCenter;
  
  worksheet.mergeCells(`F${signStartRow}:${'H'}${signStartRow}`);
  worksheet.getCell(`F${signStartRow}`).value = `Kepala Desa ${safeBranding?.namaDesa || ''}`;
  worksheet.getCell(`F${signStartRow}`).alignment = textCenter;

  worksheet.mergeCells(`F${signStartRow + 4}:${'H'}${signStartRow+4}`);
  const kadesNameCell = worksheet.getCell(`F${signStartRow + 4}`);
  kadesNameCell.value = safeBranding?.kepalaDesa || '.........................................';
  kadesNameCell.font = { ...fontBold, underline: true };
  kadesNameCell.alignment = textCenter;

  // === COLUMN WIDTHS ===
  worksheet.columns = [
    { key: 'no', width: 5 },
    { key: 'dusun', width: 15 },
    { key: 'rw', width: 5 },
    { key: 'namaKetuaRw', width: 20 },
    { key: 'rt', width: 5 },
    { key: 'namaKetuaRt', width: 20 },
    { key: 'sekretaris', width: 20 },
    { key: 'bendahara', width: 20 },
    { key: 'dukuh', width: 15 }
  ];

  // --- SAVE ---
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob(buffer), `Rekap RT RW Dusun Desa ${safeBranding.namaDesa || 'Tanpa Nama'} - ${new Date().getFullYear()}.xlsx`);
};

