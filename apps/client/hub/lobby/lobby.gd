class_name HubLobby
extends Control
## The lobby (docs/experience.md, "Sảnh: vòng đảo thể loại"): the ring of genre islands on the
## sea, and a thin HUD around it. Top left the profile, top right the balance and ⚙, the right
## column a banner (the open event with a red dot, else Chợ), bottom left Nhà, Chợ, Đình, Bến,
## bottom right the selected game's card with CHƠI and Tạo phòng.
##
## The lobby only shows and reports: the hub (main.gd) acts on its signals.

signal play_pressed(game_id: String)
signal create_pressed(game_id: String)
## The selected island was tapped again, or the card: open the game select on this genre.
signal select_opened(genre_id: String)
## Nhà, Chợ, Đình or Bến ("nha", "cho", "dinh", "ben").
signal place_pressed(place: String)
## The ring turned to another genre: the hub picks that genre's game for the card.
signal genre_changed(genre_id: String)
## The banner of an open event: open its card.
signal event_pressed(game_id: String)

const PLACES: Array = [
	["nha", "Nhà", "house"],
	["cho", "Chợ", "storefront"],
	["dinh", "Đình", "bank"],
	["ben", "Bến", "anchor"],
]
const CARD_SIZE := Vector2(236.0, 212.0)
const GAP := 16.0

var ring := HubIslandRing.new()
var money := HubMoneyRow.new()
var avatar := XomDaoAvatar.new()
var play: XomDaoButton = XomDaoButton.create("CHƠI", XomDaoUi.Kind.PLAY)
var create: XomDaoButton = XomDaoButton.create("Tạo phòng", XomDaoUi.Kind.SOCIAL)

var _game_id: String = ""
var _profile := HBoxContainer.new()
var _name := Label.new()
var _level: XomDaoChip = XomDaoChip.create("Cấp 1", "star", XomDaoUi.HONEY_DARK)
var _banner := Button.new()
var _banner_icon := TextureRect.new()
var _banner_title := Label.new()
var _banner_tag: XomDaoChip
## The event on the banner ("" = Chợ).
var _event_id: String = ""
var _places := HBoxContainer.new()
var _corner := HBoxContainer.new()
var _card := PanelContainer.new()
var _card_name := Label.new()
var _card_art := HubCardArt.new()
var _card_foot := HFlowContainer.new()
var _settings: XomDaoSettings


func _init(settings: XomDaoSettings = null) -> void:
	_settings = settings if settings != null else XomDaoSettings.current()
	name = "Lobby"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	ring.name = "Ring"
	ring.selected_changed.connect(func(_i: int) -> void: genre_changed.emit(ring.selected_id()))
	ring.opened.connect(func(_i: int) -> void: _open_genre())
	add_child(ring)
	_build_profile()
	add_child(money)
	_build_banner()
	_build_places()
	_build_corner()
	resized.connect(_layout)
	_corner.resized.connect(_layout, CONNECT_DEFERRED)
	_settings.changed.connect(_layout)


func _ready() -> void:
	_layout()


## Fills the ring from the catalog, `genre_id`'s island at the front.
func show_catalog(catalog: HubCatalog, genre_id: String) -> void:
	var list: Array[Dictionary] = HubIslandRing.entries(
		catalog.catalog.genres, catalog.ready_genres()
	)
	var events: Array[XomDaoGameCard] = catalog.open_events()
	var index: int = 0
	for i: int in list.size():
		if list[i]["id"] == genre_id:
			index = i
		if not events.is_empty() and list[i]["id"] == events[0].genre:
			list[i]["days"] = HubCatalog.days_left(events[0])
	ring.set_entries(list, index)
	show_event(events[0] if not events.is_empty() else null)
	_layout()


## The banner: an open event (its colour, the days left and a red dot), or Chợ when none is.
func show_event(card: XomDaoGameCard) -> void:
	_event_id = card.id if card != null else ""
	var color: Color = XomDaoUi.LACQUER
	if card != null and card.event != null and card.event.color != "":
		color = Color(card.event.color)
	var style: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(color, XomDaoUi.GOLD, XomDaoUi.BORDER, 18.0)
	)
	for state: String in ["normal", "hover", "pressed", "hover_pressed"]:
		_banner.add_theme_stylebox_override(state, style)
	_banner_icon.texture = XomDaoUi.icon("moon-stars" if card != null else "storefront")
	_banner_title.text = "Sự kiện" if card != null else "Chợ"
	_banner_tag.text = "Còn %d ngày" % HubCatalog.days_left(card) if card != null else "Mới"
	var dot: Node = _banner.get_node_or_null("Dot")
	if card != null:
		XomDaoDot.attach(_banner)
	elif dot != null:
		dot.queue_free()


