class_name XomDaoGameTile
extends Button
## The card of one game: dark wood, corners 24, 280 × 420. Head: the name. Body: the card art.
## Foot: three chips, players, length of a match and players online. The selected card has a
## brass border.
##
##   var tile := XomDaoGameTile.new()
##   tile.show_card(card)        # an XomDaoGameCard from catalog:get
##   tile.art = load(...)        # the game's card picture (2:3)
##   tile.selected = true

const SIZE := Vector2(280.0, 420.0)
const WOOD := Color("#5C3A1F")

var title: String = "":
	set(value):
		title = value
		_title.text = value

var art: Texture2D:
	set(value):
		art = value
		_art.texture = value

var selected: bool = false:
	set(value):
		selected = value
		_restyle()

## Chips of the foot, as given by show_card() or set_chips().
var players_text: String = ""
var duration_text: String = ""
var playing: int = -1

var _title := Label.new()
var _art := TextureRect.new()
var _frame := PanelContainer.new()
var _foot := HFlowContainer.new()


## "2 người", "2–4 người".
static func players_label(min_players: int, max_players: int) -> String:
	if max_players <= min_players:
		return "%d người" % min_players
	return "%d–%d người" % [min_players, max_players]


## "10 phút", "5–10 phút".
static func duration_label(duration: Dictionary) -> String:
	var low: int = int(duration.get("min", 0))
	var high: int = int(duration.get("max", low))
	if high <= low:
		return "%d phút" % low
	return "%d–%d phút" % [low, high]


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	custom_minimum_size = SIZE
	clip_contents = true
	var column := VBoxContainer.new()
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	column.offset_left = 10.0
	column.offset_right = -10.0
	column.offset_top = 6.0
	column.offset_bottom = -10.0
	column.add_theme_constant_override("separation", 8)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(column)
	_title.add_theme_font_override("font", XomDaoUi.display_font(800))
	_title.add_theme_font_size_override("font_size", 36)
	_title.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_title.custom_minimum_size.y = 52.0
	column.add_child(_title)
	var frame: PanelContainer = _frame
	frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var art_box: StyleBoxFlat = XomDaoUi.box(
		XomDaoUi.SEA, XomDaoUi.PAPER_DARK, XomDaoUi.BORDER, 16.0
	)
	art_box.set_content_margin_all(XomDaoUi.BORDER)
	frame.add_theme_stylebox_override("panel", art_box)
	column.add_child(frame)
	_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.add_child(_art)
	_foot.alignment = FlowContainer.ALIGNMENT_CENTER
	_foot.add_theme_constant_override("h_separation", 6)
	_foot.add_theme_constant_override("v_separation", 6)
	_foot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_foot)
	_restyle()


func _ready() -> void:
	button_down.connect(_on_down)


## Draws `node` in the art's frame instead of a picture (a card without its art yet).
func show_art(node: Control) -> void:
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_frame.add_child(node)


## Fills the card from the catalog: name, players, length and how many play it now.
func show_card(card: XomDaoGameCard) -> void:
	title = card.name
	set_chips(
		players_label(card.min_players, card.max_players),
		duration_label(card.duration),
		card.playing
	)


## The foot's chips; an empty text or a negative count leaves that chip out.
func set_chips(players: String, duration: String, online: int = -1) -> void:
	players_text = players
	duration_text = duration
	playing = online
	for child: Node in _foot.get_children():
		child.queue_free()
	if players != "":
		_foot.add_child(_small(XomDaoChip.create(players, "users")))
	if duration != "":
		_foot.add_child(_small(XomDaoChip.create(duration, "clock")))
	if online >= 0:
		var chip: XomDaoChip = _small(XomDaoChip.create(str(online)))
		chip.set_icon(_online_dot())
		_foot.add_child(chip)


func _small(chip: XomDaoChip) -> XomDaoChip:
	chip.compact()
	return chip


func _online_dot() -> Texture2D:
	var image := Image.create(32, 32, false, Image.FORMAT_RGBA8)
	for y: int in 32:
		for x: int in 32:
			var d: float = Vector2(x + 0.5, y + 0.5).distance_to(Vector2(16.0, 16.0))
			image.set_pixel(x, y, Color(XomDaoUi.GEM, clampf(11.0 - d, 0.0, 1.0)))
	return ImageTexture.create_from_image(image)


func _on_down() -> void:
	XomDaoUi.bounce(self)
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)


func _restyle() -> void:
	var border: Color = XomDaoUi.GOLD if selected else WOOD.darkened(0.35)
	var style: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(WOOD, border, 5 if selected else XomDaoUi.BORDER, XomDaoUi.RADIUS)
	)
	if selected:
		style.shadow_color = Color(XomDaoUi.GOLD, 0.4)
		style.shadow_size = 12
		style.shadow_offset = Vector2.ZERO
	for state: String in ["normal", "hover", "pressed", "hover_pressed", "disabled"]:
		add_theme_stylebox_override(state, style)
	add_theme_stylebox_override("focus", StyleBoxEmpty.new())
