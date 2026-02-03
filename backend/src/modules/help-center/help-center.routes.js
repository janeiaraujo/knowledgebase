/**
 * Help Center Module
 * 
 * Features:
 * - Searchable documentation
 * - Interactive tutorials
 * - FAQ section
 * - Feature tours
 * - Shortcuts guide
 */

import { ObjectId } from 'mongodb';

// Default help articles
const DEFAULT_ARTICLES = [
    {
        id: 'getting-started',
        category: 'basics',
        title: 'Primeiros Passos',
        description: 'Aprenda a usar a plataforma',
        icon: '🚀',
        content: `
# Bem-vindo ao Incident KB!

O Incident KB é uma plataforma de gestão de conhecimento para documentar e compartilhar informações sobre incidentes, procedimentos e soluções.

## Conceitos Básicos

### Knowledge Base (KB)
Um KB é um artigo de conhecimento que documenta:
- Problemas conhecidos
- Soluções e workarounds
- Procedimentos operacionais
- Post-mortems de incidentes

### Status de um KB
- **Rascunho**: Ainda em edição
- **Em Revisão**: Aguardando aprovação
- **Aprovado**: Validado por um revisor
- **Publicado**: Disponível para todos
- **Arquivado**: Não mais relevante

## Primeiros Passos

1. **Crie seu primeiro KB**: Acesse a página de Knowledge Base e clique em "Novo KB"
2. **Explore a busca**: Use a Busca Inteligente para encontrar informações
3. **Configure seu perfil**: Acesse Configurações para personalizar sua experiência
        `
    },
    {
        id: 'smart-search',
        category: 'features',
        title: 'Busca Inteligente',
        description: 'Aprenda a usar a busca com IA',
        icon: '🤖',
        content: `
# Busca Inteligente

Nossa busca inteligente usa IA para encontrar as informações mais relevantes.

## Como Funciona

1. **Busca Semântica**: Entende o significado da sua pergunta, não apenas palavras-chave
2. **Análise de Contexto**: Considera o contexto do seu problema
3. **Sugestões**: Sugere KBs relacionados e ações

## Dicas de Uso

### Use linguagem natural
Em vez de: \`erro 500 api\`
Use: \`A API está retornando erro 500 quando tento fazer login\`

### Seja específico
Em vez de: \`sistema lento\`
Use: \`O sistema de pagamentos está lento após as 18h\`

## Solicitar Novo KB

Se não encontrar o que procura:
1. Clique em "Solicitar Novo KB"
2. Descreva o problema em detalhes
3. Aguarde a criação do KB pela equipe
        `
    },
    {
        id: 'creating-kb',
        category: 'guides',
        title: 'Criando um KB de Qualidade',
        description: 'Boas práticas para documentação',
        icon: '📝',
        content: `
# Criando um KB de Qualidade

## Estrutura Recomendada

### 1. Título Claro
- Seja específico e descritivo
- Inclua palavras-chave relevantes
- Exemplo: "Erro de timeout na API de Pagamentos - Solução"

### 2. Descrição do Problema
- O que acontece?
- Quando acontece?
- Quais são os sintomas?

### 3. Causa Raiz
- Por que isso acontece?
- Quais são os fatores contribuintes?

### 4. Solução
- Passos claros e numerados
- Comandos copiáveis
- Screenshots quando necessário

### 5. Tags e Categorias
- Adicione tags relevantes
- Escolha a categoria correta
- Facilite a busca futura

## Checklist de Qualidade

- [ ] Título claro e específico
- [ ] Problema bem descrito
- [ ] Solução testada
- [ ] Tags apropriadas
- [ ] Links relacionados
        `
    },
    {
        id: 'gps-flows',
        category: 'features',
        title: 'Diagnóstico GPS',
        description: 'Fluxos de diagnóstico guiado',
        icon: '🗺️',
        content: `
# Diagnóstico GPS

O GPS (Guided Problem Solving) é um sistema de fluxos de diagnóstico interativos.

## O que é um Fluxo GPS?

Um fluxo GPS é uma série de perguntas e decisões que guiam o usuário até a solução de um problema.

## Criando um Fluxo

1. **Planeje o fluxo**: Mapeie todas as possibilidades
2. **Crie as etapas**: Cada etapa é uma pergunta ou ação
3. **Conecte as etapas**: Defina o caminho baseado nas respostas
4. **Teste**: Percorra o fluxo para validar

## Tipos de Etapas

- **Pergunta**: Coleta informação do usuário
- **Ação**: Instrui uma ação específica
- **Decisão**: Ramifica o fluxo baseado em condição
- **KB**: Referencia um artigo de conhecimento
- **Fim**: Conclusão do diagnóstico

## Dicas

- Mantenha perguntas simples
- Use linguagem clara
- Ofereça opções predefinidas
- Inclua botão de "Não sei"
        `
    },
    {
        id: 'postmortem',
        category: 'guides',
        title: 'Escrevendo Post-Mortems',
        description: 'Como documentar incidentes',
        icon: '📋',
        content: `
# Post-Mortem de Incidentes

Um post-mortem é uma análise detalhada de um incidente após sua resolução.

## Por que fazer Post-Mortem?

1. **Aprendizado**: Entender o que aconteceu
2. **Prevenção**: Evitar recorrência
3. **Documentação**: Histórico para referência
4. **Melhoria**: Identificar gaps em processos

## Estrutura Recomendada

### Resumo Executivo
- Data e duração do incidente
- Impacto (usuários, receita, etc.)
- Severidade

### Timeline
- Quando foi detectado
- Ações tomadas
- Quando foi resolvido

### Análise de Causa Raiz
- Use técnica dos "5 Porquês"
- Identifique fatores contribuintes
- Seja honesto e blameless

### Ações de Melhoria
- O que fazer diferente?
- Quem é responsável?
- Prazo para implementação

## Cultura Blameless

- Foque em processos, não pessoas
- Assuma boa intenção
- Busque aprendizado, não culpados
        `
    },
    {
        id: 'keyboard-shortcuts',
        category: 'tips',
        title: 'Atalhos de Teclado',
        description: 'Navegue mais rápido',
        icon: '⌨️',
        content: `
# Atalhos de Teclado

Aumente sua produtividade com estes atalhos.

## Navegação Global

| Atalho | Ação |
|--------|------|
| \`Ctrl/Cmd + K\` | Abrir busca rápida |
| \`Ctrl/Cmd + N\` | Novo KB |
| \`Ctrl/Cmd + /\` | Atalhos de teclado |
| \`Esc\` | Fechar modal |

## Editor de KB

| Atalho | Ação |
|--------|------|
| \`Ctrl/Cmd + S\` | Salvar |
| \`Ctrl/Cmd + B\` | Negrito |
| \`Ctrl/Cmd + I\` | Itálico |
| \`Ctrl/Cmd + K\` | Inserir link |
| \`Ctrl/Cmd + Shift + C\` | Bloco de código |

## Tabelas

| Atalho | Ação |
|--------|------|
| \`Tab\` | Próxima célula |
| \`Shift + Tab\` | Célula anterior |

## Busca

| Atalho | Ação |
|--------|------|
| \`Enter\` | Pesquisar |
| \`↑/↓\` | Navegar resultados |
| \`Enter\` | Abrir resultado |
        `
    },
    {
        id: 'integrations',
        category: 'advanced',
        title: 'Integrações',
        description: 'Conecte com outras ferramentas',
        icon: '🔌',
        content: `
# Integrações

Conecte o Incident KB com suas ferramentas favoritas.

## Slack

### Configuração
1. Crie um Incoming Webhook no Slack
2. Copie a URL do webhook
3. Cole em Configurações > Integrações > Slack

### Notificações
- Novos KBs publicados
- Incidentes criados
- Menções

## Microsoft Teams

### Configuração
1. Adicione um Incoming Webhook no canal
2. Copie a URL gerada
3. Configure em Integrações

## Jira

### Funcionalidades
- Criar tickets a partir de KBs
- Vincular KBs a issues
- Sincronizar status

## Webhooks Personalizados

Envie dados para qualquer sistema:
1. Acesse Admin > Webhooks
2. Configure URL de destino
3. Selecione eventos
4. Defina payload personalizado
        `
    },
    {
        id: 'gamification',
        category: 'features',
        title: 'Sistema de Gamificação',
        description: 'Pontos, badges e ranking',
        icon: '🏆',
        content: `
# Gamificação

Ganhe pontos e badges ao contribuir com a plataforma!

## Como Ganhar Pontos

| Ação | Pontos |
|------|--------|
| Criar KB | 5 |
| KB publicado | 10 |
| Comentário | 1 |
| Revisão | 5 |
| Post-mortem | 15 |
| Fluxo GPS | 10 |

## Níveis

1. **Iniciante** (0-99 pts)
2. **Aprendiz** (100-299 pts)
3. **Contribuidor** (300-599 pts)
4. **Especialista** (600-999 pts)
5. **Veterano** (1000-1499 pts)
6. **Expert** (1500-2199 pts)
7. **Mestre** (2200-2999 pts)
8. **Grão-Mestre** (3000-3999 pts)
9. **Lenda** (4000-5499 pts)
10. **Imortal** (5500+ pts)

## Badges Especiais

- 🎯 **Primeiro Passo**: Crie seu primeiro KB
- ✍️ **Escritor Prolífico**: Crie 10 KBs
- 🔥 **Semana de Fogo**: Contribua 7 dias seguidos
- 🦸 **Herói dos Incidentes**: Documente 5 post-mortems
- 🗺️ **Criador de Jornadas**: Crie 5 fluxos GPS
        `
    }
];

