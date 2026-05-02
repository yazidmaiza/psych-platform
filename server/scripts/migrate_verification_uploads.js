/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const serverRoot = path.resolve(__dirname, '..');
const fromDir = path.join(serverRoot, 'uploads', 'verification');
const toDir = path.join(serverRoot, 'private_uploads', 'verification');

const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
};

const removeDir = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) removeDir(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
};

if (!fs.existsSync(fromDir)) {
  console.log('No legacy verification uploads found at:', fromDir);
  process.exit(0);
}

if (fs.existsSync(toDir)) {
  console.error('Destination already exists:', toDir);
  console.error('Refusing to merge automatically. Move manually or delete destination and retry.');
  process.exit(1);
}

console.log('Migrating verification uploads...');
console.log('From:', fromDir);
console.log('To:  ', toDir);

copyDir(fromDir, toDir);
removeDir(fromDir);

console.log('Done.');

