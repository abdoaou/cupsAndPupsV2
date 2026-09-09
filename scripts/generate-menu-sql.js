const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scripts/railway-menu.json', 'utf8'));

let sql = `-- Import Railway coffee menu into menu_items
BEGIN;
DELETE FROM menu_items WHERE "locationId" = (SELECT id FROM locations WHERE slug = 'main' LIMIT 1);

`;

data.forEach((item, i) => {
  const name = String(item.name).replace(/'/g, "''");
  const desc = item.description
    ? `'${String(item.description).replace(/'/g, "''")}'`
    : 'NULL';
  const pet = item.isPetFriendly ? 'true' : 'false';
  sql += `INSERT INTO menu_items (id, "locationId", name, description, category, price, "isPetFriendly", "isAvailable", "isDailySpecial", "sortOrder", "createdAt", "updatedAt") VALUES ('menu-rail-${i}', (SELECT id FROM locations WHERE slug='main' LIMIT 1), '${name}', ${desc}, '${item.category}'::"MenuCategory", ${Number(item.price)}, ${pet}, true, false, ${i}, NOW(), NOW());\n`;
});

sql += `COMMIT;
SELECT category, COUNT(*) FROM menu_items GROUP BY category ORDER BY category;
`;

fs.writeFileSync('scripts/import-railway-menu.sql', sql);
console.log('wrote', data.length, 'items');
