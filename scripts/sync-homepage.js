const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'public', 'index.html');
const destinationPath = path.join(__dirname, '..', 'index.html');
const docsDir = path.join(__dirname, '..', 'docs');
const docsIndexPath = path.join(docsDir, 'index.html');
const docsPublicDir = path.join(docsDir, 'public');
const projectPlanSourceDir = path.join(__dirname, '..', 'project-plan');
const projectPlanDocsDir = path.join(docsDir, 'project-plan');

function copyDirectoryRecursive(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourceEntryPath = path.join(from, entry.name);
    const targetEntryPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourceEntryPath, targetEntryPath);
    } else {
      fs.copyFileSync(sourceEntryPath, targetEntryPath);
    }
  }
}

try {
  const sourceHtml = fs.readFileSync(sourcePath, 'utf8');
  const transformed = sourceHtml
    .replace(/href="styles\.css"/g, 'href="./public/styles.css"')
    .replace(/src="app\.js"/g, 'src="./public/app.js"');

  fs.writeFileSync(destinationPath, transformed, 'utf8');
  console.log('Homepage synced to root index.html');

  const docsTransformed = sourceHtml
    .replace(/href="styles\.css"/g, 'href="./public/styles.css"')
    .replace(/src="app\.js"/g, 'src="./public/app.js"');

  fs.writeFileSync(docsIndexPath, docsTransformed, 'utf8');
  copyDirectoryRecursive(path.join(__dirname, '..', 'public'), docsPublicDir);
  if (fs.existsSync(projectPlanSourceDir)) {
    copyDirectoryRecursive(projectPlanSourceDir, projectPlanDocsDir);
  }
  console.log('Homepage synced to docs/index.html with assets');
} catch (error) {
  console.error('Unable to sync homepage to root index.html');
  console.error(error);
  process.exitCode = 1;
}
