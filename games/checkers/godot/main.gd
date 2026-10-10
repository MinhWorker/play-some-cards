extends Control
## Cờ Đam on the Godot client, in the **Bàn** layout (docs/experience.md): the wooden board in the
## middle, as tall as the frame; the two players in the column on its left (yours at the bottom,
## the other under the hub's ☰) with the move count between them; the status and Xin hoà, Đầu
## hàng, Hiệu ứng in the column on its right. It draws `snapshot.view` (View in
## src/game/model.ts, with your legal `moves` on your turn) and sends `move {path}`,
## `offer-draw`, `decline-draw` and `resign`.
##
## On your turn the pieces that may move are ringed. Tap one, then the square to go to; a capture
## of several pieces is tapped one landing square at a time. The side that moves second sees the
## board turned round, so your pieces are always at the bottom. A move slides hop by hop, taken
## pieces fly to the column and a new king gets a ring of light (Hiệu ứng: Tắt skips them).
##
## Named nodes for tests: Board, Square_<sq> (a button per dark square), Piece_<sq>, Status,
## MoveCount, Seat_<seat>, OfferDraw, DeclineDraw, Resign, Effects.

const SIZE := 8
## The playing area's margin on the board picture (3% each side).
const FRAME := 0.03
## The side that moves first (RULES.first) and starts at the bottom.
const FIRST := "b"
const SIDE_NAMES: Dictionary = {"w": "Trắng", "b": "Đen"}
const LAST := Color("#FFE066")
const PICKED := Color("#7FD4FF")
const TARGET := Color("#2E9D57")
const MOVABLE := Color("#FFE066")
const HOP_SECONDS := 0.18
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const COLUMN := 230.0
const BUTTON_WIDTH := 210.0
const SOUNDS: Array[String] = ["capture", "draw", "move", "promote", "select", "start", "win"]
const SETTINGS := "user://checkers.cfg"

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your side ("w", "b"), or "" for a spectator (who looks from the first side).
var _mine: String = ""
var _flip: bool = false
var _effects: bool = true

var _cloth := TextureRect.new()
var _board := TextureRect.new()
var _marks := Control.new()
var _squares := Control.new()
var _pieces_layer := Control.new()
var _status := Label.new()
var _move_count := Label.new()
var _draw: XomDaoButton = XomDaoButton.create("Xin hoà", XomDaoUi.Kind.INFO)
var _decline: XomDaoButton = XomDaoButton.create("Từ chối", XomDaoUi.Kind.BACK)
var _resign: XomDaoButton = XomDaoButton.create("Đầu hàng", XomDaoUi.Kind.DANGER)
var _effects_button: XomDaoButton = XomDaoButton.create("", XomDaoUi.Kind.BACK)
var _slots: Array[XomDaoPlayerSlot] = []
var _icons: Array[TextureRect] = []
var _sounds: Dictionary = {}
var _textures: Dictionary = {}

## Pieces on screen: square → TextureRect, and the letter each shows.
var _pieces: Dictionary = {}
var _letters: Dictionary = {}
## The squares tapped so far for this move: the piece, then each landing square.
var _path: Array[int] = []
var _moves: Array = []
var _plies: int = -1
var _ended: bool = false
var _animating: bool = false
var _resign_armed: bool = false
## Where the playing area starts on screen and one square's side.
var _origin := Vector2.ZERO
var _cell: float = 60.0


## Options for a sandbox room (`?play=checkers` in a debug build): against the computer.
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
			"label": "Lượt đi",
			"options": [["Bạn đi trước", false], ["Đối thủ đi trước", true]],
		},
	]


