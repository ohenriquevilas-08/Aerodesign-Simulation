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

Durante a preparação, navegue horizontalmente por Visão geral, Projeto, Habilidades, Finanças e Rivais. A aba Campeonato só aparece ao fim das 20 semanas e permanece disponível durante o evento e a classificação final. Use as setas na interface, as teclas de direção ou deslize horizontalmente na área principal.

Na árvore de habilidades, escolha um conceito exclusivo para o avião (carga máxima, estrutura leve ou estabilidade) e pesquise melhorias de engenharia e gestão da equipe. Pesquisas consomem semanas e créditos; seus efeitos persistem entre temporadas. Pré-requisitos e impactos numéricos ficam visíveis antes de pesquisar. Saves antigos são migrados automaticamente para incluir a árvore.

Referência visual consultada: [EA SPORTS FC 26 — Career Mode Deep Dive](https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-career-mode-deep-dive), especialmente a navegação por seções e os painéis de Manager Career.
