class_name XomDaoResourceIcon
extends Control
## The icon of a currency, drawn flat: the copper coin with a square hole (xu) or the green gem
## (ngọc). Light from the top left, a border darker than the face.

enum Currency { COIN, GEM }

var currency: Currency = Currency.COIN:
	set(value):
		currency = value
		queue_redraw()


func _init() -> void:
	custom_minimum_size = Vector2(72.0, 72.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var r: float = minf(size.x, size.y) / 2.0
	var c: Vector2 = size / 2.0
	draw_circle(c + Vector2(r * 0.06, r * 0.1), r * 0.96, XomDaoUi.SHADOW, true, -1.0, true)
	if currency == Currency.COIN:
		_coin(c, r * 0.94)
	else:
		_gem(c, r * 0.94)


func _coin(c: Vector2, r: float) -> void:
	draw_circle(c, r, XomDaoUi.COIN_DARK, true, -1.0, true)
	draw_circle(c, r * 0.88, XomDaoUi.COIN, true, -1.0, true)
	draw_circle(c, r * 0.66, XomDaoUi.COIN_DARK, false, r * 0.06, true)
	draw_arc(c, r * 0.76, PI * 1.05, PI * 1.55, 16, Color(XomDaoUi.CREAM, 0.7), r * 0.08, true)
	var hole: float = r * 0.24
	draw_rect(Rect2(c - Vector2(hole, hole), Vector2(hole, hole) * 2.0), XomDaoUi.COIN_DARK)


func _gem(c: Vector2, r: float) -> void:
	var outer := PackedVector2Array()
	for i: int in 6:
		var angle: float = PI / 6.0 + i * PI / 3.0
		outer.append(c + Vector2(cos(angle), sin(angle)) * r)
	draw_colored_polygon(outer, XomDaoUi.GEM_DARK)
	var inner := PackedVector2Array()
	for point: Vector2 in outer:
		inner.append(c + (point - c) * 0.8)
	draw_colored_polygon(inner, XomDaoUi.GEM)
	var table := PackedVector2Array()
	for point: Vector2 in inner:
		table.append(c + (point - c) * 0.45 + Vector2(-r * 0.08, -r * 0.08))
	draw_colored_polygon(table, XomDaoUi.GEM.lightened(0.3))
	draw_line(inner[3], inner[4], Color(XomDaoUi.CREAM, 0.8), r * 0.08, true)
