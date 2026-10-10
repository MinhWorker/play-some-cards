class_name XomDaoButton
extends Button
## A text button coloured by what it does (XomDaoUi.Kind): dark background, cream label.
## PLAY is the one big lacquer button of the lobby; everything else is flat.
##
##   var play := XomDaoButton.create("CHƠI", XomDaoUi.Kind.PLAY)
##   var leave := XomDaoButton.create("Rời phòng", XomDaoUi.Kind.DANGER)
## It bounces and plays the tap sound when pressed.

const HEIGHT := 88.0
const PLAY_HEIGHT := 120.0

@export var kind: XomDaoUi.Kind = XomDaoUi.Kind.GO:
	set(value):
		kind = value
		_restyle()


static func create(label: String, button_kind: XomDaoUi.Kind = XomDaoUi.Kind.GO) -> XomDaoButton:
	var button := XomDaoButton.new()
	button.text = label
	button.kind = button_kind
	return button


func _init() -> void:
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_restyle()


func _ready() -> void:
	button_down.connect(_on_down)


func _on_down() -> void:
	XomDaoUi.bounce(self)
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)


func _restyle() -> void:
	var play: bool = kind == XomDaoUi.Kind.PLAY
	var colors: Array[Color] = XomDaoUi.kind_colors(kind)
	var border: int = 4 if play else XomDaoUi.BORDER
	var radius: float = 36.0 if play else 22.0
	var pad: float = 48.0 if play else 28.0
	var normal: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(colors[0], colors[1], border, radius)
	)
	if play:
		normal.shadow_color = Color(XomDaoUi.GOLD, 0.45)
		normal.shadow_size = 14
		normal.shadow_offset = Vector2(0.0, 4.0)
	var hover: StyleBoxFlat = normal.duplicate()
	hover.bg_color = colors[0].lightened(0.1)
	var pressed: StyleBoxFlat = normal.duplicate()
	pressed.bg_color = colors[0].darkened(0.08)
	pressed.shadow_size = 0
	var disabled: StyleBoxFlat = normal.duplicate()
	disabled.bg_color = _grey(colors[0])
	disabled.border_color = _grey(colors[1])
	disabled.shadow_size = 0
	for style: StyleBoxFlat in [normal, hover, pressed, disabled]:
		style.content_margin_left = pad
		style.content_margin_right = pad
		style.content_margin_top = 4.0
		style.content_margin_bottom = 8.0
	# Pressed: the label sinks 4 units with the button.
	pressed.content_margin_top = 8.0
	pressed.content_margin_bottom = 4.0
	pressed.expand_margin_top = -4.0
	pressed.expand_margin_bottom = 4.0
	add_theme_stylebox_override("normal", normal)
	add_theme_stylebox_override("hover", hover)
	add_theme_stylebox_override("pressed", pressed)
	add_theme_stylebox_override("hover_pressed", pressed)
	add_theme_stylebox_override("disabled", disabled)
	add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	add_theme_font_override("font", XomDaoUi.display_font(800))
	add_theme_font_size_override("font_size", 48 if play else 32)
	for state: String in ["font_color", "font_hover_color", "font_pressed_color"]:
		add_theme_color_override(state, XomDaoUi.CREAM)
	add_theme_color_override("font_disabled_color", Color(XomDaoUi.CREAM, 0.6))
	add_theme_constant_override("h_separation", 12)
	add_theme_constant_override("icon_max_width", 40)
	add_theme_color_override("icon_normal_color", XomDaoUi.CREAM)
	add_theme_color_override("icon_hover_color", XomDaoUi.CREAM)
	add_theme_color_override("icon_pressed_color", XomDaoUi.CREAM)
	custom_minimum_size.y = PLAY_HEIGHT if play else HEIGHT
	if play and size.x < 280.0:
		custom_minimum_size.x = 280.0


## Disabled look: 60% greyed and 60% opaque.
func _grey(color: Color) -> Color:
	var grey: float = color.get_luminance()
	return Color(color.lerp(Color(grey, grey, grey), 0.6), 0.6)
