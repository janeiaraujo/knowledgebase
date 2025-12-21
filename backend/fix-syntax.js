import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = [
  'src/modules/databases/databases.routes.js',
  'src/modules/records/records.routes.js',
  'src/modules/incidents/incidents.routes.js',
  'src/modules/ai/ai.routes.js',
  'src/modules/billing/billing.routes.js'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix: preHandler: [...]]  ) } -> preHandler: [...] }
  content = content.replace(/(preHandler:\s*\[[^\]]+\])\s+\)\s*\}/g, '$1\n  }');
  
  // Fix: preHandler: [...] } }, async -> preHandler: [...] }, async
  content = content.replace(/(preHandler:\s*\[[^\]]+\])\s*\}\s*\},\s*async/g, '$1\n  }, async');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Fixed: ${file}`);
});

console.log('\n🎉 All files fixed!');