// FAQ items
const FAQ_ITEMS = [
    {
        question: 'Como criar um novo KB?',
        answer: 'Acesse Knowledge Base no menu lateral, clique em "Novo KB", preencha o formulário e salve.'
    },
    {
        question: 'Posso editar um KB publicado?',
        answer: 'Sim, você pode editar KBs publicados. A edição criará uma nova versão no histórico.'
    },
    {
        question: 'Como funciona o sistema de aprovação?',
        answer: 'Quando você submete um KB para revisão, um revisor da equipe irá avaliar e aprovar ou solicitar alterações.'
    },
    {
        question: 'Posso usar Markdown nos KBs?',
        answer: 'Sim! O editor suporta Markdown completo, incluindo tabelas, código e listas.'
    },
    {
        question: 'Como solicitar a criação de um KB?',
        answer: 'Use a Busca Inteligente, e se não encontrar o que procura, clique em "Solicitar Novo KB".'
    },
    {
        question: 'Minhas contribuições são rastreadas?',
        answer: 'Sim, todas as suas contribuições são registradas e contam para o sistema de gamificação.'
    },
    {
        question: 'Como exportar KBs?',
        answer: 'Você pode exportar KBs individuais ou em lote em formato PDF, HTML ou Markdown.'
    },
    {
        question: 'O que é um fluxo GPS?',
        answer: 'GPS (Guided Problem Solving) são fluxos interativos que guiam o diagnóstico de problemas passo a passo.'
    }
];

