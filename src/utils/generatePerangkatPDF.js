import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePerangkatPDF = async (groupedData, exportConfig) => {
    const doc = new jsPDF('landscape');
    let isFirstPage = true;

    for (const [index, group] of groupedData.entries()) {
        if (!isFirstPage) {
            doc.addPage();
        }

        // Judul Dinamis per Desa
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const title = `DATA PERANGKAT DESA ${group.desa.toUpperCase()} (${String(index + 1).padStart(2, '0')})`;
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        doc.text(`TAHUN ${new Date().getFullYear()}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

        // --- PERUBAHAN: Menambahkan 'TANGGAL SK' ke header ---
        const head = [
            [
                { content: 'NO', rowSpan: 2 },
                { content: 'N A M A', rowSpan: 2 },
                { content: 'Jenis Kelamin', colSpan: 2 },
                { content: 'JABATAN', rowSpan: 2 },
                { content: 'TEMPAT, TGL LAHIR', rowSpan: 2 },
                { content: 'PENDIDIKAN', rowSpan: 2 },
                { content: 'NO SK', rowSpan: 2 },
                { content: 'TANGGAL SK', rowSpan: 2 }, // <-- DITAMBAHKAN
                { content: 'TANGGAL PELANTIKAN', rowSpan: 2 },
                { content: 'AKHIR MASA JABATAN', rowSpan: 2 },
                { content: 'N I K', rowSpan: 2 },
            ],
            [
                { content: 'L' },
                { content: 'P' },
            ]
        ];

        const body = group.perangkat.map((p, i) => {
            const tempatTglLahir = `${p.tempat_lahir || ''}, ${p.tgl_lahir ? new Date(p.tgl_lahir).toLocaleDateString('id-ID') : ''}`;
            // --- PERUBAHAN: Menambahkan data 'tgl_sk' ---
            return [
                i + 1,
                p.nama || '',
                p.jenis_kelamin === 'L' ? '1' : '',
                p.jenis_kelamin === 'P' ? '1' : '',
                p.jabatan || '',
                tempatTglLahir,
                p.pendidikan === 'SD' ? '1' : '',
                p.pendidikan === 'SMP' ? '1' : '',
                p.pendidikan === 'SLTA' ? '1' : '',
                ['D1', 'D2', 'D3'].includes(p.pendidikan) ? '1' : '',
                p.pendidikan === 'S1' ? '1' : '',
                p.pendidikan === 'S2' ? '1' : '',
                p.pendidikan === 'S3' ? '1' : '',
                p.no_sk || '',
                p.tgl_sk ? new Date(p.tgl_sk).toLocaleDateString('id-ID') : '', // <-- DITAMBAHKAN
                p.tgl_pelantikan ? new Date(p.tgl_pelantikan).toLocaleDateString('id-ID') : '',
                p.akhir_jabatan ? new Date(p.akhir_jabatan).toLocaleDateString('id-ID') : '',
                p.nik || ''
            ];
        });

        autoTable(doc, {
            head: head,
            body: body,
            startY: 30,
            theme: 'grid',
            headStyles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 1, valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 8 }, // NO
            },
        });

        // Tanda Tangan Kepala Desa dengan Tanggal Dinamis
        const finalY = doc.lastAutoTable.finalY + 15;
        const kades = group.perangkat.find(p => p.jabatan && p.jabatan.toLowerCase() === 'kepala desa');
        const kadesName = kades ? kades.nama.toUpperCase() : '(...........................................)';

        const getFormattedDate = () => {
            const date = new Date();
            const day = date.getDate();
            const month = date.toLocaleString('id-ID', { month: 'long' });
            const year = date.getFullYear();
            return `${day} ${month} ${year}`;
        };

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        doc.text(`${group.desa}, ${getFormattedDate()}`, doc.internal.pageSize.getWidth() - 60, finalY, { align: 'center' });
        doc.text(`Mengetahui,`, doc.internal.pageSize.getWidth() - 60, finalY + 7, { align: 'center' });
        doc.text(`Kepala Desa ${group.desa}`, doc.internal.pageSize.getWidth() - 60, finalY + 12, { align: 'center' });
        
        doc.setFont('helvetica', 'bold');
        doc.text(kadesName, doc.internal.pageSize.getWidth() - 60, finalY + 32, { align: 'center' });

        isFirstPage = false;
    }

    doc.save(`Data_perangkat_desa.pdf`);
};
