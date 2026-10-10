class_name XomDaoMat
extends Control
## The sedge mat the card games are played on: woven straw tiled over the whole table, a red band
## and a thin green one round the play area, a flower in each corner and a soft light in the
## middle. Fills its parent; the table puts it first.

## How wide one tile of mat.webp (512 px) lies on the table, in units.
const TILE := 220.0
const RED := Color("#B0261E")
const GREEN := Color("#26683A")
const STRAW := Color("#C9A86A")

var _weave := TextureRect.new()
var _pattern := Control.new()


func _init() -> void:
	name = "Mat"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_weave.texture = preload("res://addons/xomdao_sdk/ui/cards/mat.webp")
	_weave.stretch_mode = TextureRect.STRETCH_TILE
	_weave.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	_weave.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_weave.scale = Vector2.ONE * TILE / 512.0
	add_child(_weave)
	# The bands and flowers lie on the weave.
	_pattern.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_pattern.draw.connect(_draw_pattern.bind(_pattern))
	add_child(_pattern)
	resized.connect(_on_resized)


func _on_resized() -> void:
	_weave.size = size / _weave.scale
	_pattern.size = size
	_pattern.queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), STRAW)


func _draw_pattern(pattern: Control) -> void:
	var edge: float = float(XomDaoSettings.current().margin) + 8.0
	var frame := Rect2(Vector2(edge, edge), pattern.size - Vector2(edge, edge) * 2.0)
	pattern.draw_rect(frame, Color(RED, 0.55), false, 10.0)
	pattern.draw_rect(frame.grow(-17.0), Color(GREEN, 0.5), false, 4.0)
	for corner: Vector2 in [
		frame.position + Vector2(48, 48),
		Vector2(frame.end.x - 48, frame.position.y + 48),
		Vector2(frame.position.x + 48, frame.end.y - 48),
		frame.end - Vector2(48, 48),
	]:
		var points := PackedVector2Array(
			[
				corner + Vector2(0, -22),
				corner + Vector2(22, 0),
				corner + Vector2(0, 22),
				corner + Vector2(-22, 0)
			]
		)
		pattern.draw_colored_polygon(points, Color(GREEN, 0.3))
		points.append(points[0])
		pattern.draw_polyline(points, Color(RED, 0.55), 3.0, true)
	var light := Color(1.0, 0.95, 0.8, 0.12)
	pattern.draw_circle(pattern.size / 2.0, minf(pattern.size.x, pattern.size.y) * 0.32, light)