func show_user(user: XomDaoUser) -> void:
	_name.text = user.name if user != null else ""
	avatar.initial = _name.text
	avatar.frame = user.frame if user != null else ""


## The level chip by the name (`stats:get`).
func show_level(level: int) -> void:
	_level.text = "Cấp %d" % level
	_level.visible = true


## The card at the bottom right: the selected game, or "Sắp có" when there is none to play.
func show_game(card: XomDaoGameCard, can_play: bool) -> void:
	_game_id = card.id if card != null else ""
	_card_name.text = card.name if card != null else "Sắp có"
	_card_art.title = _card_name.text
	_card_art.locked = not can_play
	for child: Node in _card_foot.get_children():
		child.queue_free()
	if card != null:
		var players := XomDaoChip.create(
			XomDaoGameTile.players_label(card.min_players, card.max_players)
		)
		players.compact()
		_card_foot.add_child(players)
		var length := XomDaoChip.create(XomDaoGameTile.duration_label(card.duration))
		length.compact()
		_card_foot.add_child(length)
		var online := XomDaoChip.create(str(card.playing), "users")
		online.compact()
		_card_foot.add_child(online)
	play.disabled = not can_play
	create.disabled = not can_play
	_layout.call_deferred()


## Where the HUD is, in this control's coordinates: no island may go there.
func hud_rects() -> Array[Rect2]:
	var out: Array[Rect2] = []
	for part: Control in [_profile, money, _banner, _places, _corner]:
		out.append(Rect2(part.position, part.size * part.scale))
	return out


func _open_genre() -> void:
	if ring.selected_id() == HubIsland.SOON or ring.islands[ring.selected].locked:
		XomDaoToast.show_on(self, "Sắp có", "lock-simple")
		return
	select_opened.emit(ring.selected_id())


func _build_profile() -> void:
	_profile.name = "Profile"
	_profile.add_theme_constant_override("separation", 0)
	add_child(_profile)
	avatar.name = "Avatar"
	avatar.custom_minimum_size = Vector2(88.0, 88.0)
	_profile.add_child(avatar)
	var pill := PanelContainer.new()
	pill.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var style: StyleBoxFlat = XomDaoUi.box(XomDaoUi.HUD, Color.TRANSPARENT, 0, 28.0)
	style.content_margin_left = 20.0
	style.content_margin_right = 24.0
	pill.add_theme_stylebox_override("panel", style)
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_profile.add_child(pill)
	_name.name = "PlayerName"
	_name.theme_type_variation = "HudLabel"
	_name.add_theme_font_size_override("font_size", 34)
	_name.custom_minimum_size.y = 56.0
	_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pill.add_child(_name)
	_level.name = "LobbyLevel"
	_level.compact()
	_level.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_level.visible = false
	_profile.add_child(_level)
	# The profile opens Nhà.
	_profile.mouse_filter = Control.MOUSE_FILTER_STOP
	_profile.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_profile.gui_input.connect(_on_profile_input)


func _build_banner() -> void:
	_banner.name = "Banner"
	_banner.focus_mode = Control.FOCUS_NONE
	_banner.custom_minimum_size = Vector2(150.0, 176.0)
	_banner.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	_banner.pressed.connect(
		func() -> void:
			if _event_id != "":
				event_pressed.emit(_event_id)
			else:
				place_pressed.emit("cho")
	)
	add_child(_banner)
	var column := VBoxContainer.new()
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.add_child(column)
	_banner_icon.custom_minimum_size = Vector2(72.0, 72.0)
	_banner_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_banner_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_banner_icon.modulate = XomDaoUi.CREAM
	_banner_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_banner_icon)
	_banner_title.name = "BannerTitle"
	_banner_title.theme_type_variation = "HudLabel"
	_banner_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_banner_title)
	_banner_tag = XomDaoChip.create("", "", XomDaoUi.GOLD_DARK)
	_banner_tag.name = "BannerTag"
	_banner_tag.compact()
	_banner_tag.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(_banner_tag)
	show_event(null)


