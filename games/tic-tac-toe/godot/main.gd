extends Control
## Caro on the Godot client, in the **Bàn** layout (docs/experience.md): the board of wooden tiles
## in the middle, as tall as the frame; the two players in the column on its left (yours at the
## bottom, the other under the hub's ☰), each with the piece it plays as a badge; the status and,
## for the host after a game, Đổi quân in the column on its right. It draws `snapshot.view` (the
## server's State in src/game/model.ts) and sends `place {x, y}` when you tap a free tile on your
## turn.
##
## A piece pops in with its sound. When a piece reaches an edge the board grows: the new tiles
## fade in, nearest the old board first, while the board glides to fit. After a win the five
## tiles turn gold and their pieces bounce.
##
## Named nodes for tests: Board, Cell_<x>_<y> (a button per tile, in board coordinates, so
## x and y go negative once the board grew left or up), Piece_<x>_<y>, Status, Rule, Seat_<seat>,
## Swap.

const RED := Color("#E0463A")
const BLUE := Color("#5FB4FF")
const HOVER := Color("#FFF1B8")
const LAST := Color("#FFE6A0")
const WIN_TINT := Color("#FFD34D")
## Marks in a row that win (WIN in src/game/model.ts).
const WIN := 5
const GLIDE_SECONDS := 0.65
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const COLUMN := 230.0
const BUTTON_WIDTH := 210.0
const SOUNDS: Array[String] = [
	"caro-draw", "caro-line-complete", "caro-o-place", "caro-select", "caro-start", "mark-drop"
]
const PLACE_SOUND: Dictionary = {"X": "mark-drop", "O": "caro-o-place"}
const DIRECTIONS: Array[Vector2i] = [
	Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1), Vector2i(1, -1)
]

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}

var _cloth := TextureRect.new()
var _board := Control.new()
var _tiles_layer := Control.new()
var _pieces_layer := Control.new()
var _cells := Control.new()
var _status := Label.new()
var _rule := Label.new()
var _swap: XomDaoButton = XomDaoButton.create("Đổi quân", XomDaoUi.Kind.INFO)
var _swap_icon := TextureRect.new()
var _slots: Array[XomDaoPlayerSlot] = []
var _icons: Array[TextureRect] = []
var _sounds: Dictionary = {}
var _textures: Dictionary = {}

## Tiles, cell buttons and pieces by cell.
var _tiles: Dictionary = {}
var _buttons: Dictionary = {}
var _pieces: Dictionary = {}
var _bounces: Dictionary = {}
## The board's bounds on screen now (left, top, cols, rows).
var _shape := Vector4i(0, 0, -1, -1)
## Where the board's centre (in board coordinates) sits, and a cell's side on screen.
var _mid := Vector2.ZERO
var _cell: float = 40.0
var _area := Rect2()
var _glide: Tween
var _hovered := Vector2i(1 << 20, 1 << 20)
var _round: int = -1
var _seq: int = -1
var _ended: bool = false
var _line: Array[Vector2i] = []


## Options for a sandbox room (`?play=tic-tac-toe` in a debug build): against the computer.
func sandbox_options() -> Dictionary:
	return {"opponent": "bot"}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts).
func room_setup() -> Array:
	return [
		{"key": "opponent", "label": "Chơi với", "options": [["Bạn bè", "human"], ["Máy", "bot"]]},
		{
			"key": "level",
			"label": "Máy chơi",
			"options": [["Dễ", "easy"], ["Vừa", "normal"], ["Khó", "hard"]]
		},
		{"key": "swap", "label": "Bạn cầm quân", "options": [["X (đi trước)", false], ["O", true]]},
	]


