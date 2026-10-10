extends Control
## __NAME__
##
## The game on the Godot client, in the **Hành động** layout (docs/experience.md): the scene
## fills the screen; the goal sits at the top left under the hub's ☰, the counter at the top
## right, the players at the bottom left (where a joystick would go) and the +1 / +2 / +3
## buttons at the bottom right. It draws `snapshot.view` (State in src/game/<Name>Game.ts) and
## sends `add {amount}`. The hub adds this scene when the room's game starts, calls `bind` and
## draws the ☰ menu, the room and the result.
##
## Named nodes for tests: Goal, Total, Status, Seat_<seat>, Add_<amount>.

const TARGET := 21
## The hub's ☰ button keeps the top left square: the goal goes under it.
const MENU := 88.0

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
## Your seat, -1 when you only watch.
var _me: int = -1
var _scene := Control.new()
var _goal: XomDaoChip = XomDaoChip.create("Tới %d" % TARGET, "flag-banner")
var _total := Label.new()
var _status := Label.new()
var _seats := HBoxContainer.new()
var _actions := HBoxContainer.new()
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
	_scene.set_anchors_preset(Control.PRESET_FULL_RECT)
	_scene.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scene.draw.connect(_draw_scene)
	_scene.resized.connect(_scene.queue_redraw)
	add_child(_scene)
	_goal.name = "Goal"
	add_child(_goal)
	_total.name = "Total"
	_total.theme_type_variation = "HudLabel"
	_total.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_total.add_theme_font_override("font", XomDaoUi.display_font(800))
	_total.add_theme_font_size_override("font_size", 96)
	add_child(_total)
	_status.name = "Status"
	_status.theme_type_variation = "HudLabel"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_status)
	_seats.name = "Seats"
	_seats.add_theme_constant_override("separation", 12)
	add_child(_seats)
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
	_scene.queue_redraw()
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
		_seats.add_child(slot)
		_slots.append(slot)


func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var bottom: float = size.y - edge
	_goal.reset_size()
	_goal.position = Vector2(left, edge + MENU + 12.0)
	_total.reset_size()
	_total.position = Vector2(right - _total.size.x, edge)
	_status.reset_size()
	_status.position = Vector2(right - _status.size.x, edge + _total.size.y)
	_actions.reset_size()
	_actions.position = Vector2(right - _actions.size.x, bottom - _actions.size.y)
	_seats.reset_size()
	_seats.position = Vector2(left, bottom - _seats.size.y)


## The scene: sky, sea and an islet with a heap of stones that grows with the total.
func _draw_scene() -> void:
	var area: Vector2 = _scene.size
	_scene.draw_rect(Rect2(Vector2.ZERO, area), XomDaoUi.SKY)
	var shore: float = area.y * 0.62
	_scene.draw_rect(Rect2(0.0, shore, area.x, area.y - shore), XomDaoUi.SEA)
	var total: int = 0
	if _snapshot != null and _snapshot.view is Dictionary:
		total = int((_snapshot.view as Dictionary).get("total", 0))
	var middle := Vector2(area.x / 2.0, shore + 40.0)
	_scene.draw_set_transform(middle + Vector2(0.0, 20.0), 0.0, Vector2(1.0, 0.3))
	_scene.draw_circle(Vector2.ZERO, 300.0, XomDaoUi.SAND)
	_scene.draw_set_transform(Vector2.ZERO)
	for i: int in total:
		var at := middle + Vector2((i % 7 - 3) * 34.0, -(i / 7) * 30.0)
		_scene.draw_circle(at, 16.0, XomDaoUi.HONEY_DARK)
		_scene.draw_circle(at - Vector2(4.0, 4.0), 12.0, XomDaoUi.HONEY)


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if _snapshot != null and seat >= 0 and seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "?"
