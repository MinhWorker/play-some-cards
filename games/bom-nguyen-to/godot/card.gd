extends Control
## A fighter's card: the friend's portrait, a name and the HP bar, with the team's letter in a
## team match. Your own card (`stats` on) also lists the bombs you can still place and the
## blast range. The table fills it with `show_fighter`.

const ART := "res://content/bom-nguyen-to/art/"
const Rules := preload("res://content/bom-nguyen-to/rules.gd")
const TEAM_INK: Array[Color] = [Color("#4c9be8"), Color("#f0708f")]
const OUTLINE := Color("#8a5a43")
const PAPER := Color("#fff6e7")

## Your own card: bigger, with the bombs and the range under the bar.
var stats: bool = false

var _fighter: Dictionary = {}
var _title: String = ""
var _team: String = ""
var _bombs: String = ""
var _range: String = ""
var _paint: String = ""
var _portraits: Dictionary = {}
var _icons: Dictionary = {}


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for element: String in Rules.ELEMENTS:
		_portraits[element] = load(ART + "portrait-%s.webp" % element)
	for icon: String in ["heart", "bomb", "blast"]:
		_icons[icon] = load(ART + "icon-%s.webp" % icon)
	resized.connect(queue_redraw)


## Shows a fighter ({} hides the card); `title` is the name to show.
func show_fighter(one: Dictionary, title: String, view: Dictionary) -> void:
	visible = not one.is_empty()
	if one.is_empty():
		return
	_fighter = one
	_title = title
	_team = ""
	if str(view.get("mode", "solo")) == "teams":
		_team = "A" if int(one["team"]) == 0 else "B"
	_bombs = "%d / %d" % [Rules.bombs_left(view, one), int(one["capacity"])]
	_range = str(int(one["range"]))
	var paint: String = (
		"%s|%s|%s|%s|%s|%s" % [title, one["hp"], one["element"], _team, _bombs, _range]
	)
	modulate.a = 1.0 if int(one["hp"]) > 0 else 0.55
	if paint != _paint:
		_paint = paint
		queue_redraw()


func _draw() -> void:
	if _fighter.is_empty():
		return
	var box := Rect2(Vector2.ZERO, size)
	var style := StyleBoxFlat.new()
	style.bg_color = PAPER
	style.border_color = OUTLINE
	style.set_border_width_all(2)
	style.set_corner_radius_all(int(minf(20.0, size.y * 0.3)))
	style.shadow_color = Color(0.36, 0.49, 0.23, 0.25)
	style.shadow_offset = Vector2(0, 4)
	style.shadow_size = 2
	draw_style_box(style, box)
	var element: String = str(_fighter["element"])
	var hp: int = int(_fighter["hp"])
	var head: float = minf(size.y, 64.0) if not stats else minf(size.x * 0.42, 96.0)
	var picture: Texture2D = _portraits[element]
	var fit: float = (head - 8.0) / maxf(picture.get_width(), picture.get_height())
	var pic: Vector2 = picture.get_size() * fit
	var pic_at := Vector2(4.0 + (head - 8.0 - pic.x) / 2.0, 4.0 + (head - 8.0 - pic.y) / 2.0)
	var grey := Color(0.6, 0.6, 0.6) if hp <= 0 else Color.WHITE
	var circle: Color = Rules.CHARACTERS[element]["pastel"]
	draw_circle(Vector2(head / 2.0, head / 2.0), head / 2.0 - 3.0, circle)
	draw_texture_rect(picture, Rect2(pic_at, pic), false, grey)
	var font: Font = XomDaoUi.display_font(800)
	var x: float = head + 6.0
	var w: float = size.x - x - 10.0
	var bar_h: float = 26.0
	var top: float = 6.0
	if _team != "":
		_text(font, _team, Vector2(head - 14.0, head - 4.0), 24, TEAM_INK[0 if _team == "A" else 1])
	var named: bool = w >= 110.0
	if named:
		_text(font, _fit(font, _title, w, 24), Vector2(x, top + 24.0), 24, Color("#5b3a2e"), false)
		top += 30.0
	else:
		top = (head - bar_h) / 2.0
	var bar := Rect2(x, top, w, bar_h)
	_pill(bar, Color("#e9dccb"))
	if hp > 0:
		_pill(
			Rect2(bar.position, Vector2(maxf(bar_h, w * hp / 100.0), bar_h)),
			Rules.CHARACTERS[element]["bar"]
		)
	_text(font, str(hp), bar.get_center() + Vector2(0, 9.0), 24, Color.WHITE)
	if not stats:
		return
	var rows: Array = [["bomb", "Bom", _bombs], ["blast", "Tầm nổ", _range]]
	for i: int in rows.size():
		var y: float = maxf(head, top + bar_h) + 8.0 + i * 36.0
		var icon: Texture2D = _icons[rows[i][0]]
		var k: float = 30.0 / icon.get_height()
		draw_texture_rect(icon, Rect2(Vector2(12.0, y), icon.get_size() * k), false)
		_text(font, rows[i][1], Vector2(54.0, y + 25.0), 24, Color("#5b3a2e"), false)
		var value: String = rows[i][2]
		var vw: float = font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, 24).x
		_text(font, value, Vector2(size.x - 14.0 - vw, y + 25.0), 24, Color("#5b3a2e"), false)


func _pill(box: Rect2, ink: Color) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = ink
	style.set_corner_radius_all(int(box.size.y / 2.0))
	draw_style_box(style, box)


func _text(
	font: Font, text: String, at: Vector2, font_size: int, ink: Color, centred: bool = true
) -> void:
	var w: float = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var spot: Vector2 = at - Vector2(w / 2.0 if centred else 0.0, 0)
	if ink == Color.WHITE or centred:
		draw_string_outline(
			font, spot, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 5, Color("#5b3a2e")
		)
	draw_string(font, spot, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, ink)


static func _fit(font: Font, text: String, width: float, font_size: int) -> String:
	var out: String = text
	while (
		out.length() > 1
		and font.get_string_size(out, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > width
	):
		out = out.left(out.length() - 2) + "…"
	return out
