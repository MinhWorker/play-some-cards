extends Control
## Cờ Vua on the Godot client, in the **Bàn** layout (docs/experience.md): the wooden board in the
## middle, as tall as the frame; the two players in the column on its left (yours at the bottom,
## the other under the hub's ☰) with the move count between them; the status and Xin hoà, Đầu
## hàng, Hiệu ứng in the column on its right. It draws `snapshot.view` (View in
## src/game/model.ts, with your legal `moves` on your turn) and sends `move {from, to,
## promotion?}`, `offer-draw`, `decline-draw` and `resign`.
##
## Tap one of your pieces, then a dotted square (a ring marks a piece you can take); a pawn
## reaching the last rank asks which piece it becomes (Phong cấp). The side that plays Black sees
## the board turned round. The last move's squares are tinted gold, a king in check red. A move
## slides (the rook too when castling), a taken piece flies to its taker's seat, and a check shows
## a CHIẾU TƯỚNG! ribbon (Hiệu ứng: Tắt skips the motion, the sounds stay).
##
## Named nodes for tests: Board, Square_<sq> (a button per square, sq = row * 8 + col from
## Black's side), Piece_<sq>, Status, MoveCount, Seat_<seat>, OfferDraw, DeclineDraw, Resign,
## Effects, Promotion with Promote_<q|r|b|n>, CutIn.

const SIZE := 8
## The playing area's margin on the board picture (3% each side).
const FRAME := 0.03
## White moves first and starts at the bottom.
const FIRST := "w"
const SIDE_NAMES: Dictionary = {"w": "Trắng", "b": "Đen"}
const ART: Dictionary = {
	"k": "king", "q": "queen", "r": "rook", "b": "bishop", "n": "knight", "p": "pawn"
}
const PROMOTIONS: Array[String] = ["q", "r", "b", "n"]
const PROMOTION_NAMES: Dictionary = {"q": "Hậu", "r": "Xe", "b": "Tượng", "n": "Mã"}
## The visible piece's height as a share of its picture, and where its base sits on it.
const DISC := 0.68
const ANCHOR := Vector2(0.5, 0.62)
const LAST := Color("#FFE066")
const PICKED := Color("#7FD4FF")
const TARGET := Color("#1F6B3A")
const CHECK := Color("#FF3B30")
const LIGHT_TEXT := Color("#614029")
const DARK_TEXT := Color("#FFEBBD")
const SLIDE_SECONDS := 0.22
## The hub's ☰ button keeps the top left square.
const MENU := 88.0
const COLUMN := 230.0
const BUTTON_WIDTH := 210.0
const SOUNDS: Array[String] = [
	"capture", "castle", "check", "draw", "mate", "move", "promote", "select", "start", "win"
]
const SETTINGS := "user://chess.cfg"

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your side ("w", "b"), or "" for a spectator (who looks from White's side).
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
var _promotion: XomDaoBoard = XomDaoBoard.create("Phong cấp")
var _slots: Array[XomDaoPlayerSlot] = []
var _icons: Array[TextureRect] = []
var _sounds: Dictionary = {}
var _textures: Dictionary = {}

## Pieces on screen: square → TextureRect, and the letter each shows.
var _pieces: Dictionary = {}
var _letters: Dictionary = {}
## The picked piece's square (-1: none), and the square a pawn is promoting on.
var _picked: int = -1
var _promoting: int = -1
var _moves: Array = []
var _plies: int = -1
var _ended: bool = false
var _animating: bool = false
var _resign_armed: bool = false
## Where the playing area starts on screen and one square's side.
var _origin := Vector2.ZERO
var _cell: float = 60.0


## Options for a sandbox room (`?play=chess` in a debug build): against the computer.
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
			"options": [["Trắng, đi trước", false], ["Đen", true]],
		},
	]


