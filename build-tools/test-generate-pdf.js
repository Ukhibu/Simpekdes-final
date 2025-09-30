// Headless PDF generation test for reportGenerators.generateDemografiPDF
// This script runs the exported generator function in Node by mocking
// window.jspdf and patching jsPDF.prototype.save to write a file.

const fs = require('fs');
const path = require('path');

// Try to require dependencies
let jsPDF;
try {
  ({ jsPDF } = require('jspdf'));
  require('jspdf-autotable');
} catch (err) {
  console.error('Please ensure dependencies "jspdf" and "jspdf-autotable" are installed.');
  console.error('Run: npm install jspdf jspdf-autotable');
  process.exit(1);
}

// Patch global window object so reportGenerators can access window.jspdf
global.window = global.window || {};
global.window.jspdf = { jsPDF };

// Mock browser alert used in the module
global.alert = (msg) => {
  console.warn('alert:', msg);
};

// Patch jsPDF.prototype.save so that when generatePDF calls doc.save(filename)
// we instead write the PDF bytes to disk in build/test-output.pdf
const outPath = path.resolve(__dirname, '..', 'build', 'test-output.pdf');
if (!jsPDF.prototype._patchedSave) {
  const originalSave = jsPDF.prototype.save;
  jsPDF.prototype.save = function (filename) {
    try {
      const arr = this.output('arraybuffer');
      fs.writeFileSync(outPath, Buffer.from(arr));
      console.log('PDF written to', outPath);
    } catch (err) {
      console.error('Failed to write PDF output:', err);
    }
    // keep original behavior silent in Node
    if (typeof originalSave === 'function') {
      try { /* no-op */ } catch (e) {}
    }
  };
  jsPDF.prototype._patchedSave = true;
}

  // Provide a minimal stub for autoTable if not present so the generator can run in Node
  if (typeof jsPDF.prototype.autoTable !== 'function') {
    jsPDF.prototype.autoTable = function (opts) {
      // Create a simple previous.finalY based on startY and number of rows
      const startY = (opts && opts.startY) ? opts.startY : 30;
      const rowCount = (opts && opts.body && Array.isArray(opts.body)) ? opts.body.length : 0;
      // approximate row height 7 units
      const approxTableHeight = rowCount * 7 + 20; // header + padding
      this.autoTable = this.autoTable || {};
      this.autoTable.previous = { finalY: startY + approxTableHeight };
      // For compatibility, also set number of pages to 1
      if (!this.internal) this.internal = {};
      if (!this.internal.getNumberOfPages) this.internal.getNumberOfPages = () => 1;
      return this.autoTable.previous;
    };
  }

// Import the generator module. Use require; the project file exports named functions.
const generatorPath = path.resolve(__dirname, '..', 'src', 'utils', 'reportGenerators.js');
let genModule;
try {
  genModule = require(generatorPath);
} catch (err) {
  console.error('Failed to import reportGenerators.js from', generatorPath);
  console.error(err);
  process.exit(1);
}

const { generateDemografiPDF } = genModule;
if (!generateDemografiPDF) {
  console.error('generateDemografiPDF not found in module exports.');
  process.exit(1);
}

// Build dummy data (short table to simulate "per-desa" case)
const data = [
  { nama: 'Budi', jabatan: 'RT', pendidikan: 'SMA', tgl_lahir: new Date(1990, 1, 1), desa: 'Punggelan' },
  { nama: 'Siti', jabatan: 'RW', pendidikan: 'S1', tgl_lahir: new Date(1995, 5, 10), desa: 'Punggelan' }
];

try {
  // Call with (data, desaFilter, exportConfig, title)
  generateDemografiPDF(data, 'Punggelan', {}, 'Test_Demografi');
} catch (err) {
  console.error('Error while generating PDF:', err);
  process.exit(1);
}
