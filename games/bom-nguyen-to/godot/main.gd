extends Control
## Bom Nguyên Tố on the Godot client, in the **Hành động** layout (docs/experience.md): the
## garden arena fills the middle; your friend's card sits at the top left under the hub's ☰, the
## clock at the top middle between the other players' cards, the D-pad at the bottom left and
## Bom, Kỹ năng, Lướt at the bottom right. It draws `snapshot.view` (State in
## src/game/model.ts) and sends `choose {element}`, `ready`, `input {direction, at}`,
## `bomb {at}`, `skill` and `dash`. Keys: WASD or the arrows, Space, E, Shift.
##
## The match is real time: the server ticks every 100 ms and follows where this screen shows
## you (`at`), so walking feels immediate.
##
## Named nodes for tests: Arena, Pick_<element>, Ready, Pad, Bomb, Skill, Dash, Clock, Status,
## Me, Card_<seat>, Fighter_<seat> (in the arena).

const Rules := preload("res://content/bom-nguyen-to/rules.gd")
const Arena := preload("res://content/bom-nguyen-to/arena.gd")
const Pad := preload("res://content/bom-nguyen-to/pad.gd")
const Action := preload("res://content/bom-nguyen-to/action.gd")
const Card := preload("res://content/bom-nguyen-to/card.gd")
const ART := "res://content/bom-nguyen-to/art/"
const SOUNDS := "dash explode hurt lose pickup place skill start win"
const KEYS: Dictionary = {
	KEY_W: "up",
	KEY_UP: "up",
	KEY_S: "down",
	KEY_DOWN: "down",
	KEY_A: "left",
	KEY_LEFT: "left",
	KEY_D: "right",
	KEY_RIGHT: "right",
}
## Each action: its event, button name, art and how long it recharges (ms).
const ACTIONS: Array = [
	["bomb", "Bomb", "Bom", "button-orange", "icon-bomb", 400.0],
	["skill", "Skill", "Kỹ năng", "button-purple", "icon-skill", 14000.0],
	["dash", "Dash", "Lướt", "button-blue", "icon-dash", 5000.0],
]
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const RESEND_MS := 200.0
## The pointer index the real mouse uses (touches count from 0).
const MOUSE := 100

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
var _me: String = ""

var _backdrop := TextureRect.new()
var _arena: Control = Arena.new()
var _pad: Control = Pad.new()
var _actions: Array[Control] = []
var _me_card: Control = Card.new()
var _cards: Array[Control] = []
var _clock := Label.new()
var _clock_board := TextureRect.new()
var _status := Label.new()
var _select: XomDaoBoard = XomDaoBoard.create("Chọn bạn nhỏ")
var _picks: Dictionary = {}
var _skill := Label.new()
var _about := Label.new()
var _ready_button: XomDaoButton = XomDaoButton.create("Sẵn sàng", XomDaoUi.Kind.GO)
var _sounds: Dictionary = {}

## Keys held (latest last) and fingers down: index → "pad" or an action button.
var _keys: Array[String] = []
var _touches: Dictionary = {}
var _touch_dir: Dictionary = {}
var _direction: String = "none"
var _sent: String = "none"
var _sent_at: float = 0.0


## Options for a sandbox room (`?play=bom-nguyen-to` in a debug build): you and one easy bot.
func sandbox_options() -> Dictionary:
	return {"mode": "solo", "total": 2, "bots": 1, "level": "easy"}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	var friends: Array = []
	for element: String in Rules.ELEMENTS:
		friends.append([Rules.CHARACTERS[element]["name"], element])
	return [
		{
			"key": "mode",
			"label": "Chế độ",
			"options": [["Sinh tồn", "solo"], ["Đấu đội 2v2", "teams"]],
		},
		{
			"key": "total",
			"label": "Số nhân vật",
			"options": [["1", 1], ["2", 2], ["3", 3], ["4", 4]],
			"default": 3,
		},
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3]],
			"default": 3,
		},
		{
			"key": "level",
			"label": "Độ khó",
			"options": [["Dễ", "easy"], ["Thường", "normal"], ["Khó", "hard"]],
			"default": 1,
		},
		{"key": "element", "label": "Bạn nhỏ", "options": friends},
		{
			"key": "friendlyFire",
			"label": "Sát thương đồng đội",
			"options": [["Tắt", false], ["Bật", true]]
		},
	]


