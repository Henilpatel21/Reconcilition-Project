const Papa = require('papaparse');
const XLSX = require('xlsx');

/**
 * Parse uploaded settlement file (CSV or Excel)
 * @param {Object} file - multer file object with buffer
 * @returns {Array<Object>} rows
 */
function parseSettlementFile(file) {
  if (!file || !file.buffer) return [];

  const name = (file.originalname || '').toLowerCase();
  const isCsv = name.endsWith('.csv') || (file.mimetype && file.mimetype.includes('csv'));

  if (isCsv) {
    const text = file.buffer.toString('utf8');
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    return parsed.data || [];
  }

  // Try Excel
  try {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: null });
    return json;
  } catch (err) {
    // fallback: try csv parse on buffer string
    const text = file.buffer.toString('utf8');
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    return parsed.data || [];
  }
}

module.exports = { parseSettlementFile };
