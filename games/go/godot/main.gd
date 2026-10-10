extends Control
## Cờ Vây on the Godot client, in the **Bàn** layout (docs/experience.md): the wooden board in the
## middle, as tall as the frame; the two players in the column on its left (yours at the bottom,
## the other under the hub's ☰), each with a bowl of stones and a lid of the stones they took;
## the status, the move count or the count, and Bỏ lượt, Đồng ý, Đánh tiếp, Đầu hàng in the
## column on its right. It draws `snapshot.view` (View in src/game/model.ts, with the points you
## may play on your turn and, while counting, the count) and sends `place {point}`, `pass`,
## `mark {point}`, `accept`, `resume` and `resign`.
##
## On your turn the stone you would play follows the mouse; while a finger (or the mouse) is down
## a loupe shows the points round it, and letting go plays there. After two passes the count
## starts: dead stones fade and each point a side gets shows a small square of its color; tap a
## chain to mark it dead or alive, Đồng ý to agree, Đánh tiếp to play on. Taken stones fly to the
## taker's lid. Đầu hàng asks first.
##
## Named nodes for tests: Board, Zone (the taps), Point_<p> (one per intersection,
## p = row * size + col from the top), Stone_<p>, Status, Details, Seat_<seat>, Bowl_<seat>,
## Lid_<seat>, Pass, Accept, Resume, Resign, ResignDialog with ConfirmResign and KeepPlaying.

const SIZE := 19
## Black moves first and starts at the bottom.
const FIRST := "b"
const SIDE_NAMES: Dictionary = {"b": "Đen", "w": "Trắng"}
const ART: Dictionary = {"b": "stone-black", "w": "stone-white"}
## Stones each side starts with in its bowl.
const STONES: Dictionary = {"b": 181, "w": 180}
const LINE := Color("#3B2A14")
const LAST := Color("#E0463A")
const BLACK := Color("#1B1B1B")
const WHITE := Color("#F5F2EA")
const GOLDEN_ANGLE := PI * (3.0 - sqrt(5.0))
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const COLUMN := 230.0
const BUTTON_WIDTH := 210.0
const SOUNDS: Array[String] = [
	"capture", "count", "end", "pass", "place-1", "place-2", "place-3", "start"
]

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your side ("b", "w"), or "" for a spectator (who looks from Black's side).
var _mine: String = ""

var _cloth := TextureRect.new()
var _board := TextureRect.new()
var _lines := Control.new()
var _shadows := Control.new()
var _stones_layer := Control.new()
var _marks := Control.new()
var _ghost := TextureRect.new()
var _loupe := Control.new()
var _points := Control.new()
var _zone := Control.new()
var _status := Label.new()
var _details := Label.new()
var _pass: XomDaoButton = XomDaoButton.create("Bỏ lượt", XomDaoUi.Kind.INFO)
var _accept: XomDaoButton = XomDaoButton.create("Đồng ý", XomDaoUi.Kind.CONFIRM)
var _resume: XomDaoButton = XomDaoButton.create("Đánh tiếp", XomDaoUi.Kind.INFO)
var _resign: XomDaoButton = XomDaoButton.create("Đầu hàng", XomDaoUi.Kind.DANGER)
var _dialog: XomDaoBoard = XomDaoBoard.create("Đầu hàng?")
var _shade := ColorRect.new()
var _slots: Array[XomDaoPlayerSlot] = []
var _bowls: Array[Control] = []
var _lids: Array[Control] = []
var _sounds: Dictionary = {}
var _textures: Dictionary = {}

## Stones on screen: point → TextureRect, and the side each shows.
var _stones: Dictionary = {}
var _sides: Dictionary = {}
var _moves: Array = []
var _hovered: int = -1
var _pressed: bool = false
var _plies: int = -1
var _seq: int = -1
var _ended: bool = false
## Where point (0, 0) is on screen and the gap between lines.
var _origin := Vector2.ZERO
var _cell: float = 30.0


## Options for a sandbox room (`?play=go` in a debug build): against the computer.
func sandbox_options() -> Dictionary:
	return {"opponent": "bot"}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts).
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
			"key": "swap",
			"label": "Bạn cầm quân",
			"options": [["Đen (đi trước)", false], ["Trắng", true]],
		},
	]