## The figures for the hub's result board.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or str(_view["phase"]) != "ended":
		return {}
	var rows: Array = []
	var one: Dictionary = Rules.fighter(_view, _me)
	if not one.is_empty():
		rows.append(["Hạ gục", str(int(one["kills"]))])
		rows.append(["Thùng quà đã mở", str(int(one["crates"]))])
	return {"reason": str(_view.get("reason", "")), "rows": rows}


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	_backdrop.texture = load(ART + "garden.webp")
	_backdrop.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_backdrop.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	_backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	_backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_backdrop)
	_arena.name = "Arena"
	_arena.set_anchors_preset(Control.PRESET_FULL_RECT)
	_arena.connect("cue", _play)
	add_child(_arena)
	_me_card.name = "Me"
	_me_card.set("stats", true)
	add_child(_me_card)
	for seat: int in 4:
		var card: Control = Card.new()
		card.name = "Slot_%d" % seat
		card.visible = false
		add_child(card)
		_cards.append(card)
	_clock_board.texture = load(ART + "timer-board.webp")
	_clock_board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_clock_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_clock_board)
	_clock.name = "Clock"
	_hud(_clock, 36)
	_clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_clock.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(_clock)
	_status.name = "Status"
	_hud(_status, 26)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_status)
	_pad.name = "Pad"
	add_child(_pad)
	for spec: Array in ACTIONS:
		var button: Control = Action.create(spec[1], spec[2], spec[3], spec[4])
		button.connect("pressed", _act.bind(spec[0]))
		add_child(button)
		_actions.append(button)
	_build_select()
	for sound: String in SOUNDS.split(" "):
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/bom-nguyen-to/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


func _build_select() -> void:
	_select.name = "Select"
	add_child(_select)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	_select.content.add_child(row)
	for element: String in Rules.ELEMENTS:
		var pick := Button.new()
		pick.name = "Pick_" + element
		pick.custom_minimum_size = Vector2(136, 176)
		pick.flat = true
		pick.focus_mode = Control.FOCUS_NONE
		pick.draw.connect(_draw_pick.bind(pick, element))
		pick.pressed.connect(_choose.bind(element))
		row.add_child(pick)
		_picks[element] = pick
	for label: Label in [_skill, _about]:
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_color_override("font_color", XomDaoUi.INK)
		_select.content.add_child(label)
	_skill.name = "Skill"
	_skill.add_theme_font_override("font", XomDaoUi.display_font(800))
	_skill.add_theme_font_size_override("font_size", 30)
	_about.add_theme_font_size_override("font_size", 24)
	_ready_button.name = "Ready"
	_ready_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_ready_button.custom_minimum_size.x = 280.0
	_ready_button.pressed.connect(_on_ready)
	_select.content.add_child(_ready_button)
	_select.visible = false


static func _hud(label: Label, font_size: int) -> void:
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", Color.WHITE)
	label.add_theme_color_override("font_outline_color", Color("#5b3a2e"))
	label.add_theme_constant_override("outline_size", 8)


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary or (snapshot.view as Dictionary).is_empty():
		return
	var viewer: String = str(_client.player_id)
	var me: String = viewer if not Rules.fighter(snapshot.view, viewer).is_empty() else ""
	var fresh: bool = me != _me or _view.is_empty()
	if fresh:
		_release()
		_arena.call("reset")
	_me = me
	_view = snapshot.view
	_arena.set("me", me)
	_arena.call("show_view", _view, not fresh)
	if str(_view["phase"]) != "playing":
		_release()
	_show_cards()
	_show_select()
	var playing: bool = str(_view["phase"]) == "playing"
	var alive: bool = not me.is_empty() and int(Rules.fighter(_view, me)["hp"]) > 0
	_pad.visible = playing and alive
	for button: Control in _actions:
		button.visible = playing and alive


