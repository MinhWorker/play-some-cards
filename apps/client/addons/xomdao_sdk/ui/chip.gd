class_name XomDaoChip
extends PanelContainer
## A small label on its own darker pill: a level, a card count, "4 người", "10 phút".
## Parts of a card are separate chips, never joined with "·" or "|".
##
##   XomDaoChip.create("10 phút", "clock")
##   XomDaoChip.create("12", "", XomDaoUi.LACQUER)

const HEIGHT := 48.0

var text: String = "":
	set(value):
		text = value
		_label.text = value

var color: Color = XomDaoUi.HUD:
	set(value):
		color = value
		_restyle()

var _label := Label.new()
var _icon := TextureRect.new()


static func create(
	label: String, name_of_icon: String = "", background: Color = XomDaoUi.HUD
) -> XomDaoChip:
	var chip := XomDaoChip.new()
	chip.text = label
	chip.color = background
	if name_of_icon != "":
		chip.set_icon(XomDaoUi.icon(name_of_icon))
	return chip


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size.y = HEIGHT
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(row)
	_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_icon.custom_minimum_size = Vector2(28.0, 28.0)
	_icon.modulate = XomDaoUi.CREAM
	_icon.visible = false
	row.add_child(_icon)
	_label.add_theme_font_override("font", XomDaoUi.display_font(700))
	_label.add_theme_font_size_override("font_size", 26)
	_label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(_label)
	_restyle()


## A smaller chip for crowded rows (a card's foot): 40 tall, text 24.
func compact() -> void:
	custom_minimum_size.y = 40.0
	_label.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_icon.custom_minimum_size = Vector2(24.0, 24.0)
	var style: StyleBoxFlat = get_theme_stylebox("panel")
	style.content_margin_left = 10.0
	style.content_margin_right = 12.0


func set_icon(texture: Texture2D) -> void:
	_icon.texture = texture
	_icon.visible = texture != null


func _restyle() -> void:
	var style: StyleBoxFlat = XomDaoUi.box(color, color.darkened(0.3), 2, HEIGHT / 2.0)
	style.content_margin_left = 18.0
	style.content_margin_right = 18.0
	style.content_margin_top = 2.0
	style.content_margin_bottom = 4.0
	add_theme_stylebox_override("panel", style)
