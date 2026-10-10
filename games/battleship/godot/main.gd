extends Control
## Bắn Tàu on the Godot client, in the **Bàn** layout (docs/experience.md): the ocean, the big
## sea in the middle, the players' column on the left (the other player under ☰, you at the
## bottom, your own sea between you in battle), the status, the other fleet and the buttons on
## the right. It draws `snapshot.view` (View in src/game/model.ts: each seat's waters, the turn,
## the last shot) and sends `arrange {ships}`, `shuffle`, `ready`, `fire {cell}` and `resign`.
##
## Setting up, the big sea is yours: drag a ship to move it (the cells it would take light up
## green, or red where it may not go), tap a ship to pick it, tap it again to turn it, tap an
## empty cell to move the picked ship there; Xếp lại shuffles, Sẵn sàng starts. In battle the big
## sea is the other side's: tap a cell to fire on your turn. Shots splash or burst, sunk ships
## show dark, and both fleets come up at the end.
##
## Named nodes for tests: Big (the big sea), Small (your sea in battle), Seat_<seat>, Status,
## Shot, Fleet_<k>, Shuffle, Ready, Resign.

const Rules := preload("res://content/battleship/rules.gd")
const Sea := preload("res://content/battleship/sea.gd")
const SOUNDS: Array[String] = ["fire", "hit", "miss", "place", "ready", "sunk", "win"]
const BUTTON_WIDTH := 190.0
## The big sea leaves this much (in cells) for its letters and numbers.
const LABELS := 0.9
const GOLD := Color("#FFD54F")
const WIN := Color("#8DFF8A")
const LOSE := Color("#FF8A80")
## A press that moves this far is a drag.
const DRAG := 10.0

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your seat in `players`, or -1 for a spectator (who sees seat 1's sea big).
var _me: int = -1

var _ocean := TextureRect.new()
var _big: Control = Sea.new()
var _small: Control = Sea.new()
var _slots: Array[XomDaoPlayerSlot] = []
var _status := Label.new()
var _shot := Label.new()
var _fleet := VBoxContainer.new()
var _fleet_rows: Array[Control] = []
var _shuffle: XomDaoButton = XomDaoButton.create("Xếp lại", XomDaoUi.Kind.SOCIAL)
var _ready_button: XomDaoButton = XomDaoButton.create("Sẵn sàng", XomDaoUi.Kind.PLAY)
var _resign: XomDaoButton = XomDaoButton.create("Đầu hàng", XomDaoUi.Kind.DANGER)
var _resign_armed: bool = false
var _fx := Control.new()
var _sounds: Dictionary = {}
var _textures: Dictionary = {}

## Setting up: your fleet as placed on this screen (sent on every change), the picked ship.
var _draft: Array = []
var _picked: int = -1
## A press on the big sea: the ship held (-1 none), which of its cells, where it started.
var _pressing: bool = false
var _press_ship: int = -1
var _press_part: int = 0
var _press_from := Vector2.ZERO
var _press_moved: bool = false
## The last shot shown, to play only new ones.
var _last_key: String = ""
var _ended: bool = false


## Options for a sandbox room (`?play=battleship` in a debug build): the computer, easy.
func sandbox_options() -> Dictionary:
	return {"opponent": "bot", "level": "easy"}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	return [
		{"key": "opponent", "label": "Đối thủ", "options": [["Bạn bè", "human"], ["Máy", "bot"]]},
		{
			"key": "level",
			"label": "Máy chơi",
			"options": [["Dễ", "easy"], ["Vừa", "normal"], ["Khó", "hard"]],
			"default": 1,
		},
		{
			"key": "spacing",
			"label": "Xếp tàu",
			"options": [["Không sát nhau", true], ["Được sát nhau", false]],
		},
		{
			"key": "bonus",
			"label": "Bắn trúng",
			"options": [["Được bắn tiếp", true], ["Đổi lượt", false]],
		},
		{
			"key": "swap",
			"label": "Lượt bắn",
			"options": [["Bạn bắn trước", false], ["Đối thủ bắn trước", true]],
		},
	]


## How the game ended and its figures, for the hub's result board.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _view.get("end") == null:
		return {}
	var waters: Array = _view["waters"]
	var fired: Array[String] = []
	var sunk: Array[String] = []
	for seat: int in 2:
		var target: Dictionary = waters[1 - seat]
		fired.append("%s %d" % [_seat_name(seat), (target["shots"] as Array).size()])
		sunk.append("%s %d" % [_seat_name(seat), (target["sunk"] as Array).size()])
	var sank: bool = str((_view["end"] as Dictionary)["reason"]) == "sunk"
	return {
		"reason": "Cả hạm đội bị đánh chìm" if sank else _status.text,
		"rows": [["Phát bắn", " · ".join(fired)], ["Tàu đã đánh chìm", " · ".join(sunk)]],
	}


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	_ocean.texture = _art("ocean")
	_ocean.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_ocean.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_ocean.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_ocean)
	_big.name = "Big"
	_big.gui_input.connect(_on_big_input)
	add_child(_big)
	_small.name = "Small"
	_small.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_small)
	for seat: int in 2:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		add_child(slot)
		_slots.append(slot)
	_status.name = "Status"
	_hud(_status, XomDaoUi.TEXT)
	_shot.name = "Shot"
	_hud(_shot, XomDaoUi.TEXT_MIN)
	for label: Label in [_status, _shot]:
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		add_child(label)
	_fleet.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fleet.add_theme_constant_override("separation", 6)
	add_child(_fleet)
	for k: int in Rules.FLEET.size():
		var length: int = Rules.FLEET[k]
		var row := HBoxContainer.new()
		row.name = "Fleet_%d" % k
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_theme_constant_override("separation", 8)
		var ship := TextureRect.new()
		ship.texture = _art("ship-%d" % length)
		ship.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ship.custom_minimum_size = Vector2(16.0 * length, 16.0)
		ship.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(ship)
		var label := Label.new()
		_hud(label, XomDaoUi.TEXT_MIN - 4)
		label.text = Rules.SHIP_NAMES[length]
		row.add_child(label)
		_fleet.add_child(row)
		_fleet_rows.append(row)
	_shuffle.name = "Shuffle"
	_shuffle.pressed.connect(_on_shuffle)
	_ready_button.name = "Ready"
	_ready_button.pressed.connect(_on_ready)
	_resign.name = "Resign"
	_resign.pressed.connect(_on_resign)
	for button: XomDaoButton in [_shuffle, _ready_button, _resign]:
		button.custom_minimum_size = Vector2(BUTTON_WIDTH, XomDaoUi.TOUCH)
		add_child(button)
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/battleship/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


