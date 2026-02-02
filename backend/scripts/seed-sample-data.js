import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function seedData() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();

        // Get tenant and user
        const emailArg = process.argv.find(a => a.startsWith('--email='));
        const email = emailArg ? emailArg.split('=')[1] : null;

        let user = null;
        if (email) {
            user = await db.collection('users').findOne({ email });
            if (!user) {
                console.log(`❌ No user found with email: ${email}`);
                return;
            }
        } else {
            // Prefer demo user if present, otherwise fallback to first user
            user = await db.collection('users').findOne({ email: 'demo@incidentkb.com' });
            if (!user) {
                const users = await db.collection('users').find({}).limit(1).toArray();
                if (users.length === 0) {
                    console.log('❌ No users found. Please register first.');
                    return;
                }
                user = users[0];
            }
        }

        const tenantId = user.tenant_id;
        const userId = user._id;

        console.log(`📝 Creating sample data for tenant: ${tenantId}`);
        console.log(`👤 User: ${user.name} (${user.email})`);

        const existingCount = await db.collection('records').countDocuments({ tenant_id: tenantId });
        if (existingCount > 0) {
            console.log(`ℹ️ Tenant already has ${existingCount} record(s). Skipping sample KB insert.`);
            return;
        }

        // Create sample KBs
        const sampleKBs = [{
                tenant_id: tenantId,
                database_id: 'general',
                title: 'Como Reiniciar o Servidor de Aplicação',
                content_md: `# Como Reiniciar o Servidor de Aplicação

## Problema
O servidor de aplicação está travado ou não responde.

## Solução

### Passo 1: Verificar o Status
\`\`\`bash
systemctl status app-server
\`\`\`

### Passo 2: Reiniciar o Serviço
\`\`\`bash
sudo systemctl restart app-server
\`\`\`

### Passo 3: Verificar os Logs
\`\`\`bash
tail -f /var/log/app-server/error.log
\`\`\`

## Prevenção
- Configurar monitoramento automático
- Implementar health checks
- Ajustar timeouts conforme necessário`,
                properties: {},
                custom_properties: {
                    severity: { type: 'select', value: 'high' },
                    category: { type: 'select', value: 'infrastructure' }
                },
                status: 'published',
                version: 1,
                created_by: userId,
                created_at: new Date(),
                updated_at: new Date(),
                approved_by: userId,
                approved_at: new Date(),
                published_at: new Date()
            },
            {
                tenant_id: tenantId,
                database_id: 'general',
                title: 'Erro de Conexão com Banco de Dados',
                content_md: `# Erro de Conexão com Banco de Dados

## Sintomas
- Timeout ao tentar conectar
- Erro "Connection refused"
- Pool de conexões esgotado

## Diagnóstico

### 1. Verificar conectividade
\`\`\`bash
telnet db-server 5432
\`\`\`

### 2. Verificar credenciais
- Confirmar usuário e senha
- Verificar permissões do usuário
- Validar string de conexão

### 3. Verificar recursos
\`\`\`sql
SELECT * FROM pg_stat_activity;
\`\`\`

## Solução
1. Reiniciar pool de conexões
2. Aumentar limite de conexões se necessário
3. Otimizar queries lentas

## Contatos
- DBA: dba@empresa.com
- Suporte: suporte@empresa.com`,
                properties: {},
                custom_properties: {
                    severity: { type: 'select', value: 'critical' },
                    category: { type: 'select', value: 'database' }
                },
                status: 'published',
                version: 1,
                created_by: userId,
                created_at: new Date(Date.now() - 86400000), // 1 day ago
                updated_at: new Date(Date.now() - 86400000),
                approved_by: userId,
                approved_at: new Date(Date.now() - 86400000),
                published_at: new Date(Date.now() - 86400000)
            },
            {
                tenant_id: tenantId,
                database_id: 'general',
                title: 'Configurar SSL/TLS no Nginx',
                content_md: `# Configurar SSL/TLS no Nginx

## Objetivo
Configurar certificado SSL/TLS para habilitar HTTPS.

## Pré-requisitos
- Certificado SSL válido (Let's Encrypt ou comercial)
- Acesso root ao servidor
- Nginx instalado

## Configuração

### 1. Instalar Certbot (Let's Encrypt)
\`\`\`bash
sudo apt install certbot python3-certbot-nginx
\`\`\`

### 2. Obter Certificado
\`\`\`bash
sudo certbot --nginx -d example.com -d www.example.com
\`\`\`

### 3. Configurar Nginx
\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Resto da configuração...
}
\`\`\`

### 4. Testar e Recarregar
\`\`\`bash
sudo nginx -t
sudo systemctl reload nginx
\`\`\`

## Renovação Automática
O Certbot configura renovação automática via cron.`,
                properties: {},
                custom_properties: {
                    severity: { type: 'select', value: 'medium' },
                    category: { type: 'select', value: 'security' }
                },
                status: 'approved',
                version: 1,
                created_by: userId,
                created_at: new Date(Date.now() - 172800000), // 2 days ago
                updated_at: new Date(Date.now() - 172800000),
                approved_by: userId,
                approved_at: new Date(Date.now() - 86400000),
                published_at: null
            },
            {
                tenant_id: tenantId,
                database_id: 'general',
                title: 'Backup e Restore do PostgreSQL',
                content_md: `# Backup e Restore do PostgreSQL

## Backup Completo

### Comando básico
\`\`\`bash
pg_dump -U usuario -h localhost nome_db > backup.sql
\`\`\`

### Com compressão
\`\`\`bash
pg_dump -U usuario -h localhost -Fc nome_db > backup.dump
\`\`\`

### Backup de todas as databases
\`\`\`bash
pg_dumpall -U postgres > backup_all.sql
\`\`\`

## Restore

### De arquivo SQL
\`\`\`bash
psql -U usuario -h localhost nome_db < backup.sql
\`\`\`

### De arquivo comprimido
\`\`\`bash
pg_restore -U usuario -h localhost -d nome_db backup.dump
\`\`\`

## Automatização

### Script de backup diário
\`\`\`bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U postgres nome_db > /backups/db_$DATE.sql
# Manter apenas últimos 7 dias
find /backups -name "db_*.sql" -mtime +7 -delete
\`\`\`

### Cron (todos os dias às 2h)
\`\`\`
0 2 * * * /path/to/backup-script.sh
\`\`\``,
                properties: {},
                custom_properties: {
                    severity: { type: 'select', value: 'high' },
                    category: { type: 'select', value: 'database' }
                },
                status: 'in_review',
                version: 1,
                created_by: userId,
                created_at: new Date(Date.now() - 3600000), // 1 hour ago
                updated_at: new Date(Date.now() - 3600000),
                approved_by: null,
                approved_at: null,
                published_at: null
            },
            {
                tenant_id: tenantId,
                database_id: 'general',
                title: 'Monitoramento de Performance com New Relic',
                content_md: `# Monitoramento de Performance com New Relic

## Instalação

### Node.js
\`\`\`bash
npm install newrelic --save
\`\`\`

### Configuração
\`\`\`javascript
// newrelic.js
exports.config = {
  app_name: ['Minha Aplicação'],
  license_key: 'sua-chave-aqui',
  logging: {
    level: 'info'
  }
}
\`\`\`

### Inicializar
\`\`\`javascript
// Primeira linha do index.js
require('newrelic');
\`\`\`

## Métricas Importantes

### APM
- Response time
- Throughput
- Error rate
- Apdex score

### Infrastructure
- CPU usage
- Memory usage
- Disk I/O
- Network traffic

## Alertas Recomendados

1. **Error rate > 5%**
   - Criticidade: Alta
   - Notificar: Equipe de Dev

2. **Response time > 2s**
   - Criticidade: Média
   - Notificar: Equipe de Ops

3. **CPU > 80%**
   - Criticidade: Alta
   - Notificar: Equipe de Infra

## Dashboards
- Overview da aplicação
- Performance de APIs
- Errors e exceptions
- User satisfaction`,
                properties: {},
                custom_properties: {
                    severity: { type: 'select', value: 'medium' },
                    category: { type: 'select', value: 'monitoring' }
                },
                status: 'draft',
                version: 1,
                created_by: userId,
                created_at: new Date(),
                updated_at: new Date(),
                approved_by: null,
                approved_at: null,
                published_at: null
            }
        ];

        const result = await db.collection('records').insertMany(sampleKBs);
        console.log(`✅ Created ${result.insertedCount} sample KBs`);

        // Create versions
        const versions = sampleKBs.map((kb, index) => ({
            tenant_id: tenantId,
            record_id: Object.values(result.insertedIds)[index],
            version: 1,
            title: kb.title,
            content_md: kb.content_md,
            properties: kb.properties,
            custom_properties: kb.custom_properties,
            created_by: userId,
            created_at: kb.created_at
        }));

        await db.collection('record_versions').insertMany(versions);
        console.log(`✅ Created ${versions.length} versions`);

        console.log('\n🎉 Sample data created successfully!');
        console.log('\nSummary:');
        console.log(`- ${sampleKBs.filter(kb => kb.status === 'published').length} Published KBs`);
        console.log(`- ${sampleKBs.filter(kb => kb.status === 'approved').length} Approved KBs`);
        console.log(`- ${sampleKBs.filter(kb => kb.status === 'in_review').length} In Review KBs`);
        console.log(`- ${sampleKBs.filter(kb => kb.status === 'draft').length} Draft KBs`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

seedData();