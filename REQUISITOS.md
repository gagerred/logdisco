# LogDisco — controle de requisitos

Legenda: `[x]` implementado e testado · `[~]` implementado, falta validar com o Firebase real · `[ ]` pendente (etapa entre parênteses)

## 1. Objetivo / identidade visual
- [~] Verde e vermelho como cores principais, contraste legível (Etapa 2)
- [~] Interface responsiva para computador e celular (Etapa 2 — navegação; demais telas nas etapas seguintes)

## 2. Autenticação e armazenamento
- [~] 2.1 Login com Google (2)
- [~] 2.1 Login com e-mail e senha, criação de conta (2)
- [~] 2.1 "Esqueci minha senha" na tela de login (2)
- [~] 2.1 Alterar senha nas configurações (2)
- [x] 2.1 Senhas gerenciadas só pelo Firebase Auth; Firestore guarda apenas nome e e-mail (2)
- [~] 2.2 Isolamento entre usuários por regras do Firestore (2) — testes das regras escritos em `tests/rules`, ainda não executados
- [~] 2.2 Cache local apagado ao sair da conta (2)

## 3. Integração com o Discogs
- [x] 3.1 Normalizar R123456 / 123456 / [R123456] (3) — 21 testes unitários
- [~] 3.2 Leitura de artista, título, faixas, capa, formato, artistas das faixas, link, release e master (3) — conversão testada com dados de exemplo; falta validar com o Discogs real (use "Testar consulta de lançamento"). A gravação no banco é na Etapa 4
- [x] 3.3 Mapear formato para CD / Vinyl / DVD / CD/DVD (3) — testado; formatos sem correspondência (Cassette, Blu-ray…) ficam para o usuário escolher
- [x] 3.3 Formato original somente leitura na edição (4) — não há campo de edição e as regras bloqueiam a alteração
- [~] Vínculo da conta Discogs por OAuth 1.0a (3) — fluxo testado com respostas simuladas; falta validar com o Discogs real
- [x] Fila que respeita 60 req/min, com tratamento de 429, falha de rede e erros 5xx (3) — testado

## 4. Tela inicial
- [~] Cinco últimas audições, ordenadas pela data e horário da audição e não pelo cadastro (5) — lógica e tela testadas com dados de exemplo
- [~] 4.1 Pesquisar música — só na página inicial; mostra em quais álbuns a música aparece (5)

## 5. Coleção
- [~] 5.1 Cadastro por código do Discogs, com data de inclusão (4) — servidor testado com banco simulado (duplicados, edições diferentes, categoria obrigatória, reativação); falta validar com Firestore e Discogs reais
- [~] 5.2 Tela da coleção: artistas, "Ver todos os artistas/álbuns" (4)
- [ ] 5.2 Botão Sincronizar e indicador da última sincronização (6)
- [x] 5.3 Filtros combinados: artista, título, formato, ouvido/nunca ouvido (4) — lógica testada; "ouvido/nunca ouvido" passa a ter dados reais com o diário (5)
- [~] 5.4 Pesquisa na navbar: artista ou título, com capa e formato ao lado do título (4)
- [~] 5.5 Página do álbum: capa, artista, título, formato, faixas, link do Discogs, data de inclusão (4)
- [~] 5.5 Botão "Registrar audição" e lista de audições na página do álbum (5)
- [~] 5.6 Edição: título e formato; artista não editável (4) — regras do Firestore limitam as edições a esses campos
- [~] 5.7 Recarregar do Discogs, com prévia das diferenças e confirmação, sem tocar nas audições (4) — testado com banco simulado

## 6. Artistas
- [~] Página do artista: álbuns da coleção e link do Discogs (4)
- [ ] Página do artista: álbuns da lista de desejos (7)

## 7. Diário de audições
- [~] 7.1 Registrar audição (calendário, "Hoje", horário), com validação de data real e sem datas futuras (5)
- [~] 7.2 Editar data/horário e excluir, com confirmação (5) — as telas refletem a mudança em tempo real
- [~] 7.3 Calendário de audições: dias marcados, lista do dia, navegação por mês e ano (5)

## 8. Sincronização
- [ ] Comparação, tela de conferência, aprovação, soft delete, histórico (6)

## 9. Lista de desejos
- [ ] 9.1–9.4 Wantlist, ordenação, busca, marketplaces (7)
- [ ] 9.5 Atualização manual e automática (domingo, 11h, Brasília) com bloqueio e registro de erros (7)

## 10. Quero Conhecer
- [ ] Inserção por código, abrir no Discogs, excluir, YouTube Music (7)

## 11. Relatórios
- [ ] 11.1 Gerais · 11.2 Anuais · 11.3 Por tipo de mídia · 11.4 Apresentação (8)

## 12. Sorteio
- [~] Sortear disco com filtros dos grupos A e B, independentes e opcionais (5) — lógica testada; "Somente CD" não inclui CD/DVD

## 13–14. Letras e "Various"
- [~] Botão de letra por faixa (4) · artista por faixa em álbuns "Various" (4)

## 15–16. CSV, backup e histórico
- [ ] Exportar e importar CSV com prévia e validação (9)
- [ ] Cópia de segurança (9) · Histórico de alterações (9)

## 17. Navegação
- [~] Navbar no computador e barra inferior fixa no celular com menu "Mais" (2)
- [~] Botão de pesquisa na navbar (4)

## 18. Configurações
- [~] Conta, nome, e-mail, alterar/definir senha, Google continua funcionando (2)
- [~] Vínculo/desvínculo do Discogs nas Configurações (3)
- [ ] Últimas atualizações, importação/exportação, backup (6–9)

## 19–21. Integridade, requisitos técnicos e testes
- [x] 19.2–19.4 Lançamento único por código de Release; edições diferentes ficam separadas (4) — testado
- [x] 19.5–19.6 Edição e recarga do Discogs não alteram audições (4) — testado
- [x] 19.1 / 19.14 Isolamento por usuário nas regras; audições só de álbuns do próprio usuário (5) — regras escritas, teste no emulador pendente de execução
- [~] 19.8 / 19.13 Exclusão lógica: reativação preserva histórico (4, testado); fluxo de remoção na sincronização (6)
- [~] Chaves só no servidor; `.env*` fora do Git (2)
- [x] Teste unitário das mensagens de erro de login (2)
- [ ] Testes: cadastro, sincronização, histórico, soft delete, CSV, cron, relatórios, filtros/sorteio, responsividade (3–10)
