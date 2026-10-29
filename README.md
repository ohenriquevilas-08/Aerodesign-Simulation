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

O menu inicial permite continuar a carreira salva ou criar uma nova. Na configuração, escolha os nomes da equipe e do avião e a dificuldade: Calouro começa com mais créditos e rivais que evoluem mais devagar; Veterano começa com menos créditos e rivais mais fortes. Intermediário mantém o equilíbrio padrão. Um novo jogo exige confirmação antes de substituir um salvamento existente. Saves anteriores são migrados automaticamente.