export default async function helpCenterRoutes(fastify) {
    const db = fastify.mongo.db;

    // Initialize help content
    fastify.addHook('onReady', async () => {
        const count = await db.collection('help_articles').countDocuments();
        if (count === 0) {
            await db.collection('help_articles').insertMany(
                DEFAULT_ARTICLES.map(article => ({
                    ...article,
                    created_at: new Date(),
                    updated_at: new Date()
                }))
            );
            fastify.log.info('Help articles initialized');
        }
    });

    // Get all help articles
    fastify.get('/articles', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { category, search } = request.query;

        const filter = {};
        if (category) {
            filter.category = category;
        }
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        const articles = await db.collection('help_articles')
            .find(filter)
            .project({ content: 0 })
            .toArray();

        // Group by category
        const grouped = articles.reduce((acc, article) => {
            if (!acc[article.category]) {
                acc[article.category] = [];
            }
            acc[article.category].push(article);
            return acc;
        }, {});

        return { articles: grouped };
    });

    // Get specific article
    fastify.get('/articles/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params;

        const article = await db.collection('help_articles').findOne({ id });

        if (!article) {
            return reply.status(404).send({ error: 'Artigo não encontrado' });
        }

        // Track view
        await db.collection('help_article_views').insertOne({
            article_id: id,
            user_id: new ObjectId(request.user.id),
            viewed_at: new Date()
        });

        return { article };
    });

    // Get FAQ
    fastify.get('/faq', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return { faq: FAQ_ITEMS };
    });

    // Search help
    fastify.get('/search', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { q } = request.query;

        if (!q || q.length < 2) {
            return { results: [] };
        }

        const articles = await db.collection('help_articles')
            .find({
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { description: { $regex: q, $options: 'i' } },
                    { content: { $regex: q, $options: 'i' } }
                ]
            })
            .project({ content: 0 })
            .limit(10)
            .toArray();

        // Also search FAQ
        const faqResults = FAQ_ITEMS.filter(item =>
            item.question.toLowerCase().includes(q.toLowerCase()) ||
            item.answer.toLowerCase().includes(q.toLowerCase())
        );

        return {
            results: {
                articles,
                faq: faqResults
            }
        };
    });

    // Feature tours
    fastify.get('/tours', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = request.user.id;

        // Get completed tours
        const completedTours = await db.collection('user_tours')
            .find({ user_id: new ObjectId(userId) })
            .toArray();

        const completedIds = new Set(completedTours.map(t => t.tour_id));

        const tours = [
            {
                id: 'welcome',
                name: 'Tour de Boas-vindas',
                description: 'Conheça a plataforma',
                steps: 8,
                completed: completedIds.has('welcome')
            },
            {
                id: 'create-kb',
                name: 'Criando seu Primeiro KB',
                description: 'Aprenda a criar documentação',
                steps: 5,
                completed: completedIds.has('create-kb')
            },
            {
                id: 'smart-search',
                name: 'Busca Inteligente',
                description: 'Domine a busca com IA',
                steps: 4,
                completed: completedIds.has('smart-search')
            },
            {
                id: 'gps',
                name: 'Diagnóstico GPS',
                description: 'Crie fluxos de diagnóstico',
                steps: 6,
                completed: completedIds.has('gps')
            }
        ];

        return { tours };
    });

    // Complete tour
    fastify.post('/tours/:id/complete', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params;
        const userId = request.user.id;

        await db.collection('user_tours').updateOne(
            { user_id: new ObjectId(userId), tour_id: id },
            {
                $set: {
                    completed_at: new Date()
                },
                $setOnInsert: {
                    user_id: new ObjectId(userId),
                    tour_id: id
                }
            },
            { upsert: true }
        );

        return { message: 'Tour concluído' };
    });

    // Submit feedback
    fastify.post('/feedback', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { article_id, helpful, comment } = request.body;
        const userId = request.user.id;

        await db.collection('help_feedback').insertOne({
            article_id,
            user_id: new ObjectId(userId),
            helpful,
            comment,
            created_at: new Date()
        });

        return { message: 'Feedback enviado. Obrigado!' };
    });

    // Get categories
    fastify.get('/categories', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const categories = [
            { id: 'basics', name: 'Básico', icon: '📖', description: 'Conceitos fundamentais' },
            { id: 'features', name: 'Funcionalidades', icon: '⚡', description: 'Recursos da plataforma' },
            { id: 'guides', name: 'Guias', icon: '📝', description: 'Tutoriais passo a passo' },
            { id: 'tips', name: 'Dicas', icon: '💡', description: 'Produtividade e atalhos' },
            { id: 'advanced', name: 'Avançado', icon: '🔧', description: 'Configurações e integrações' }
        ];

        return { categories };
    });
}
