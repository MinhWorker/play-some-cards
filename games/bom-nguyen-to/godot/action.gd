extends Control
## A round action button of the arena (Bom, Kỹ năng, Lướt): a painted button with its icon and
## name, a shade that sweeps back while it recharges and seconds left instead of the name. The
## table presses it (`press`), since a finger on the D-pad must not stop another from tapping.

signal pressed

const ART := "res://content/bom-nguyen-to/art/"

var label: String = ""
var enabled: bool = false:
	set(value):
		if enabled != value:
			enabled = value
			queue_redraw()
## How much is left to recharge, 0–1, and the seconds shown instead of the name.
var cooldown: float = 0.0
var seconds: int = 0
## A gold ring while a skill's boost lasts.
var glowing: bool = false

var _face: Texture2D
var _icon: Texture2D
var _down: bool = false
var _text := Label.new()


static func create(id: String, text: String, face: String, icon: String) -> Control:
	var button: Control = load("res://content/bom-nguyen-to/action.gd").new()
	button.name = id
	button.set("label", text)
	button.set("_face", load(ART + face + ".webp"))
	button.set("_icon", load(ART + icon + ".webp"))
	return button


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_text.add_theme_font_override("font", XomDaoUi.display_font(800))
	_text.add_theme_color_override("font_color", Color.WHITE)
	_text.add_theme_color_override("font_outline_color", Color("#5b3a2e"))
	_text.add_theme_constant_override("outline_size", 6)
	add_child(_text)
	resized.connect(_layout)


## Shows the cooldown and the text; redraws only when something changed.
func show_state(left: float, total: float, glow: bool) -> void:
	var fraction: float = clampf(left / total, 0.0, 1.0) if total > 0.0 else 0.0
	var secs: int = ceili(left / 1000.0) if left > 500.0 else 0
	if absf(fraction - cooldown) > 0.01 or secs != seconds or glow != glowing:
		cooldown = fraction
		seconds = secs
		glowing = glow
		_text.text = "%ds" % secs if secs > 0 else label
		queue_redraw()
	elif _text.text == "":
		_text.text = label


## A finger came down on the button (or lifted with `down` false).
func press(down: bool) -> void:
	if down and enabled and not _down:
		pressed.emit()
	_down = down
	queue_redraw()


func covers(at: Vector2) -> bool:
	return at.distance_to(size / 2.0) <= size.x * 0.55


func _layout() -> void:
	var font_size: int = maxi(24, int(size.x * 0.22))
	_text.add_theme_font_size_override("font_size", font_size)
	_text.size = Vector2(size.x * 1.4, font_size * 1.4)
	_text.position = Vector2(-size.x * 0.2, size.y * 0.62)


func _draw() -> void:
	var d: float = size.x * (0.94 if _down else 1.0)
	var at: Vector2 = (size - Vector2(d, d)) / 2.0
	var tint := Color.WHITE if enabled else Color(0.75, 0.72, 0.72, 0.85)
	var face_h: float = d * _face.get_height() / _face.get_width()
	draw_texture_rect(_face, Rect2(at, Vector2(d, face_h)), false, tint)
	var icon: float = d * 0.42
	var ratio: float = float(_icon.get_width()) / _icon.get_height()
	var icon_size := Vector2(icon * minf(ratio, 1.4), icon * minf(ratio, 1.4) / ratio)
	var centre: Vector2 = size / 2.0 - Vector2(0, d * 0.12)
	draw_texture_rect(_icon, Rect2(centre - icon_size / 2.0, icon_size), false, tint)
	var r: float = d * 0.36
	if cooldown > 0.0:
		var points := PackedVector2Array([centre])
		for i: int in 41:
			var angle: float = -PI / 2.0 + TAU * cooldown * i / 40.0
			points.append(centre + Vector2(cos(angle), sin(angle)) * r)
		draw_colored_polygon(points, Color(0.23, 0.16, 0.29, 0.45))
	if glowing:
		draw_arc(centre, r + 3.0, 0, TAU, 48, Color("#fff1a0"), 4.0, true)
