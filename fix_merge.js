const fs = require('fs');
let content = fs.readFileSync('src/utils/archiveExport.ts', 'utf8');

const regex = /<<<<<<< Updated upstream[\s\S]*?=======\n([\s\S]*?)>>>>>>> Stashed changes/;
content = content.replace(regex, '$1');

fs.writeFileSync('src/utils/archiveExport.ts', content);
