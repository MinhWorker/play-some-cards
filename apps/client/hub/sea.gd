class_name HubSea
extends Control
## The hub's backdrop: the sea from above, deeper towards the bottom, with a few wave marks and
## far-off islets on the horizon. Fills its parent and takes no input.


func _init() -> void:
	name = "Sea"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func _draw() -> void:
	var w: float = size.x
	var h: float = size.y
	var horizon: float = h * 0.12
	draw_rect(Rect2(0, 0, w, horizon), XomDaoUi.SKY)
	var bands: int = 12
	for i: int in bands:
		var t: float = float(i) / bands
		var color: Color = XomDaoUi.SEA.lerp(XomDaoUi.SEA_DEEP, t)
		var y: float = horizon + (h - horizon) * t
		draw_rect(Rect2(0, y, w, (h - horizon) / bands + 1.0), color)
	# Islets on the horizon.
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var x: float = -40.0
	while x < w:
		var width: float = rng.randf_range(60.0, 140.0)
		var height: float = rng.randf_range(18.0, 46.0)
		var hill := PackedVector2Array(
			[
				Vector2(x, horizon),
				Vector2(x + width * 0.3, horizon - height),
				Vector2(x + width * 0.6, horizon - height * 0.8),
				Vector2(x + width, horizon),
			]
		)
		draw_colored_polygon(hill, XomDaoUi.BAMBOO_DARK.lerp(XomDaoUi.SKY, 0.45))
		x += width + rng.randf_range(80.0, 260.0)
	# Wave marks.
	for i: int in int(w * h / 26000.0):
		var at := Vector2(rng.randf_range(0.0, w), rng.randf_range(horizon + 20.0, h))
		var wide: float = rng.randf_range(16.0, 34.0)
		draw_arc(at, wide, PI * 1.15, PI * 1.85, 8, Color(1, 1, 1, 0.22), 3.0, true)