## How the game ended and its figures, for the hub's result board.
func result_detail() -> Dictionary:
	# The hub may ask before this scene heard the last state.
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	var end: Variant = _view.get("end")
	if end is not Dictionary:
		return {}
	var winner: String = str((end as Dictionary).get("winner", FIRST))
	var reason: String = str((end as Dictionary).get("reason", ""))
	var count: Variant = (end as Dictionary).get("score")
	var prisoners: Dictionary = _view.get("prisoners", {})
	var rows: Array = [
		["Số nước", str(int(_view.get("plies", 0)))],
		["Quân đã bắt", "Đen %d · Trắng %d" % [prisoners.get("b", 0), prisoners.get("w", 0)]],
	]
	var how: String
	if reason == "score" and count is Dictionary:
		var b: float = float((count as Dictionary).get("b", 0))
		var w: float = float((count as Dictionary).get("w", 0))
		how = "%s thắng %s điểm" % [_name_of(winner), _num(absf(b - w))]
		rows.append(["Đếm điểm", "Đen %s · Trắng %s" % [_num(b), _num(w)]])
	else:
		var loser: String = _name_of(_other(winner))
		how = "%s %s" % [loser, "đầu hàng" if reason == "resign" else "rời bàn"]
	return {"reason": how, "rows": rows}


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	var night := ColorRect.new()
	night.color = Color("#0F2A26")
	night.set_anchors_preset(Control.PRESET_FULL_RECT)
	night.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(night)
	_cloth.texture = _art("cloth")
	_cloth.stretch_mode = TextureRect.STRETCH_TILE
	_cloth.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	_cloth.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_cloth)

	_board.name = "Board"
	_board.texture = _art("board")
	_board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_board.stretch_mode = TextureRect.STRETCH_SCALE
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	for layer: Control in [_lines, _shadows, _stones_layer, _marks, _points]:
		layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(layer)
	_lines.draw.connect(_draw_lines)
	_shadows.draw.connect(_draw_shadows)
	_marks.draw.connect(_draw_marks)
	for p: int in SIZE * SIZE:
		var spot := Control.new()
		spot.name = "Point_%d" % p
		spot.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_points.add_child(spot)
	_ghost.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_ghost.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ghost.modulate.a = 0.45
	_ghost.visible = false
	add_child(_ghost)
	_zone.name = "Zone"
	_zone.mouse_filter = Control.MOUSE_FILTER_STOP
	_zone.gui_input.connect(_on_zone_input)
	_zone.mouse_exited.connect(_hover.bind(-1))
	add_child(_zone)
	_loupe.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_loupe.visible = false
	_loupe.draw.connect(_draw_loupe)
	add_child(_loupe)

	_status.name = "Status"
	_status.theme_type_variation = "HudLabel"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_status)
	_details.name = "Details"
	_details.theme_type_variation = "HudLabel"
	_details.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_details)
	_pass.name = "Pass"
	_pass.pressed.connect(_send.bind("pass"))
	_accept.name = "Accept"
	_accept.pressed.connect(_send.bind("accept"))
	_resume.name = "Resume"
	_resume.pressed.connect(_send.bind("resume"))
	_resign.name = "Resign"
	_resign.pressed.connect(_open_dialog)
	for button: XomDaoButton in [_pass, _accept, _resume, _resign]:
		button.custom_minimum_size.x = BUTTON_WIDTH
		add_child(button)
	for seat: int in 2:
		var bowl := Control.new()
		bowl.name = "Bowl_%d" % seat
		bowl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bowl.draw.connect(_draw_bowl.bind(seat, false))
		add_child(bowl)
		_bowls.append(bowl)
		var lid := Control.new()
		lid.name = "Lid_%d" % seat
		lid.mouse_filter = Control.MOUSE_FILTER_IGNORE
		lid.draw.connect(_draw_bowl.bind(seat, true))
		add_child(lid)
		_lids.append(lid)
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.compact = true
		add_child(slot)
		_slots.append(slot)
	_build_dialog()
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/go/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


