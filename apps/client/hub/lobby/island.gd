class_name HubIsland
extends Control
## One genre island on the lobby's ring: its art (`hub/genres/<island>.webp`) or, until that is
## drawn, a toy island with the genre's sign on it (a board for Cờ, fanned cards for Bài). The
## selected island has a gold halo on the water and its name on a wooden sign; a locked one
## (Sắp có, or a genre with no ready game) sits in fog with a lock.
##
## The ring sizes and places it (HubIslandRing); the island only draws.

## Size at scale 1: the island and the band above it where the selected one's sign hangs.
const BASE := Vector2(240.0, 200.0)
const SIGN_BAND := 52.0
const SOON := "sap-co"

var genre_id: String = ""
var title: String = "":
	set(value):
		title = value
		_sign.text = value

var locked: bool = false:
	set(value):
		locked = value
		queue_redraw()

var selected: bool = false:
	set(value):
		selected = value
		_sign.visible = value
		_place_sign()

## How near the front it is: 1 at the front, 0 at the back (paler and smaller).
var depth: float = 1.0:
	set(value):
		depth = value
		modulate = Color(1, 1, 1).lerp(Color(0.78, 0.9, 0.95), 1.0 - value)

var art: Texture2D

var _sign := Label.new()
var _lock: Texture2D = XomDaoUi.icon("lock-simple")


## The island for a ring entry ({id, name, island, locked}).
static func create(entry: Dictionary) -> HubIsland:
	var island := HubIsland.new()
	island.genre_id = str(entry.get("id", ""))
	island.name = "Island_" + island.genre_id
	island.title = str(entry.get("name", ""))
	island.locked = bool(entry.get("locked", false))
	var path: String = "res://hub/genres/%s.webp" % str(entry.get("island", ""))
	if ResourceLoader.exists(path):
		island.art = load(path)
	return island


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	size = BASE
	_sign.visible = false
	_sign.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_sign.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_sign.add_theme_font_override("font", XomDaoUi.display_font(800))
	_sign.add_theme_font_size_override("font_size", 34)
	_sign.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_sign.add_theme_color_override("font_outline_color", XomDaoUi.HONEY_DARK)
	_sign.add_theme_constant_override("outline_size", 8)
	var plank: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.HONEY, XomDaoUi.HONEY_DARK, XomDaoUi.BORDER, 14.0)
	)
	plank.content_margin_left = 22.0
	plank.content_margin_right = 22.0
	_sign.add_theme_stylebox_override("normal", plank)
	add_child(_sign)
	resized.connect(_place_sign)


## Where the island itself is inside the control (below the sign band).
func body_rect() -> Rect2:
	var k: float = size.x / BASE.x
	return Rect2(0.0, SIGN_BAND * k, size.x, size.y - SIGN_BAND * k)


func _place_sign() -> void:
	var k: float = size.x / BASE.x
	_sign.scale = Vector2.ONE * k
	_sign.size = _sign.get_combined_minimum_size()
	_sign.position = Vector2((size.x - _sign.size.x * k) / 2.0, 0.0)
	queue_redraw()


func _ready() -> void:
	_place_sign.call_deferred()


func _draw() -> void:
	var body: Rect2 = body_rect()
	var k: float = size.x / BASE.x
	var c := Vector2(body.get_center().x, body.position.y + body.size.y * 0.62)
	var rx: float = body.size.x * 0.46
	var ry: float = body.size.y * 0.3
	if selected:
		_ellipse(c + Vector2(0, ry * 0.25), rx * 1.12, ry * 1.25, Color(XomDaoUi.GOLD, 0.35), 0.0)
		_ellipse(c + Vector2(0, ry * 0.25), rx * 1.12, ry * 1.25, XomDaoUi.GOLD, 4.0 * k)
	# Foam on the water, the rocky foot, then the sand and the grass on top.
	_ellipse(c + Vector2(0, ry * 0.18), rx * 1.04, ry * 1.06, Color(1, 1, 1, 0.55), 0.0)
	_ellipse(c + Vector2(0, ry * 0.12), rx, ry, Color("#8C7B6B"), 0.0)
	_ellipse(c, rx * 0.97, ry * 0.92, XomDaoUi.SAND, 0.0)
	_ellipse(c - Vector2(0, ry * 0.18), rx * 0.72, ry * 0.62, XomDaoUi.BAMBOO, 0.0)
	_ellipse(
		c - Vector2(rx * 0.1, ry * 0.28), rx * 0.48, ry * 0.38, XomDaoUi.BAMBOO.lightened(0.15), 0.0
	)
	if art != null:
		var w: float = body.size.x
		var h: float = w * art.get_height() / art.get_width()
		draw_texture_rect(art, Rect2(body.position.x, body.end.y - h, w, h), false)
	elif locked:
		_draw_fog(c, rx, ry, k)
	else:
		_draw_palm(c + Vector2(rx * 0.62, -ry * 0.2), k)
		_draw_mark(c - Vector2(0, ry * 0.35), k)


