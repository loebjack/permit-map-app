const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, '../../../cache/co-intakes_page1.html');
const html = fs.readFileSync(htmlFile, 'utf8');

const $ = cheerio.load(html);

console.log('=== TABLE ANALYSIS ===\n');

// Find all tables
const tables = $('table');
console.log(`Found ${tables.length} table(s)\n`);

tables.each((idx, table) => {
  console.log(`--- Table ${idx + 1} ---`);
  
  // Get headers
  const headers = [];
  $(table).find('tr').first().find('th, td').each((i, el) => {
    const $el = $(el);
    const linkText = $el.find('a').text().trim();
    const text = linkText || $el.text().trim();
    if (text) headers.push(text);
  });
  
  console.log(`Headers (${headers.length}):`, headers.join(' | '));
  
  // Count data rows
  const dataRows = $(table).find('tr').length - 1; // subtract header row
  console.log(`Data rows: ${dataRows}\n`);
  
  // Show first data row
  if (dataRows > 0) {
    console.log('First data row:');
    const firstRow = $(table).find('tr').eq(1);
    const cells = firstRow.find('td');
    cells.each((i, cell) => {
      const text = $(cell).text().trim().substring(0, 50);
      console.log(`  [${i}] ${headers[i] || 'unknown'}: ${text}${text.length === 50 ? '...' : ''}`);
    });
  }
  
  console.log('\n');
});