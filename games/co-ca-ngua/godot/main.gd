extends Control
## Cờ Cá Ngựa on the Godot client, in the **Bàn** layout (docs/experience.md): the square board in
## the middle, each player's slot in the corner by their colour's paddock (like Ludo King), the
## dice beside whoever is on turn. It draws `snapshot.view` (State in src/game/model.ts: every
## horse, the colours, the turn, the dice) and sends `roll` and `move {horse}`.
##
## Tap the dice to roll; the horses that can go get a gold ring, tap one to move it. Horses hop
## square by square, a kicked horse slides back to its paddock, and a team home dances.
##
## Named nodes for tests: Board, Dice, Horse_<seat>_<horse>, Seat_<seat>, Status, Notice.

const Rules := preload("res://content/co-ca-ngua/rules.gd")
const SOUNDS: Array[String] = [
	"dice-roll",
	"dice-six",
	"game-start",
	"no-move",
	"token-bump",
	"token-finish",
	"token-leave",
	"token-safe",
	"token-select",
	"token-step",
	"turn",
	"win",
]
## The 15 × 15 grid on the board picture: one cell, and where the grid starts (in board sides).
const CELL := 0.4 / 6.5
const HORSE := 0.081
const TURN_SECONDS := 30.0
const ROLL_SECONDS := 0.62
const STEP_SECONDS := 0.11
const GOLD := Color("#FFE2A0")

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your seat, or -1 for a spectator.
var _me: int = -1

var _cloth := ColorRect.new()
var _board := TextureRect.new()
var _rings := Control.new()
var _dice := TextureRect.new()
var _status := Label.new()
var _notice := Label.new()
var _slots: Array[XomDaoPlayerSlot] = []
## horses[seat][horse]: each a sprite with its number.
var _horses: Array = []
var _fx := Control.new()
var _sounds: Dictionary = {}
var _faces: Array[Texture2D] = []
var _frames: Array[Texture2D] = []

## What the last view showed, to animate only what changed.
var _phase: String = ""
var _moves: int = -1
var _ended: bool = false
## Animations run one after another; while they run the horses are theirs to place.
var _jobs: Array[Callable] = []
var _running: bool = false
var _rolling: bool = false


## Options for a sandbox room (`?play=co-ca-ngua` in a debug build): three computer players.
func sandbox_options() -> Dictionary:
	return {"bots": 3, "mode": "normal"}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	return [
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3]],
		},
		{
			"key": "mode",
			"label": "Chế độ",
			"options": [["Thường", "normal"], ["Phân hạng", "ranked"]],
		},
	]


## The figures for the hub's result board.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _view.get("winner") == null:
		return {}
	var rows: Array = [["Số nước đi", str(int(_view["moves"]))]]
	var rankings: Array = _view["rankings"]
	if rankings.size() > 1:
		var names: Array[String] = []
		for seat: Variant in rankings:
			names.append(_seat_name(int(seat)))
		rows.append(["Thứ tự về đích", " · ".join(names)])
	return {"reason": "Bốn ngựa về đích", "rows": rows}


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	_cloth.color = Color("#0B3A40")
	_cloth.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_cloth)
	_board.name = "Board"
	_board.texture = load("res://content/co-ca-ngua/art/board.webp")
	_board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	_rings.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_rings.draw.connect(_draw_rings)
	add_child(_rings)
	var sheet: Texture2D = load("res://content/co-ca-ngua/art/horses.webp")
	for color: int in 4:
		var frame := AtlasTexture.new()
		frame.atlas = sheet
		frame.region = Rect2(4.0 + color * 264.0, 4.0, 256.0, 256.0)
		_frames.append(frame)
	for face: int in 6:
		_faces.append(load("res://content/co-ca-ngua/art/dice-%d.webp" % (face + 1)))
	_dice.name = "Dice"
	_dice.texture = _faces[0]
	_dice.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_dice.mouse_filter = Control.MOUSE_FILTER_STOP
	_dice.gui_input.connect(_on_dice_input)
	add_child(_dice)
	_status.name = "Status"
	_hud(_status, XomDaoUi.TEXT)
	_notice.name = "Notice"
	_hud(_notice, XomDaoUi.TEXT_MIN)
	_notice.add_theme_color_override("font_color", GOLD)
	for label: Label in [_status, _notice]:
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		add_child(label)
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/co-ca-ngua/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


