import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * Menghasilkan PDF Laporan Program Kerja LPM
 * @param {Array} programs - Daftar program kerja
 * @param {String} desa - Nama desa
 * @param {String} ketuaName - Nama Ketua LPM (untuk tanda tangan)
 * @param {String} logoUrl - URL Logo (Base64 atau Link)
 */
export const generateLPMProgramPDF = (programs, desa, ketuaName, logoUrl = null) => {
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
  const currentYear = new Date().getFullYear();

  // --- KOP SURAT ---
  // Logo (Kiri Atas)
  if (logoUrl) {
      try {
          // Koordinat: x=20, y=10, ukuran 20x20 mm
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
  doc.text(`LEMBAGA PEMBERDAYAAN MASYARAKAT (LPM) DESA ${desa.toUpperCase()}`, 148.5, 30, { align: 'center' });
  
  // Garis Pembatas Kop
  doc.setLineWidth(0.5);
  doc.line(20, 36, 277, 36); 
  
  // --- JUDUL DOKUMEN ---
  doc.setFontSize(12);
  doc.text(`LAPORAN PROGRAM KERJA TAHUN ${currentYear}`, 148.5, 45, { align: 'center' });

  // --- TABEL DATA ---
  const tableColumn = [
    "No", 
    "Nama Program", 
    "Tujuan & Sasaran", 
    "Waktu & Lokasi", 
    "Anggaran", 
    "Sumber Dana", 
    "Realisasi", 
    "Penanggung Jawab"
  ];

  const tableRows = [];

  programs.forEach((program, index) => {
    const rowData = [
      index + 1,
      program.nama_program,
      `Tujuan: ${program.tujuan}\nSasaran: ${program.sasaran}`,
      `Waktu: ${program.waktu_pelaksanaan ? format(new Date(program.waktu_pelaksanaan), 'dd MMMM yyyy', { locale: id }) : '-'}\nLokasi: ${program.lokasi}`,
      program.anggaran ? `Rp ${parseInt(program.anggaran).toLocaleString('id-ID')}` : '-',
      program.sumber_dana || '-',
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
    // Pengaturan Lebar & Posisi Tabel (Rata Kanan Kiri)
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
      fillColor: [255, 255, 255], // Header Putih (Formal)
      textColor: [0, 0, 0],       // Teks Hitam
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.2,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 }, // No
      1: { fontStyle: 'bold', cellWidth: 40 }, // Nama Program
      2: { cellWidth: 50 }, // Tujuan
      3: { cellWidth: 40 }, // Waktu
      4: { halign: 'right', cellWidth: 30 }, // Anggaran
      5: { cellWidth: 25 }, // Sumber Dana
      6: { halign: 'center', cellWidth: 20 }, // Realisasi
      7: { cellWidth: 'auto' } // PJ (Sisa ruang)
    },
  });

  // --- TANDA TANGAN ---
  const finalY = doc.lastAutoTable.finalY + 20;
  
  // Cek jika halaman tidak cukup, buat halaman baru
  if (finalY > 170) {
    doc.addPage();
  }

  const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: id });

  // Posisi Kanan (Ketua LPM) - Koordinat X disesuaikan agar pas di kanan
  const rightX = 230; 
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${desa}, ${dateStr}`, rightX, finalY, { align: 'center' });
  doc.text(`Ketua LPM Desa ${desa}`, rightX, finalY + 7, { align: 'center' });
  
  // Nama Ketua (Bold)
  doc.setFont('helvetica', 'bold');
  doc.text(ketuaName || "( ..................................... )", rightX, finalY + 35, { align: 'center' });
  
  // NIP/NIAP Dihapus sesuai permintaan
  // Jika nama ketua kosong, beri keterangan kecil
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

  // Simpan PDF
  doc.save(`Laporan_Program_LPM_${desa}_${currentYear}.pdf`);
};