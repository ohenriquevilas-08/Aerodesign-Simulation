# Aerodesign Manager

Jogo de gestão universitária de aerodesign, feito com JavaScript e CSS sem dependências de runtime. O arquivo publicado `index.html` é autônomo e pode ser aberto diretamente no navegador.

## Desenvolver

Requer Node.js. Não é necessário instalar pacotes.

```powershell
npm test
npm run build
```

Edite os módulos em `src/`; `npm run build` incorpora o código ao template HTML e atualiza `index.html`. Execute o build depois das alterações antes de publicar.

## Organização

- `src/index.template.html`: estrutura e estilos da interface.
- `src/content.js`: regras configuráveis, equipes, filosofias, clima e estratégias.
- `src/random.js`: gerador pseudoaleatório com estado serializável para partidas reproduzíveis.
- `src/aircraft.js`: fórmulas do avião, melhorias e marcos tecnológicos.
- `src/team.js`: elenco, recrutamento, alocações semanais, motivação e sucessão.
- `src/rivals.js`: evolução semanal e decisões estratégicas das equipes BOT.
- `src/competition.js`: previsão do tempo, relatórios, baterias e classificação.
- `src/state.js`: estado, validação e migração de saves.
- `src/game.js`: ações e transições da temporada, sem dependência do DOM.
- `src/storage.js`: persistência local.
- `src/ui.js` e `src/main.js`: renderização e ligação das ações do navegador.
- `tests/game.test.js`: testes de regras, partidas reproduzíveis, salvamento e telas da competição.

O evento é salvo entre etapas. As decisões da equipe, clima, resultados já resolvidos e seed da simulação permanecem consistentes ao recarregar a página. Preferências de movimento reduzido do sistema são respeitadas.

## Carreira

O menu inicial permite continuar a carreira salva ou criar uma nova. Na configuração, escolha os nomes da equipe e do avião e a dificuldade: Calouro começa com mais créditos e rivais que evoluem mais devagar; Veterano começa com menos créditos e rivais mais fortes. Intermediário mantém o equilíbrio padrão. Iniciar uma nova carreira substitui o salvamento atual; saves anteriores são migrados automaticamente.

Durante a preparação, navegue horizontalmente por Visão geral, Projeto, Habilidades, Finanças, Rivais e Equipe. A aba Campeonato só aparece ao fim das 20 semanas e permanece disponível durante o evento e a classificação final. Use as setas na interface, as teclas de direção ou deslize horizontalmente na área principal. A interface se ajusta à altura da janela sem rolagem vertical; durante as baterias, o circuito, os controles e o placar ficam visíveis juntos.

Na árvore de habilidades, escolha um conceito exclusivo para o projeto do ano (carga máxima, estrutura leve ou estabilidade) e pesquise melhorias de engenharia e gestão da equipe. Pesquisas consomem semanas e créditos; melhorias de equipe persistem entre temporadas, mas o conceito é específico de cada projeto. Pré-requisitos e impactos numéricos ficam visíveis antes de pesquisar. Saves antigos são migrados automaticamente para incluir a árvore.

## Projeto, protótipos e peças

Cada temporada tem 20 semanas divididas em três etapas: Projeto (6 semanas), Protótipos + ensaios (7) e Versão final + ensaios + relatório (7). Uma carreira nova começa sem atributos desenvolvidos, avião, relatório ou peças. Melhorias de engenharia pertencem ao projeto do ano e só podem ser feitas na primeira etapa.

Na segunda etapa, construa o protótipo por 280 créditos e use até três semanas de ensaio para desenvolver o projeto. Na etapa final, monte por 500 créditos o avião que efetivamente competirá, faça até dois ensaios de confiabilidade e escreva o relatório em ações de uma semana. O evento só começa quando houver avião final e ao menos uma etapa do relatório concluída.

O avião final compete uma vez. Depois do evento, suas peças entram no acervo com condição ajustada pelos resultados dos voos. O regulamento anual define quais tipos podem ser reaproveitados; peças incompatíveis não podem ser selecionadas. Ao iniciar o ano seguinte, os atributos e o projeto são reiniciados, enquanto equipe, melhorias permanentes e peças armazenadas continuam. Saves anteriores à versão 8 são migrados automaticamente.

## Fundação da carreira

A campanha principal cobre cinco temporadas e continua em modo livre depois do quinto ano. Cada temporada apresenta uma meta técnica ligada ao regulamento e uma meta de colocação. Ao final do campeonato, o resultado e as metas aumentam a reputação institucional, que chega a 100 e desbloqueia novas opções de captação nos níveis 15, 35 e 60. As rivais mantêm os atributos e o caixa acumulados entre temporadas.

A cada semana de preparação, as quatro equipes BOT avançam em paralelo conforme suas filosofias; o diário registra publicamente as decisões tomadas, sem revelar os atributos exatos. O scouting custa 150 créditos por equipe e temporada, não consome uma semana e produz tendências aproximadas sobre pontos fortes, vulnerabilidades, aderência ao regulamento atual e estratégias prováveis em diferentes condições de voo.

Carreiras anteriores são migradas automaticamente para incluir reputação, metas, atividade recente das rivais e o modelo de projeto/peças; os relatórios antigos de scouting permanecem identificados como históricos.

## Gestão de equipe

A carreira começa com o presidente e dois capitães fundadores. Integrantes recrutados têm especialidade, experiência, motivação e uma previsão de saída visível; contratação e mudança de alocação não consomem semanas. As tarefas delegadas contribuem modestamente para engenharia, captação ou mentoria a cada turno, enquanto a motivação influencia a produtividade. A capacidade do elenco cresce com a reputação.

Os fundadores deixam a equipe ao começar o Ano 3. Use o Ano 2 para indicar sucessores das capitanias de Aerodinâmica e Estruturas; a transição anual processa as saídas programadas e as nomeações. A partir do Ano 3, os capitães têm mandato de uma temporada, e o presidente permanece.

Referência visual consultada: [EA SPORTS FC 26 — Career Mode Deep Dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-career-mode-deep-dive), especialmente a navegação por seções e os painéis de Manager Career.