## How the game ended and its figures, for the hub's result board.
func result_detail() -> Dictionary:
	# The hub may ask before this scene heard the last state.
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty():
		return {}
	var board: Dictionary = _view["board"]
	var moves: int = 0
	for cell: Variant in board["cells"]:
		if cell != null:
			moves += 1
	var how: String = "Nối đủ %d quân" % WIN if not _line.is_empty() else "Hết chỗ để nối %d" % WIN
	return {"reason": how, "rows": [["Số nước", str(moves)]]}


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	var sea := ColorRect.new()
	sea.color = Color("#10404A")
	sea.set_anchors_preset(Control.PRESET_FULL_RECT)
	sea.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(sea)
	_cloth.texture = _art("cloth")
	_cloth.stretch_mode = TextureRect.STRETCH_TILE
	_cloth.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	_cloth.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_cloth)

	_board.name = "Board"
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_board)
	for layer: Control in [_tiles_layer, _pieces_layer, _cells]:
		layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_board.add_child(layer)

	_status.name = "Status"
	_status.theme_type_variation = "HudLabel"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_status)
	_rule.name = "Rule"
	_rule.theme_type_variation = "HudLabel"
	_rule.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_rule.text = "Nối %d" % WIN
	add_child(_rule)
	_swap.name = "Swap"
	_swap.custom_minimum_size.x = BUTTON_WIDTH
	_swap.pressed.connect(_on_swap)
	_swap.visible = false
	add_child(_swap)
	_swap_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_swap_icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_swap_icon.custom_minimum_size = Vector2(44.0, 44.0)
	_swap_icon.size = _swap_icon.custom_minimum_size
	_swap_icon.visible = false
	add_child(_swap_icon)
	for seat: int in 2:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.compact = true
		add_child(slot)
		_slots.append(slot)
		var icon := TextureRect.new()
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.custom_minimum_size = Vector2(56.0, 56.0)
		icon.size = icon.custom_minimum_size
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(icon)
		_icons.append(icon)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/tic-tac-toe/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var first: bool = _view.is_empty()
	_view = view
	var fresh: bool = snapshot.round != _round
	if fresh:
		_round = snapshot.round
		_clear_pieces()
		if not first and snapshot.status == "playing":
			_sfx("caro-start")
	var board: Dictionary = view["board"]
	var shape := Vector4i(
		int(board["left"]), int(board["top"]), int(board["cols"]), int(board["rows"])
	)
	if shape != _shape:
		_sync_tiles(shape, not first and not fresh)
		_frame(not first and not fresh)
	var placed := Vector2i(1 << 20, 1 << 20)
	if snapshot.last != null and snapshot.last.seq != _seq:
		var move: Variant = snapshot.last.move
		if _seq >= 0 and move is Dictionary and (move as Dictionary).get("payload") is Dictionary:
			var payload: Dictionary = (move as Dictionary)["payload"]
			placed = Vector2i(int(payload.get("x", 0)), int(payload.get("y", 0)))
		_seq = snapshot.last.seq
	_sync_pieces(placed)
	_line = _winning_line()
	var ended: bool = snapshot.status != "playing" and snapshot.result != null
	if ended and not _ended and not first:
		_sfx("caro-line-complete" if not _line.is_empty() else "caro-draw")
	_ended = ended
	_tint_tiles()
	_glow()
	_show_seats()
	_show_status()
	_layout()


# ── Board ─────────────────────────────────────────────────────────────────────────────────


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/tic-tac-toe/art/%s.webp" % name_of)
	return _textures[name_of]


func _at(p: Vector2i) -> String:
	var board: Dictionary = _view["board"]
	var col: int = p.x - int(board["left"])
	var row: int = p.y - int(board["top"])
	if col < 0 or row < 0 or col >= int(board["cols"]) or row >= int(board["rows"]):
		return ""
	var cell: Variant = (board["cells"] as Array)[row * int(board["cols"]) + col]
	return "" if cell == null else str(cell)


## A cell's centre on screen, in the board layer.
func _center_of(p: Vector2i) -> Vector2:
	return _area.get_center() + (Vector2(p) - _mid) * _cell


