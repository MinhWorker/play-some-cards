class_name XomDaoIconButton
extends Button
## A round HUD button with one icon: dark see-through disc, cream icon, 88 × 88.
##
##   var menu := XomDaoIconButton.create("list")   # a Phosphor Fill icon name
##   menu.dot = true                               # the red dot of something new

const SIZE := 88.0
const ICON := 48

## Shows the red dot on the button.
var dot: bool = false:
	set(value):
		dot = value
		if value:
			XomDaoDot.attach(self)
		elif has_node("Dot"):
			get_node("Dot").queue_free()

var icon_name: String = "":
	set(value):
		icon_name = value
		icon = XomDaoUi.icon(value) if value != "" else null


static func create(name_of_icon: String) -> XomDaoIconButton:
	var button := XomDaoIconButton.new()
	button.icon_name = name_of_icon
	return button


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	custom_minimum_size = Vector2(SIZE, SIZE)
	expand_icon = true
	icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vertical_icon_alignment = VERTICAL_ALIGNMENT_CENTER
	var pad: float = (SIZE - ICON) / 2.0
	var normal: StyleBoxFlat = XomDaoUi.box(XomDaoUi.HUD, Color.TRANSPARENT, 0, SIZE / 2.0)
	var hover: StyleBoxFlat = XomDaoUi.box(
		XomDaoUi.HUD.lightened(0.1), Color.TRANSPARENT, 0, SIZE / 2.0
	)
	var pressed: StyleBoxFlat = XomDaoUi.box(
		XomDaoUi.HUD.darkened(0.2), Color.TRANSPARENT, 0, SIZE / 2.0
	)
	for style: StyleBoxFlat in [normal, hover, pressed]:
		style.set_content_margin_all(pad)
	add_theme_stylebox_override("normal", normal)
	add_theme_stylebox_override("hover", hover)
	add_theme_stylebox_override("pressed", pressed)
	add_theme_stylebox_override("hover_pressed", pressed)
	add_theme_stylebox_override("disabled", normal)
	add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	for state: String in ["icon_normal_color", "icon_hover_color", "icon_pressed_color"]:
		add_theme_color_override(state, XomDaoUi.CREAM)
	add_theme_color_override("icon_disabled_color", Color(XomDaoUi.CREAM, 0.4))


func _ready() -> void:
	button_down.connect(_on_down)


func _on_down() -> void:
	XomDaoUi.bounce(self)
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
