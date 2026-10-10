class_name XomDaoMenu
extends Control
## The shell's one in-game control: the ☰ button in the top left corner (88 × 88, the margin
## from the edge set in the settings) and the shared menu board it opens: leave the room, sound,
## settings (HUD size, margin, picture quality), rules and emotes. Games leave that corner empty.
##
##   var menu := XomDaoMenu.new()
##   add_child(menu)                 # covers its parent; only the button and board take input
##   menu.leave_requested.connect(...)
## Sound and settings apply by themselves (XomDaoSettings); the rest is up to the screen.

signal leave_requested
signal rules_requested
signal emote_chosen(emote: String)

## Emotes offered in the menu, by id; each is a Phosphor icon of the same name.
const EMOTES: Array[String] = [
	"smiley", "smiley-wink", "smiley-sad", "smiley-angry", "thumbs-up", "hands-clapping"
]
const SCALE_LABELS: Array[String] = ["Nhỏ", "Vừa", "Lớn", "To"]
const MARGIN_LABELS: Array[String] = ["Hẹp", "Vừa", "Rộng"]
const QUALITY_LABELS: Array[String] = ["Thấp", "Vừa", "Cao"]

var button: XomDaoIconButton = XomDaoIconButton.create("list")
var board: XomDaoBoard = XomDaoBoard.create("Menu", true)
var sound: XomDaoChoice = XomDaoChoice.create(["Bật", "Tắt"])
var ui_scale: XomDaoChoice = XomDaoChoice.create(SCALE_LABELS)
var margin: XomDaoChoice = XomDaoChoice.create(MARGIN_LABELS)
var quality: XomDaoChoice = XomDaoChoice.create(QUALITY_LABELS)

var _settings: XomDaoSettings
var _shade := ColorRect.new()


func _init(settings: XomDaoSettings = null) -> void:
	_settings = settings if settings != null else XomDaoSettings.current()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.pressed.connect(open)
	add_child(button)
	_shade.color = Color(XomDaoUi.INK, 0.45)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.visible = false
	_shade.gui_input.connect(_on_shade_input)
	add_child(_shade)
	board.visible = false
	board.closed.connect(_on_closed)
	add_child(board)
	_build_board()
	_settings.changed.connect(_sync)
	resized.connect(_layout)
	_sync()


func is_open() -> bool:
	return board.visible


func open() -> void:
	_shade.visible = true
	_layout()
	board.open()


func close() -> void:
	if board.visible:
		board.close()


func _on_closed() -> void:
	_shade.visible = false


func _on_shade_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		close()


func _build_board() -> void:
	sound.changed.connect(func(index: int) -> void: _settings.set_value("sound", index == 0))
	ui_scale.changed.connect(
		func(index: int) -> void: _settings.set_value("ui_scale", XomDaoSettings.SCALES[index])
	)
	margin.changed.connect(
		func(index: int) -> void: _settings.set_value("margin", XomDaoSettings.MARGINS[index])
	)
	quality.changed.connect(
		func(index: int) -> void: _settings.set_value("quality", XomDaoSettings.QUALITIES[index])
	)
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 24)
	board.content.add_child(columns)
	# Left: the settings, a label and a row of choices each.
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 16)
	grid.add_theme_constant_override("v_separation", 12)
	var rows: Array = [
		["Âm thanh", sound],
		["Cỡ giao diện", ui_scale],
		["Lề", margin],
		["Chất lượng hình", quality]
	]
	for row: Array in rows:
		var label := Label.new()
		label.text = row[0]
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size.x = 150.0
		label.add_theme_font_override("font", XomDaoUi.body_font(true))
		label.add_theme_font_size_override("font_size", 26)
		label.add_theme_color_override("font_color", XomDaoUi.INK)
		grid.add_child(label)
		var choice: XomDaoChoice = row[1]
		choice.add_theme_constant_override("separation", 6)
		grid.add_child(choice)
	columns.add_child(grid)
	# Right: leave, rules, then the emotes.
	var side := VBoxContainer.new()
	side.add_theme_constant_override("separation", 12)
	side.custom_minimum_size.x = 3.0 * XomDaoIconButton.SIZE + 16.0
	columns.add_child(side)
	var leave: XomDaoButton = XomDaoButton.create("Rời phòng", XomDaoUi.Kind.DANGER)
	leave.name = "Leave"
	leave.icon = XomDaoUi.icon("sign-out")
	leave.pressed.connect(_leave)
	side.add_child(leave)
	var rules: XomDaoButton = XomDaoButton.create("Luật", XomDaoUi.Kind.INFO)
	rules.name = "Rules"
	rules.icon = XomDaoUi.icon("book-open")
	rules.pressed.connect(_rules)
	side.add_child(rules)
	side.add_child(XomDaoDivider.create())
	var emotes := GridContainer.new()
	emotes.name = "Emotes"
	emotes.columns = 3
	emotes.add_theme_constant_override("h_separation", 8)
	emotes.add_theme_constant_override("v_separation", 8)
	for emote: String in EMOTES:
		var pick: XomDaoIconButton = XomDaoIconButton.create(emote)
		pick.name = emote
		pick.pressed.connect(_emote.bind(emote))
		emotes.add_child(pick)
	side.add_child(emotes)


func _leave() -> void:
	close()
	leave_requested.emit()


func _rules() -> void:
	close()
	rules_requested.emit()


func _emote(emote: String) -> void:
	close()
	emote_chosen.emit(emote)


## Shows the saved settings on the board and applies the HUD scale and margin to the button.
func _sync() -> void:
	sound.selected = 0 if _settings.sound else 1
	ui_scale.selected = maxi(0, XomDaoSettings.SCALES.find(_settings.ui_scale))
	margin.selected = maxi(0, XomDaoSettings.MARGINS.find(_settings.margin))
	quality.selected = maxi(0, XomDaoSettings.QUALITIES.find(_settings.quality))
	button.scale = Vector2.ONE * _settings.ui_scale
	_layout()


func _layout() -> void:
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	button.position = inset + Vector2.ONE * _settings.margin
	board.reset_size()
	board.position = (size - board.size) / 2.0
