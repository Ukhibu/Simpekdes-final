import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * Menghasilkan PDF Laporan Program Kerja Karang Taruna
 * @param {Array} programs - Daftar program kerja
 * @param {String} desa - Nama desa
 * @param {String} ketuaName - Nama Ketua Karang Taruna (untuk tanda tangan)
 * @param {String} logoUrl - URL Logo (Base64 atau Link)
 */
export const generateKarangTarunaProgramPDF = (programs, desa, ketuaName, logoUrl = null) => {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
  const currentYear = new Date().getFullYear();

  // --- KOP SURAT ---
  // Logo (Kiri Atas)
  if (logoUrl) {
      try {
          doc.addImage(logoUrl, 'PNG', 20, 10, 20, 20); 
      } catch (e) {
          console.warn("Gagal memuat logo:", e);
      }
  }

  // Teks Kop (Tengah)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`PEMERINTAH KABUPATEN BANJARNEGARA`, 148.5, 15, { align: 'center' });
  doc.text(`KECAMATAN PUNGGELAN`, 148.5, 22, { align: 'center' });
  doc.setFontSize(16);
  doc.text(`KARANG TARUNA DESA ${desa.toUpperCase()}`, 148.5, 30, { align: 'center' });
  
  // Garis Pembatas Kop
  doc.setLineWidth(0.5);
  doc.line(20, 36, 277, 36); 
  
  // --- JUDUL DOKUMEN ---
  doc.setFontSize(12);
  doc.text(`LAPORAN PROGRAM KERJA KARANG TARUNA TAHUN ${currentYear}`, 148.5, 45, { align: 'center' });

  // --- TABEL DATA ---
  const tableColumn = [
    "No", 
    "Nama Program", 
    "Bidang Kegiatan", 
    "Tujuan & Sasaran", 
    "Waktu & Lokasi", 
    "Anggaran", 
    "Realisasi", 
    "Pelaksana"
  ];

  const tableRows = [];

  programs.forEach((program, index) => {
    const rowData = [
      index + 1,
      program.nama_program,
      program.bidang || '-', // Kolom khusus Karang Taruna
      `Tujuan: ${program.tujuan}\nSasaran: ${program.sasaran}`,
      `Waktu: ${program.waktu_pelaksanaan ? format(new Date(program.waktu_pelaksanaan), 'dd MMMM yyyy', { locale: id }) : '-'}\nLokasi: ${program.lokasi}`,
      program.anggaran ? `Rp ${parseInt(program.anggaran).toLocaleString('id-ID')}` : '-',
      `${program.realisasi || 0}%`,
      program.penanggung_jawab || '-'
    ];
    tableRows.push(rowData);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 50,
    theme: 'grid',
    margin: { left: 20, right: 20 }, 
    styles: {
      fontSize: 9,
      cellPadding: 3,
      valign: 'middle',
      font: 'helvetica',
      overflow: 'linebreak',
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [255, 255, 255], // Putih Formal
      textColor: [0, 0, 0],       // Teks Hitam
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.2,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 45 },
      4: { cellWidth: 40 },
      5: { halign: 'right', cellWidth: 25 },
      6: { halign: 'center', cellWidth: 15 },
      7: { cellWidth: 'auto' }
    },
  });

  // --- TANDA TANGAN ---
  const finalY = doc.lastAutoTable.finalY + 20;
  if (finalY > 170) doc.addPage();

  const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: id });
  const rightX = 230; 
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${desa}, ${dateStr}`, rightX, finalY, { align: 'center' });
  doc.text(`Ketua Karang Taruna`, rightX, finalY + 7, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.text(ketuaName || "( ..................................... )", rightX, finalY + 35, { align: 'center' });
  
  if (!ketuaName) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text("(Data Ketua belum diinput)", rightX, finalY + 40, { align: 'center' });
  }

  // --- FOOTER ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Dicetak melalui Aplikasi SIMPEKDES pada ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(`Laporan_Program_KarangTaruna_${desa}_${currentYear}.pdf`);
};