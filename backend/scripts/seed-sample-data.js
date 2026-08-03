import { MongoClient } from 'mongodb';
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
        } else {

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

        } // fim do bloco "sem KBs ainda"

        // ==================== INCIDENTES E EVENTOS DE TESTE ====================
        // Independente de ja existirem KBs - cobre os tres estados do lifecycle
        // (aberto / reconhecido / resolvido), um incidente aberto automaticamente
        // a partir de evento (como o /api/events/ingest faria de verdade), um
        // incidente com KB vinculado, e alguns eventos ainda nao convertidos.

        const existingIncidents = await db.collection('incidents').countDocuments({ tenant_id: tenantId });
        if (existingIncidents > 0) {
            console.log(`ℹ️ Tenant already has ${existingIncidents} incident(s). Skipping sample incidents.`);
        } else {
            const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);

            // --- Evento que sera convertido automaticamente num incidente critico ---
            const criticalEvent = {
                tenant_id: tenantId,
                event_hash: 'seed-cpu-critico',
                source: 'zabbix',
                event_type: 'trigger',
                severity: 'critical',
                title: 'CPU acima de 95% no servidor de banco (srv-db-01)',
                description: 'Trigger "CPU load is too high" disparado por 3 checagens consecutivas.',
                timestamp: hoursAgo(1),
                metadata: { host: 'srv-db-01', trigger_id: 'seed-001' },
                occurrence_count: 3,
                last_occurrence: hoursAgo(1),
                created_at: hoursAgo(1),
                related_incidents: [],
                related_kbs: []
            };
            const criticalEventResult = await db.collection('events').insertOne(criticalEvent);
            criticalEvent._id = criticalEventResult.insertedId;

            // --- Eventos ainda nao convertidos (populam a tela de Eventos) ---
            const looseEvents = [
                {
                    tenant_id: tenantId,
                    event_hash: 'seed-disco-85',
                    source: 'zabbix',
                    event_type: 'trigger',
                    severity: 'medium',
                    title: 'Disco em 85% de uso em srv-app-02',
                    description: 'Particao /var atingiu 85% de uso.',
                    timestamp: hoursAgo(6),
                    metadata: { host: 'srv-app-02', partition: '/var' },
                    occurrence_count: 1,
                    last_occurrence: hoursAgo(6),
                    created_at: hoursAgo(6),
                    related_incidents: [],
                    related_kbs: []
                },
                {
                    tenant_id: tenantId,
                    event_hash: 'seed-5xx-checkout',
                    source: 'datadog',
                    event_type: 'metric_alert',
                    severity: 'high',
                    title: 'Taxa de erro 5xx acima do threshold em /checkout',
                    description: 'Error rate de 8% nos ultimos 5 minutos (threshold: 2%).',
                    timestamp: hoursAgo(2),
                    metadata: { endpoint: '/checkout', error_rate: '8%' },
                    occurrence_count: 1,
                    last_occurrence: hoursAgo(2),
                    created_at: hoursAgo(2),
                    related_incidents: [],
                    related_kbs: []
                },
                {
                    tenant_id: tenantId,
                    event_hash: 'seed-redis-timeout',
                    source: 'grafana',
                    event_type: 'alert',
                    severity: 'medium',
                    title: 'Timeout de conexão com Redis',
                    description: 'Connection pool esgotado, timeouts intermitentes.',
                    timestamp: hoursAgo(0.5),
                    metadata: { service: 'cache-redis' },
                    occurrence_count: 4,
                    last_occurrence: hoursAgo(0.2),
                    created_at: hoursAgo(4),
                    related_incidents: [],
                    related_kbs: []
                }
            ];
            await db.collection('events').insertMany(looseEvents);

            // --- Incidentes cobrindo os tres estados + origem manual/automatica ---
            const openIncident = {
                tenant_id: tenantId,
                title: 'Lentidão no carregamento do dashboard',
                description: 'Usuários reportando dashboard demorando mais de 10s para carregar.',
                severity: 'medium',
                affected_services: ['Dashboard', 'API'],
                status: 'open',
                created_by: userId,
                created_via: 'manual',
                created_at: hoursAgo(2),
                updated_at: hoursAgo(2),
                acknowledged_at: null,
                acknowledged_by: null,
                resolved_at: null,
                related_kb_ids: [],
                timeline: [
                    { action: 'created', user_id: userId, timestamp: hoursAgo(2), note: 'Incidente criado' }
                ]
            };

            const acknowledgedIncident = {
                tenant_id: tenantId,
                title: 'Fila de emails travada no worker',
                description: 'Emails transacionais (magic link, notificações) não estão sendo entregues desde as 14h.',
                severity: 'high',
                affected_services: ['Worker de emails', 'SMTP'],
                status: 'acknowledged',
                created_by: userId,
                created_via: 'manual',
                created_at: hoursAgo(5),
                updated_at: hoursAgo(3),
                acknowledged_at: hoursAgo(3),
                acknowledged_by: userId,
                resolved_at: null,
                related_kb_ids: [],
                timeline: [
                    { action: 'created', user_id: userId, timestamp: hoursAgo(5), note: 'Incidente criado' },
                    { action: 'status_acknowledged', user_id: userId, timestamp: hoursAgo(3), note: 'Incidente reconhecido - notificações pausadas enquanto está em tratamento' }
                ]
            };

            const resolvedIncident = {
                tenant_id: tenantId,
                title: 'Certificado SSL expirando em 3 dias',
                description: 'Alerta de expiração próxima do certificado de app.exemplo.com.',
                severity: 'low',
                affected_services: ['Nginx'],
                status: 'resolved',
                created_by: userId,
                created_via: 'manual',
                created_at: hoursAgo(30),
                updated_at: hoursAgo(28),
                acknowledged_at: hoursAgo(29),
                acknowledged_by: userId,
                resolved_at: hoursAgo(28),
                related_kb_ids: [],
                timeline: [
                    { action: 'created', user_id: userId, timestamp: hoursAgo(30), note: 'Incidente criado' },
                    { action: 'status_acknowledged', user_id: userId, timestamp: hoursAgo(29), note: 'Incidente reconhecido - notificações pausadas enquanto está em tratamento' },
                    { action: 'status_resolved', user_id: userId, timestamp: hoursAgo(28), note: 'Certificado renovado via Certbot' }
                ]
            };

            const autoIncident = {
                tenant_id: tenantId,
                title: criticalEvent.title,
                description: `Aberto automaticamente a partir de evento de ${criticalEvent.source} (severidade ${criticalEvent.severity})`,
                severity: 'critical',
                affected_services: ['Banco de Dados'],
                status: 'open',
                created_by: null,
                created_via: 'auto_ingest',
                created_at: hoursAgo(1),
                updated_at: hoursAgo(1),
                acknowledged_at: null,
                acknowledged_by: null,
                resolved_at: null,
                related_kb_ids: [],
                source_event_id: criticalEvent._id,
                timeline: [
                    { action: 'created_from_event', user_id: null, timestamp: hoursAgo(1), note: `Aberto automaticamente a partir de evento de ${criticalEvent.source} (severidade ${criticalEvent.severity})` }
                ]
            };

            const resolvedWithKbIncident = {
                tenant_id: tenantId,
                title: 'Vazamento de memória na API principal causou timeout em cascata',
                description: 'Pods da API reiniciando em loop por OOMKilled, derrubando o timeout de downstream services.',
                severity: 'critical',
                affected_services: ['API principal', 'Gateway'],
                status: 'resolved',
                created_by: userId,
                created_via: 'manual',
                created_at: hoursAgo(50),
                updated_at: hoursAgo(46),
                acknowledged_at: hoursAgo(49),
                acknowledged_by: userId,
                resolved_at: hoursAgo(47),
                related_kb_ids: [],
                timeline: [
                    { action: 'created', user_id: userId, timestamp: hoursAgo(50), note: 'Incidente criado' },
                    { action: 'status_acknowledged', user_id: userId, timestamp: hoursAgo(49), note: 'Incidente reconhecido - notificações pausadas enquanto está em tratamento' },
                    { action: 'status_resolved', user_id: userId, timestamp: hoursAgo(47), note: 'Deploy com correção de memory leak em cache local' },
                    { action: 'kb_created', user_id: userId, timestamp: hoursAgo(46), note: 'KB gerado a partir deste incidente via Captura Rápida' }
                ]
            };

            const incidentsResult = await db.collection('incidents').insertMany([
                openIncident,
                acknowledgedIncident,
                resolvedIncident,
                autoIncident,
                resolvedWithKbIncident
            ]);
            const insertedIncidentIds = Object.values(incidentsResult.insertedIds);
            const resolvedWithKbIncidentId = insertedIncidentIds[4];
            const autoIncidentId = insertedIncidentIds[3];

            // Liga o evento critico de volta ao incidente que ele gerou
            await db.collection('events').updateOne(
                { _id: criticalEvent._id },
                { $push: { related_incidents: autoIncidentId } }
            );

            // KB vinculado ao incidente resolvido, simulando o resultado de
            // "Criar KB a partir deste incidente" (Captura Rápida) na tela.
            const linkedKbResult = await db.collection('records').insertOne({
                tenant_id: tenantId,
                database_id: 'general',
                title: 'Vazamento de memória na API principal: diagnóstico e correção',
                content_md: `# Vazamento de memória na API principal: diagnóstico e correção

## Resumo
Pods da API reiniciando em loop por OOMKilled, causando timeout em cascata nos serviços downstream.

## Sintomas
- Pods da API em CrashLoopBackOff
- Timeouts intermitentes no Gateway
- Uso de memória subindo linearmente até o limite do container

## Causa Raiz
Cache local sem TTL acumulando objetos sem liberação, esgotando a memória do pod.

## Solução
1. Adicionar TTL ao cache local
2. Ajustar limites de memória do deployment
3. Adicionar alerta de uso de memória > 80%

## Prevenção
Revisar todos os caches locais do serviço para garantir TTL/limite de tamanho configurado.

---
*Artigo gerado a partir do incidente "Vazamento de memória na API principal causou timeout em cascata"*`,
                status: 'draft',
                version: 1,
                created_by: userId,
                created_at: hoursAgo(46),
                updated_at: hoursAgo(46),
                deleted_at: null,
                category_id: null,
                incident_id: resolvedWithKbIncidentId,
                properties: {
                    summary: 'Vazamento de memória no cache local da API causou reinícios em cascata.',
                    severity: 'critical',
                    source: 'quick_capture'
                },
                tags: [],
                views: 0,
                helpful_count: 0,
                not_helpful_count: 0
            });

            await db.collection('incidents').updateOne(
                { _id: resolvedWithKbIncidentId },
                { $push: { related_kb_ids: linkedKbResult.insertedId } }
            );

            console.log('✅ Created 5 sample incidents (open, acknowledged, resolved, auto-created from event, resolved with linked KB)');
            console.log('✅ Created 4 sample events (1 converted to incident, 3 pending conversion)');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
    }
}

seedData();