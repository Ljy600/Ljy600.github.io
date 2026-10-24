const fs = require('fs');
const idx = fs.readFileSync('dist/index.html', 'utf8');
const i = idx.indexOf('site-footer');
console.log(JSON.stringify(idx.slice(i, i + 400)));