## One tile and one button per cell of the board: tiles off it go, new ones are made (fading
## in, nearest the old board first, when `animate`).
func _sync_tiles(shape: Vector4i, animate: bool) -> void:
	var old: Vector4i = _shape
	_shape = shape
	var wanted: Dictionary = {}
	for y: int in range(shape.y, shape.y + shape.w):
		for x: int in range(shape.x, shape.x + shape.z):
			wanted[Vector2i(x, y)] = true
	for p: Vector2i in _tiles.keys():
		if wanted.has(p):
			continue
		_tiles[p].queue_free()
		_buttons[p].queue_free()
		_tiles.erase(p)
		_buttons.erase(p)
	for p: Vector2i in wanted:
		if _tiles.has(p):
			continue
		var tile := TextureRect.new()
		tile.texture = _art("tile")
		tile.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tile.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_tiles_layer.add_child(tile)
		_tiles[p] = tile
		var cell := Button.new()
		cell.name = "Cell_%d_%d" % [p.x, p.y]
		cell.flat = true
		cell.focus_mode = Control.FOCUS_NONE
		var clear := StyleBoxEmpty.new()
		for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
			cell.add_theme_stylebox_override(state, clear)
		cell.pressed.connect(_tap.bind(p))
		cell.mouse_entered.connect(_hover.bind(p))
		cell.mouse_exited.connect(_hover.bind(Vector2i(1 << 20, 1 << 20)))
		_cells.add_child(cell)
		_buttons[p] = cell
		if animate and old.z > 0 and is_inside_tree():
			var away: int = maxi(
				maxi(old.x - p.x, p.x - (old.x + old.z - 1)),
				maxi(old.y - p.y, p.y - (old.y + old.w - 1))
			)
			tile.modulate.a = 0.0
			tile.create_tween().tween_property(tile, "modulate:a", 1.0, 0.32).set_delay(
				0.12 + away * 0.11
			)


## Glides (or jumps) so the whole board fits the board area, centred.
func _frame(smooth: bool) -> void:
	if _shape.z <= 0:
		return
	var mid := Vector2(_shape.x + (_shape.z - 1) / 2.0, _shape.y + (_shape.w - 1) / 2.0)
	var cell: float = minf(_area.size.x, _area.size.y) / maxi(_shape.z, _shape.w)
	if _glide != null:
		_glide.kill()
	if not smooth or not is_inside_tree():
		_mid = mid
		_cell = cell
		_place_board()
		return
	_glide = create_tween().set_parallel().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_glide.tween_property(self, "_mid", mid, GLIDE_SECONDS)
	_glide.tween_property(self, "_cell", cell, GLIDE_SECONDS)
	_glide.tween_method(func(_t: float) -> void: _place_board(), 0.0, 1.0, GLIDE_SECONDS)


func _place_board() -> void:
	for p: Vector2i in _tiles:
		var at: Vector2 = _center_of(p)
		var tile: TextureRect = _tiles[p]
		tile.size = Vector2.ONE * _cell * 0.96
		tile.position = at - tile.size / 2.0
		var cell: Button = _buttons[p]
		cell.size = Vector2.ONE * _cell
		cell.position = at - cell.size / 2.0
	for p: Vector2i in _pieces:
		var piece: TextureRect = _pieces[p]
		piece.size = Vector2.ONE * _cell * 1.1
		piece.pivot_offset = piece.size / 2.0
		piece.position = _center_of(p) - piece.size / 2.0


func _clear_pieces() -> void:
	for piece: TextureRect in _pieces.values():
		piece.queue_free()
	_pieces.clear()
	_bounces.clear()


## The pieces on screen follow the board; the one just placed pops in with its sound.
func _sync_pieces(placed: Vector2i) -> void:
	for p: Vector2i in _pieces.keys():
		if _at(p) != "":
			continue
		_pieces[p].queue_free()
		_pieces.erase(p)
	for p: Vector2i in _tiles:
		var mark: String = _at(p)
		if mark == "" or _pieces.has(p):
			continue
		var piece := TextureRect.new()
		piece.name = "Piece_%d_%d" % [p.x, p.y]
		piece.texture = _art("piece-x" if mark == "X" else "piece-o")
		piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_pieces_layer.add_child(piece)
		_pieces[p] = piece
		if p == placed and is_inside_tree():
			piece.scale = Vector2.ZERO
			(
				piece
				. create_tween()
				. tween_property(piece, "scale", Vector2.ONE, 0.26)
				. set_trans(Tween.TRANS_BACK)
				. set_ease(Tween.EASE_OUT)
			)
			_sfx(PLACE_SOUND[mark])
	_place_board()


## The first WIN cells in a row with the same mark, or none.
func _winning_line() -> Array[Vector2i]:
	for p: Vector2i in _tiles:
		var mark: String = _at(p)
		if mark == "":
			continue
		for step: Vector2i in DIRECTIONS:
			var line: Array[Vector2i] = []
			for i: int in WIN:
				if _at(p + step * i) != mark:
					break
				line.append(p + step * i)
			if line.size() == WIN:
				return line
	return []


