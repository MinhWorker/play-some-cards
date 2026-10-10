class_name XomDaoDivider
extends Control
## A light divider with a pattern: a thin wave of water, never a straight grey rule.
## Paper colour by default; on wood use XomDaoDivider.create(Color(XomDaoUi.CREAM, 0.2)).

var color: Color = XomDaoUi.PAPER_DARK:
	set(value):
		color = value
		queue_redraw()


static func create(line_color: Color = XomDaoUi.PAPER_DARK) -> XomDaoDivider:
	var divider := XomDaoDivider.new()
	divider.color = line_color
	return divider


func _init() -> void:
	custom_minimum_size = Vector2(0.0, 16.0)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var points := PackedVector2Array()
	var mid: float = size.y / 2.0
	var steps: int = maxi(2, int(size.x / 6.0))
	for i: int in steps + 1:
		var x: float = size.x * i / steps
		points.append(Vector2(x, mid + sin(x / 14.0) * 4.0))
	draw_polyline(points, color, 3.0, true)