## Đầu hàng? over a shade that plays on when tapped, so a stray touch can't end the game.
func _build_dialog() -> void:
	_shade.color = Color(0.0, 0.0, 0.0, 0.5)
	_shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_shade.visible = false
	_shade.gui_input.connect(
		func(event: InputEvent) -> void:
			if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
				_close_dialog()
	)
	add_child(_shade)
	_dialog.name = "ResignDialog"
	_dialog.visible = false
	add_child(_dialog)
	var body := Label.new()
	body.text = "Bạn sẽ thua ván này."
	body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_dialog.content.add_child(body)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	_dialog.content.add_child(row)
	var confirm: XomDaoButton = XomDaoButton.create("Đầu hàng", XomDaoUi.Kind.DANGER)
	confirm.name = "ConfirmResign"
	confirm.pressed.connect(
		func() -> void:
			_close_dialog()
			await _client.send("resign")
	)
	row.add_child(confirm)
	var keep: XomDaoButton = XomDaoButton.create("Chơi tiếp", XomDaoUi.Kind.CONFIRM)
	keep.name = "KeepPlaying"
	keep.pressed.connect(_close_dialog)
	row.add_child(keep)


func _open_dialog() -> void:
	_shade.visible = true
	_dialog.visible = true
	_dialog.reset_size()
	_dialog.position = (size - _dialog.size) / 2.0


func _close_dialog() -> void:
	_shade.visible = false
	_dialog.visible = false


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var players: Array = view.get("players", [])
	var was: String = _mine
	_mine = ""
	if players.size() == 2:
		if str(players[0]) == _client.player_id:
			_mine = FIRST
		elif str(players[1]) == _client.player_id:
			_mine = _other(FIRST)
	var plies: int = int(view.get("plies", 0))
	var fresh: bool = plies == 0 and (_plies != 0 or _view.is_empty())
	var live: bool = not _view.is_empty() and not fresh
	_view = view
	_moves = view.get("moves", [])
	if fresh:
		_clear_stones()
		_sfx("start")
	var event: String = ""
	if snapshot.last != null and snapshot.last.seq != _seq:
		if _seq >= 0 and snapshot.last.move is Dictionary:
			event = str((snapshot.last.move as Dictionary).get("event", ""))
		_seq = snapshot.last.seq
	if live:
		_play_sound(event, plies)
	_sync_stones(live and event == "place")
	_plies = plies
	if _hovered >= 0 and not _moves.has(_hovered):
		_hover(-1)
	_show_seats()
	_show_status()
	_show_buttons()
	var ended: bool = view.get("end") != null
	if ended and not _ended and live:
		_sfx("end")
	if ended:
		_close_dialog()
	_ended = ended
	if was != _mine:
		_layout()
	_marks.queue_redraw()
	_shadows.queue_redraw()


func _play_sound(event: String, plies: int) -> void:
	match event:
		"place":
			_sfx("place-%d" % (plies % 3 + 1))
			var last: Variant = _view.get("last")
			if (
				last is Dictionary
				and not ((last as Dictionary).get("captured", []) as Array).is_empty()
			):
				get_tree().create_timer(0.09).timeout.connect(_sfx.bind("capture"))
		"pass":
			_sfx("count" if str(_view.get("phase", "")) == "scoring" else "pass")
		"mark":
			_sfx("pass")
		"resume":
			_sfx("start")


# ── Board ─────────────────────────────────────────────────────────────────────────────────


func _point_at(p: int) -> Vector2:
	return _origin + Vector2(p % SIZE, p / SIZE) * _cell


## The point under a position on screen, or -1 off the board.
func _point_under(at: Vector2) -> int:
	var col: int = roundi((at.x - _origin.x) / _cell)
	var row: int = roundi((at.y - _origin.y) / _cell)
	if col < 0 or col >= SIZE or row < 0 or row >= SIZE:
		return -1
	return row * SIZE + col


func _stone_rect(p: int) -> Rect2:
	var side: float = _cell * 1.04
	return Rect2(_point_at(p) - Vector2.ONE * side / 2.0, Vector2(side, side))


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/go/art/%s.webp" % name_of)
	return _textures[name_of]


func _clear_stones() -> void:
	for stone: TextureRect in _stones.values():
		stone.queue_free()
	_stones.clear()
	_sides.clear()


