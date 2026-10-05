# Cờ tỷ phú Classic

Read `../AGENTS.md` for the shared game/SDK rules. The Vietnamese component map is in `README.md`.

- `src/game/`: authoritative pure rules, board/pricing data (`model.ts`), cards, bot and turn clock.
- `src/scenes/CoTyPhuClassicView.ts`: scene orchestration, layout and control wiring.
- `src/scenes/CityBackground.ts`: independent animated city background, with scene lifetime.
- `src/scenes/Setup.ts`: room setup/options.
- `src/scenes/board/`: projected tile geometry, prices, ownership and special-square symbols;
  `SymbolAtlas.ts` packs their baked animation frames for upload once at scene creation.
  `MonopolyBorders.ts` merges only touching same-owner group tiles; `monopolyShader.ts`
  draws antialiased outlines and flowing fire inward on the GPU, clipped to `BOARD_FACES`. `DeedLayers.ts` selects baked
  enamel owner strips and porcelain building frames; no runtime flat badge polygons.
- `src/scenes/effects/`: backdrop, small-object glow, money animations, money audio the scoped private jail-door effect (`JailGateEffect.ts`), and the victory celebration (`VictoryEffect.ts`).
- `src/scenes/hud/`: player-panel projection (`PlayerPanel.ts`) and pattern (`PlayerPanelPattern.ts`), tooltips, rent tables, bulk mortgage selection/confirmation (`MortgagePanel.ts`), auction confirmation (`AuctionConfirmPanel.ts`), cached action icons (`PropertyActionIcons.ts`) and property action availability.
- `src/scenes/presentation/`: dice, event-card presentation, notices and property snapshot queue.
- Tests stay next to the implementation they exercise.

`sources/render_board_25d.py` generates `assets/board-25d.webp` and
`src/scenes/board/boardGeometry.ts` together. Update its square kinds/groups whenever BOARD changes;
do not hand-edit the generated geometry. Then run `sources/render_deed_layers.py` to
regenerate `assets/deed-layers.webp`/`.json` and `src/scenes/board/deedLayerGeometry.ts`
with the same camera/lights. `BOARD_CELLS` are hit bounds; `BOARD_FACES` are visible surface limits inside the printed
bevel. All ownership overlays must stay inside the face. Neither generated geometry file
should be edited by hand. Assets use the shared `../../assets/AGENTS.md` rules.
