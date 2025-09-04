import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, addYears } from 'date-fns';

// Helper untuk memformat tanggal (sudah bagus, kita pertahankan)
const formatDate = (dateString) => {
    try {
        if (!dateString) return '';
        const date = new Date(dateString.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
        if (isNaN(date.getTime())) return '';
        return format(date, 'dd/MM/yyyy');
    } catch (error) {
        return '';
    }
};

export const generatePerangkatXLSX = async (groupedData, exportConfig) => {
    const workbook = new ExcelJS.Workbook();

    // Style yang akan digunakan
    const titleStyle = {
        font: { name: 'Arial', size: 12, bold: true },
        alignment: { vertical: 'middle', horizontal: 'left' }
    };

    const headerStyle = {
        font: { name: 'Arial', size: 10, bold: true },
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
        border: {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        }
    };

    const cellStyle = {
        border: {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        },
        alignment: { vertical: 'middle', horizontal: 'left' }
    };
    
    const centerCellStyle = { ...cellStyle, alignment: { vertical: 'middle', horizontal: 'center' }};


    for (const [index, group] of groupedData.entries()) {
        const desaName = group.desa.toUpperCase();
        const sheetName = `${index + 1}. ${desaName.substring(0, 25)}`;
        const worksheet = workbook.addWorksheet(sheetName);

        // --- 1. Judul Utama ---
        worksheet.mergeCells('A1:S1');
        worksheet.getCell('A1').value = `DATA PERANGKAT DESA ${desaName} KECAMATAN PUNGGELAN`;
        worksheet.getCell('A1').style = titleStyle;

        worksheet.mergeCells('A2:S2');
        worksheet.getCell('A2').value = `TAHUN ${new Date().getFullYear()}`;
        worksheet.getCell('A2').style = titleStyle;

        // --- 2. Header Tabel Kompleks (Baris 4 & 5) ---
        worksheet.getRow(4).height = 30; // Atur tinggi baris
        worksheet.getRow(5).height = 30;
        
        // Menggabungkan sel header
        worksheet.mergeCells('A4:A5'); worksheet.getCell('A4').value = "NO";
        worksheet.mergeCells('B4:B5'); worksheet.getCell('B4').value = "N A M A";
        worksheet.mergeCells('C4:D4'); worksheet.getCell('C4').value = "Jenis Kelamin";
        worksheet.mergeCells('E4:E5'); worksheet.getCell('E4').value = "JABATAN";
        worksheet.mergeCells('F4:G4'); worksheet.getCell('F4').value = "TEMPAT, TGL LAHIR";
        worksheet.mergeCells('H4:N4'); worksheet.getCell('H4').value = "PENDIDIKAN";
        worksheet.mergeCells('O4:O5'); worksheet.getCell('O4').value = "NO SK";
        worksheet.mergeCells('P4:P5'); worksheet.getCell('P4').value = "TANGGAL SK";
        worksheet.mergeCells('Q4:Q5'); worksheet.getCell('Q4').value = "TANGGAL PELANTIKAN";
        worksheet.mergeCells('R4:R5'); worksheet.getCell('R4').value = "AKHIR MASA JABATAN";
        worksheet.mergeCells('S4:S5'); worksheet.getCell('S4').value = "No. HP / WA";
        worksheet.mergeCells('T4:T5'); worksheet.getCell('T4').value = "N I K";

        // Menambahkan style ke semua sel header yang digabung
        ['A4','B4','C4','E4','F4','H4','O4','P4','Q4','R4','S4','T4'].forEach(cell => {
             worksheet.getCell(cell).style = headerStyle;
        });
        
        // Sub-header di baris ke-5
        worksheet.getCell('C5').value = 'L';
        worksheet.getCell('D5').value = 'P';
        worksheet.getCell('H5').value = 'SD';
        worksheet.getCell('I5').value = 'SMP';
        worksheet.getCell('J5').value = 'SLTA';
        worksheet.getCell('K5').value = 'D1-D3';
        worksheet.getCell('L5').value = 'S1';
        worksheet.getCell('M5').value = 'S2';
        worksheet.getCell('N5').value = 'S3';

        // Memberi style pada sub-header dan sel kosong di bawah merge
        ['C5','D5','G5','H5','I5','J5','K5','L5','M5','N5'].forEach(key => {
            worksheet.getCell(key).style = headerStyle;
        });

        // --- 3. Isi Data Perangkat ---
        let currentRow = 6;
        group.perangkat.forEach((p, i) => {
            // Logika akhir jabatan (sudah bagus)
            let akhirJabatan = formatDate(p.akhir_jabatan);
            if (!akhirJabatan && p.tgl_lahir) {
                try {
                    const tglLahirDate = new Date(p.tgl_lahir.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
                    if (!isNaN(tglLahirDate.getTime())) {
                        akhirJabatan = format(addYears(tglLahirDate, 60), 'dd/MM/yyyy');
                    }
                } catch (e) { /* Biarkan kosong */ }
            }
            
            const rowData = [
                i + 1,
                p.nama || '',
                p.jenis_kelamin === 'L' ? '1' : null,
                p.jenis_kelamin === 'P' ? '1' : null,
                p.jabatan || '',
                p.tempat_lahir || '',
                formatDate(p.tgl_lahir), // Kolom tanggal lahir dipisah
                p.pendidikan === 'SD' ? '1' : null,
                p.pendidikan === 'SMP' ? '1' : null,
                p.pendidikan === 'SLTA' ? '1' : null,
                ['D1', 'D2', 'D3'].includes(p.pendidikan) ? '1' : null,
                p.pendidikan === 'S1' ? '1' : null,
                p.pendidikan === 'S2' ? '1' : null,
                p.pendidikan === 'S3' ? '1' : null,
                p.no_sk || '',
                formatDate(p.tgl_sk),
                formatDate(p.tgl_pelantikan),
                akhirJabatan,
                p.no_hp || '',
                p.nik || ''
            ];
            
            const row = worksheet.addRow(rowData);
            
            // Menerapkan style ke setiap sel di baris data
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if ([1, 3, 4, 8, 9, 10, 11, 12, 13, 14].includes(colNumber)) {
                     cell.style = centerCellStyle; // Perataan tengah untuk kolom tertentu
                } else {
                     cell.style = cellStyle;
                }
            });
            
            currentRow++;
        });

        // --- 4. Blok Tanda Tangan ---
        const signatureRowStart = currentRow + 3;
        const signatureCol = 'P'; // Kolom 'P' atau indeks 16

        const getFormattedDate = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        
        worksheet.getCell(`${signatureCol}${signatureRowStart}`).value = `Punggelan, ${getFormattedDate()}`;
        worksheet.getCell(`${signatureCol}${signatureRowStart + 1}`).value = exportConfig?.jabatanPenandaTangan || 'Camat Punggelan';
        worksheet.getCell(`${signatureCol}${signatureRowStart + 4}`).value = exportConfig?.namaPenandaTangan || 'NAMA CAMAT';
        worksheet.getCell(`${signatureCol}${signatureRowStart + 4}`).font = { bold: true, underline: true };
        worksheet.getCell(`${signatureCol}${signatureRowStart + 5}`).value = exportConfig?.pangkatPenandaTangan || 'Pangkat / Golongan';
        worksheet.getCell(`${signatureCol}${signatureRowStart + 6}`).value = `NIP. ${exportConfig?.nipPenandaTangan || 'XXXXXX'}`;

        // Atur alignment untuk blok tanda tangan
        for (let i = 0; i < 7; i++) {
            worksheet.getCell(`${signatureCol}${signatureRowStart + i}`).alignment = { horizontal: 'center' };
        }

        // --- 5. Mengatur Lebar Kolom ---
        worksheet.columns = [
            { width: 5 }, { width: 25 }, { width: 5 }, { width: 5 },
            { width: 20 }, { width: 15 }, { width: 15 }, { width: 5 },
            { width: 5 }, { width: 5 }, { width: 7 }, { width: 5 },
            { width: 5 }, { width: 5 }, { width: 20 }, { width: 15 },
            { width: 18 }, { width: 20 }, { width: 18 }, { width: 20 }
        ];
    }

    // --- 6. Menghasilkan File dan Memicu Download ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'Data_Perangkat_Desa.xlsx');
};