class_name XomDaoDelta
extends PanelContainer
## A change of a resource on a paper tag: "+120" in green with an up arrow, "−20" in red with a
## down arrow. Shown on the result board and when coins fly in.

var amount: int = 0:
	set(value):
		amount = value
		_label.text = XomDaoUi.delta(value)
		_label.add_theme_color_override("font_color", XomDaoUi.delta_color(value, true))
		_arrow.queue_redraw()

var _label := Label.new()
var _arrow := Control.new()


static func create(value: int) -> XomDaoDelta:
	var tag := XomDaoDelta.new()
	tag.amount = value
	return tag


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, XomDaoUi.BORDER, 16.0)
	)
	style.content_margin_left = 20.0
	style.content_margin_right = 24.0
	style.content_margin_top = 6.0
	style.content_margin_bottom = 6.0
	add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	add_child(row)
	_arrow.custom_minimum_size = Vector2(32.0, 40.0)
	_arrow.draw.connect(_draw_arrow)
	row.add_child(_arrow)
	_label.add_theme_font_override("font", XomDaoUi.display_font(800))
	_label.add_theme_font_size_override("font_size", 44)
	row.add_child(_label)


func _draw_arrow() -> void:
	if amount == 0:
		return
	var s: Vector2 = _arrow.size
	var color: Color = XomDaoUi.delta_color(amount)
	var up: bool = amount > 0
	var tip: float = 4.0 if up else s.y - 4.0
	var base: float = s.y * 0.5
	var head := PackedVector2Array(
		[Vector2(s.x / 2.0, tip), Vector2(s.x, base), Vector2(0.0, base)]
	)
	_arrow.draw_colored_polygon(head, color)
	var stem_top: float = base if up else 4.0
	var stem_bottom: float = s.y - 4.0 if up else base
	_arrow.draw_rect(Rect2(s.x * 0.3, stem_top, s.x * 0.4, stem_bottom - stem_top), color)
