class_name HubBen
extends Control
## Bến, the harbour (docs/experience.md): type a room's code to join it, or pick one of the
## selected game's open rooms. Each row: the game's small picture and name, the host and the
## seats as two chips, and "Vào".

signal back_pressed
signal join_requested(code: String)

const WIDTH := 760.0
const LIST_HEIGHT := 220.0

var top := HubTopBar.new()
var code_input := LineEdit.new()

var _board: XomDaoBoard = XomDaoBoard.create("Bến")
var _heading := Label.new()
var _list := VBoxContainer.new()
var _game_name: String = ""


func _init(settings: XomDaoSettings = null) -> void:
	name = "Ben"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	top = HubTopBar.new(settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	_board.name = "BenBoard"
	add_child(_board)
	var column: VBoxContainer = _board.content
	column.custom_minimum_size.x = WIDTH
	column.add_theme_constant_override("separation", 14)
	var join := HBoxContainer.new()
	join.add_theme_constant_override("separation", 16)
	column.add_child(join)
	code_input.name = "CodeInput"
	code_input.placeholder_text = "Mã phòng"
	code_input.max_length = 4
	code_input.alignment = HORIZONTAL_ALIGNMENT_CENTER
	code_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	code_input.custom_minimum_size.y = XomDaoUi.TOUCH
	code_input.add_theme_font_override("font", XomDaoUi.display_font(800))
	code_input.add_theme_font_size_override("font_size", 40)
	code_input.text_submitted.connect(func(_t: String) -> void: _join_typed())
	join.add_child(code_input)
	var go: XomDaoButton = XomDaoButton.create("Vào", XomDaoUi.Kind.SOCIAL)
	go.name = "Join"
	go.custom_minimum_size.x = 180.0
	go.pressed.connect(_join_typed)
	join.add_child(go)
	column.add_child(XomDaoDivider.new())
	_heading.name = "RoomsHeading"
	_heading.add_theme_font_override("font", XomDaoUi.display_font(700))
	column.add_child(_heading)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size.y = LIST_HEIGHT
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	_list.name = "Rooms"
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 10)
	scroll.add_child(_list)
	resized.connect(_layout)


func _ready() -> void:
	_layout()


## The open rooms of the game `game_name` (its `lobby:watch` list).
func show_rooms(game_name: String, rooms: Array[XomDaoRoomSummary]) -> void:
	_game_name = game_name
	_heading.text = "Phòng %s đang mở" % game_name
	for child: Node in _list.get_children():
		child.queue_free()
	var shown: int = 0
	for summary: XomDaoRoomSummary in rooms:
		if summary.can_join:
			_list.add_child(_row(summary))
			shown += 1
	if shown == 0:
		var empty := Label.new()
		empty.name = "NoRooms"
		empty.text = "Chưa có phòng nào mở"
		empty.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.7))
		_list.add_child(empty)


func _row(summary: XomDaoRoomSummary) -> Control:
	var row := PanelContainer.new()
	row.name = "Room_" + summary.code
	var style: StyleBoxFlat = XomDaoUi.box(XomDaoUi.PAPER_DARK, Color.TRANSPARENT, 0, 16.0)
	style.set_content_margin_all(8.0)
	row.add_theme_stylebox_override("panel", style)
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 12)
	row.add_child(line)
	var art := HubCardArt.new()
	art.title = _game_name
	art.custom_minimum_size = Vector2(88.0, 72.0)
	line.add_child(art)
	var title := Label.new()
	title.text = _game_name
	title.add_theme_font_override("font", XomDaoUi.display_font(800))
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	line.add_child(title)
	var host := XomDaoChip.create(summary.host_name, "crown")
	host.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(host)
	var seats := XomDaoChip.create("%d/%d" % [summary.players, summary.max_players], "users")
	seats.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(seats)
	var enter: XomDaoButton = XomDaoButton.create("Vào", XomDaoUi.Kind.SOCIAL)
	enter.name = "Enter_" + summary.code
	enter.pressed.connect(join_requested.emit.bind(summary.code))
	line.add_child(enter)
	return row


func _join_typed() -> void:
	var code: String = code_input.text.strip_edges()
	if code != "":
		join_requested.emit(code)


func _layout() -> void:
	top._layout()
	_board.reset_size()
	var y: float = top.bottom() + 8.0
	_board.position = Vector2(
		(size.x - _board.size.x) / 2.0, maxf(y, (size.y - _board.size.y) / 2.0)
	)
