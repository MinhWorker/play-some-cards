extends Control
## Caro on the Godot client: draws the room's board (`snapshot.view`, the server's State in
## src/game/model.ts) and sends `place` when you tap a free cell on your turn. The hub adds this
## scene when the room's game starts and calls `bind` with its connection.
##
## Each cell is a Button named Cell_<x>_<y> in board coordinates, so tests can tap one by name.

const RED := XomDaoUi.LACQUER
const BLUE := Color("#1E5FA6")
const PAPER := XomDaoUi.PAPER
const LINE := XomDaoUi.HONEY
const LAST := Color("#FFE08A")
## The board's side on screen at most (the 720-unit frame, minus the HUD).
const BOARD_SIDE := 600.0

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _grid: GridContainer
var _shape: Vector4i = Vector4i(0, 0, -1, -1)
var _status: Label
var _x_slot: XomDaoPlayerSlot
var _o_slot: XomDaoPlayerSlot


## Options for a sandbox room (`?play=tic-tac-toe` in a debug build): against the computer.
func sandbox_options() -> Dictionary:
	return {"opponent": "bot"}


## The hub's Tạo phòng board: who to play and, against the computer, how well it plays
## (`optionsSchema` in src/game/model.ts).
func room_setup() -> Array:
	return [
		{"key": "opponent", "label": "Chơi với", "options": [["Bạn bè", "human"], ["Máy", "bot"]]},
		{
			"key": "level",
			"label": "Máy chơi",
			"options": [["Dễ", "easy"], ["Vừa", "normal"], ["Khó", "hard"]]
		},
	]


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	var bg := ColorRect.new()
	bg.color = XomDaoUi.SEA_DEEP
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 24)
	center.add_child(row)
	_x_slot = _slot("X")
	row.add_child(_x_slot)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(column)
	_status = Label.new()
	_status.name = "Status"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.theme_type_variation = "HudLabel"
	column.add_child(_status)
	var frame := PanelContainer.new()
	frame.add_theme_stylebox_override("panel", _box(LINE, 6.0, 8))
	column.add_child(frame)
	_grid = GridContainer.new()
	_grid.name = "Board"
	_grid.add_theme_constant_override("h_separation", 2)
	_grid.add_theme_constant_override("v_separation", 2)
	frame.add_child(_grid)
	_o_slot = _slot("O")
	row.add_child(_o_slot)


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var board: Dictionary = view["board"]
	var players: Array = view["players"]
	var shape := Vector4i(
		int(board["left"]), int(board["top"]), int(board["cols"]), int(board["rows"])
	)
	if shape != _shape:
		_build(shape)
	var cells: Array = board["cells"]
	var mine: bool = snapshot.status == "playing" and str(view["turn"]) == _client.player_id
	var last := Vector2i(1 << 20, 1 << 20)
	if snapshot.last != null and snapshot.last.move is Dictionary:
		var payload: Variant = (snapshot.last.move as Dictionary).get("payload")
		if payload is Dictionary:
			last = Vector2i(int(payload.get("x", 0)), int(payload.get("y", 0)))
	for i: int in cells.size():
		var at := Vector2i(shape.x + i % shape.z, shape.y + i / shape.z)
		var cell: Button = _grid.get_child(i)
		var mark: String = "" if cells[i] == null else str(cells[i])
		cell.text = mark
		cell.add_theme_color_override("font_color", RED if mark == "X" else BLUE)
		cell.add_theme_color_override("font_disabled_color", RED if mark == "X" else BLUE)
		cell.disabled = not mine or mark != ""
		var fill: Color = LAST if at == last else PAPER
		cell.add_theme_stylebox_override("normal", _box(fill, 0.0, 2))
		cell.add_theme_stylebox_override("disabled", _box(fill, 0.0, 2))
	_x_slot.player_name = _name(str(players[0]))
	_o_slot.player_name = _name(str(players[1]))
	_x_slot.frame = _frame(str(players[0]))
	_o_slot.frame = _frame(str(players[1]))
	for i: int in 2:
		var slot: XomDaoPlayerSlot = [_x_slot, _o_slot][i]
		var on_turn: bool = snapshot.status == "playing" and str(view["turn"]) == str(players[i])
		if on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
	if snapshot.status != "playing":
		_status.text = ""
	elif mine:
		_status.text = "Lượt bạn"
	else:
		_status.text = "Lượt %s" % _name(str(view["turn"]))


## Makes one Button per cell for a board of this shape (left, top, cols, rows).
func _build(shape: Vector4i) -> void:
	_shape = shape
	for child: Node in _grid.get_children():
		_grid.remove_child(child)
		child.queue_free()
	_grid.columns = shape.z
	var side: float = floorf(BOARD_SIDE / maxi(shape.z, shape.w)) - 2.0
	for y: int in range(shape.y, shape.y + shape.w):
		for x: int in range(shape.x, shape.x + shape.z):
			var cell := Button.new()
			cell.name = "Cell_%d_%d" % [x, y]
			cell.custom_minimum_size = Vector2(side, side)
			cell.focus_mode = Control.FOCUS_NONE
			cell.add_theme_font_size_override("font_size", int(side * 0.8))
			cell.add_theme_stylebox_override("hover", _box(XomDaoUi.CREAM, 0.0, 2))
			cell.add_theme_stylebox_override("pressed", _box(LAST, 0.0, 2))
			cell.pressed.connect(_place.bind(x, y))
			_grid.add_child(cell)


func _place(x: int, y: int) -> void:
	await _client.send("place", {"x": x, "y": y})


func _name(id: String) -> String:
	if id == _client.player_id:
		return "Bạn"
	for player: XomDaoPlayerInfo in _snapshot.seats + _snapshot.players:
		if player.id == id:
			return player.name
	return "?"


## The frame a player wears, "" for the computer.
func _frame(id: String) -> String:
	for player: XomDaoPlayerInfo in _snapshot.seats + _snapshot.players:
		if player.id == id:
			return player.frame
	return ""


## A player's seat beside the board, with the mark they play on a chip.
func _slot(mark: String) -> XomDaoPlayerSlot:
	var slot := XomDaoPlayerSlot.new()
	slot.name = mark + "Slot"
	slot.custom_minimum_size = Vector2(200, 0)
	slot.extra = mark
	return slot


static func _box(color: Color, margin: float, radius: int) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.set_corner_radius_all(radius)
	box.set_content_margin_all(margin)
	return box