## How the game ended and its figures, for the hub's result board.
func result_detail() -> Dictionary:
	# The hub may ask before this scene heard the last state.
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _view.get("end") == null:
		return {}
	var taken: Dictionary = _view.get("taken", {})
	return {
		"reason": _status.text,
		"rows":
		[
			["Số lượt đi", str(int(_view.get("plies", 0)))],
			["Quân đã ăn", "Trắng %d · Đen %d" % [int(taken.get("w", 0)), int(taken.get("b", 0))]],
		],
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
	_effects = _load_effects()
	var night := ColorRect.new()
	night.color = Color("#0F2230")
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
	_marks.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_marks.draw.connect(_draw_marks)
	add_child(_marks)
	_pieces_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_pieces_layer)
	_squares.name = "Squares"
	_squares.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_squares)
	for sq: int in SIZE * SIZE:
		if not _is_dark(sq):
			continue
		var square := Button.new()
		square.name = "Square_%d" % sq
		square.flat = true
		square.focus_mode = Control.FOCUS_NONE
		var clear := StyleBoxEmpty.new()
		for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
			square.add_theme_stylebox_override(state, clear)
		square.pressed.connect(_tap.bind(sq))
		_squares.add_child(square)

	_status.name = "Status"
	_status.theme_type_variation = "HudLabel"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(_status)
	_move_count.name = "MoveCount"
	_move_count.theme_type_variation = "HudLabel"
	_move_count.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_move_count)
	_draw.name = "OfferDraw"
	_draw.pressed.connect(_send.bind("offer-draw"))
	_decline.name = "DeclineDraw"
	_decline.pressed.connect(_send.bind("decline-draw"))
	_resign.name = "Resign"
	_resign.pressed.connect(_on_resign)
	_effects_button.name = "Effects"
	_effects_button.pressed.connect(_toggle_effects)
	for button: XomDaoButton in [_draw, _decline, _resign, _effects_button]:
		button.custom_minimum_size.x = BUTTON_WIDTH
		add_child(button)
	for seat: int in 2:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.compact = true
		add_child(slot)
		_slots.append(slot)
		var icon := TextureRect.new()
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.custom_minimum_size = Vector2(36.0, 36.0)
		icon.size = icon.custom_minimum_size
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(icon)
		_icons.append(icon)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/checkers/sounds/%s.wav" % sound)
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
	var players: Array = view.get("players", [])
	_mine = ""
	if players.size() == 2:
		if str(players[0]) == _client.player_id:
			_mine = FIRST
		elif str(players[1]) == _client.player_id:
			_mine = _other(FIRST)
	var flip: bool = _mine == _other(FIRST)
	var plies: int = int(view.get("plies", 0))
	var fresh: bool = plies == 0 and (_plies != 0 or _view.is_empty())
	var last: Variant = view.get("last")
	var animate: bool = (
		_effects
		and not _animating
		and plies == _plies + 1
		and flip == _flip
		and last is Dictionary
		and is_inside_tree()
		and _letters.has(int((last as Dictionary)["path"][0]))
	)
	_view = view
	_moves = view.get("moves", [])
	if flip != _flip:
		_flip = flip
		_layout()
	if fresh:
		_clear_pieces()
		_sfx("start")
	if animate:
		_play_move(last as Dictionary, plies)
	elif not _animating:
		_sync_pieces()
		if plies == _plies + 1 and last is Dictionary:
			_sfx(_move_sound(last as Dictionary))
	_plies = plies
	if not _path.is_empty() and not _moves.any(_starts_with.bind(_path)):
		_path.clear()
	_show_seats()
	_show_status()
	_show_buttons()
	var ended: bool = view.get("end") != null
	if ended and not _ended:
		var end: Dictionary = view["end"]
		_sfx("win" if end.get("winner") != null else "draw")
	_ended = ended
	_move_count.text = "Nước %d" % (plies / 2 + 1)
	_marks.queue_redraw()


# ── Board ─────────────────────────────────────────────────────────────────────────────────


## A square's top-left corner on screen (turned round for the side moving second).
func _square_at(sq: int) -> Vector2:
	var row: int = sq / SIZE
	var col: int = sq % SIZE
	if _flip:
		row = SIZE - 1 - row
		col = SIZE - 1 - col
	return _origin + Vector2(col, row) * _cell


func _piece_rect(sq: int) -> Rect2:
	var side: float = _cell * 0.86
	return Rect2(_square_at(sq) + Vector2.ONE * (_cell - side) / 2.0, Vector2(side, side))


func _texture_of(letter: String) -> Texture2D:
	var art: String = (
		"piece-%s-%s"
		% [
			"white" if letter.to_lower() == "w" else "black",
			"king" if letter == letter.to_upper() else "man"
		]
	)
	return _art(art)


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/checkers/art/%s.webp" % name_of)
	return _textures[name_of]


func _clear_pieces() -> void:
	for piece: TextureRect in _pieces.values():
		piece.queue_free()
	_pieces.clear()
	_letters.clear()
	_path.clear()


## Makes the pieces on screen match the board, without animation.
func _sync_pieces() -> void:
	var board: String = str(_view.get("board", ""))
	for sq: int in _pieces.keys():
		if sq < board.length() and board[sq] == _letters[sq]:
			continue
		(_pieces[sq] as TextureRect).queue_free()
		_pieces.erase(sq)
		_letters.erase(sq)
	for sq: int in board.length():
		var letter: String = board[sq]
		if letter == "." or _pieces.has(sq):
			continue
		var piece := TextureRect.new()
		piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_pieces_layer.add_child(piece)
		_pieces[sq] = piece
		_letters[sq] = letter
	_place_pieces()