## Makes the stones on screen match the board. After a capture the taken stones fly to the
## taker's lid; anything else (joining late, a new game) appears at once.
func _sync_stones(animate: bool) -> void:
	var board: String = str(_view.get("board", ""))
	var last: Variant = _view.get("last")
	var captured: Array = (last as Dictionary).get("captured", []) if last is Dictionary else []
	var taker: String = str((last as Dictionary).get("side", "")) if last is Dictionary else ""
	for p: int in _stones.keys():
		if p < board.length() and board[p] == _sides[p]:
			continue
		var stone: TextureRect = _stones[p]
		_stones.erase(p)
		_sides.erase(p)
		if animate and captured.has(p) and is_inside_tree():
			var lid: Control = _lids[0 if taker == _side_at_bottom() else 1]
			var target: Vector2 = lid.position + lid.size / 2.0 - stone.size / 4.0
			stone.move_to_front()
			var tween: Tween = stone.create_tween().set_parallel()
			var delay: float = captured.find(p) * 0.028
			tween.tween_property(stone, "position", target, 0.38).set_delay(delay).set_trans(
				Tween.TRANS_CUBIC
			)
			tween.tween_property(stone, "size", stone.size / 2.0, 0.38).set_delay(delay)
			tween.chain().tween_callback(stone.queue_free)
		else:
			stone.queue_free()
	for p: int in board.length():
		var side: String = board[p]
		if side == "." or _stones.has(p):
			continue
		var stone := TextureRect.new()
		stone.name = "Stone_%d" % p
		stone.texture = _art(ART[side])
		stone.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		stone.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_stones_layer.add_child(stone)
		_stones[p] = stone
		_sides[p] = side
	_place_stones()
	for i: int in 2:
		_bowls[i].queue_redraw()
		_lids[i].queue_redraw()


func _place_stones() -> void:
	var dead: Array = _view.get("dead", [])
	var counting: bool = _counting()
	for p: int in _stones.keys():
		var stone: TextureRect = _stones[p]
		var rect: Rect2 = _stone_rect(p)
		stone.position = rect.position
		stone.size = rect.size
		var faint: bool = counting and (dead.has(float(p)) or dead.has(p))
		stone.modulate.a = 0.4 if faint else 1.0


func _counting() -> bool:
	var end: Variant = _view.get("end")
	return (
		str(_view.get("phase", "")) == "scoring"
		or end is Dictionary and str((end as Dictionary).get("reason", "")) == "score"
	)


## The lines, the border and the star points.
func _draw_lines() -> void:
	var span: float = (SIZE - 1) * _cell
	for i: int in SIZE:
		var along := Vector2(0.0, i * _cell)
		_lines.draw_line(_origin + along, _origin + along + Vector2(span, 0.0), LINE, 1.15, true)
		var down := Vector2(i * _cell, 0.0)
		_lines.draw_line(_origin + down, _origin + down + Vector2(0.0, span), LINE, 1.15, true)
	_lines.draw_rect(Rect2(_origin, Vector2.ONE * span), LINE, false, 1.8, true)
	for row: int in [3, 9, 15]:
		for col: int in [3, 9, 15]:
			var star: Vector2 = _point_at(row * SIZE + col)
			_lines.draw_circle(star, maxf(2.6, _cell * 0.09), LINE, true, -1.0, true)


## A soft contact shadow under each stone (fainter under dead ones).
func _draw_shadows() -> void:
	var dead: Array = _view.get("dead", [])
	var counting: bool = _counting()
	for p: int in _stones.keys():
		var faint: bool = counting and (dead.has(float(p)) or dead.has(p))
		var at: Vector2 = _point_at(p) + Vector2(_cell * 0.025, _cell * 0.07)
		for i: int in range(4, 0, -1):
			var color := Color("#20180F", 0.035 if faint else 0.1)
			_shadows.draw_circle(at, _cell * (0.4 + i * 0.024), color, true, -1.0, true)


## The last stone's ring and the ko point; while counting (and after a count), each point a side
## gets shows a small square of its color.
func _draw_marks() -> void:
	_place_stones()
	if _counting():
		var count: Variant = _view.get("count")
		if count is not Dictionary:
			return
		var owner: String = str((count as Dictionary).get("owner", ""))
		var board: String = str(_view.get("board", ""))
		var half: float = _cell * 0.16
		for p: int in owner.length():
			var side: String = owner[p]
			if side == "." or (p < board.length() and board[p] == side):
				continue
			var square := Rect2(_point_at(p) - Vector2.ONE * half, Vector2.ONE * half * 2.0)
			_marks.draw_rect(square, BLACK if side == "b" else WHITE)
			_marks.draw_rect(square, Color(WHITE if side == "b" else BLACK, 0.6), false, 1.0)
		return
	var last: Variant = _view.get("last")
	if last is Dictionary and (last as Dictionary).get("point") != null:
		var at: Vector2 = _point_at(int((last as Dictionary)["point"]))
		var width: float = maxf(2.0, _cell * 0.07)
		_marks.draw_arc(at, _cell * 0.22, 0.0, TAU, 32, LAST, width, true)
	var ko: Variant = _view.get("ko")
	if ko != null and _view.get("end") == null:
		var half: float = _cell * 0.22
		var square := Rect2(_point_at(int(ko)) - Vector2.ONE * half, Vector2.ONE * half * 2.0)
		_marks.draw_rect(square, Color(LINE, 0.9), false, maxf(2.0, _cell * 0.06))


