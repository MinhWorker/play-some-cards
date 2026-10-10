class_name HubRoomSetup
extends Control
## Tạo phòng: a board the game fills with its own options. The game's main scene describes them
## with `room_setup()`, a list of
##   { "key": "opponent", "label": "Chơi với", "options": [["Bạn bè", "human"], ["Máy", "bot"]] }
## and the hub draws one row of choices per option: the first is picked, or the one at the
## optional "default" index. Tạo sends the picked values as the room's options.

signal created(options: Dictionary)
signal cancelled

var choices: Dictionary = {}

var _spec: Array = []
var _shade := ColorRect.new()
var _board: XomDaoBoard = XomDaoBoard.create("Tạo phòng", true)


func _init() -> void:
	name = "RoomSetup"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shade.color = Color(XomDaoUi.INK, 0.45)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_shade)
	_board.name = "SetupBoard"
	_board.closed.connect(cancelled.emit)
	add_child(_board)
	resized.connect(_layout)


## Builds the board for `game_name` from its `room_setup()` list ([] for none).
func show_setup(game_name: String, spec: Array) -> void:
	_spec = spec
	_board.title = "Tạo phòng %s" % game_name
	var column: VBoxContainer = _board.content
	column.add_theme_constant_override("separation", 14)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 16)
	grid.add_theme_constant_override("v_separation", 12)
	column.add_child(grid)
	for option: Variant in spec:
		if option is not Dictionary:
			continue
		var label := Label.new()
		label.text = str(option.get("label", ""))
		label.add_theme_font_override("font", XomDaoUi.body_font(true))
		grid.add_child(label)
		var labels: Array[String] = []
		for pair: Variant in option.get("options", []):
			labels.append(str(pair[0]))
		var choice := XomDaoChoice.create(
			labels, clampi(int(option.get("default", 0)), 0, maxi(0, labels.size() - 1))
		)
		choice.name = "Option_" + str(option.get("key", ""))
		choices[str(option.get("key", ""))] = choice
		grid.add_child(choice)
	if spec.is_empty():
		var none := Label.new()
		none.text = "Phòng thường, không có tuỳ chọn."
		column.add_child(none)
	column.add_child(XomDaoDivider.new())
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 16)
	column.add_child(buttons)
	var cancel: XomDaoButton = XomDaoButton.create("Huỷ", XomDaoUi.Kind.BACK)
	cancel.name = "CancelCreate"
	cancel.pressed.connect(cancelled.emit)
	buttons.add_child(cancel)
	var make: XomDaoButton = XomDaoButton.create("Tạo", XomDaoUi.Kind.GO)
	make.name = "ConfirmCreate"
	make.pressed.connect(func() -> void: created.emit(options()))
	buttons.add_child(make)
	_board.open()
	_layout.call_deferred()


## The picked value of each option.
func options() -> Dictionary:
	var out: Dictionary = {}
	for option: Variant in _spec:
		if option is not Dictionary:
			continue
		var key: String = str(option.get("key", ""))
		var values: Array = option.get("options", [])
		var choice: XomDaoChoice = choices.get(key)
		if choice != null and choice.selected < values.size():
			out[key] = values[choice.selected][1]
	return out


func _layout() -> void:
	_board.reset_size()
	_board.position = (size - _board.size) / 2.0