func _show_cards() -> void:
	var fighters: Array = _view["fighters"]
	var mine: Dictionary = Rules.fighter(_view, _me)
	_me_card.call("show_fighter", mine, "Bạn" if not mine.is_empty() else "", _view)
	var others: Array = fighters.filter(func(one: Dictionary) -> bool: return str(one["id"]) != _me)
	for i: int in _cards.size():
		var card: Control = _cards[i]
		if i >= others.size():
			card.visible = false
			continue
		var one: Dictionary = others[i]
		card.name = "Card_%d" % int(one["seat"])
		var title: String = str(one["name"])
		if bool(one["bot"]):
			title = Rules.CHARACTERS[str(one["element"])]["name"]
		card.call("show_fighter", one, title, _view)


func _show_select() -> void:
	var choosing: bool = str(_view["phase"]) == "select"
	_select.visible = choosing
	if not choosing:
		return
	var mine: Dictionary = Rules.fighter(_view, _me)
	for element: String in _picks:
		var pick: Button = _picks[element]
		pick.disabled = mine.is_empty()
		pick.queue_redraw()
	if mine.is_empty():
		_skill.text = ""
		_about.text = "Đang chờ người chơi chọn bạn nhỏ"
		_ready_button.visible = false
		return
	var info: Dictionary = Rules.CHARACTERS[str(mine["element"])]
	_skill.text = "%s  %s" % [info["element"], info["skill"]]
	_about.text = info["about"]
	_ready_button.visible = true
	_ready_button.disabled = bool(mine["ready"])
	_ready_button.text = "Đã sẵn sàng" if bool(mine["ready"]) else "Sẵn sàng"


func _draw_pick(pick: Button, element: String) -> void:
	var mine: Dictionary = Rules.fighter(_view, _me) if not _view.is_empty() else {}
	var chosen: bool = not mine.is_empty() and str(mine["element"]) == element
	var info: Dictionary = Rules.CHARACTERS[element]
	var box := Rect2(Vector2(4, 4), pick.size - Vector2(8, 8))
	var style := StyleBoxFlat.new()
	style.bg_color = info["pastel"]
	style.border_color = info["color"] if chosen else Color("#8a5a43")
	style.set_border_width_all(6 if chosen else 3)
	style.set_corner_radius_all(22)
	pick.draw_style_box(style, box)
	var picture: Texture2D = load(ART + "portrait-%s.webp" % element)
	var fit: float = 112.0 / maxf(picture.get_width(), picture.get_height())
	var size_of: Vector2 = picture.get_size() * fit
	pick.draw_texture_rect(
		picture, Rect2(Vector2((pick.size.x - size_of.x) / 2.0, 14.0), size_of), false
	)
	var font: Font = XomDaoUi.display_font(800)
	var title: String = str(info["name"])
	var font_size: int = 24
	while (
		font_size > 18
		and font.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > box.size.x - 8
	):
		font_size -= 1
	var w: float = font.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	pick.draw_string(
		font,
		Vector2((pick.size.x - w) / 2.0, pick.size.y - 22.0),
		title,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		font_size,
		Color("#5b3a2e")
	)


func _process(delta: float) -> void:
	if _view.is_empty():
		return
	var playing: bool = str(_view["phase"]) == "playing"
	var ms: float = Time.get_ticks_msec()
	if _direction != _sent or (_direction != "none" and ms - _sent_at >= RESEND_MS):
		_send_direction()
	_arena.call("step", minf(delta, 0.25), _direction)
	var now: float = _arena.call("now")
	_clock.text = Rules.clock(_view, now)
	var mine: Dictionary = Rules.fighter(_view, _me)
	var status: String = ""
	if str(_view["phase"]) == "select":
		status = "Chọn bạn nhỏ"
	elif playing and not mine.is_empty() and int(mine["hp"]) == 0:
		status = "Đã bị loại, đang xem"
	elif Rules.closing_in(_view, now) >= 0.0:
		status = "Đấu trường sắp thu hẹp!"
	elif playing and int(_view.get("ring", 0)) > 0:
		status = "Đấu trường đang thu hẹp!"
	_status.text = status
	if mine.is_empty():
		return
	var lefts: Array[float] = [
		maxf(float(mine["nextBomb"]) - now, 0.0),
		maxf(float(mine["skillReady"]) - now, 0.0),
		maxf(float(mine["dashReady"]) - now, 0.0),
	]
	var free: bool = float(mine["frozenUntil"]) <= now and float(mine["stunUntil"]) <= now
	for i: int in _actions.size():
		var button: Control = _actions[i]
		var enabled: bool = _can_act() and lefts[i] <= 0.0 and free
		if i == 0:
			enabled = enabled and Rules.bombs_left(_view, mine) > 0
		button.set("enabled", enabled)
		var glow: bool = i == 1 and float(mine["skillUntil"]) > now
		button.call("show_state", lefts[i], ACTIONS[i][5], glow)