## A bowl of the stones a side has left, or its lid with the stones it took.
func _draw_bowl(seat: int, lid: bool) -> void:
	var control: Control = _lids[seat] if lid else _bowls[seat]
	var side: String = _side_at_bottom() if seat == 0 else _other(_side_at_bottom())
	var diameter: float = control.size.x
	control.draw_texture_rect(
		_art("bowl-lid" if lid else "bowl"), Rect2(Vector2.ZERO, control.size), false
	)
	if _view.is_empty():
		return
	var prisoners: Dictionary = _view.get("prisoners", {})
	var count: int
	var art: String
	if lid:
		count = int(prisoners.get(side, 0))
		art = ART[_other(side)]
	else:
		var board: String = str(_view.get("board", ""))
		count = int(STONES[side]) - board.count(side) - int(prisoners.get(_other(side), 0))
		art = ART[side]
	var stone: float = diameter * (0.12 if lid else 0.1)
	var center: Vector2 = control.size / 2.0
	for i: int in mini(count, 111):
		var layer: int = i / 37
		var slot: int = i % 37
		var angle: float = slot * GOLDEN_ANGLE + layer * 0.71
		var radius: float = sqrt((slot + 0.5) / 37.0) * diameter * 0.285
		var at: Vector2 = center + Vector2(cos(angle), sin(angle)) * radius
		control.draw_texture_rect(
			_art(art), Rect2(at - Vector2.ONE * stone / 2.0, Vector2.ONE * stone), false
		)


# ── Taps ──────────────────────────────────────────────────────────────────────────────────


## Mouse over the board shows the stone you would play; a press shows the loupe too, and letting
## go plays (or, while counting, marks the chain there).
func _on_zone_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var motion := event as InputEventMouseMotion
		_hover(_point_under(_zone.position + motion.position))
	elif event is InputEventMouseButton:
		var button := event as InputEventMouseButton
		if button.button_index != MOUSE_BUTTON_LEFT:
			return
		var p: int = _point_under(_zone.position + button.position)
		if button.pressed:
			_pressed = true
			_hover(p)
		else:
			_pressed = false
			_hover(-1)
			_tap(p)


func _tap(p: int) -> void:
	if p < 0 or _mine == "" or _view.get("end") != null:
		return
	if str(_view.get("phase", "")) == "scoring":
		if str(_view.get("board", ""))[p] != ".":
			await _client.send("mark", {"point": p})
		return
	if not _moves.has(float(p)) and not _moves.has(p):
		return
	_moves = []
	await _client.send("place", {"point": p})


func _hover(p: int) -> void:
	var shown: bool = p >= 0 and (_moves.has(float(p)) or _moves.has(p))
	_hovered = p if shown else -1
	_ghost.visible = shown
	_loupe.visible = shown and _pressed
	if not shown:
		return
	_ghost.texture = _art(ART[_mine])
	var rect: Rect2 = _stone_rect(p)
	_ghost.position = rect.position
	_ghost.size = rect.size
	var at: Vector2 = _point_at(p)
	var above: float = at.y - 118.0
	_loupe.position = Vector2(at.x, above if above - 72.0 > _origin.y - _cell else at.y + 118.0)
	_loupe.queue_redraw()


