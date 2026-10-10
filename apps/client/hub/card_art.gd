class_name HubCardArt
extends Control
## The picture of a game card until the game ships its card art: sea, the game's initial big on
## a disc, and fog with a lock when it is not playable here yet.

var title: String = "":
	set(value):
		title = value
		queue_redraw()

var locked: bool = false:
	set(value):
		locked = value
		queue_redraw()

var _lock: Texture2D = XomDaoUi.icon("lock-simple")


func _init() -> void:
	custom_minimum_size = Vector2(120.0, 96.0)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true


func _draw() -> void:
	var box: StyleBoxFlat = XomDaoUi.box(XomDaoUi.SEA, XomDaoUi.PAPER_DARK, XomDaoUi.BORDER, 14.0)
	draw_style_box(box, Rect2(Vector2.ZERO, size))
	var c: Vector2 = size / 2.0
	var r: float = minf(size.x, size.y) * 0.34
	draw_circle(c + Vector2(3, 4), r, XomDaoUi.SHADOW, true, -1.0, true)
	draw_circle(c, r, XomDaoUi.PAPER, true, -1.0, true)
	draw_circle(c, r * 0.86, XomDaoUi.LACQUER, false, maxf(2.0, r * 0.08), true)
	var font: Font = XomDaoUi.display_font(800)
	var letter: String = title.left(1)
	var font_size: int = int(r * 1.15)
	var w: float = font.get_string_size(letter, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	draw_string(
		font,
		c + Vector2(-w / 2.0, font_size * 0.36),
		letter,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		font_size,
		XomDaoUi.INK
	)
	if locked:
		draw_rect(Rect2(Vector2.ZERO, size), Color(1, 1, 1, 0.55))
		var side: float = r * 1.1
		draw_texture_rect(
			_lock, Rect2(c - Vector2(side, side) / 2.0, Vector2(side, side)), false, XomDaoUi.HUD
		)
