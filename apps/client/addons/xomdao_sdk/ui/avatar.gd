class_name XomDaoAvatar
extends Control
## A round picture in a bamboo ring, used everywhere a player shows (lobby profile, table,
## rankings, waiting room). Without a picture it shows the first letter of the name.
## `turn` (0..1) draws the brass turn timer around the ring; -1 hides it.

## How much of the picture's width its round face takes: the app's avatars are a disc of radius
## 100 on a 256 × 256 canvas.
var picture_fill: float = 200.0 / 256.0

var picture: Texture2D:
	set(value):
		picture = value
		queue_redraw()

var initial: String = "":
	set(value):
		initial = value.left(1).to_upper()
		queue_redraw()

## The share of the turn left, drawn as a brass arc; -1 when it is not this player's turn.
var turn: float = -1.0:
	set(value):
		turn = value
		queue_redraw()

## The 👑 of the room's host.
var crown: bool = false:
	set(value):
		crown = value
		queue_redraw()


func _init() -> void:
	custom_minimum_size = Vector2(96.0, 96.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var r: float = minf(size.x, size.y) / 2.0
	var c: Vector2 = size / 2.0
	var ring: float = maxf(4.0, r * 0.13)
	draw_circle(c + Vector2(3.0, 4.0), r, XomDaoUi.SHADOW, true, -1.0, true)
	draw_circle(c, r, XomDaoUi.BAMBOO_DARK, true, -1.0, true)
	draw_circle(c, r - ring * 0.35, XomDaoUi.BAMBOO, true, -1.0, true)
	var inner: float = r - ring
	if picture != null:
		_draw_picture(c, inner)
	else:
		draw_circle(c, inner, XomDaoUi.SEA_DEEP, true, -1.0, true)
		var font: Font = XomDaoUi.display_font(800)
		var font_size: int = int(inner * 1.1)
		var text_size: Vector2 = font.get_string_size(
			initial, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size
		)
		var base := Vector2(c.x - text_size.x / 2.0, c.y + font.get_ascent(font_size) * 0.38)
		draw_string(font, base, initial, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, XomDaoUi.CREAM)
	# Bamboo joints: short dark marks around the ring.
	for i: int in 8:
		var angle: float = i * TAU / 8.0 + PI / 8.0
		var dir := Vector2(cos(angle), sin(angle))
		draw_line(c + dir * (r - ring), c + dir * r, XomDaoUi.BAMBOO_DARK, 2.0, true)
	if turn >= 0.0:
		var width: float = maxf(5.0, r * 0.12)
		var ring_radius: float = r + width * 0.9
		draw_circle(c, ring_radius, Color(XomDaoUi.HUD, 0.5), false, width, true)
		if turn >= 1.0:
			draw_circle(c, ring_radius, XomDaoUi.GOLD, false, width, true)
		elif turn > 0.0:
			var end: float = -PI / 2.0 + TAU * turn
			draw_arc(c, ring_radius, -PI / 2.0, end, 48, XomDaoUi.GOLD, width, true)
	if crown:
		_draw_crown(c + Vector2(-r * 0.62, -r * 0.82), r * 0.42)


func _draw_picture(c: Vector2, r: float) -> void:
	var points := PackedVector2Array()
	var uvs := PackedVector2Array()
	for i: int in 48:
		var dir := Vector2(cos(i * TAU / 48.0), sin(i * TAU / 48.0))
		points.append(c + dir * r)
		uvs.append(Vector2(0.5, 0.5) + dir * 0.5 * picture_fill)
	draw_colored_polygon(points, Color.WHITE, uvs, picture)


func _draw_crown(at: Vector2, w: float) -> void:
	var h: float = w * 0.8
	var shape := PackedVector2Array(
		[
			at + Vector2(-w / 2.0, h / 2.0),
			at + Vector2(-w / 2.0, -h / 4.0),
			at + Vector2(-w / 4.0, h / 8.0),
			at + Vector2(0.0, -h / 2.0),
			at + Vector2(w / 4.0, h / 8.0),
			at + Vector2(w / 2.0, -h / 4.0),
			at + Vector2(w / 2.0, h / 2.0),
		]
	)
	var outline := shape.duplicate()
	outline.append(shape[0])
	draw_colored_polygon(shape, XomDaoUi.GOLD)
	draw_polyline(outline, XomDaoUi.GOLD_DARK, maxf(2.0, w * 0.08), true)
