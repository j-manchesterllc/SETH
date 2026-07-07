const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'app/api');
const archiveDir = path.join(__dirname, 'app/api.archive');

if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

const keep = ['supabase-test', 'v1'];

fs.readdirSync(apiDir).forEach(dir => {
  if (dir === 'api.archive') return;
  if (keep.includes(dir)) return;
  const src = path.join(apiDir, dir);
  const dst = path.join(archiveDir, dir);
  if (fs.lstatSync(src).isDirectory()) {
    fs.renameSync(src, dst);
    console.log('Moved:', dir);
  }
});

console.log('Done. Remaining:', fs.readdirSync(apiDir));