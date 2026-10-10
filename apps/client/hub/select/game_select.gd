class_name HubGameSelect
extends Control
## Choosing a game (docs/experience.md, "Chọn trò"): genre tabs on top, the genre's cards in a
## row that scrolls sideways, and the selected card's detail board on the right with Chọn, Tạo
## phòng, Danh sách phòng and Luật. Selecting a card starts loading its pack.

signal back_pressed
## Chọn: this game goes on the lobby's CHƠI.
signal chosen(game_id: String)
signal create_pressed(game_id: String)
signal rooms_pressed(game_id: String)
signal rules_pressed(game_id: String)

const DETAIL_WIDTH := 400.0
const TILE_SCALE := 0.9

var top := HubTopBar.new()
var tiles: Array[XomDaoGameTile] = []

var _catalog: HubCatalog
var _genre: String = ""
var _game: String = ""
var _tabs := HBoxContainer.new()
var _tab_scroll := ScrollContainer.new()
var _scroll := ScrollContainer.new()
var _row := HBoxContainer.new()
var _detail: XomDaoBoard = XomDaoBoard.create("")
var _tagline := Label.new()
var _chips := HFlowContainer.new()
var _choose: XomDaoButton = XomDaoButton.create("Chọn", XomDaoUi.Kind.CONFIRM)
var _create: XomDaoButton = XomDaoButton.create("Tạo phòng", XomDaoUi.Kind.SOCIAL)
var _rooms: XomDaoButton = XomDaoButton.create("Danh sách phòng", XomDaoUi.Kind.SOCIAL)
var _rules: XomDaoButton = XomDaoButton.create("Luật", XomDaoUi.Kind.INFO)