func _place_pieces() -> void:
	for sq: int in _pieces.keys():
		var piece: TextureRect = _pieces[sq]
		var rect: Rect2 = _piece_rect(sq)
		piece.name = "Piece_%d" % sq
		piece.texture = _texture_of(_letters[sq])
		piece.position = rect.position
		piece.size = rect.size
		piece.modulate.a = 1.0
		piece.scale = Vector2.ONE


## The last move on screen: the piece slides hop by hop, each taken piece flies to its taker's
## seat and fades, a new king gets a ring of light. Taps wait until it is over.
func _play_move(last: Dictionary, plies: int) -> void:
	var path: Array = last.get("path", [])
	var captures: Array = last.get("captures", [])
	var from: int = int(path[0])
	var to: int = int(path[path.size() - 1])
	var moving: TextureRect = _pieces[from]
	var letter: String = str(_letters[from])
	var taken: Array[TextureRect] = []
	for sq: Variant in captures:
		if _pieces.has(int(sq)):
			taken.append(_pieces[int(sq)])
			_pieces.erase(int(sq))
			_letters.erase(int(sq))
	_pieces.erase(from)
	_letters.erase(from)
	_animating = true
	_path.clear()
	moving.move_to_front()
	var seat: XomDaoPlayerSlot = _slots[0 if _side_at_bottom() == _side_of(letter) else 1]
	for i: int in range(1, path.size()):
		var hop: Rect2 = _piece_rect(int(path[i]))
		var tween: Tween = moving.create_tween()
		tween.tween_property(moving, "position", hop.position, HOP_SECONDS).set_trans(
			Tween.TRANS_SINE
		)
		await tween.finished
		if not is_inside_tree():
			return
		var victim: TextureRect = taken[i - 1] if i - 1 < taken.size() else null
		_sfx("capture" if victim != null else "move")
		if victim != null:
			var away: Tween = victim.create_tween().set_parallel()
			var target: Vector2 = seat.position + seat.size / 2.0
			away.tween_property(victim, "position", target, HOP_SECONDS)
			away.tween_property(victim, "modulate:a", 0.0, HOP_SECONDS)
			away.tween_property(victim, "scale", Vector2.ONE * 0.3, HOP_SECONDS)
			away.chain().tween_callback(victim.queue_free)
	# The board may already be a move further on (the reply came in meanwhile); the piece keeps
	# its own letter and _sync_pieces below catches up with the board.
	_pieces[to] = moving
	_letters[to] = letter.to_upper() if bool(last.get("crowned", false)) else letter
	_place_pieces()
	if bool(last.get("crowned", false)):
		_sfx("promote")
		_crown_ring(_piece_rect(to))
	_animating = false
	# A reply that came in meanwhile plays next.
	var next: Variant = _view.get("last")
	if (
		int(_view.get("plies", 0)) == plies + 1
		and next is Dictionary
		and _letters.has(int((next as Dictionary)["path"][0]))
	):
		_play_move(next as Dictionary, plies + 1)
		return
	_sync_pieces()
	_marks.queue_redraw()


func _crown_ring(rect: Rect2) -> void:
	var ring := Control.new()
	ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ring.position = rect.get_center()
	ring.draw.connect(
		func() -> void:
			ring.draw_arc(Vector2.ZERO, _cell * 0.42, 0.0, TAU, 48, Color("#FFD56B"), 4.0, true)
	)
	add_child(ring)
	var tween: Tween = ring.create_tween().set_parallel()
	tween.tween_property(ring, "scale", Vector2.ONE * 1.8, 0.38)
	tween.tween_property(ring, "modulate:a", 0.0, 0.38)
	tween.chain().tween_callback(ring.queue_free)


func _move_sound(last: Dictionary) -> String:
	if bool(last.get("crowned", false)):
		return "promote"
	return "capture" if not (last.get("captures", []) as Array).is_empty() else "move"