func _can_act() -> bool:
	if _view.is_empty() or str(_view["phase"]) != "playing":
		return false
	var mine: Dictionary = Rules.fighter(_view, _me)
	return not mine.is_empty() and int(mine["hp"]) > 0


# ── Input ─────────────────────────────────────────────────────────────────────────────────


func _unhandled_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or key.echo and not KEYS.has(key.keycode):
		return
	if KEYS.has(key.keycode):
		var dir: String = KEYS[key.keycode]
		_keys.erase(dir)
		if key.pressed:
			_keys.append(dir)
		_refresh()
		get_viewport().set_input_as_handled()
	elif key.pressed and not key.echo:
		match key.keycode:
			KEY_SPACE:
				_act("bomb")
			KEY_E:
				_act("skill")
			KEY_SHIFT:
				_act("dash")
			_:
				return
		get_viewport().set_input_as_handled()


## Fingers and the mouse on the D-pad and the action buttons: every finger on its own, so one
## can hold a direction while another drops a bomb.
func _input(event: InputEvent) -> void:
	if not _can_act():
		return
	var pointer: Array = _pointer(event)
	if pointer.is_empty():
		return
	var index: int = pointer[0]
	var at: Vector2 = pointer[1]
	var down: Variant = pointer[2]
	if down == null:
		if _touches.get(index) is String:
			_touch_dir[index] = _pad.call("direction_at", _local(_pad, at))
			_refresh()
	elif not down:
		var held: Variant = _touches.get(index)
		_touches.erase(index)
		_touch_dir.erase(index)
		if held is Control:
			(held as Control).call("press", false)
		_refresh()
	elif _press(index, at):
		get_viewport().set_input_as_handled()


## [index, position, pressed (null for a move)] of a finger or the real mouse, else [].
static func _pointer(event: InputEvent) -> Array:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		return [touch.index, touch.position, touch.pressed]
	if event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		return [drag.index, drag.position, null]
	if event.device == InputEvent.DEVICE_ID_EMULATION:
		return []
	var button := event as InputEventMouseButton
	if button != null and button.button_index == MOUSE_BUTTON_LEFT:
		return [MOUSE, button.position, button.pressed]
	var motion := event as InputEventMouseMotion
	if motion != null:
		return [MOUSE, motion.position, null]
	return []


## A finger came down: on the D-pad or an action button it is theirs (true).
func _press(index: int, at: Vector2) -> bool:
	if _pad.call("covers", _local(_pad, at)):
		_touches[index] = "pad"
		_touch_dir[index] = _pad.call("direction_at", _local(_pad, at))
		_refresh()
		return true
	for button: Control in _actions:
		if button.call("covers", _local(button, at)):
			_touches[index] = button
			button.call("press", true)
			return true
	return false


static func _local(node: Control, at: Vector2) -> Vector2:
	return node.get_global_transform_with_canvas().affine_inverse() * at


func _refresh() -> void:
	var dir: String = "none"
	for index: Variant in _touch_dir:
		var touched: String = _touch_dir[index]
		if touched != "none" and touched != "":
			dir = touched
	if dir == "none" and not _keys.is_empty():
		dir = _keys[-1]
	_direction = dir if _can_act() else "none"
	_pad.set("held", _direction)
	if _direction != _sent:
		_send_direction()