func _build_places() -> void:
	_places.name = "Places"
	_places.add_theme_constant_override("separation", 8)
	add_child(_places)
	for place: Array in PLACES:
		var button := Button.new()
		button.name = "Place_" + str(place[0])
		button.text = place[1]
		button.icon = XomDaoUi.icon(place[2])
		button.focus_mode = Control.FOCUS_NONE
		button.custom_minimum_size = Vector2(84.0, 104.0)
		button.expand_icon = true
		button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		button.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		button.add_theme_constant_override("icon_max_width", 48)
		button.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
		var style: StyleBoxFlat = XomDaoUi.box(XomDaoUi.HUD, Color.TRANSPARENT, 0, 18.0)
		style.content_margin_top = 10.0
		style.content_margin_bottom = 6.0
		button.add_theme_stylebox_override("normal", style)
		var down: StyleBoxFlat = style.duplicate()
		down.bg_color = XomDaoUi.HUD.darkened(0.2)
		button.add_theme_stylebox_override("hover", style)
		button.add_theme_stylebox_override("pressed", down)
		button.add_theme_stylebox_override("hover_pressed", down)
		button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
		button.add_theme_color_override("icon_normal_color", XomDaoUi.CREAM)
		button.add_theme_color_override("icon_pressed_color", XomDaoUi.CREAM)
		button.add_theme_color_override("icon_hover_color", XomDaoUi.CREAM)
		button.button_down.connect(XomDaoUi.bounce.bind(button))
		button.pressed.connect(place_pressed.emit.bind(str(place[0])))
		_places.add_child(button)


func _build_corner() -> void:
	_corner.name = "PlayCorner"
	_corner.add_theme_constant_override("separation", 12)
	_corner.alignment = BoxContainer.ALIGNMENT_END
	add_child(_corner)
	_card.name = "SelectedGame"
	_card.custom_minimum_size = CARD_SIZE
	_card.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var wood: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoGameTile.WOOD, XomDaoGameTile.WOOD.darkened(0.35), XomDaoUi.BORDER, 20.0)
	)
	wood.set_content_margin_all(8.0)
	_card.add_theme_stylebox_override("panel", wood)
	_card.gui_input.connect(_on_card_input)
	_corner.add_child(_card)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_card.add_child(column)
	_card_name.name = "SelectedName"
	_card_name.theme_type_variation = "HudLabel"
	_card_name.add_theme_font_size_override("font_size", 32)
	_card_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_card_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	column.add_child(_card_name)
	_card_art.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(_card_art)
	_card_foot.alignment = FlowContainer.ALIGNMENT_CENTER
	_card_foot.add_theme_constant_override("h_separation", 4)
	_card_foot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_card_foot)
	var buttons := VBoxContainer.new()
	buttons.add_theme_constant_override("separation", 12)
	buttons.alignment = BoxContainer.ALIGNMENT_END
	_corner.add_child(buttons)
	play.name = "Play"
	play.custom_minimum_size.x = 240.0
	play.pressed.connect(func() -> void: play_pressed.emit(_game_id))
	buttons.add_child(play)
	create.name = "CreateRoom"
	create.pressed.connect(func() -> void: create_pressed.emit(_game_id))
	buttons.add_child(create)


func _on_profile_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
		place_pressed.emit("nha")


func _on_card_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		XomDaoUi.bounce(_card)
		XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
		_open_genre()


## Corners at the safe area plus the player's margin, scaled by their HUD size; the ring takes
## the sea between them.
func _layout() -> void:
	var view: Vector2 = size
	if view.x <= 0.0:
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var k: float = _settings.ui_scale
	var left: float = inset.x + edge
	var right: float = view.x - inset.x - edge
	var top: float = inset.y + edge
	var bottom: float = view.y - edge
	for part: Control in [_profile, money, _banner, _places, _corner]:
		part.reset_size()
		part.scale = Vector2.ONE * k
	_profile.position = Vector2(left, top)
	money.position = Vector2(right - money.size.x * k, top)
	_banner.position = Vector2(right - _banner.size.x * k, top + (88.0 + GAP) * k)
	_places.position = Vector2(left, bottom - _places.size.y * k)
	_corner.position = Vector2(right - _corner.size.x * k, bottom - _corner.size.y * k)
	var ring_top: float = top + 88.0 * k + 8.0
	var ring_bottom: float = minf(_places.position.y, _corner.position.y) - 8.0
	var ring_right: float = _banner.position.x - GAP
	ring.position = Vector2(left, ring_top)
	ring.size = Vector2(maxf(0.0, ring_right - left), maxf(0.0, ring_bottom - ring_top))
