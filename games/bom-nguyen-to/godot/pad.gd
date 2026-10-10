extends Control
## The wooden D-pad at the bottom left: a round plate with four cream keys. The table reads where
## a finger is (`direction_at`) and shows the key held down (`held`).

const ART := "res://content/bom-nguyen-to/art/"
const KEYS: Dictionary = {
	"up": Vector2(0, -1), "left": Vector2(-1, 0), "down": Vector2(0, 1), "right": Vector2(1, 0)
}

var held: String = "none":
	set(value):
		if held != value:
			held = value
			queue_redraw()

var _plate: Texture2D = load(ART + "dpad.webp")
var _key: Texture2D = load(ART + "dpad-key.webp")


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


## The direction a finger at `at` (in this control) points, "none" in the middle, "" outside.
func direction_at(at: Vector2) -> String:
	var radius: float = size.x / 2.0
	var d: Vector2 = at - size / 2.0
	if d.length() > radius * 1.5:
		return ""
	if d.length() < radius * 0.12:
		return "none"
	if absf(d.x) > absf(d.y):
		return "right" if d.x > 0.0 else "left"
	return "down" if d.y > 0.0 else "up"


## Whether `at` (in this control) is on the plate.
func covers(at: Vector2) -> bool:
	return at.distance_to(size / 2.0) <= size.x / 2.0


func _draw() -> void:
	var d: float = size.x
	var centre: Vector2 = size / 2.0
	draw_texture_rect(
		_plate, Rect2(Vector2.ZERO, Vector2(d, d * _plate.get_height() / _plate.get_width())), false
	)
	var key: float = d * 0.3
	for dir: String in KEYS:
		var down: bool = held == dir
		var k: float = key * (0.94 if down else 1.0)
		var at: Vector2 = centre + KEYS[dir] * d * 0.27
		var tint := Color(1, 1, 1, 0.85 if down else 1.0)
		draw_texture_rect(_key, Rect2(at - Vector2(k, k) / 2.0, Vector2(k, k)), false, tint)
		var along: Vector2 = KEYS[dir]
		var side := Vector2(-along.y, along.x)
		var r: float = k * 0.22
		var arrow := PackedVector2Array(
			[at + along * r, at - along * r * 0.7 + side * r, at - along * r * 0.7 - side * r]
		)
		draw_colored_polygon(arrow, Color("#9c6236"))
