class_name XomDaoDot
extends Control
## The red "something new" dot: lantern red with a cream ring, 24 units. Put it on any control
## with XomDaoDot.attach(control); it sits on the control's top right corner.

const SIZE := 24.0


## Adds a dot to the top right corner of `control` (or returns the one already there).
static func attach(control: Control) -> XomDaoDot:
	var dot: XomDaoDot = control.get_node_or_null("Dot")
	if dot == null:
		dot = XomDaoDot.new()
		dot.name = "Dot"
		control.add_child(dot)
	dot.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	dot.offset_left = -SIZE * 0.85
	dot.offset_top = -SIZE * 0.15
	dot.offset_right = SIZE * 0.15
	dot.offset_bottom = SIZE * 0.85
	return dot


func _init() -> void:
	custom_minimum_size = Vector2(SIZE, SIZE)
	size = Vector2(SIZE, SIZE)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var center: Vector2 = size / 2.0
	draw_circle(center, SIZE / 2.0, XomDaoUi.CREAM, true, -1.0, true)
	draw_circle(center, SIZE / 2.0 - XomDaoUi.BORDER, XomDaoUi.LANTERN, true, -1.0, true)
