const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'public', 'index.html');
const destinationPath = path.join(__dirname, '..', 'index.html');

try {
  const sourceHtml = fs.readFileSync(sourcePath, 'utf8');
  const transformed = sourceHtml
    .replace(/href="styles\.css"/g, 'href="./public/styles.css"')
    .replace(/src="app\.js"/g, 'src="./public/app.js"');

  fs.writeFileSync(destinationPath, transformed, 'utf8');
  console.log('Homepage synced to root index.html');
} catch (error) {
  console.error('Unable to sync homepage to root index.html');
  console.error(error);
  process.exitCode = 1;
}
