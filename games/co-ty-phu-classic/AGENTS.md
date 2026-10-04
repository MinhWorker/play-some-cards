# Cờ tỷ phú Classic

Read `../AGENTS.md` for the shared game/SDK rules. The Vietnamese component map is in `README.md`.

- `src/game/`: authoritative pure rules, board/pricing data (`model.ts`), cards, bot and turn clock.
- `src/scenes/CoTyPhuClassicView.ts`: scene orchestration, layout and control wiring.
- `src/scenes/Setup.ts`: room setup/options.
- `src/scenes/board/`: projected tile geometry, prices, ownership and special-square symbols;
  `SymbolAtlas.ts` packs their baked animation frames for upload once at scene creation.
- `src/scenes/effects/`: backdrop, small-object glow, money animations and money audio.
- `src/scenes/hud/`: player-panel projection (`PlayerPanel.ts`) and pattern (`PlayerPanelPattern.ts`), tooltips, rent tables, bulk mortgage selection (`MortgagePanel.ts`) and property action availability.
- `src/scenes/presentation/`: dice, event-card presentation, notices and property snapshot queue.
- Tests stay next to the implementation they exercise.

`sources/render_board_25d.py` generates `assets/board-25d.webp` and
`src/scenes/board/boardGeometry.ts` together. Update its square kinds/groups whenever BOARD changes;
do not hand-edit the generated geometry. Assets use the shared `../../assets/AGENTS.md` rules.