## The last move's squares; on your turn, rings on the pieces that may move; the picked piece,
## the squares it has landed on so far, the pieces it takes on the way and where it may go next.
func _draw_marks() -> void:
	var last: Variant = _view.get("last")
	if last is Dictionary:
		for sq: Variant in (last as Dictionary).get("path", []):
			_marks.draw_rect(Rect2(_square_at(int(sq)), Vector2.ONE * _cell), Color(LAST, 0.3))
	for piece: TextureRect in _pieces.values():
		piece.modulate.a = 1.0
	if _animating:
		return
	if _path.is_empty():
		var width: float = maxf(2.0, _cell * 0.06)
		for start: int in _starts():
			var center: Vector2 = _square_at(start) + Vector2.ONE * _cell / 2.0
			_marks.draw_arc(center, _cell * 0.47, 0.0, TAU, 40, Color(MOVABLE, 0.9), width, true)
		return
	for sq: int in _path:
		_marks.draw_rect(Rect2(_square_at(sq), Vector2.ONE * _cell), Color(PICKED, 0.45))
	var matching: Array = _moves.filter(_starts_with.bind(_path))
	if not matching.is_empty():
		var captures: Array = (matching[0] as Dictionary).get("captures", [])
		for i: int in mini(_path.size() - 1, captures.size()):
			var taken: TextureRect = _pieces.get(int(captures[i]))
			if taken != null:
				taken.modulate.a = 0.4
	for move: Dictionary in matching:
		var path: Array = move["path"]
		if path.size() > _path.size():
			var center: Vector2 = _square_at(int(path[_path.size()])) + Vector2.ONE * _cell / 2.0
			_marks.draw_circle(center, _cell * 0.18, Color(TARGET, 0.75), true, -1.0, true)


## The squares of the pieces that may move now.
func _starts() -> Array[int]:
	var out: Array[int] = []
	for move: Dictionary in _moves:
		var start: int = int((move["path"] as Array)[0])
		if not out.has(start):
			out.append(start)
	return out


static func _starts_with(move: Dictionary, prefix: Array[int]) -> bool:
	var path: Array = move["path"]
	if path.size() < prefix.size():
		return false
	for i: int in prefix.size():
		if int(path[i]) != prefix[i]:
			return false
	return true


## A tap on a dark square: pick a piece that may move, or the next square of its move (the move
## is sent once the tapped squares make a whole move), or drop the pick.
func _tap(sq: int) -> void:
	if _animating or _moves.is_empty():
		return
	var extended: Array[int] = _path.duplicate()
	extended.append(sq)
	var matching: Array = [] if _path.is_empty() else _moves.filter(_starts_with.bind(extended))
	if not matching.is_empty():
		var whole: Array = matching.filter(
			func(m: Dictionary) -> bool: return (m["path"] as Array).size() == extended.size()
		)
		if whole.size() == 1 and matching.size() == 1:
			_path.clear()
			_moves = []
			await _client.send("move", {"path": extended})
		else:
			_path = extended
	elif _starts().has(sq):
		_sfx("select")
		if _path.size() == 1 and _path[0] == sq:
			_path.clear()
		else:
			_path = [sq]
	else:
		_path.clear()
	_marks.queue_redraw()


# ── Players, status and buttons ───────────────────────────────────────────────────────────


static func _other(side: String) -> String:
	return "w" if side == "b" else "b"


static func _side_of(letter: String) -> String:
	return "w" if letter.to_lower() == "w" else "b"


static func _is_dark(sq: int) -> bool:
	return (sq / SIZE + sq % SIZE) % 2 == 1


func _side_at_bottom() -> String:
	return _other(FIRST) if _flip else FIRST


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


## Slot 0 is the side at the bottom (yours), slot 1 the other, with its piece, wins and takes.
func _show_seats() -> void:
	var taken: Dictionary = _view.get("taken", {})
	var playing: bool = _view.get("end") == null and _snapshot.status == "playing"
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
		slot.extra = "Thắng %d · Ăn %d" % [wins, int(taken.get(side, 0))]
		var on_turn: bool = playing and str(_view.get("turn", "")) == side
		if on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
		_icons[i].texture = _texture_of(side)
	# A longer count can widen the seats' column.
	_layout()


func _show_status() -> void:
	var end: Variant = _view.get("end")
	var turn: String = str(_view.get("turn", FIRST))
	if end is Dictionary:
		var winner: Variant = (end as Dictionary).get("winner")
		var loser: String = _name_of(_other(str(winner))) if winner != null else ""
		var how: String = (
			{
				"blocked": "%s hết nước đi" % loser,
				"resign": "%s đầu hàng" % loser,
				"left": "%s rời bàn" % loser,
				"repetition": "Lặp lại thế cờ ba lần",
				"move-limit": "Lâu không ăn quân",
				"agreement": "Hai bên đồng ý",
			}
			. get(str((end as Dictionary).get("reason", "")), "")
		)
		if winner != null:
			_status.text = "%s thắng · %s" % [_name_of(str(winner)), how]
		else:
			_status.text = "Hoà · %s" % how
		return
	var offer: Variant = _view.get("drawOffer")
	if offer != null and _mine != "" and str(offer) != _mine:
		_status.text = "%s xin hoà" % _name_of(str(offer))
	elif turn == _mine:
		_status.text = "Tới lượt bạn"
	else:
		_status.text = "Lượt %s · %s" % [SIDE_NAMES[turn], _name_of(turn)]