func _init(settings: XomDaoSettings = null) -> void:
	name = "GameSelect"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	top = HubTopBar.new(settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	_tabs.name = "Tabs"
	_tabs.add_theme_constant_override("separation", 10)
	_tab_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_tab_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	_tab_scroll.add_child(_tabs)
	add_child(_tab_scroll)
	_scroll.name = "Cards"
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	add_child(_scroll)
	_row.add_theme_constant_override("separation", 16)
	_scroll.add_child(_row)
	_build_detail()
	resized.connect(_layout)


func _ready() -> void:
	_layout()


## Shows a genre's cards, with `game_id` selected (or the first card).
func show_genre(catalog: HubCatalog, genre_id: String, game_id: String = "") -> void:
	_catalog = catalog
	_genre = genre_id
	_build_tabs()
	for slot: Node in _row.get_children():
		slot.queue_free()
	tiles.clear()
	var cards: Array[XomDaoGameCard] = catalog.games_of(genre_id)
	for card: XomDaoGameCard in cards:
		_row.add_child(_tile(card))
	var pick: String = game_id
	if catalog.card(pick) == null or catalog.card(pick).genre != genre_id:
		pick = cards[0].id if not cards.is_empty() else ""
	select_game(pick)


## Selects a card: the detail board shows it and its pack starts loading.
func select_game(game_id: String) -> void:
	_game = game_id
	for tile: XomDaoGameTile in tiles:
		tile.selected = tile.name == "Card_" + game_id
	var card: XomDaoGameCard = _catalog.card(game_id) if _catalog != null else null
	_detail.visible = card != null
	if card == null:
		return
	var playable: bool = _catalog.can_play(game_id)
	_detail.title = card.name
	_tagline.text = card.tagline if playable else "Sắp có trên Xóm Đảo."
	for child: Node in _chips.get_children():
		child.queue_free()
	var players := XomDaoChip.create(
		XomDaoGameTile.players_label(card.min_players, card.max_players), "users"
	)
	players.compact()
	_chips.add_child(players)
	var open := XomDaoChip.create("%d phòng mở" % card.open_rooms, "anchor")
	open.name = "OpenRooms"
	open.compact()
	_chips.add_child(open)
	for button: XomDaoButton in [_choose, _create, _rooms]:
		button.disabled = not playable
	if playable:
		ContentLoader.preload_game(game_id)
	_layout.call_deferred()


func selected_game() -> String:
	return _game


func _build_tabs() -> void:
	for child: Node in _tabs.get_children():
		child.queue_free()
	for genre: XomDaoGenre in _catalog.ordered_genres():
		var tab: XomDaoButton = XomDaoButton.create(
			genre.name, XomDaoUi.Kind.GO if genre.id == _genre else XomDaoUi.Kind.BACK
		)
		tab.name = "Tab_" + genre.id
		tab.custom_minimum_size = Vector2(140.0, 72.0)
		tab.pressed.connect(func() -> void: show_genre(_catalog, genre.id))
		_tabs.add_child(tab)


## A card in its slot in the row (the slot is the size of the scaled card).
func _tile(card: XomDaoGameCard) -> Control:
	var tile := XomDaoGameTile.new()
	tile.name = "Card_" + card.id
	tile.show_card(card)
	tile.scale = Vector2.ONE * TILE_SCALE
	tile.custom_minimum_size = XomDaoGameTile.SIZE
	tile.pressed.connect(select_game.bind(card.id))
	var art := HubCardArt.new()
	art.title = card.name
	art.locked = not _catalog.can_play(card.id)
	tile.show_art(art)
	if art.locked:
		tile.modulate = Color(1, 1, 1, 0.7)
	var about: XomDaoIconButton = XomDaoIconButton.create("question")
	about.name = "About_" + card.id
	about.scale = Vector2.ONE * 0.6
	about.position = Vector2(XomDaoGameTile.SIZE.x - 64.0, 72.0)
	about.pressed.connect(rules_pressed.emit.bind(card.id))
	tile.add_child(about)
	var slot := Control.new()
	slot.custom_minimum_size = XomDaoGameTile.SIZE * TILE_SCALE
	slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	slot.add_child(tile)
	tiles.append(tile)
	return slot


func _build_detail() -> void:
	_detail.name = "Detail"
	add_child(_detail)
	var column: VBoxContainer = _detail.content
	column.add_theme_constant_override("separation", 10)
	_tagline.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_tagline.custom_minimum_size.x = DETAIL_WIDTH - 88.0
	_tagline.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	column.add_child(_tagline)
	_chips.add_theme_constant_override("h_separation", 6)
	_chips.add_theme_constant_override("v_separation", 6)
	column.add_child(_chips)
	_choose.name = "Choose"
	_choose.pressed.connect(func() -> void: chosen.emit(_game))
	_create.name = "SelectCreate"
	_create.pressed.connect(func() -> void: create_pressed.emit(_game))
	_rooms.name = "RoomList"
	_rooms.pressed.connect(func() -> void: rooms_pressed.emit(_game))
	_rules.name = "GameRules"
	_rules.pressed.connect(func() -> void: rules_pressed.emit(_game))
	var pair := HBoxContainer.new()
	pair.add_theme_constant_override("separation", 12)
	column.add_child(pair)
	for button: XomDaoButton in [_choose, _rules]:
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		pair.add_child(button)
	column.add_child(_create)
	column.add_child(_rooms)


func _layout() -> void:
	top._layout()
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = XomDaoSettings.current().margin
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var y: float = top.bottom() + 4.0
	var tabs_left: float = top.back.position.x + (XomDaoIconButton.SIZE + 16.0) * top.back.scale.x
	_tab_scroll.position = Vector2(tabs_left, top.bottom() - 80.0)
	_tab_scroll.size = Vector2(maxf(0.0, top.money.position.x - 16.0 - tabs_left), 80.0)
	_detail.reset_size()
	_detail.custom_minimum_size.x = DETAIL_WIDTH
	_detail.position = Vector2(right - _detail.size.x, y)
	var cards_top: float = y + 8.0
	_scroll.position = Vector2(left, cards_top)
	_scroll.size = Vector2(
		maxf(0.0, _detail.position.x - 16.0 - left), XomDaoGameTile.SIZE.y * TILE_SCALE + 8.0
	)