func _can_play(p: Vector2i) -> bool:
	return (
		_snapshot != null
		and _snapshot.status == "playing"
		and str(_view.get("turn", "")) == _client.player_id
		and _at(p) == ""
	)


## Gold under the winning line, light under the mouse where you may play, else plain.
func _tint_tiles() -> void:
	var last := Vector2i(1 << 20, 1 << 20)
	if _snapshot != null and _snapshot.last != null and _snapshot.last.move is Dictionary:
		var payload: Variant = (_snapshot.last.move as Dictionary).get("payload")
		if payload is Dictionary:
			last = Vector2i(int(payload.get("x", 0)), int(payload.get("y", 0)))
	for p: Vector2i in _tiles:
		var tile: TextureRect = _tiles[p]
		var alpha: float = tile.modulate.a
		if _line.has(p):
			tile.modulate = WIN_TINT
		elif p == _hovered and _can_play(p):
			tile.modulate = HOVER
		elif p == last and _snapshot.status == "playing":
			tile.modulate = LAST
		else:
			tile.modulate = Color.WHITE
		tile.modulate.a = alpha
		(_buttons[p] as Button).disabled = not _can_play(p)


## The winning pieces bounce, one after another, while the result shows.
func _glow() -> void:
	for p: Vector2i in _bounces.keys():
		if _line.has(p):
			continue
		(_bounces[p] as Tween).kill()
		_bounces.erase(p)
		if _pieces.has(p):
			(_pieces[p] as TextureRect).scale = Vector2.ONE
	for i: int in _line.size():
		var p: Vector2i = _line[i]
		if _bounces.has(p) or not _pieces.has(p) or not is_inside_tree():
			continue
		var piece: TextureRect = _pieces[p]
		var bounce: Tween = piece.create_tween().set_loops()
		bounce.tween_interval(0.3 + i * 0.12)
		bounce.tween_property(piece, "scale", Vector2.ONE * 1.18, 0.42).set_trans(Tween.TRANS_SINE)
		bounce.tween_property(piece, "scale", Vector2.ONE, 0.42).set_trans(Tween.TRANS_SINE)
		_bounces[p] = bounce


func _tap(p: Vector2i) -> void:
	if not _can_play(p):
		return
	_hovered = Vector2i(1 << 20, 1 << 20)
	(_buttons[p] as Button).disabled = true
	await _client.send("place", {"x": p.x, "y": p.y})


func _hover(p: Vector2i) -> void:
	_hovered = p
	if not _view.is_empty():
		_tint_tiles()


# ── Players, status and the host's swap ───────────────────────────────────────────────────


## The id that plays a mark: players[0] is X.
func _player_of(mark: String) -> String:
	var players: Array = _view.get("players", [])
	if players.size() < 2:
		return ""
	return str(players[0 if mark == "X" else 1])


func _mine() -> String:
	if _player_of("O") == _client.player_id:
		return "O"
	return "X" if _player_of("X") == _client.player_id else ""


func _name(id: String) -> String:
	if id == _client.player_id:
		return "Bạn"
	for player: XomDaoPlayerInfo in _snapshot.seats + _snapshot.players:
		if player.id == id:
			return player.name
	return "?"


## Slot 0 (at the bottom) is yours, or X for a spectator; each with its wins and its piece.
func _show_seats() -> void:
	var bottom: String = "O" if _mine() == "O" else "X"
	for i: int in 2:
		var mark: String = bottom if i == 0 else ("X" if bottom == "O" else "O")
		var id: String = _player_of(mark)
		var slot: XomDaoPlayerSlot = _slots[i]
		slot.player_name = _name(id)
		slot.host = id != "" and id == str(_snapshot.host_id)
		for seat: XomDaoPlayerInfo in _snapshot.seats:
			if seat.id == id:
				slot.frame = seat.frame
		# The room's score counts wins by place in `players`.
		var wins: int = 0
		for i_player: int in _snapshot.players.size():
			var counted: bool = _snapshot.score != null and i_player < _snapshot.score.wins.size()
			if counted and _snapshot.players[i_player].id == id:
				wins = _snapshot.score.wins[i_player]
		slot.extra = "Thắng %d" % wins
		var on_turn: bool = _snapshot.status == "playing" and str(_view.get("turn", "")) == id
		if on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
		_icons[i].texture = _art("piece-x" if mark == "X" else "piece-o")