## Where this screen shows you, sent with your input so the server follows it.
func _at() -> Dictionary:
	if _me.is_empty():
		return {}
	var at: Vector2 = _arena.call("shown_at", _me)
	return {"x": snappedf(at.x, 0.001), "y": snappedf(at.y, 0.001)}


func _send_direction() -> void:
	if not _me.is_empty() and not _view.is_empty() and str(_view["phase"]) == "playing":
		_client.send("input", {"direction": _direction, "at": _at()})
	_sent = _direction
	_sent_at = Time.get_ticks_msec()


func _release() -> void:
	_keys.clear()
	_touch_dir.clear()
	for index: Variant in _touches:
		if _touches[index] is Control:
			(_touches[index] as Control).call("press", false)
	_touches.clear()
	_direction = "none"
	_pad.set("held", "none")
	if _sent != "none":
		_send_direction()


func _act(action: String) -> void:
	if not _can_act():
		return
	# A bomb lands on the cell you see yourself on.
	_client.send(action, {"at": _at()} if action == "bomb" else {})


func _choose(element: String) -> void:
	if not _me.is_empty():
		_client.send("choose", {"element": element})


func _on_ready() -> void:
	if not _me.is_empty():
		_ready_button.disabled = true
		_client.send("ready")


func _play(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var top: float = edge
	var bottom: float = size.y - edge
	# Left column: your card under ☰, the D-pad at the bottom.
	var column: float = clampf(size.x * 0.2, 220.0, 260.0)
	_me_card.position = Vector2(left, top + MENU + 8.0)
	_me_card.size = Vector2(column, 178.0)
	var pad: float = minf(column, 240.0)
	_pad.position = Vector2(left + (column - pad) / 2.0, bottom - pad)
	_pad.size = Vector2(pad, pad)
	# Right: the three action buttons in a column, Bom biggest at the bottom.
	var big: float = 124.0
	var small: float = 104.0
	_place(_actions[0], Vector2(right - big, bottom - big), big)
	_place(_actions[1], Vector2(right - (big + small) / 2.0, bottom - big - small - 12.0), small)
	_place(
		_actions[2], Vector2(right - (big + small) / 2.0, bottom - big - small * 2.0 - 24.0), small
	)
	# Top row: the clock in the middle with two cards on each side.
	var row_left: float = left + MENU + 12.0
	var row_h: float = 64.0
	var clock := Vector2(184.0, 60.0)
	var mid: float = (row_left + right) / 2.0
	_clock_board.size = clock
	_clock_board.position = Vector2(mid - clock.x / 2.0, top + (row_h - clock.y) / 2.0)
	_clock.position = _clock_board.position + Vector2(clock.x * 0.18, 0)
	_clock.size = Vector2(clock.x * 0.8, clock.y)
	_status.size = Vector2(right - row_left, 36.0)
	_status.position = Vector2(row_left, top + row_h + 2.0)
	var gap: float = 8.0
	var card_w: float = minf(240.0, (right - row_left - clock.x - 4.0 * gap) / 4.0)
	for i: int in _cards.size():
		var slot: int = [-2, -1, 1, 2][i]
		var x: float = (
			mid + signf(slot) * (clock.x / 2.0 + gap + (absf(slot) - 1.0) * (card_w + gap))
		)
		if slot < 0:
			x -= card_w
		_cards[i].position = Vector2(x, top)
		_cards[i].size = Vector2(card_w, row_h)
	# The arena between the columns, under the top row and its status line.
	var area_left: float = left + column + 12.0
	var area_right: float = right - big - 12.0
	var area_top: float = top + row_h + 36.0
	_arena.call("fit", Rect2(area_left, area_top, area_right - area_left, bottom - area_top))
	var board: Vector2 = _select.get_combined_minimum_size()
	_select.size = board
	_select.position = (size - board) / 2.0


func _place(button: Control, at: Vector2, side: float) -> void:
	button.position = at
	button.size = Vector2(side, side)
