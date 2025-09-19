import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './dateFormatter'; // Asumsi Anda punya formatter ini

export const generatePerangkatPDF = (groupedData, exportConfig) => {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
    });

    const tableFont = 'times'; // Font standar untuk dokumen resmi

    groupedData.forEach((group, index) => {
        if (index > 0) {
            doc.addPage();
        }

        // --- Judul Utama & Judul Desa ---
        doc.setFont(tableFont, 'bold');
        doc.setFontSize(12);
        doc.text(`DATA PERANGKAT DESA KECAMATAN PUNGGELAN`, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
        doc.setFontSize(11);
        doc.text(`TAHUN ${new Date().getFullYear()}`, doc.internal.pageSize.getWidth() / 2, 55, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFillColor(224, 224, 224); // Warna abu-abu untuk background judul desa
        doc.rect(40, 65, doc.internal.pageSize.getWidth() - 80, 20, 'F');
        doc.text(`DATA PERANGKAT DESA ${group.desa.toUpperCase()}`, doc.internal.pageSize.getWidth() / 2, 78, { align: 'center' });

        // --- Menyiapkan Data untuk Tabel ---
        const head = [
            [
                { content: 'NO', rowSpan: 2 },
                { content: 'N A M A', rowSpan: 2 },
                { content: 'Jenis Kelamin', colSpan: 2 },
                { content: 'JABATAN', rowSpan: 2 },
                { content: 'TEMPAT, TGL LAHIR', colSpan: 2 },
                { content: 'PENDIDIKAN', colSpan: 9 },
                { content: 'NO SK', rowSpan: 2 },
                { content: 'TANGGAL SK', rowSpan: 2 },
                { content: 'TANGGAL PELANTIKAN', rowSpan: 2 },
                { content: 'AKHIR MASA JABATAN', rowSpan: 2 },
            ],
            [
                'L', 'P', // Sub-header untuk Jenis Kelamin
                'TEMPAT LAHIR', 'TANGGAL LAHIR', // Sub-header untuk TTL
                'SD', 'SLTP', 'SLTA', 'D1', 'D2', 'D3', 'S1', 'S2', 'S3' // Sub-header untuk Pendidikan
            ]
        ];

        const body = group.perangkat.map((p, i) => [
            i + 1,
            p.nama || '',
            p.jenis_kelamin === 'L' ? 'V' : '',
            p.jenis_kelamin === 'P' ? 'V' : '',
            p.jabatan || '',
            p.tempat_lahir || '',
            p.tgl_lahir ? formatDate(p.tgl_lahir) : '',
            p.pendidikan === 'SD' ? 'V' : '',
            p.pendidikan === 'SLTP' || p.pendidikan === 'SMP' ? 'V' : '',
            p.pendidikan === 'SLTA' ? 'V' : '',
            p.pendidikan === 'D1' ? 'V' : '',
            p.pendidikan === 'D2' ? 'V' : '',
            p.pendidikan === 'D3' ? 'V' : '',
            p.pendidikan === 'S1' ? 'V' : '',
            p.pendidikan === 'S2' ? 'V' : '',
            p.pendidikan === 'S3' ? 'V' : '',
            p.no_sk || '',
            p.tgl_sk ? formatDate(p.tgl_sk) : '',
            p.tgl_pelantikan ? formatDate(p.tgl_pelantikan) : '',
            p.akhir_jabatan ? formatDate(p.akhir_jabatan) : '',
        ]);
        
        // --- Menghitung Jumlah ---
        const counts = { L: 0, P: 0, SD: 0, SLTP: 0, SLTA: 0, D1: 0, D2: 0, D3: 0, S1: 0, S2: 0, S3: 0 };
        group.perangkat.forEach(p => {
            if (p.jenis_kelamin === 'L') counts.L++;
            if (p.jenis_kelamin === 'P') counts.P++;
            const eduKey = p.pendidikan === 'SMP' ? 'SLTP' : p.pendidikan;
            if (counts.hasOwnProperty(eduKey)) counts[eduKey]++;
        });

        const foot = [
            [
                { content: 'JUMLAH', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: counts.L, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                { content: counts.P, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                '', '', '',
                { content: counts.SD, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                { content: counts.SLTP, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                { content: counts.SLTA, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                { content: counts.D1, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                { content: counts.D2, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                { content: counts.D3, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                { content: counts.S1, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                { content: counts.S2, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                { content: counts.S3, styles: { halign: 'center', fontStyle: 'bold', textColor: '#888888' } },
                '', '', '', ''
            ],
            [
                { content: 'JUMLAH TOTAL', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fillColor: [197, 224, 180] } },
                { content: counts.L + counts.P, colSpan: 5, styles: { halign: 'center', fontStyle: 'bold', fillColor: [197, 224, 180] } },
                { content: Object.values(counts).slice(2).reduce((a, b) => a + b, 0), colSpan: 9, styles: { halign: 'center', fontStyle: 'bold', fillColor: [197, 224, 180] } },
                { content: '', colSpan: 4, styles: { fillColor: [197, 224, 180], lineWidth: { top: 1, right: 1, bottom: 1, left: 1}, lineColor: 0 } }
            ]
        ];

        // --- PANGGILAN FUNGSI DIPERBAIKI ---
        autoTable(doc, {
            head: head,
            body: body,
            foot: foot,
            startY: 90,
            theme: 'grid',
            styles: {
                font: tableFont,
                fontSize: 7, // Ukuran font data kecil agar muat
                cellPadding: 3,
                valign: 'middle',
            },
            headStyles: {
                fontStyle: 'bold',
                halign: 'center',
                fillColor: [211, 211, 211], // Header abu-abu
                textColor: 0,
                fontSize: 8,
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 25 }, // NO
                1: { cellWidth: 90 }, // NAMA
                2: { halign: 'center', cellWidth: 20 }, // L
                3: { halign: 'center', cellWidth: 20 }, // P
                4: { cellWidth: 90 }, // JABATAN
                5: { cellWidth: 70 }, // TEMPAT LAHIR
                6: { cellWidth: 55 }, // TANGGAL LAHIR
                // Pendidikan
                7: { halign: 'center', cellWidth: 20 }, 8: { halign: 'center', cellWidth: 20 }, 9: { halign: 'center', cellWidth: 20 },
                10: { halign: 'center', cellWidth: 20 }, 11: { halign: 'center', cellWidth: 20 }, 12: { halign: 'center', cellWidth: 20 },
                13: { halign: 'center', cellWidth: 20 }, 14: { halign: 'center', cellWidth: 20 }, 15: { halign: 'center', cellWidth: 20 },
                16: { cellWidth: 90 }, // NO SK
                17: { cellWidth: 55 }, // TGL SK
                18: { cellWidth: 55 }, // TGL PELANTIKAN
                19: { cellWidth: 55 }, // AKHIR JABATAN
            },
            didDrawPage: function (data) {
                // --- Tambahkan Blok Tanda Tangan ---
                const finalY = data.cursor.y + 20;
                doc.setFontSize(9);
                doc.setFont(tableFont, 'normal');
                
                const sigX = doc.internal.pageSize.getWidth() - 250;
                doc.text(`Punggelan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, sigX, finalY, { align: 'left' });
                doc.text(exportConfig?.jabatanPenandaTangan || 'Camat Punggelan', sigX, finalY + 12, { align: 'left' });

                doc.setFont(tableFont, 'bold');
                doc.text(exportConfig?.namaPenandaTangan || '(...........................................)', sigX, finalY + 70, { align: 'left' });
                doc.setFont(tableFont, 'normal');
                doc.text(exportConfig?.pangkatPenandaTangan || 'Pangkat / Golongan', sigX, finalY + 82, { align: 'left' });
                doc.text(`NIP. ${exportConfig?.nipPenandaTangan || '...'}`, sigX, finalY + 94, { align: 'left' });
            }
        });
    });

    // --- Nama File Dinamis ---
    const fileName = groupedData.length > 1
        ? `Rekap_Perangkat_Desa_Kec_Punggelan_${new Date().getFullYear()}.pdf`
        : `Data_Perangkat_Desa_${groupedData[0]?.desa.replace(/\s/g, '_') || 'Export'}_${new Date().getFullYear()}.pdf`;
    
    doc.save(fileName);
};