static func _hud(label: Label, font_size: int) -> void:
	label.theme_type_variation = "HudLabel"
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	label.add_theme_color_override("font_outline_color", XomDaoUi.INK)
	label.add_theme_constant_override("outline_size", 8)


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/battleship/art/%s.webp" % name_of)
	return _textures[name_of]


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var live: bool = not _view.is_empty()
	_view = view
	_me = (view["players"] as Array).find(_client.player_id)
	if live:
		_present()
	_last_key = _key_of(view.get("last"))
	if _arranging() and not _pressing:
		_draft = []
		for ship: Variant in ((view["waters"] as Array)[_me] as Dictionary)["ships"]:
			_draft.append(((ship as Dictionary)["cells"] as Array).map(_to_int))
	elif not _arranging():
		_picked = -1
	_draw_seas()
	_show_hud()
	var ended: bool = view.get("end") != null
	if ended and not _ended and live and _me >= 0:
		if int((view["end"] as Dictionary)["winner"]) == _me:
			_sfx("win")
	_ended = ended
	_layout()


static func _to_int(value: Variant) -> int:
	return int(value)


static func _key_of(last: Variant) -> String:
	if last is not Dictionary:
		return ""
	var shot: Dictionary = last
	return "%d:%d:%s" % [int(shot["by"]), int(shot["cell"]), str(shot["hit"])]


## Setting up and not ready yet: your fleet can still move.
func _arranging() -> bool:
	if _me < 0 or _view.get("end") != null or str(_view["phase"]) != "setup":
		return false
	return not bool((_view["ready"] as Array)[_me])


## The seat whose sea is big: yours while arranging, the other one in battle.
func _big_seat() -> int:
	if _me < 0:
		return 1
	return _me if str(_view["phase"]) == "setup" else 1 - _me


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	var id: String = str((_view["players"] as Array)[seat])
	for player: XomDaoPlayerInfo in _snapshot.players:
		if player.id == id:
			return player.name
	return "Đối thủ"


func _player_info(seat: int) -> XomDaoPlayerInfo:
	var id: String = str((_view["players"] as Array)[seat])
	for player: XomDaoPlayerInfo in _snapshot.players:
		if player.id == id:
			return player
	return XomDaoPlayerInfo.new()


# ── Seas ──────────────────────────────────────────────────────────────────────────────────


