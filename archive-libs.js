const fs = require('fs');
const path = require('path');

const libDir = path.join(__dirname, 'lib');
const archiveDir = path.join(__dirname, 'lib.archive');

if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

// Files that heavily reference old Prisma models - archive them
const archive = [
  'cortex.ts',
  'brand-manager.ts',
  'browser-automate-core.ts',
  'reliability.ts',
  'swarm.ts',
  'agents.ts',
  'agent-router.ts',
  'telemetry.ts',
  'tools.ts',
];

archive.forEach(file => {
  const src = path.join(libDir, file);
  const dst = path.join(archiveDir, file);
  if (fs.existsSync(src)) {
    fs.renameSync(src, dst);
    console.log('Archived:', file);
  }
});

console.log('Done. Remaining:', fs.readdirSync(libDir).filter(f => f.endsWith('.ts')));