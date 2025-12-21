import fs from 'fs';
import path from 'path';

const routesFiles = [
  'src/modules/databases/databases.routes.js',
  'src/modules/incidents/incidents.routes.js',
  'src/modules/kb/kb.routes.js',
  'src/modules/files/files.routes.js',
  'src/modules/events/events.routes.js',
  'src/modules/users/users.routes.js',
  'src/modules/organizations/organizations.routes.js',
  'src/modules/properties/properties.routes.js',
  'src/modules/roles/roles.routes.js'
];

for (const file of routesFiles) {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipping ${file} - file not found`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if already has toObjectId import
  if (content.includes('toObjectId')) {
    console.log(`✅ ${file} - already has toObjectId`);
    continue;
  }
  
  // Add import if not present
  if (!content.includes("import { toObjectId } from '../../utils/mongodb.js'")) {
    const lines = content.split('\n');
    const firstImportIndex = lines.findIndex(line => line.startsWith('import '));
    
    if (firstImportIndex !== -1) {
      lines.splice(firstImportIndex + 1, 0, "import { toObjectId } from '../../utils/mongodb.js';");
      content = lines.join('\n');
      console.log(`📝 ${file} - added toObjectId import`);
    }
  }
  
  // Pattern to find route params that need conversion
  const patterns = [
    { param: 'databaseId', name: 'database' },
    { param: 'incidentId', name: 'incident' },
    { param: 'kbId', name: 'kb' },
    { param: 'fileId', name: 'file' },
    { param: 'eventId', name: 'event' },
    { param: 'userId', name: 'user' },
    { param: 'orgId', name: 'organization' },
    { param: 'propertyId', name: 'property' },
    { param: 'roleId', name: 'role' }
  ];
  
  let modified = false;
  
  for (const { param } of patterns) {
    // Add ObjectId conversion after params extraction
    const paramExtractPattern = new RegExp(
      `const \\{ ${param} \\} = request\\.params;\\n(?!\\s*const objectId = toObjectId\\(${param}\\);)`,
      'g'
    );
    
    const replacement = `const { ${param} } = request.params;\n    \n    const objectId = toObjectId(${param});\n    if (!objectId) {\n      return reply.status(400).send({ error: 'Invalid ID format' });\n    }\n`;
    
    if (paramExtractPattern.test(content)) {
      content = content.replace(paramExtractPattern, replacement);
      modified = true;
    }
    
    // Replace direct usage of param with objectId in MongoDB queries
    const queryPatterns = [
      new RegExp(`_id: ${param}([,\\s}])`, 'g'),
      new RegExp(`${param.replace('Id', '_id')}: ${param}([,\\s}])`, 'g')
    ];
    
    for (const pattern of queryPatterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, (match, suffix) => {
          return `_id: objectId${suffix}`;
        });
        modified = true;
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file} - fixed ObjectId conversions`);
  } else {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`ℹ️  ${file} - no changes needed`);
  }
}

console.log('\n✨ All files processed!');