## How the game ended and its figures, for the hub's result board.
func result_detail() -> Dictionary:
	# The hub may ask before this scene heard the last state.
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _view.get("end") == null:
		return {}
	return {
		"reason": _status.text,
		"rows":
		[
			["Số lượt đi", str(int(_view.get("plies", 0)))],
			["Quân đã ăn", "Trắng %d · Đen %d" % [_taken_by("w"), _taken_by("b")]],
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
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.custom_minimum_size = Vector2(60.0, 60.0)
		icon.size = icon.custom_minimum_size
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(icon)
		_icons.append(icon)
	_build_promotion()
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/chess/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


## Phong cấp: the four pieces a pawn may become, over the board.
func _build_promotion() -> void:
	_promotion.name = "Promotion"
	_promotion.visible = false
	add_child(_promotion)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	_promotion.content.add_child(row)
	for kind: String in PROMOTIONS:
		var button: XomDaoButton = XomDaoButton.create(PROMOTION_NAMES[kind], XomDaoUi.Kind.BACK)
		button.name = "Promote_" + kind
		button.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		button.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		button.expand_icon = true
		button.custom_minimum_size = Vector2(110.0, 140.0)
		button.pressed.connect(_promote.bind(kind))
		row.add_child(button)


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
		and _letters.has(int((last as Dictionary)["from"]))
	)
	var moved: bool = plies == _plies + 1 and last is Dictionary
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
		if moved:
			_sfx(_move_sound(last as Dictionary))
	_plies = plies
	if _picked >= 0 and not _starts().has(_picked):
		_picked = -1
	if _promoting >= 0 and _moves.is_empty():
		_close_promotion()
	_show_seats()
	_show_status()
	_show_buttons()
	var ended: bool = view.get("end") != null
	if ended and not _ended:
		var end: Dictionary = view["end"]
		if str(end.get("reason", "")) != "checkmate":
			_sfx("win" if end.get("winner") != null else "draw")
	_ended = ended
	_move_count.text = "Nước %d" % (plies / 2 + 1)
	_marks.queue_redraw()


# ── Board ─────────────────────────────────────────────────────────────────────────────────


## A square's top-left corner on screen (turned round for Black).
func _square_at(sq: int) -> Vector2:
	var row: int = sq / SIZE
	var col: int = sq % SIZE
	if _flip:
		row = SIZE - 1 - row
		col = SIZE - 1 - col
	return _origin + Vector2(col, row) * _cell


func _center_of(sq: int) -> Vector2:
	return _square_at(sq) + Vector2.ONE * _cell / 2.0


## A piece's picture: every piece shares one canvas, its base a little below the square's middle.
func _piece_rect(sq: int) -> Rect2:
	var side: float = _cell * 0.9 / DISC
	return Rect2(_center_of(sq) - ANCHOR * side, Vector2(side, side))


func _texture_of(letter: String) -> Texture2D:
	var side: String = "white" if letter == letter.to_upper() else "black"
	return _art("piece-%s-%s" % [side, ART[letter.to_lower()]])


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/chess/art/%s.webp" % name_of)
	return _textures[name_of]


## The board's letters, "" for an empty square.
func _board_letters() -> Array[String]:
	var out: Array[String] = []
	for cell: Variant in _view.get("board", []):
		out.append("" if cell == null else str(cell))
	return out


func _clear_pieces() -> void:
	for piece: TextureRect in _pieces.values():
		piece.queue_free()
	_pieces.clear()
	_letters.clear()
	_picked = -1


## Makes the pieces on screen match the board, without animation.
func _sync_pieces() -> void:
	var board: Array[String] = _board_letters()
	for sq: int in _pieces.keys():
		if sq < board.size() and board[sq] == _letters[sq]:
			continue
		(_pieces[sq] as TextureRect).queue_free()
		_pieces.erase(sq)
		_letters.erase(sq)
	for sq: int in board.size():
		if board[sq] == "" or _pieces.has(sq):
			continue
		var piece := TextureRect.new()
		piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		piece.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_pieces_layer.add_child(piece)
		_pieces[sq] = piece
		_letters[sq] = board[sq]
	_place_pieces()


## Every piece on its square, the ones nearer the bottom of the screen drawn over the others.
func _place_pieces() -> void:
	var order: Array = _pieces.keys()
	order.sort_custom(func(a: int, b: int) -> bool: return _square_at(a).y < _square_at(b).y)
	for sq: int in order:
		var piece: TextureRect = _pieces[sq]
		var rect: Rect2 = _piece_rect(sq)
		piece.name = "Piece_%d" % sq
		piece.texture = _texture_of(_letters[sq])
		piece.position = rect.position
		piece.size = rect.size
		piece.modulate.a = 1.0
		piece.scale = Vector2.ONE
		piece.move_to_front()


## The last move on screen: the piece slides (the rook with it when castling), a taken piece flies
## to its taker's seat and fades. You may pick your next move meanwhile.
func _play_move(last: Dictionary, plies: int) -> void:
	var from: int = int(last["from"])
	var to: int = int(last["to"])
	var moving: TextureRect = _pieces[from]
	var letter: String = str(_letters[from])
	var taken_at: int = to
	if bool(last.get("enPassant", false)):
		taken_at = (from / SIZE) * SIZE + to % SIZE
	var victim: TextureRect = _pieces.get(taken_at) if taken_at != from else null
	_pieces.erase(taken_at)
	_letters.erase(taken_at)
	_pieces.erase(from)
	_letters.erase(from)
	var rook: Array = _castle_rook(from, to) if bool(last.get("castle", false)) else []
	var rook_piece: TextureRect = null
	if not rook.is_empty() and _pieces.has(rook[0]):
		rook_piece = _pieces[rook[0]]
		_pieces.erase(rook[0])
		_letters.erase(rook[0])
	_animating = true
	moving.move_to_front()
	var tween: Tween = moving.create_tween().set_parallel()
	tween.tween_property(moving, "position", _piece_rect(to).position, SLIDE_SECONDS).set_trans(
		Tween.TRANS_SINE
	)
	if rook_piece != null:
		(
			tween
			. tween_property(rook_piece, "position", _piece_rect(rook[1]).position, SLIDE_SECONDS)
			. set_trans(Tween.TRANS_SINE)
		)
	if victim != null:
		var seat: XomDaoPlayerSlot = _slots[0 if _side_at_bottom() == _side_of(letter) else 1]
		var away: Tween = victim.create_tween().set_parallel()
		var target: Vector2 = seat.position + seat.size / 2.0
		away.tween_interval(SLIDE_SECONDS * 0.6)
		away.chain().tween_property(victim, "position", target, SLIDE_SECONDS)
		away.tween_property(victim, "modulate:a", 0.0, SLIDE_SECONDS)
		away.tween_property(victim, "scale", Vector2.ONE * 0.4, SLIDE_SECONDS)
		away.chain().tween_callback(victim.queue_free)
	await tween.finished
	if not is_inside_tree():
		return
	_sfx(_move_sound(last))
	# The board may already be a move further on (the reply came in meanwhile); each piece keeps
	# its own letter and _sync_pieces below catches up with the board.
	_pieces[to] = moving
	var promotion: Variant = last.get("promotion")
	if promotion != null:
		var kind: String = str(promotion)
		_letters[to] = kind.to_upper() if letter == letter.to_upper() else kind
	else:
		_letters[to] = letter
	if rook_piece != null:
		_pieces[rook[1]] = rook_piece
		_letters[rook[1]] = "R" if letter == "K" else "r"
	_place_pieces()
	_animating = false
	if plies == int(_view.get("plies", 0)):
		_cut_in(last)
	# A reply that came in meanwhile plays next.
	var next: Variant = _view.get("last")
	if (
		int(_view.get("plies", 0)) == plies + 1
		and next is Dictionary
		and _letters.has(int((next as Dictionary)["from"]))
	):
		_play_move(next as Dictionary, plies + 1)
		return
	_sync_pieces()
	_marks.queue_redraw()


## The rook's squares when the king castles from `from` to `to`.
static func _castle_rook(from: int, to: int) -> Array:
	var row: int = from / SIZE
	if to > from:
		return [row * SIZE + 7, row * SIZE + 5]
	return [row * SIZE, row * SIZE + 3]


func _move_sound(last: Dictionary) -> String:
	var end: Variant = _view.get("end")
	if end is Dictionary and str((end as Dictionary).get("reason", "")) == "checkmate":
		return "mate"
	if bool(_view.get("check", false)):
		return "check"
	if last.get("promotion") != null:
		return "promote"
	if bool(last.get("castle", false)):
		return "castle"
	return "capture" if last.get("captured") != null else "move"


## CHIẾU TƯỚNG! (or CHIẾU HẾT!): a crimson ribbon with the checking piece pops up over the board
## and fades.
func _cut_in(last: Dictionary) -> void:
	if not _effects or not bool(_view.get("check", false)):
		return
	var end: Variant = _view.get("end")
	var mate: bool = end is Dictionary and str((end as Dictionary).get("reason", "")) == "checkmate"
	var ribbon := PanelContainer.new()
	ribbon.name = "CutIn"
	ribbon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.box(Color("#8E1B1B"), Color("#E9C46A"), 4, 18.0)
	style.content_margin_left = 28.0
	style.content_margin_right = 36.0
	style.content_margin_top = 10.0
	style.content_margin_bottom = 10.0
	ribbon.add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ribbon.add_child(row)
	var piece := TextureRect.new()
	var board: Array[String] = _board_letters()
	var to: int = int(last["to"])
	piece.texture = _texture_of(board[to] if board[to] != "" else "Q")
	piece.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	piece.custom_minimum_size = Vector2(72.0, 72.0)
	row.add_child(piece)
	var text := Label.new()
	text.text = "CHIẾU HẾT!" if mate else "CHIẾU TƯỚNG!"
	text.add_theme_font_override("font", XomDaoUi.display_font(900))
	text.add_theme_font_size_override("font_size", 44)
	text.add_theme_color_override("font_color", XomDaoUi.CREAM)
	text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(text)
	add_child(ribbon)
	ribbon.reset_size()
	ribbon.position = _board.position + (_board.size - ribbon.size) / 2.0
	ribbon.pivot_offset = ribbon.size / 2.0
	ribbon.scale = Vector2.ONE * 0.4
	ribbon.modulate.a = 0.0
	var tween: Tween = ribbon.create_tween()
	tween.set_parallel()
	tween.tween_property(ribbon, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_BACK)
	tween.tween_property(ribbon, "modulate:a", 1.0, 0.16)
	tween.chain().tween_interval(0.9)
	tween.chain().tween_property(ribbon, "modulate:a", 0.0, 0.3)
	tween.chain().tween_callback(ribbon.queue_free)


## The files and ranks on the edge squares; the last move's squares; a king in check; the picked
## piece and where it may go (a dot, or a ring round a piece it takes).
func _draw_marks() -> void:
	var font: Font = get_theme_default_font()
	var font_size: int = maxi(8, roundi(_cell * 0.2))
	var pad: float = _cell * 0.06
	for i: int in SIZE:
		var col: int = SIZE - 1 - i if _flip else i
		var file: String = "abcdefgh"[col]
		var at := _origin + Vector2((i + 1) * _cell - pad, SIZE * _cell - pad * 0.5)
		var width: float = font.get_string_size(file, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		var color: Color = LIGHT_TEXT if i % 2 == 1 else DARK_TEXT
		_marks.draw_string(font, at - Vector2(width, 0.0), file, 0, -1, font_size, color)
		var rank: String = str(i + 1) if _flip else str(SIZE - i)
		var rank_at := _origin + Vector2(pad, i * _cell + pad * 0.5 + font.get_ascent(font_size))
		color = DARK_TEXT if i % 2 == 1 else LIGHT_TEXT
		_marks.draw_string(font, rank_at, rank, 0, -1, font_size, color)
	var last: Variant = _view.get("last")
	if last is Dictionary:
		for key: String in ["from", "to"]:
			var sq: int = int((last as Dictionary)[key])
			_marks.draw_rect(Rect2(_square_at(sq), Vector2.ONE * _cell), Color(LAST, 0.35))
	if bool(_view.get("check", false)) and _view.get("end") == null or _mated():
		var king: int = _board_letters().find("K" if str(_view.get("turn", "")) == "w" else "k")
		if king >= 0:
			_marks.draw_rect(Rect2(_square_at(king), Vector2.ONE * _cell), Color(CHECK, 0.55))
	if _picked < 0:
		return
	_marks.draw_rect(Rect2(_square_at(_picked), Vector2.ONE * _cell), Color(PICKED, 0.5))
	var board: Array[String] = _board_letters()
	for to: int in _targets(_picked):
		if board[to] != "":
			_marks.draw_arc(
				_center_of(to), _cell * 0.44, 0.0, TAU, 40, Color(TARGET, 0.8), _cell * 0.07, true
			)
		else:
			_marks.draw_circle(_center_of(to), _cell * 0.16, Color(TARGET, 0.75), true, -1.0, true)


func _mated() -> bool:
	var end: Variant = _view.get("end")
	return end is Dictionary and str((end as Dictionary).get("reason", "")) == "checkmate"


## The squares of the pieces that may move now.
func _starts() -> Array[int]:
	var out: Array[int] = []
	for move: Dictionary in _moves:
		var from: int = int(move["from"])
		if not out.has(from):
			out.append(from)
	return out


## Where the piece on `from` may go.
func _targets(from: int) -> Array[int]:
	var out: Array[int] = []
	for move: Dictionary in _moves:
		var to: int = int(move["to"])
		if int(move["from"]) == from and not out.has(to):
			out.append(to)
	return out


## A tap on a square: pick a piece that may move, move the picked piece there (a pawn reaching
## the last rank asks what it becomes first), or drop the pick.
func _tap(sq: int) -> void:
	if _moves.is_empty():
		return
	if _promoting >= 0:
		_close_promotion()
	if _picked >= 0 and _targets(_picked).has(sq):
		var promotes: bool = _moves.any(
			func(m: Dictionary) -> bool:
				return (
					int(m["from"]) == _picked and int(m["to"]) == sq and m.get("promotion") != null
				)
		)
		if promotes:
			_open_promotion(sq)
			return
		var from: int = _picked
		_picked = -1
		_moves = []
		_marks.queue_redraw()
		await _client.send("move", {"from": from, "to": sq})
		return
	if _starts().has(sq) and sq != _picked:
		_sfx("select")
		_picked = sq
	else:
		_picked = -1
	_marks.queue_redraw()


func _open_promotion(to: int) -> void:
	_promoting = to
	var white: bool = _mine == "w"
	for kind: String in PROMOTIONS:
		var button: XomDaoButton = _promotion.find_child("Promote_" + kind, true, false)
		button.icon = _texture_of(kind.to_upper() if white else kind)
	_promotion.visible = true
	_promotion.reset_size()
	_promotion.position = _board.position + (_board.size - _promotion.size) / 2.0


func _close_promotion() -> void:
	_promoting = -1
	_promotion.visible = false


func _promote(kind: String) -> void:
	if _promoting < 0 or _picked < 0:
		_close_promotion()
		return
	var move: Dictionary = {"from": _picked, "to": _promoting, "promotion": kind}
	_close_promotion()
	_picked = -1
	_moves = []
	_marks.queue_redraw()
	await _client.send("move", move)


# ── Players, status and buttons ───────────────────────────────────────────────────────────


static func _other(side: String) -> String:
	return "w" if side == "b" else "b"


static func _side_of(letter: String) -> String:
	return "w" if letter == letter.to_upper() else "b"


func _side_at_bottom() -> String:
	return _other(FIRST) if _flip else FIRST


## How many pieces `side` has taken.
func _taken_by(side: String) -> int:
	var count: int = 0
	for piece: Variant in _view.get("captured", []):
		if _side_of(str(piece)) != side:
			count += 1
	return count


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


## Slot 0 is the side at the bottom (yours), slot 1 the other, with its king, wins and takes.
func _show_seats() -> void:
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
		slot.extra = "Thắng %d · Ăn %d" % [wins, _taken_by(side)]
		var on_turn: bool = playing and str(_view.get("turn", "")) == side
		if on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
		_icons[i].texture = _texture_of("K" if side == "w" else "k")
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
				"checkmate": "Chiếu hết!",
				"stalemate": "Hết nước đi",
				"resign": "%s đầu hàng" % loser,
				"left": "%s rời bàn" % loser,
				"repetition": "Lặp lại thế cờ ba lần",
				"move-limit": "50 nước không ăn quân, không đi tốt",
				"material": "Không đủ quân chiếu hết",
				"agreement": "Hai bên đồng ý",
			}
			. get(str((end as Dictionary).get("reason", "")), "")
		)
		if winner != null:
			_status.text = "%s thắng · %s" % [_name_of(str(winner)), how]
		else:
			_status.text = "Hoà · %s" % how
		return
	var check: String = " · Chiếu!" if bool(_view.get("check", false)) else ""
	var offer: Variant = _view.get("drawOffer")
	if offer != null and _mine != "" and str(offer) != _mine:
		_status.text = "%s xin hoà" % _name_of(str(offer))
	elif turn == _mine:
		_status.text = "Tới lượt bạn" + check
	else:
		_status.text = "Lượt %s · %s%s" % [SIDE_NAMES[turn], _name_of(turn), check]


func _show_buttons() -> void:
	var playing: bool = _mine != "" and _view.get("end") == null and _snapshot.status == "playing"
	var offer: Variant = _view.get("drawOffer")
	var offered: bool = playing and offer != null and str(offer) != _mine
	var vs_bot: bool = false
	for player: XomDaoPlayerInfo in _snapshot.seats:
		vs_bot = vs_bot or player.bot
	# The computer never takes a draw: no point offering one.
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
	config.set_value("chess", "effects", _effects)
	config.save(SETTINGS)
	_effects_button.text = "Hiệu ứng: %s" % ("Bật" if _effects else "Tắt")


static func _load_effects() -> bool:
	var config := ConfigFile.new()
	if config.load(SETTINGS) != OK:
		return true
	return bool(config.get_value("chess", "effects", true))


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
	if _promotion.visible:
		_promotion.reset_size()
		_promotion.position = board_at + (_board.size - _promotion.size) / 2.0
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


## Each side's king sits on its player's avatar like a badge, once the slots have laid out.
func _place_icons() -> void:
	for i: int in _slots.size():
		var avatar: Control = _slots[i].avatar
		var icon: TextureRect = _icons[i]
		icon.position = (avatar.global_position - global_position + avatar.size - icon.size * 0.62)
