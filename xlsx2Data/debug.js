const XLSX = require('xlsx');
const excelFile = process.argv[2];

if (!excelFile) {
    console.error('Please provide Excel file path');
    process.exit(1);
}

const workbook = XLSX.readFile(excelFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet);
let columns

console.log('\n📋 Column names found in your Excel:');
console.log('----------------------------------------');
if (rows.length > 0) {
    columns = Object.keys(rows[0]);
    columns.forEach((col, i) => {
        console.log(`${i + 1}. "${col}"`);
    });
}
console.log('----------------------------------------');
console.log(`Total columns: ${columns.length}`);
console.log(`Total rows: ${rows.length}`);