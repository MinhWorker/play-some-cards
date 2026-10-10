class_name XomDaoToast
extends PanelContainer
## A quick notice: a strip of paper with a torn edge that slides down from the top middle,
## stays a moment and goes. Status text only ("Đã sao chép mã phòng", "Sắp có").
##
##   XomDaoToast.show_on(self, "Đã sao chép mã phòng")

const HEIGHT := 72.0
const STAY := 1.8

var text: String = "":
	set(value):
		text = value
		_label.text = value

var _label := Label.new()
var _icon := TextureRect.new()


## Shows a notice over `host`'s screen (on its own top layer) and frees it afterwards.
static func show_on(
	host: Node, message: String, name_of_icon: String = "check-circle"
) -> XomDaoToast:
	var layer := CanvasLayer.new()
	layer.layer = 100
	host.add_child(layer)
	var toast := XomDaoToast.create(message, name_of_icon)
	toast.name = "Toast"
	var holder := Control.new()
	holder.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(holder)
	holder.add_child(toast)
	toast.slide(layer)
	return toast


static func create(message: String, name_of_icon: String = "check-circle") -> XomDaoToast:
	var toast := XomDaoToast.new()
	toast.text = message
	toast._icon.texture = XomDaoUi.icon(name_of_icon) if name_of_icon != "" else null
	toast._icon.visible = name_of_icon != ""
	return toast


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size.y = HEIGHT
	var style: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, 2, 8.0)
	)
	style.content_margin_left = 24.0
	style.content_margin_right = 32.0
	style.content_margin_bottom = 6.0
	add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(row)
	_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_icon.custom_minimum_size = Vector2(40.0, 40.0)
	_icon.modulate = XomDaoUi.BAMBOO_DARK
	row.add_child(_icon)
	_label.add_theme_font_override("font", XomDaoUi.body_font(true))
	_label.add_theme_font_size_override("font_size", 28)
	_label.add_theme_color_override("font_color", XomDaoUi.INK)
	row.add_child(_label)


## Slides in from above the top edge, waits, slides out, then frees `owner_node`.
func slide(owner_node: Node) -> void:
	await get_tree().process_frame
	var width: float = get_combined_minimum_size().x
	var parent_width: float = get_parent_control().size.x
	size = Vector2(width, HEIGHT)
	position = Vector2((parent_width - width) / 2.0, -HEIGHT - 12.0)
	var tween: Tween = create_tween()
	tween.tween_property(self, "position:y", 24.0, 0.25).set_trans(Tween.TRANS_BACK)
	tween.tween_interval(STAY)
	tween.tween_property(self, "position:y", -HEIGHT - 12.0, 0.2)
	tween.tween_callback(owner_node.queue_free)


func _draw() -> void:
	# The torn bottom edge: small paper teeth hanging below the strip.
	var teeth := PackedVector2Array()
	var step: float = 14.0
	var x: float = 6.0
	var up: bool = true
	teeth.append(Vector2(4.0, size.y - 14.0))
	while x < size.x - 4.0:
		teeth.append(Vector2(x, size.y - (6.0 if up else -4.0)))
		up = not up
		x += step
	teeth.append(Vector2(size.x - 4.0, size.y - 14.0))
	draw_colored_polygon(teeth, XomDaoUi.PAPER)