## The genre's sign on its island until it has art: a little board, or fanned cards.
func _draw_mark(at: Vector2, k: float) -> void:
	match genre_id:
		"co":
			var side: float = 70.0 * k
			var board := Rect2(at - Vector2(side, side * 0.6) / 2.0, Vector2(side, side * 0.6))
			draw_rect(board, XomDaoUi.PAPER_DARK)
			for i: int in range(1, 5):
				var x: float = board.position.x + board.size.x * i / 5.0
				draw_line(
					Vector2(x, board.position.y),
					Vector2(x, board.end.y),
					XomDaoUi.HONEY_DARK,
					1.5 * k
				)
			for i: int in range(1, 3):
				var y: float = board.position.y + board.size.y * i / 3.0
				draw_line(
					Vector2(board.position.x, y),
					Vector2(board.end.x, y),
					XomDaoUi.HONEY_DARK,
					1.5 * k
				)
			_piece(
				board.position + Vector2(board.size.x * 0.3, board.size.y * 0.35),
				12.0 * k,
				XomDaoUi.LACQUER
			)
			_piece(
				board.position + Vector2(board.size.x * 0.7, board.size.y * 0.7),
				12.0 * k,
				XomDaoUi.INK
			)
		"bai":
			for i: int in 3:
				var angle: float = (i - 1) * 0.3
				var card := Rect2(Vector2(-16, -46) * k, Vector2(32, 46) * k)
				draw_set_transform(at + Vector2((i - 1) * 16.0 * k, 4.0 * k), angle)
				draw_rect(card, XomDaoUi.CREAM)
				draw_rect(card, XomDaoUi.INK, false, 1.5 * k)
				var pip: Color = XomDaoUi.LACQUER if i != 1 else XomDaoUi.INK
				draw_circle(card.get_center(), 6.0 * k, pip)
			draw_set_transform(Vector2.ZERO)
		_:
			var font: Font = XomDaoUi.display_font(800)
			var letter: String = title.left(1)
			var font_size: int = int(48 * k)
			var w: float = font.get_string_size(letter, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
			draw_string(
				font,
				at + Vector2(-w / 2.0, font_size * 0.35),
				letter,
				HORIZONTAL_ALIGNMENT_LEFT,
				-1,
				font_size,
				XomDaoUi.INK
			)


func _piece(at: Vector2, r: float, color: Color) -> void:
	draw_circle(at + Vector2(1, 2), r, XomDaoUi.SHADOW)
	draw_circle(at, r, XomDaoUi.CREAM)
	draw_circle(at, r * 0.75, color, false, 2.0)


func _draw_palm(at: Vector2, k: float) -> void:
	var top: Vector2 = at + Vector2(-6, -58) * k
	draw_line(at, top, XomDaoUi.HONEY_DARK, 6.0 * k, true)
	for i: int in 5:
		var angle: float = PI + i * PI / 4.0
		var tip: Vector2 = top + Vector2(cos(angle), sin(angle) * 0.6 + 0.35) * 34.0 * k
		draw_line(top, tip, XomDaoUi.BAMBOO_DARK, 7.0 * k, true)


func _draw_fog(c: Vector2, rx: float, ry: float, k: float) -> void:
	for i: int in 5:
		var at: Vector2 = c + Vector2((i - 2) * rx * 0.36, -ry * (0.4 + 0.25 * (i % 2)))
		draw_circle(at, rx * 0.34, Color(1, 1, 1, 0.75), true, -1.0, true)
	var side: float = 56.0 * k
	draw_texture_rect(
		_lock, Rect2(c - Vector2(side / 2.0, side * 0.95), Vector2(side, side)), false, XomDaoUi.HUD
	)


func _ellipse(c: Vector2, rx: float, ry: float, color: Color, width: float) -> void:
	var points := PackedVector2Array()
	for i: int in 49:
		var a: float = i * TAU / 48.0
		points.append(c + Vector2(cos(a) * rx, sin(a) * ry))
	if width > 0.0:
		draw_polyline(points, color, width, true)
	else:
		draw_colored_polygon(points, color)