func _draw_seas() -> void:
	var waters: Array = _view["waters"]
	var big_seat: int = _big_seat()
	var last: Variant = _view.get("last")
	if _arranging() or (str(_view["phase"]) == "setup" and big_seat == _me):
		var none: Array[bool] = []
		none.resize(_draft.size())
		none.fill(false)
		_big.show_sea(_draft, none, [], -1)
		_big.set("picked", _picked)
	else:
		_show_waters(_big, waters[big_seat], last, 1 - big_seat)
		_big.set("picked", -1)
	_small.visible = str(_view["phase"]) == "battle" or _view.get("end") != null
	_show_waters(_small, waters[1 - big_seat], last, big_seat)
	_big.mouse_default_cursor_shape = (
		Control.CURSOR_POINTING_HAND if _arranging() or _my_turn() else Control.CURSOR_ARROW
	)


## A seat's waters on a sea; `shooter` is who fires at it (for the last shot's frame).
func _show_waters(sea: Control, waters: Dictionary, last: Variant, shooter: int) -> void:
	var ships: Array = []
	var sunk: Array[bool] = []
	var shots: Array = waters["shots"]
	for ship: Variant in waters["ships"]:
		var cells: Array = ((ship as Dictionary)["cells"] as Array).map(_to_int)
		ships.append(cells)
		sunk.append(Rules.is_sunk(cells, shots))
	var at: int = -1
	if last is Dictionary and int((last as Dictionary)["by"]) == shooter:
		at = int((last as Dictionary)["cell"])
	sea.show_sea(ships, sunk, shots, at)


func _my_turn() -> bool:
	return (
		_me >= 0
		and _view.get("end") == null
		and str(_view["phase"]) == "battle"
		and int(_view["turn"]) == _me
	)


## A new shot: the shell lands with a splash or a burst, then the sound of what it did.
func _present() -> void:
	var last: Variant = _snapshot.view.get("last")
	var key: String = _key_of(last)
	if key == "" or key == _last_key:
		return
	var shot: Dictionary = last
	var by: int = int(shot["by"])
	var sea: Control = _big if 1 - by == _big_seat() else _small
	_sfx("fire")
	_burst.call_deferred(sea, int(shot["cell"]), bool(shot["hit"]), shot["sunk"] != null)


func _burst(sea: Control, cell: int, hit: bool, sunk: bool) -> void:
	if not is_inside_tree() or not sea.visible:
		return
	var size_of: float = float(sea.get("cell"))
	var sprite := TextureRect.new()
	sprite.texture = _art("burst" if hit else "splash")
	sprite.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sprite.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sprite.size = Vector2.ONE * size_of * 1.8
	sprite.pivot_offset = sprite.size / 2.0
	var middle: Vector2 = (
		sea.position + sea.call("cell_position", cell) + Vector2.ONE * size_of / 2.0
	)
	sprite.position = middle - sprite.size / 2.0
	sprite.scale = Vector2.ONE * 0.3
	_fx.add_child(sprite)
	var tween: Tween = sprite.create_tween()
	tween.tween_property(sprite, "scale", Vector2.ONE * 1.2, 0.22).set_trans(Tween.TRANS_BACK)
	tween.tween_callback(_sfx.bind("hit" if hit else "miss"))
	tween.tween_property(sprite, "modulate:a", 0.0, 0.45)
	tween.tween_callback(sprite.queue_free)
	if sunk:
		await get_tree().create_timer(0.45).timeout
		_sfx("sunk")


# ── Arranging and firing ──────────────────────────────────────────────────────────────────


func _spacing() -> bool:
	if _snapshot.options is Dictionary:
		return bool((_snapshot.options as Dictionary).get("spacing", true))
	return true


func _ship_with(cell: int) -> int:
	for i: int in _draft.size():
		if (_draft[i] as Array).has(cell):
			return i
	return -1


func _others(ship: int) -> Array:
	var others: Array = _draft.duplicate()
	others.remove_at(ship)
	return others


## Where ship `ship` lands when its cell `part` goes to `cell`, keeping its direction.
func _moved(ship: int, part: int, cell: int, vertical: bool) -> Array:
	var length: int = (_draft[ship] as Array).size()
	var row: int = cell / Rules.SIZE - (part if vertical else 0)
	var col: int = cell % Rules.SIZE - (0 if vertical else part)
	return Rules.ship_at(row, col, length, vertical)


