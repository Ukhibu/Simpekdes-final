import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, addYears } from 'date-fns';

// Helper untuk memformat tanggal dengan lebih andal
const formatDateSafe = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString.includes('-') ? dateString.replace(/-/g, '/') : dateString);
        if (isNaN(date.getTime())) return dateString;
        return format(date, 'dd-MM-yyyy');
    } catch (error) {
        return dateString;
    }
};

export const generatePerangkatPDF = async (groupedData, exportConfig) => {
    const doc = new jsPDF('landscape');
    let isFirstPage = true;

    for (const group of groupedData) {
        if (!isFirstPage) {
            doc.addPage();
        }

        const desaName = group.desa.toUpperCase();
        
        // --- Judul ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`DATA PERANGKAT DESA ${desaName} KECAMATAN PUNGGELAN`, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        doc.text(`TAHUN ${new Date().getFullYear()}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

        // --- Header Tabel ---
        const head = [
            [
                { content: 'NO', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'N A M A', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Jenis Kelamin', colSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'JABATAN', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'TEMPAT, TGL LAHIR', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'PENDIDIKAN', colSpan: 7, styles: { halign: 'center', valign: 'middle' } },
                { content: 'NO SK', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'TANGGAL SK', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'TANGGAL PELANTIKAN', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'AKHIR MASA JABATAN', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'N I K', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            ],
            [
                'L', 'P', 'SD', 'SLTP', 'SLTA', 'D1-D3', 'S1', 'S2', 'S3' // Diubah dari SMP ke SLTP
            ]
        ];

        // --- Kalkulasi Total dan Persiapan Body ---
        const totals = { L: 0, P: 0, SD: 0, SLTP: 0, SLTA: 0, D: 0, S1: 0, S2: 0, S3: 0 };
        const body = group.perangkat.map((p, i) => {
            // Update totals
            if (p.jenis_kelamin === 'L') totals.L++;
            if (p.jenis_kelamin === 'P') totals.P++;
            if (p.pendidikan === 'SD') totals.SD++;
            if (p.pendidikan === 'SMP' || p.pendidikan === 'SLTP') totals.SLTP++;
            if (p.pendidikan === 'SLTA') totals.SLTA++;
            if (['D1', 'D2', 'D3'].includes(p.pendidikan)) totals.D++;
            if (p.pendidikan === 'S1') totals.S1++;
            if (p.pendidikan === 'S2') totals.S2++;
            if (p.pendidikan === 'S3') totals.S3++;

            let akhirJabatan = formatDateSafe(p.akhir_jabatan);
            if (!akhirJabatan && p.tgl_lahir) {
                try {
                    const tglLahirDate = new Date(p.tgl_lahir.replace(/(\d{2})[-/](\d{2})[-/](\d{4})/, '$3-$2-$1'));
                    if (!isNaN(tglLahirDate.getTime())) {
                        akhirJabatan = formatDateSafe(addYears(tglLahirDate, 60));
                    }
                } catch (e) { /* Biarkan kosong */ }
            }

            const tempatTglLahir = `${p.tempat_lahir || ''}${p.tgl_lahir ? ', ' + formatDateSafe(p.tgl_lahir) : ''}`;

            return [
                i + 1,
                p.nama || '',
                p.jenis_kelamin === 'L' ? '1' : '',
                p.jenis_kelamin === 'P' ? '1' : '',
                p.jabatan || '',
                tempatTglLahir,
                p.pendidikan === 'SD' ? '1' : '',
                p.pendidikan === 'SMP' || p.pendidikan === 'SLTP' ? '1' : '',
                p.pendidikan === 'SLTA' ? '1' : '',
                ['D1', 'D2', 'D3'].includes(p.pendidikan) ? '1' : '',
                p.pendidikan === 'S1' ? '1' : '',
                p.pendidikan === 'S2' ? '1' : '',
                p.pendidikan === 'S3' ? '1' : '',
                p.no_sk || '',
                formatDateSafe(p.tgl_sk),
                formatDateSafe(p.tgl_pelantikan),
                akhirJabatan,
                p.nik || ''
            ];
        });

        // --- Baris Footer dengan Jumlah Total ---
        const foot = [
            [
                { content: 'JUMLAH', colSpan: 2, styles: { halign: 'center' } },
                totals.L,
                totals.P,
                '', // Jabatan
                '', // Tempat, Tgl Lahir
                totals.SD,
                totals.SLTP,
                totals.SLTA,
                totals.D,
                totals.S1,
                totals.S2,
                totals.S3,
                '', // NO SK
                '', // TANGGAL SK
                '', // TANGGAL PELANTIKAN
                '', // AKHIR MASA JABATAN
                '', // NIK
            ]
        ];

        autoTable(doc, {
            head: head,
            body: body,
            foot: foot,
            startY: 30,
            theme: 'grid',
            headStyles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8, fillColor: [211, 211, 211], textColor: [0,0,0] },
            footStyles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8, fillColor: [211, 211, 211], textColor: [0,0,0] },
            styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: 'auto' },
                2: { halign: 'center', cellWidth: 5 }, 3: { halign: 'center', cellWidth: 5 },
                4: { cellWidth: 20 }, 5: { cellWidth: 25 },
                6: { halign: 'center', cellWidth: 6 }, 7: { halign: 'center', cellWidth: 6 },
                8: { halign: 'center', cellWidth: 6 }, 9: { halign: 'center', cellWidth: 8 },
                10: { halign: 'center', cellWidth: 6 }, 11: { halign: 'center', cellWidth: 6 },
                12: { halign: 'center', cellWidth: 6 }, 13: { cellWidth: 20 },
                14: { halign: 'center', cellWidth: 15 }, 15: { halign: 'center', cellWidth: 15 },
                16: { halign: 'center', cellWidth: 15 }, 17: { cellWidth: 20 },
            },
            didDrawPage: (data) => {
                // --- Tanda Tangan ---
                const kades = group.perangkat.find(p => p.jabatan && p.jabatan.toLowerCase() === 'kepala desa');
                const kadesName = kades ? kades.nama.toUpperCase() : '(...........................................)';
                
                const finalY = doc.internal.pageSize.getHeight() - 35; // Position near bottom
                const pageWidth = doc.internal.pageSize.getWidth();
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');

                const textX = pageWidth - 80;
                
                doc.text(`Punggelan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, textX, finalY, { align: 'center' });
                doc.text(`Kepala Desa ${group.desa}`, textX, finalY + 7, { align: 'center' });
                
                doc.setFont('helvetica', 'bold');
                doc.text(kadesName, textX, finalY + 28, { align: 'center' });
            }
        });

        isFirstPage = false;
    }

    doc.save(`Data_Perangkat_Desa_${new Date().getFullYear()}.pdf`);
};

