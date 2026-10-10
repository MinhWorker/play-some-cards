class_name XomDaoFrame
extends RefCounted
## The landscape frame every screen is designed on (docs/ui-guide.md): 720 units tall, with a
## 960 × 720 core that is always on screen. Wider screens only add room at the sides.

const HEIGHT := 720.0
const CORE := Vector2(960.0, 720.0)


## The core's rectangle inside a viewport of the given size, centred.
static func core_rect(viewport_size: Vector2) -> Rect2:
	return Rect2((viewport_size - CORE) / 2.0, CORE)


## The notch and rounded corners on the top left, in frame units: what HUD corners stay clear of.
static func safe_inset(node: CanvasItem) -> Vector2:
	if not node.is_inside_tree():
		return Vector2.ZERO
	var window := Vector2(DisplayServer.window_get_size())
	if window.x <= 0.0 or window.y <= 0.0:
		return Vector2.ZERO
	var units: Vector2 = node.get_viewport_rect().size / window
	var safe: Rect2i = DisplayServer.get_display_safe_area()
	var origin := Vector2(DisplayServer.window_get_position())
	var inset: Vector2 = (Vector2(safe.position) - origin).max(Vector2.ZERO)
	return inset * units
