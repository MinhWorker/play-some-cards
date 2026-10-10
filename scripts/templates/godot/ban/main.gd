extends Control
## __NAME__
##
## The game on the Godot client, in the **Bàn** layout (docs/experience.md): the board in the
## middle, nearly the frame's height; the others' seats at the sides and the top right; yours at
## the bottom left and the +1 / +2 / +3 buttons at the bottom right (in a column when the
## screen is too narrow for a row beside the board). It draws `snapshot.view`
## (State in src/game/<Name>Game.ts) and sends `add {amount}`. The hub adds this scene when the
## room's game starts, calls `bind` and draws the ☰ menu, the room and the result.
##
## Named nodes for tests: Board, Total, Status, Seat_<seat>, Add_<amount>.

const TARGET := 21
## Where each seat sits, from yours (bottom) round the table, by how many play.
const SLOTS: Dictionary = {
	1: ["bottom"],
	2: ["bottom", "top"],
	3: ["bottom", "right", "left"],
	4: ["bottom", "right", "top", "left"],
}
## The hub's ☰ button keeps the top left square: nothing of the game goes there.
const MENU := 88.0

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
## Your seat, -1 when you only watch.
var _me: int = -1
var _board := PanelContainer.new()
var _total := Label.new()
var _status := Label.new()
var _actions := BoxContainer.new()
var _buttons: Array[XomDaoButton] = []
var _slots: Array[XomDaoPlayerSlot] = []


## Options for a sandbox room (`?play=<id>` in a debug build): against the computer.
func sandbox_options() -> Dictionary:
	return {"bots": 1}


## The hub's Tạo phòng board: its rows (`optionsSchema` in src/game/<Name>Game.ts).
func room_setup() -> Array:
	return [
		{
			"key": "bots",
			"label": "Máy chơi",
			"options": [["Không", 0], ["1 máy", 1], ["2 máy", 2], ["3 máy", 3]],
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
	var sea := ColorRect.new()
	sea.color = XomDaoUi.SEA_DEEP
	sea.set_anchors_preset(Control.PRESET_FULL_RECT)
	sea.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(sea)

	_board.name = "Board"
	_board.add_theme_stylebox_override(
		"panel",
		XomDaoUi.with_shadow(
			XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.HONEY_DARK, XomDaoUi.BORDER, 24.0)
		)
	)
	add_child(_board)
	var column := VBoxContainer.new()
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	_board.add_child(column)
	var goal := Label.new()
	goal.text = "Tới %d" % TARGET
	goal.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	goal.add_theme_color_override("font_color", XomDaoUi.HONEY_DARK)
	column.add_child(goal)
	_total.name = "Total"
	_total.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_total.add_theme_font_override("font", XomDaoUi.display_font(800))
	_total.add_theme_font_size_override("font_size", 160)
	_total.add_theme_color_override("font_color", XomDaoUi.INK)
	column.add_child(_total)
	_status.name = "Status"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.add_theme_color_override("font_color", XomDaoUi.INK)
	column.add_child(_status)

	_actions.name = "Actions"
	_actions.add_theme_constant_override("separation", 12)
	add_child(_actions)
	for amount: int in [1, 2, 3]:
		var button: XomDaoButton = XomDaoButton.create("+%d" % amount, XomDaoUi.Kind.PLAY)
		button.name = "Add_%d" % amount
		button.custom_minimum_size.x = 120.0
		button.disabled = true
		button.pressed.connect(_add.bind(amount))
		_actions.add_child(button)
		_buttons.append(button)
	resized.connect(_layout)


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var total: int = int(view.get("total", 0))
	var turn: int = int(view.get("turn", 0))
	_me = -1
	for seat: int in snapshot.seats.size():
		if snapshot.seats[seat].id == _client.player_id:
			_me = seat
	if _slots.size() != snapshot.seats.size():
		_build_seats(snapshot.seats.size())
	var playing: bool = snapshot.status == "playing"
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		var player: XomDaoPlayerInfo = snapshot.seats[seat]
		slot.player_name = _seat_name(seat)
		slot.frame = player.frame
		slot.host = player.id == str(snapshot.host_id)
		var on_turn: bool = playing and seat == turn
		if on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
	_total.text = str(total)
	var mine: bool = playing and turn == _me
	for i: int in _buttons.size():
		_buttons[i].disabled = not mine or total + i + 1 > TARGET
	if not playing:
		_status.text = ""
	elif mine:
		_status.text = "Lượt bạn"
	else:
		_status.text = "Lượt %s" % _seat_name(turn)
	_layout.call_deferred()


func _add(amount: int) -> void:
	for button: XomDaoButton in _buttons:
		button.disabled = true
	await _client.send("add", {"amount": amount})


func _build_seats(count: int) -> void:
	for slot: XomDaoPlayerSlot in _slots:
		slot.queue_free()
	_slots.clear()
	for seat: int in count:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.compact = true
		add_child(slot)
		_slots.append(slot)


## Where a seat sits on screen: bottom (you), right, top or left.
func _place_of(seat: int) -> String:
	var count: int = _slots.size()
	var places: Array = SLOTS.get(count, SLOTS[4])
	return str(places[posmod(seat - maxi(_me, 0), count) % places.size()])


func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var bottom: float = size.y - edge
	# The buttons in a row when it fits beside a board at least 60% of the height.
	var tall: float = size.y - 2.0 * edge
	_actions.vertical = false
	_actions.reset_size()
	var room: float = size.x - 2.0 * (inset.x + edge + _actions.size.x + 16.0)
	if room < tall * 0.6:
		_actions.vertical = true
		_actions.reset_size()
		room = size.x - 2.0 * (inset.x + edge + _actions.size.x + 16.0)
	var side: float = clampf(room, 0.0, tall)
	_board.size = Vector2(side, side)
	_board.position = (size - _board.size) / 2.0
	_actions.position = Vector2(right - _actions.size.x, bottom - _actions.size.y)
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		slot.reset_size()
		var at: Vector2
		match _place_of(seat):
			"bottom":
				at = Vector2(left, bottom - slot.size.y)
			"top":
				at = Vector2(right - slot.size.x, edge)
			"right":
				at = Vector2(right - slot.size.x, (size.y - slot.size.y) / 2.0)
			_:
				at = Vector2(left, maxf(edge + MENU + 12.0, (size.y - slot.size.y) / 2.0))
		slot.position = at


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if _snapshot != null and seat >= 0 and seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "?"