func _on_big_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		var cell: int = _big.call("cell_at", button.position)
		if button.pressed:
			if _my_turn():
				_fire(cell)
			elif _arranging():
				_press(cell, button.position)
		elif _pressing:
			_release(cell)
		return
	var motion := event as InputEventMouseMotion
	if motion != null and _pressing and _press_ship >= 0:
		_press_moved = _press_moved or motion.position.distance_to(_press_from) > DRAG
		if not _press_moved:
			return
		var cell: int = _big.call("cell_at", motion.position)
		var ship: Array = (
			_moved(_press_ship, _press_part, cell, Rules.is_vertical(_draft[_press_ship]))
			if cell >= 0
			else []
		)
		_big.set("ghost", ship)
		_big.set("ghost_ok", Rules.fits(ship, _others(_press_ship), _spacing()))
		_big.call("redraw_marks")


func _press(cell: int, at: Vector2) -> void:
	if cell < 0:
		return
	_pressing = true
	_press_from = at
	_press_moved = false
	_press_ship = _ship_with(cell)
	_press_part = (_draft[_press_ship] as Array).find(cell) if _press_ship >= 0 else 0


## Let go: a drag drops the ship where it may go; a tap picks, turns or moves.
func _release(cell: int) -> void:
	_pressing = false
	_big.set("ghost", [])
	var ship: int = _press_ship
	var changed: bool = false
	if ship >= 0 and _press_moved:
		if cell >= 0:
			var moved: Array = _moved(ship, _press_part, cell, Rules.is_vertical(_draft[ship]))
			changed = _place(ship, moved)
	elif ship >= 0 and ship == _picked:
		var cells: Array = _draft[ship]
		var first: int = int(cells.min())
		var turned: Array = Rules.ship_at(
			first / Rules.SIZE, first % Rules.SIZE, cells.size(), not Rules.is_vertical(cells)
		)
		changed = _place(ship, turned)
	elif ship >= 0:
		_picked = ship
	elif _picked >= 0 and cell >= 0:
		var moved: Array = _moved(_picked, 0, cell, Rules.is_vertical(_draft[_picked]))
		changed = _place(_picked, moved)
	_draw_seas()
	_big.call("redraw_marks")
	if changed:
		_sfx("place")
		_send_fleet()


func _place(ship: int, cells: Array) -> bool:
	if not Rules.fits(cells, _others(ship), _spacing()):
		return false
	_draft[ship] = cells
	return true


func _send_fleet() -> void:
	var ships: Array = []
	for ship: Variant in _draft:
		ships.append({"cells": ship})
	await _client.send("arrange", {"ships": ships})


func _fire(cell: int) -> void:
	if cell < 0:
		return
	var waters: Dictionary = (_view["waters"] as Array)[1 - _me]
	for shot: Variant in waters["shots"]:
		if int((shot as Dictionary)["cell"]) == cell:
			return
	await _client.send("fire", {"cell": cell})


func _on_shuffle() -> void:
	_picked = -1
	_sfx("place")
	await _client.send("shuffle")


func _on_ready() -> void:
	_picked = -1
	_sfx("ready")
	_ready_button.visible = false
	_shuffle.visible = false
	await _client.send("ready")


## Đầu hàng asks once more ("Chắc chưa?") for three seconds.
func _on_resign() -> void:
	if _resign_armed:
		_resign_armed = false
		_resign.text = "Đầu hàng"
		await _client.send("resign")
		return
	_resign_armed = true
	_resign.text = "Chắc chưa?"
	await get_tree().create_timer(3.0).timeout
	if _resign_armed:
		_resign_armed = false
		_resign.text = "Đầu hàng"


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


# ── Status ────────────────────────────────────────────────────────────────────────────────