static func _hud(label: Label, font_size: int) -> void:
	label.theme_type_variation = "HudLabel"
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	label.add_theme_color_override("font_outline_color", XomDaoUi.INK)
	label.add_theme_constant_override("outline_size", 8)


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var live: bool = not _view.is_empty()
	_me = -1
	for i: int in snapshot.seats.size():
		if snapshot.seats[i].id == _client.player_id:
			_me = i
	var count: int = (view["horses"] as Array).size()
	if count != _slots.size():
		_build(count, view)
	var phase: String = str(view["phase"])
	var moves: int = int(view["moves"])
	if not live:
		_sfx("game-start")
	elif _phase == "roll" and phase != "roll" and view.get("lastRoll") != null:
		_enqueue(_animate_roll.bind(int((view["lastRoll"] as Dictionary)["value"]), phase))
	if live and moves > _moves and view.get("lastMove") != null:
		_enqueue(_animate_move.bind((view["lastMove"] as Dictionary).duplicate(true), view))
	_view = view
	_phase = phase
	_moves = moves
	if not _running:
		_place_horses()
		_dice.texture = _faces[_dice_value() - 1]
	_show_hud()
	var ended: bool = view.get("winner") != null
	if ended and not _ended and live:
		_enqueue(_celebrate.bind(int(view["winner"])))
	_ended = ended
	_layout()


func _dice_value() -> int:
	var last: Variant = _view.get("lastRoll")
	return clampi(int((last as Dictionary)["value"]), 1, 6) if last is Dictionary else 1


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "…"


func _left(seat: int) -> bool:
	return seat < _snapshot.seats.size() and _snapshot.seats[seat].left


func _build(count: int, view: Dictionary) -> void:
	for slot: XomDaoPlayerSlot in _slots:
		slot.queue_free()
	for team: Variant in _horses:
		for horse: Control in team:
			horse.queue_free()
	_slots.clear()
	_horses.clear()
	var colors: Array = view["colors"]
	for seat: int in count:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.compact = true
		add_child(slot)
		move_child(slot, _dice.get_index())
		_slots.append(slot)
		var team: Array[Control] = []
		for k: int in 4:
			var horse := TextureRect.new()
			horse.name = "Horse_%d_%d" % [seat, k]
			horse.texture = _frames[int(colors[seat]) % 4]
			horse.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			horse.mouse_filter = Control.MOUSE_FILTER_STOP
			horse.gui_input.connect(_on_horse_input.bind(seat, k))
			var number := Label.new()
			_hud(number, XomDaoUi.TEXT_MIN - 6)
			number.autowrap_mode = TextServer.AUTOWRAP_OFF
			number.text = str(k + 1)
			number.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			number.add_theme_constant_override("outline_size", 6)
			horse.add_child(number)
			add_child(horse)
			move_child(horse, _fx.get_index())
			team.append(horse)
		_horses.append(team)


# ── The board ─────────────────────────────────────────────────────────────────────────────


## The middle of a grid point on the screen.
func _grid_point(at: Vector2) -> Vector2:
	var side: float = _board.size.x
	return _board.position + Vector2.ONE * side / 2.0 + (at - Vector2(7.0, 7.0)) * side * CELL


func _horse_point(seat: int, horse: int, position: int) -> Vector2:
	return _grid_point(Rules.point(_view["colors"], seat, horse, position))


## Puts a horse sprite standing on a point (its base a little below the middle).
func _stand(sprite: Control, at: Vector2) -> void:
	var size_of: float = _board.size.x * HORSE
	sprite.size = Vector2.ONE * size_of
	sprite.position = at - Vector2(size_of / 2.0, size_of * 0.62)
	var number: Label = sprite.get_child(0)
	number.reset_size()
	number.position = Vector2((size_of - number.size.x) / 2.0, size_of * 0.78)


func _place_horses() -> void:
	if _view.is_empty() or _board.size.x <= 0.0:
		return
	var all: Array = _view["horses"]
	for seat: int in _horses.size():
		for k: int in 4:
			var sprite: Control = _horses[seat][k]
			var horse: Dictionary = all[seat][k]
			sprite.visible = not _left(seat)
			sprite.rotation = 0.0
			_stand(sprite, _horse_point(seat, k, int(horse["position"])))
	_rings.queue_redraw()


## Whether you may roll or move now.
func _can_play() -> bool:
	return (
		_me >= 0
		and _snapshot.result == null
		and _view.get("winner") == null
		and int(_view["turn"]) == _me
		and not _left(_me)
		and not _running
	)


func _draw_rings() -> void:
	if _view.is_empty() or not _can_play() or str(_view["phase"]) != "choose":
		return
	for move: Variant in Rules.legal_moves(_view):
		var horse: int = int((move as Dictionary)["horse"])
		var at: Vector2 = _horse_point(_me, horse, int(_view["horses"][_me][horse]["position"]))
		_rings.draw_arc(at, _board.size.x * 0.036, 0.0, TAU, 32, GOLD, 4.0)