## The loupe: the 3 × 3 points round the hovered one, bigger, with the stone you would play.
func _draw_loupe() -> void:
	if _hovered < 0:
		return
	_loupe.draw_circle(Vector2.ZERO, 72.0, Color("#102D29", 0.98), true, -1.0, true)
	_loupe.draw_arc(Vector2.ZERO, 72.0, 0.0, TAU, 48, Color("#E5BD72"), 2.0, true)
	for at: float in [-36.0, 0.0, 36.0]:
		var line := Color("#F2CE8B", 0.5)
		_loupe.draw_line(Vector2(-52.0, at), Vector2(52.0, at), line, 1.0)
		_loupe.draw_line(Vector2(at, -52.0), Vector2(at, 52.0), line, 1.0)
	var board: String = str(_view.get("board", ""))
	var row: int = _hovered / SIZE
	var col: int = _hovered % SIZE
	for i: int in 9:
		var r: int = row + i / 3 - 1
		var c: int = col + i % 3 - 1
		if r < 0 or r >= SIZE or c < 0 or c >= SIZE:
			continue
		var side: String = _mine if i == 4 else board[r * SIZE + c]
		if side == ".":
			continue
		var center := Vector2((i % 3 - 1) * 36.0, (i / 3 - 1) * 36.0)
		var color := Color(1.0, 1.0, 1.0, 0.7 if i == 4 else 1.0)
		_loupe.draw_texture_rect(
			_art(ART[side]), Rect2(center - Vector2.ONE * 18.5, Vector2.ONE * 37.0), false, color
		)


# ── Players, status and buttons ───────────────────────────────────────────────────────────


static func _other(side: String) -> String:
	return "w" if side == "b" else "b"


## 7.5 → "7,5" (Vietnamese decimals).
static func _num(value: float) -> String:
	if is_equal_approx(value, roundf(value)):
		return str(int(value))
	return str(value).replace(".", ",")


func _side_at_bottom() -> String:
	return _other(FIRST) if _mine == _other(FIRST) else FIRST


## The id playing a side.
func _player_of(side: String) -> String:
	var players: Array = _view.get("players", [])
	if players.size() < 2:
		return ""
	return str(players[0 if side == FIRST else 1])


func _name_of(side: String) -> String:
	var id: String = _player_of(side)
	if id == _client.player_id:
		return "Bạn"
	if _snapshot != null:
		for player: XomDaoPlayerInfo in _snapshot.seats + _snapshot.players:
			if player.id == id:
				return player.name
	return str(SIDE_NAMES[side])


## Slot 0 is the side at the bottom (yours), slot 1 the other, with its wins and prisoners.
func _show_seats() -> void:
	var playing: bool = (
		_view.get("end") == null
		and _snapshot.status == "playing"
		and str(_view.get("phase", "")) == "play"
	)
	var prisoners: Dictionary = _view.get("prisoners", {})
	for i: int in 2:
		var side: String = _side_at_bottom() if i == 0 else _other(_side_at_bottom())
		var id: String = _player_of(side)
		var slot: XomDaoPlayerSlot = _slots[i]
		slot.player_name = _name_of(side)
		slot.host = id != "" and id == str(_snapshot.host_id)
		var wins: int = 0
		for seat: XomDaoPlayerInfo in _snapshot.seats:
			if seat.id == id:
				slot.frame = seat.frame
		# The room's score counts wins by place in `players`.
		for i_player: int in _snapshot.players.size():
			var counted: bool = _snapshot.score != null and i_player < _snapshot.score.wins.size()
			if counted and _snapshot.players[i_player].id == id:
				wins = _snapshot.score.wins[i_player]
		slot.extra = "Thắng %d · Bắt %d" % [wins, int(prisoners.get(side, 0))]
		var on_turn: bool = playing and str(_view.get("turn", "")) == side
		if on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
	# A longer count can widen the seats' column.
	_layout()


func _show_status() -> void:
	var playing: bool = _view.get("end") == null and _snapshot.status == "playing"
	_status.visible = playing
	_details.visible = playing
	if not playing:
		return
	var turn: String = str(_view.get("turn", FIRST))
	var whose: String = "Lượt bạn" if turn == _mine else "Lượt %s" % SIDE_NAMES[turn]
	var last: Variant = _view.get("last")
	if str(_view.get("phase", "")) == "scoring":
		var count: Dictionary = _view.get("count", {}) if _view.get("count") is Dictionary else {}
		_status.text = "Đếm điểm"
		_details.text = (
			"Đen %s\nTrắng %s" % [_num(float(count.get("b", 0))), _num(float(count.get("w", 0)))]
		)
		var accepted: Array = _view.get("accepted", [])
		if _mine != "" and accepted.has(_other(_mine)):
			_details.text += "\nĐã đồng ý"
	elif last is Dictionary and (last as Dictionary).get("point") == null:
		_status.text = "%s bỏ lượt" % SIDE_NAMES[str((last as Dictionary).get("side", FIRST))]
		_details.text = whose
	else:
		_status.text = whose
		_details.text = "Nước %d" % int(_view.get("plies", 0))