func _show_hud() -> void:
	var phase: String = str(_view["phase"])
	var end: Variant = _view.get("end")
	var ready: Array = _view["ready"]
	var status: String = ""
	if end is Dictionary:
		var winner: int = int((end as Dictionary)["winner"])
		var loser: int = 1 - winner
		match str((end as Dictionary)["reason"]):
			"resign":
				status = "%s đầu hàng" % _seat_name(loser)
			"left":
				status = "%s rời trận" % _seat_name(loser)
			_:
				status = "Bạn thắng" if winner == _me else "%s thắng" % _seat_name(winner)
	elif phase == "setup":
		if _me < 0:
			status = "Đang xếp tàu"
		else:
			status = "Chờ đối thủ" if bool(ready[_me]) else "Xếp tàu"
	else:
		var turn: int = int(_view["turn"])
		status = "Lượt bạn" if turn == _me else "Lượt %s" % _seat_name(turn)
	_status.text = status
	var last: Variant = _view.get("last")
	var shot: String = ""
	if last is Dictionary and phase == "battle":
		var info: Dictionary = last
		var what: String = "Trượt"
		if info["sunk"] != null:
			what = "Chìm %s" % Rules.SHIP_NAMES.get((info["sunk"] as Array).size(), "")
		elif bool(info["hit"]):
			what = "Trúng"
		shot = "%s: %s" % [Rules.cell_name(int(info["cell"])), what]
		_shot.add_theme_color_override(
			"font_color", (WIN if int(info["by"]) == _me else LOSE) if bool(info["hit"]) else GOLD
		)
	_shot.text = shot
	# The fleet under fire on the big sea: sunk ships fade.
	var sunk: Array = ((_view["waters"] as Array)[_big_seat()] as Dictionary)["sunk"]
	var left: Array = sunk.map(_to_int)
	_fleet.visible = phase == "battle" or end != null
	for k: int in Rules.FLEET.size():
		var length: int = Rules.FLEET[k]
		var gone: bool = left.has(length)
		if gone:
			left.erase(length)
		_fleet_rows[k].modulate.a = 0.35 if gone else 1.0
	var arranging: bool = _arranging()
	_shuffle.visible = arranging
	_ready_button.visible = arranging
	_resign.visible = _me >= 0 and end == null
	for seat: int in 2:
		var slot: XomDaoPlayerSlot = _slots[seat]
		var info: XomDaoPlayerInfo = _player_info(seat)
		slot.player_name = _seat_name(seat)
		slot.frame = info.frame
		slot.host = info.id != "" and info.id == str(_snapshot.host_id)
		var afloat: int = (
			Rules.FLEET.size()
			- (((_view["waters"] as Array)[seat] as Dictionary)["sunk"] as Array).size()
		)
		slot.extra = "%d tàu" % afloat
		var on_turn: bool = (
			end == null
			and (
				(phase == "battle" and int(_view["turn"]) == seat)
				or (phase == "setup" and not bool(ready[seat]))
			)
		)
		if on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## The big sea as tall as the frame in the middle; the players' column (and your small sea) on
## its left, the status, the fleet and the buttons on its right.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	_ocean.size = size
	var seats_width: float = 220.0
	for slot: XomDaoPlayerSlot in _slots:
		slot.reset_size()
		seats_width = maxf(seats_width, slot.size.x)
	var buttons_width: float = BUTTON_WIDTH
	for button: XomDaoButton in [_ready_button, _shuffle, _resign]:
		button.reset_size()
		buttons_width = maxf(buttons_width, button.size.x)
	var room: float = right - left - seats_width - buttons_width - 48.0
	var side: float = clampf(minf(size.y - 2.0 * edge - 8.0, room), 240.0, size.y)
	var cell: float = side / (Rules.SIZE + LABELS)
	_big.set("cell", cell)
	var between: float = left + seats_width + 24.0
	_big.position = Vector2(
		between + maxf(0.0, (room - side) / 2.0) + cell * LABELS,
		(size.y - side) / 2.0 + cell * LABELS
	)
	# Left column: the other player under ☰, you at the bottom, your sea between.
	var you: int = maxi(_me, 0)
	var top_y: float = edge + XomDaoUi.TOUCH + 12.0
	_slots[1 - you].position = Vector2(left, top_y)
	_slots[you].position = Vector2(left, size.y - edge - _slots[you].size.y)
	var gap_top: float = top_y + _slots[1 - you].size.y + 34.0
	var gap_bottom: float = _slots[you].position.y - 12.0
	var small_cell: float = clampf(
		minf((seats_width - 30.0) / Rules.SIZE, (gap_bottom - gap_top) / Rules.SIZE), 8.0, 26.0
	)
	_small.set("cell", small_cell)
	_small.position = Vector2(
		left + 24.0 + (seats_width - 24.0 - small_cell * Rules.SIZE) / 2.0,
		gap_top + (gap_bottom - gap_top - small_cell * Rules.SIZE) / 2.0
	)
	# Right column: the status and the last shot at the top, the fleet, the buttons below.
	var column_left: float = _big.position.x + cell * Rules.SIZE + 24.0
	var width: float = maxf(right - column_left, BUTTON_WIDTH)
	for label: Label in [_status, _shot]:
		label.size = Vector2(width, 0.0)
		label.reset_size()
		label.size.x = width
	_status.position = Vector2(column_left, edge)
	_shot.position = Vector2(column_left, _status.position.y + _status.size.y + 4.0)
	_fleet.reset_size()
	_fleet.position = Vector2(column_left, _shot.position.y + maxf(_shot.size.y, 30.0) + 12.0)
	var y: float = size.y - edge
	for button: XomDaoButton in [_ready_button, _shuffle, _resign]:
		if not button.visible:
			continue
		button.reset_size()
		y -= button.size.y
		button.position = Vector2(right - button.size.x, y)
		y -= 10.0