func _on_dice_input(event: InputEvent) -> void:
	var button := event as InputEventMouseButton
	if button == null or not button.pressed or button.button_index != MOUSE_BUTTON_LEFT:
		return
	if _can_play() and str(_view["phase"]) == "roll":
		_dice.mouse_default_cursor_shape = Control.CURSOR_ARROW
		await _client.send("roll")


func _on_horse_input(event: InputEvent, seat: int, horse: int) -> void:
	var button := event as InputEventMouseButton
	if button == null or not button.pressed or button.button_index != MOUSE_BUTTON_LEFT:
		return
	if seat != _me or not _can_play() or str(_view["phase"]) != "choose":
		return
	for move: Variant in Rules.legal_moves(_view):
		if int((move as Dictionary)["horse"]) == horse:
			_sfx("token-select")
			await _client.send("move", {"horse": horse})
			return


# ── Animations ────────────────────────────────────────────────────────────────────────────


func _enqueue(job: Callable) -> void:
	_jobs.append(job)
	if not _running:
		_run_jobs()


func _run_jobs() -> void:
	_running = true
	_rings.queue_redraw()
	while not _jobs.is_empty() and is_inside_tree():
		var job: Callable = _jobs.pop_front()
		await job.call()
	_running = false
	_rolling = false
	_place_horses()
	if not _view.is_empty():
		_dice.texture = _faces[_dice_value() - 1]
		_show_hud()


## The dice tumbles through its faces and lands on the roll.
func _animate_roll(value: int, phase: String) -> void:
	_rolling = true
	_sfx("dice-roll")
	for frame: int in 6:
		_dice.texture = _faces[(value + frame) % 6]
		var tween: Tween = _dice.create_tween()
		tween.tween_property(
			_dice, "rotation", deg_to_rad(-12.0 if frame % 2 else 12.0), ROLL_SECONDS / 6.0
		)
		await tween.finished
		if not is_inside_tree():
			return
	_dice.rotation = 0.0
	_dice.texture = _faces[value - 1]
	_rolling = false
	if value == 6:
		_sfx("dice-six")
	elif phase == "pause":
		_sfx("no-move")


## A horse hops along its path; a kicked one slides home.
func _animate_move(move: Dictionary, view: Dictionary) -> void:
	var seat: int = int(move["seat"])
	var horse: int = int(move["horse"])
	if seat >= _horses.size():
		return
	var sprite: Control = _horses[seat][horse]
	var from: int = int(move["from"])
	for step: Variant in move["path"]:
		var at: Vector2 = _grid_point(Rules.point(view["colors"], seat, horse, int(step)))
		_sfx("token-leave" if from < 0 else "token-step")
		var size_of: float = _board.size.x * HORSE
		var target: Vector2 = at - Vector2(size_of / 2.0, size_of * 0.62)
		var tween: Tween = sprite.create_tween()
		tween.tween_property(sprite, "position", target - Vector2(0.0, 8.0), STEP_SECONDS * 0.55)
		tween.tween_property(sprite, "position", target, STEP_SECONDS * 0.45)
		await tween.finished
		if not is_inside_tree():
			return
	var capture: Variant = move.get("capture")
	if capture is Dictionary and int((capture as Dictionary)["seat"]) < _horses.size():
		var victim_seat: int = int((capture as Dictionary)["seat"])
		var victim_horse: int = int((capture as Dictionary)["horse"])
		var victim: Control = _horses[victim_seat][victim_horse]
		_sfx("token-bump")
		var home: Vector2 = _grid_point(Rules.point(view["colors"], victim_seat, victim_horse, -1))
		var size_of: float = _board.size.x * HORSE
		var tween: Tween = victim.create_tween()
		tween.tween_property(
			victim, "position", home - Vector2(size_of / 2.0, size_of * 0.62), 0.26
		)
		await tween.finished
	if bool(move["finish"]):
		_sfx("token-finish")
	elif int(move["to"]) >= Rules.TRACK_LENGTH:
		_sfx("token-safe")


## A team home: its four horses hop on their squares.
func _celebrate(seat: int) -> void:
	if seat < 0 or seat >= _horses.size():
		return
	_place_horses()
	_sfx("win")
	for round: int in 6:
		var tween: Tween = create_tween().set_parallel()
		for sprite: Control in _horses[seat]:
			var base: float = sprite.position.y
			tween.tween_property(sprite, "position:y", base - _board.size.x * 0.03, 0.2).set_trans(
				Tween.TRANS_SINE
			)
			tween.chain().tween_property(sprite, "position:y", base, 0.2)
		await tween.finished
		if not is_inside_tree():
			return


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


# ── Status ────────────────────────────────────────────────────────────────────────────────


