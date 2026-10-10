class_name XomDaoFrame
extends RefCounted
## The landscape frame every screen is designed on (docs/ui-guide.md): 720 units tall, with a
## 960 × 720 core that is always on screen. Wider screens only add room at the sides.

const HEIGHT := 720.0
const CORE := Vector2(960.0, 720.0)


## The core's rectangle inside a viewport of the given size, centred.
static func core_rect(viewport_size: Vector2) -> Rect2:
	return Rect2((viewport_size - CORE) / 2.0, CORE)