func _show_buttons() -> void:
	var on: bool = _mine != "" and _view.get("end") == null and _snapshot.status == "playing"
	var counting: bool = on and str(_view.get("phase", "")) == "scoring"
	_pass.visible = on and not counting
	_pass.disabled = str(_view.get("turn", "")) != _mine
	_accept.visible = counting
	var agreed: bool = (_view.get("accepted", []) as Array).has(_mine)
	_accept.text = "Đã đồng ý" if agreed else "Đồng ý"
	_accept.disabled = agreed
	_resume.visible = counting
	_resign.visible = on
	if not on:
		_close_dialog()
	_layout.call_deferred()


func _send(event: String) -> void:
	await _client.send(event)


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## The board as tall as the frame in the middle; the players with their bowls in the column on
## its left, the status and buttons in the column on its right.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	_cloth.size = size / _cloth.scale
	var seats_width: float = COLUMN
	for slot: XomDaoPlayerSlot in _slots:
		slot.reset_size()
		seats_width = maxf(seats_width, slot.size.x)
	var buttons_width: float = BUTTON_WIDTH
	for button: XomDaoButton in [_pass, _accept, _resume, _resign]:
		button.reset_size()
		buttons_width = maxf(buttons_width, button.size.x)
	var room: float = right - left - seats_width - buttons_width - 32.0
	var side: float = clampf(minf(size.y - 2.0 * edge, room), 240.0, size.y)
	var between: float = left + seats_width + 16.0
	var board_at := Vector2(between + maxf(0.0, (room - side) / 2.0), (size.y - side) / 2.0)
	_board.position = board_at
	_board.size = Vector2(side, side)
	# Half a gap and a bit round the outer lines, so edge stones sit on the wood.
	_cell = side / (SIZE - 1 + 1.6)
	_origin = board_at + Vector2.ONE * _cell * 0.8
	for layer: Control in [_lines, _shadows, _stones_layer, _marks, _points]:
		layer.position = Vector2.ZERO
		layer.size = size
	for spot: Control in _points.get_children():
		var p: int = int(str(spot.name).trim_prefix("Point_"))
		spot.size = Vector2.ONE * _cell
		spot.position = _point_at(p) - spot.size / 2.0
	_zone.position = _origin - Vector2.ONE * _cell / 2.0
	_zone.size = Vector2.ONE * _cell * SIZE
	_place_stones()
	_lines.queue_redraw()
	_shadows.queue_redraw()
	_marks.queue_redraw()
	_hover(-1)
	# Left column: the other player under ☰ with its bowl below, yours at the bottom with its
	# bowl above.
	var top_y: float = edge + MENU + 12.0
	var room_y: float = size.y - edge - top_y - _slots[0].size.y - _slots[1].size.y - 32.0
	var diameter: float = clampf(room_y / 2.0, 64.0, minf(150.0, seats_width * 0.52))
	for i: int in 2:
		var slot: XomDaoPlayerSlot = _slots[i]
		var y: float = size.y - edge - slot.size.y if i == 0 else top_y
		slot.position = Vector2(left, y)
		var bowl_y: float = y - 8.0 - diameter if i == 0 else y + slot.size.y + 8.0
		_bowls[i].position = Vector2(left, bowl_y)
		_bowls[i].size = Vector2.ONE * diameter
		var lid: float = diameter * 0.82
		_lids[i].position = Vector2(left + diameter + 12.0, bowl_y + (diameter - lid) / 2.0)
		_lids[i].size = Vector2.ONE * lid
		_bowls[i].queue_redraw()
		_lids[i].queue_redraw()
	# Right column: the status and the count at the top, the buttons at the bottom.
	var column_left: float = board_at.x + side + 16.0
	var width: float = maxf(right - column_left, BUTTON_WIDTH)
	_status.size = Vector2(width, 0.0)
	_status.position = Vector2(column_left, edge)
	_status.reset_size()
	_status.size.x = width
	_details.size = Vector2(width, 0.0)
	_details.position = Vector2(column_left, _status.position.y + _status.size.y + 8.0)
	var y: float = size.y - edge
	for button: XomDaoButton in [_resign, _resume, _accept, _pass]:
		if not button.visible:
			continue
		button.reset_size()
		y -= button.size.y
		button.position = Vector2(right - button.size.x, y)
		y -= 10.0
	if _dialog.visible:
		_dialog.reset_size()
		_dialog.position = (size - _dialog.size) / 2.0