func _show_buttons() -> void:
	var playing: bool = _mine != "" and _view.get("end") == null and _snapshot.status == "playing"
	var offer: Variant = _view.get("drawOffer")
	var offered: bool = playing and offer != null and str(offer) != _mine
	var vs_bot: bool = false
	for player: XomDaoPlayerInfo in _snapshot.seats:
		vs_bot = vs_bot or player.bot
	_draw.visible = playing and not vs_bot
	_draw.text = (
		"Đồng ý hoà"
		if offered
		else ("Đã xin hoà" if offer != null and str(offer) == _mine else "Xin hoà")
	)
	_draw.disabled = offer != null and str(offer) == _mine
	_decline.visible = offered
	_resign.visible = playing
	if not playing:
		_resign_armed = false
	_resign.text = "Chắc chưa?" if _resign_armed else "Đầu hàng"
	_effects_button.text = "Hiệu ứng: %s" % ("Bật" if _effects else "Tắt")
	_layout.call_deferred()


func _send(event: String) -> void:
	await _client.send(event)


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


func _toggle_effects() -> void:
	_effects = not _effects
	var config := ConfigFile.new()
	config.set_value("checkers", "effects", _effects)
	config.save(SETTINGS)
	_effects_button.text = "Hiệu ứng: %s" % ("Bật" if _effects else "Tắt")


static func _load_effects() -> bool:
	var config := ConfigFile.new()
	if config.load(SETTINGS) != OK:
		return true
	return bool(config.get_value("checkers", "effects", true))


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## The board as tall as the frame in the middle; the players' column on its left, the status
## and buttons' column on its right.
func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	_cloth.size = size / _cloth.scale
	# The board takes what the two columns leave: the seats on the left, the buttons on the right.
	var seats_width: float = COLUMN
	for slot: XomDaoPlayerSlot in _slots:
		slot.reset_size()
		seats_width = maxf(seats_width, slot.size.x)
	var buttons_width: float = BUTTON_WIDTH
	for button: XomDaoButton in [_effects_button, _resign, _decline, _draw]:
		button.reset_size()
		buttons_width = maxf(buttons_width, button.size.x)
	var room: float = right - left - seats_width - buttons_width - 32.0
	var side: float = clampf(minf(size.y - 2.0 * edge, room), 240.0, size.y)
	var between: float = left + seats_width + 16.0
	var board_at := Vector2(between + maxf(0.0, (room - side) / 2.0), (size.y - side) / 2.0)
	_board.position = board_at
	_board.size = Vector2(side, side)
	_cell = side * (1.0 - 2.0 * FRAME) / SIZE
	_origin = board_at + Vector2.ONE * side * FRAME
	_marks.position = Vector2.ZERO
	_marks.size = size
	_pieces_layer.size = size
	_squares.size = size
	for square: Button in _squares.get_children():
		var sq: int = int(str(square.name).trim_prefix("Square_"))
		square.position = _square_at(sq)
		square.size = Vector2.ONE * _cell
	if not _animating:
		_place_pieces()
	# Left column: the other player under ☰, yours at the bottom, the move count between.
	var column_right: float = board_at.x - 16.0
	for i: int in 2:
		var slot: XomDaoPlayerSlot = _slots[i]
		var y: float = size.y - edge - slot.size.y if i == 0 else edge + MENU + 12.0
		slot.position = Vector2(left, y)
	_place_icons.call_deferred()
	_move_count.reset_size()
	_move_count.position = Vector2(
		left + (column_right - left - _move_count.size.x) / 2.0, (size.y - _move_count.size.y) / 2.0
	)
	# Right column: the status at the top, the buttons at the bottom.
	var column_left: float = board_at.x + side + 16.0
	var width: float = maxf(right - column_left, BUTTON_WIDTH)
	_status.size = Vector2(width, 0.0)
	_status.position = Vector2(column_left, edge)
	var y: float = size.y - edge
	for button: XomDaoButton in [_effects_button, _resign, _decline, _draw]:
		if not button.visible:
			continue
		button.reset_size()
		y -= button.size.y
		button.position = Vector2(right - button.size.x, y)
		y -= 10.0
	_marks.queue_redraw()


## Each side's piece sits on its player's avatar like a badge, once the slots have laid out.
func _place_icons() -> void:
	for i: int in _slots.size():
		var avatar: Control = _slots[i].avatar
		var icon: TextureRect = _icons[i]
		icon.position = (avatar.global_position - global_position + avatar.size - icon.size * 0.75)