func _show_hud() -> void:
	var turn: int = int(_view["turn"])
	var phase: String = str(_view["phase"])
	var winner: Variant = _view.get("winner")
	var rankings: Array = _view["rankings"]
	var colors: Array = _view["colors"]
	if winner != null:
		var who: int = int(winner)
		_status.text = "Bạn thắng!" if who == _me else "%s thắng!" % _seat_name(who)
		_status.add_theme_color_override("font_color", GOLD)
	else:
		_status.text = "Lượt bạn" if turn == _me else "Lượt %s" % _seat_name(turn)
		_status.add_theme_color_override("font_color", Rules.INKS[int(colors[turn]) % 4])
	var notice: String = ""
	if winner == null and not _rolling:
		if phase == "choose" and turn == _me:
			notice = "Chọn ngựa"
		elif phase == "pause":
			notice = str(_view.get("notice", ""))
		elif phase == "choose":
			notice = str(_view.get("notice", ""))
	_notice.text = notice
	var playing: bool = _can_play() and phase == "roll"
	_dice.mouse_default_cursor_shape = (
		Control.CURSOR_POINTING_HAND if playing else Control.CURSOR_ARROW
	)
	_dice.modulate = Color.WHITE if playing or turn != _me else Color(0.85, 0.85, 0.85)
	var timer: XomDaoRoomTimer = _snapshot.timer
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		var info: XomDaoPlayerInfo = _snapshot.seats[seat]
		var home: int = 0
		for horse: Variant in _view["horses"][seat]:
			home += 1 if bool((horse as Dictionary)["finished"]) else 0
		slot.player_name = _seat_name(seat)
		slot.frame = info.frame
		slot.host = info.id != "" and info.id == str(_snapshot.host_id)
		var place: int = rankings.find(float(seat))
		if place < 0:
			place = rankings.find(seat)
		slot.extra = (
			"Hạng %d" % (place + 1) if place >= 0 else ("Rời" if info.left else "%d/4" % home)
		)
		slot.modulate.a = 0.45 if info.left else 1.0
		var on_turn: bool = winner == null and seat == turn
		if on_turn and timer != null and timer.event == "timeout":
			slot.start_turn(TURN_SECONDS, maxf(0.0, TURN_SECONDS - timer.left / 1000.0))
		elif on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
	_rings.queue_redraw()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## The board as tall as the frame in the middle; the slots in the corners by their paddocks;
## the dice, the turn and the notice in the column of whoever is on turn.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	_cloth.size = size
	var column: float = 200.0
	for slot: XomDaoPlayerSlot in _slots:
		slot.reset_size()
		column = maxf(column, slot.size.x)
	var side: float = clampf(
		minf(size.y - 2.0 * edge, right - left - 2.0 * (column + 16.0)), 320.0, size.y
	)
	_board.size = Vector2.ONE * side
	_board.position = Vector2((size.x - side) / 2.0, (size.y - side) / 2.0)
	_rings.size = size
	if _view.is_empty():
		return
	# Each slot in the corner by its colour: red top left (under ☰), blue top right, yellow
	# bottom right, green bottom left.
	var colors: Array = _view["colors"]
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		var color: int = int(colors[seat]) % 4
		var on_right: bool = color == 1 or color == 2
		var on_top: bool = color == 0 or color == 1
		slot.position = Vector2(
			right - slot.size.x if on_right else left,
			edge + XomDaoUi.TOUCH + 12.0 if on_top else size.y - edge - slot.size.y
		)
	# The dice, the turn and the notice in the column of whoever is on turn.
	var turn_color: int = int(colors[int(_view["turn"])]) % 4
	var turn_right: bool = turn_color == 1 or turn_color == 2
	var column_left: float = _board.position.x + side + 16.0 if turn_right else left
	var column_width: float = (
		(right - column_left) if turn_right else (_board.position.x - 16.0 - left)
	)
	var dice_size: float = clampf(minf(column_width, side * 0.24), 72.0, 150.0)
	_dice.size = Vector2.ONE * dice_size
	_dice.pivot_offset = _dice.size / 2.0
	var dice_at := Vector2(
		column_left + (column_width - dice_size) / 2.0, (size.y - dice_size) / 2.0
	)
	if _dice.position.distance_to(dice_at) > 1.0 and _dice.position != Vector2.ZERO:
		_dice.create_tween().tween_property(_dice, "position", dice_at, 0.25).set_trans(
			Tween.TRANS_QUAD
		)
	else:
		_dice.position = dice_at
	for label: Label in [_status, _notice]:
		label.size = Vector2(column_width, 0.0)
		label.reset_size()
		label.size.x = column_width
	_status.position = Vector2(column_left, dice_at.y - _status.size.y - 8.0)
	_notice.position = Vector2(column_left, dice_at.y + dice_size + 8.0)
	if not _running:
		_place_horses()