func _show_status() -> void:
	var playing: bool = _snapshot.status == "playing"
	if not playing:
		_status.text = "Hết ván"
	elif str(_view.get("turn", "")) == _client.player_id:
		_status.text = "Lượt bạn"
	else:
		_status.text = "Lượt %s" % _name(str(_view.get("turn", "")))
	_status.add_theme_color_override("font_color", RED if _turn_mark() == "X" else BLUE)
	if not playing:
		_status.remove_theme_color_override("font_color")
	# The host picks the piece for the next game between games.
	var host: bool = _snapshot.host_id != null and str(_snapshot.host_id) == _client.player_id
	_swap.visible = not playing and host and _snapshot.players.size() == 2
	_swap_icon.visible = _swap.visible
	if _swap.visible:
		_swap_icon.texture = _art("piece-x" if _next_mark() == "X" else "piece-o")


func _turn_mark() -> String:
	return "X" if str(_view.get("turn", "")) == _player_of("X") else "O"


## The piece the host plays next game, from the room's `swap` option.
func _next_mark() -> String:
	var options: Dictionary = _snapshot.options if _snapshot.options is Dictionary else {}
	var first: bool = _snapshot.players.size() > 0 and _snapshot.players[0].id == _client.player_id
	return "X" if first != bool(options.get("swap", false)) else "O"


func _on_swap() -> void:
	_sfx("caro-select")
	var options: Dictionary = (
		(_snapshot.options as Dictionary).duplicate() if _snapshot.options is Dictionary else {}
	)
	options["swap"] = not bool(options.get("swap", false))
	await _client.request("room:options", {"options": options})


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## The board as tall as the frame in the middle; the players' column on its left, the status and
## Đổi quân on its right.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	_cloth.size = size
	var seats_width: float = COLUMN
	for slot: XomDaoPlayerSlot in _slots:
		slot.reset_size()
		seats_width = maxf(seats_width, slot.size.x)
	_swap.reset_size()
	var buttons_width: float = maxf(BUTTON_WIDTH, _swap.size.x)
	var room: float = right - left - seats_width - buttons_width - 32.0
	var side: float = clampf(minf(size.y - 2.0 * edge, room), 200.0, size.y)
	var between: float = left + seats_width + 16.0
	var area := Rect2(
		Vector2(between + maxf(0.0, (room - side) / 2.0), (size.y - side) / 2.0),
		Vector2(side, side)
	)
	var resized_area: bool = area != _area
	_area = area
	for layer: Control in [_board, _tiles_layer, _pieces_layer, _cells]:
		layer.position = Vector2.ZERO
		layer.size = size
	if resized_area and (_glide == null or not _glide.is_running()):
		_frame(false)
	for i: int in 2:
		var slot: XomDaoPlayerSlot = _slots[i]
		var y: float = size.y - edge - slot.size.y if i == 0 else edge + MENU + 12.0
		slot.position = Vector2(left, y)
	_place_icons.call_deferred()
	var column_left: float = area.end.x + 16.0
	var width: float = maxf(right - column_left, BUTTON_WIDTH)
	_status.size = Vector2(width, 0.0)
	_status.position = Vector2(column_left, edge)
	_status.reset_size()
	_status.size.x = width
	_rule.size = Vector2(width, 0.0)
	_rule.position = Vector2(column_left, _status.position.y + _status.size.y + 8.0)
	_swap.position = Vector2(right - _swap.size.x, size.y - edge - _swap.size.y)
	_swap_icon.position = Vector2(
		_swap.position.x + (_swap.size.x - _swap_icon.size.x) / 2.0,
		_swap.position.y - _swap_icon.size.y - 10.0
	)


## Each player's piece sits on its avatar like a badge, once the slots have laid out.
func _place_icons() -> void:
	for i: int in _slots.size():
		var avatar: Control = _slots[i].avatar
		var icon: TextureRect = _icons[i]
		icon.position = (avatar.global_position - global_position + avatar.size - icon.size * 0.62)
