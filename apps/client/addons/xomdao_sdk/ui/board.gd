class_name XomDaoBoard
extends PanelContainer
## The big board of every dialog: a honey wood frame with a title, rope knots on the top corners
## and a paper inside (inner margin 32, corners 24). Put its content in `content`.
##
##   var board := XomDaoBoard.create("Cài đặt", true)   # true: a close button
##   board.content.add_child(...)
##   board.closed.connect(...)
## open() sways it in with the paper sound; the close button hides it and emits `closed`.

signal closed

var title: String = "":
	set(value):
		title = value
		_title.text = value
		_title.visible = value != ""

## Where the board's content goes (a VBoxContainer on the paper).
var content := VBoxContainer.new()

var _title := Label.new()
var _close: XomDaoIconButton


static func create(heading: String, closable: bool = false) -> XomDaoBoard:
	var board := XomDaoBoard.new()
	board.title = heading
	board.set_closable(closable)
	return board


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	var frame: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.HONEY, XomDaoUi.HONEY_DARK, XomDaoUi.BORDER, XomDaoUi.RADIUS)
	)
	frame.set_content_margin_all(12.0)
	frame.content_margin_top = 8.0
	add_theme_stylebox_override("panel", frame)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	add_child(column)
	var head := Control.new()
	head.custom_minimum_size.y = 72.0
	column.add_child(head)
	_title.add_theme_font_override("font", XomDaoUi.display_font(800))
	_title.add_theme_font_size_override("font_size", XomDaoUi.TITLE)
	_title.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_title.add_theme_color_override("font_outline_color", XomDaoUi.HONEY_DARK)
	_title.add_theme_constant_override("outline_size", 10)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_title.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	head.add_child(_title)
	_close = XomDaoIconButton.create("x")
	_close.set_anchors_and_offsets_preset(Control.PRESET_CENTER_RIGHT)
	_close.offset_left = -XomDaoIconButton.SIZE - 20.0
	_close.offset_right = -20.0
	_close.offset_top = -XomDaoIconButton.SIZE / 2.0
	_close.offset_bottom = XomDaoIconButton.SIZE / 2.0
	_close.visible = false
	_close.pressed.connect(close)
	head.add_child(_close)
	var paper := PanelContainer.new()
	var inside: StyleBoxFlat = XomDaoUi.box(
		XomDaoUi.PAPER, XomDaoUi.PAPER_DARK, XomDaoUi.BORDER, XomDaoUi.RADIUS - 8.0
	)
	inside.set_content_margin_all(XomDaoUi.PAD)
	paper.add_theme_stylebox_override("panel", inside)
	paper.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(paper)
	content.add_theme_constant_override("separation", 16)
	paper.add_child(content)


func set_closable(closable: bool) -> void:
	_close.visible = closable


## Shows the board with a slight sway (±2°, 300 ms) and the paper sound.
func open() -> void:
	visible = true
	pivot_offset = size / 2.0
	rotation_degrees = -2.0
	XomDaoUi.play(self, XomDaoUi.SOUND_PANEL)
	var tween: Tween = create_tween()
	tween.tween_property(self, "rotation_degrees", 1.0, 0.12).set_trans(Tween.TRANS_SINE)
	tween.tween_property(self, "rotation_degrees", 0.0, 0.18).set_trans(Tween.TRANS_SINE)


func close() -> void:
	visible = false
	closed.emit()


## Rope knots tied on the two top corners.
func _draw() -> void:
	var rope := Color("#C9A46A")
	var dark := Color("#8A6A3A")
	for x: float in [18.0, size.x - 18.0]:
		var c := Vector2(x, 18.0)
		draw_circle(c + Vector2(2.0, 3.0), 13.0, XomDaoUi.SHADOW, true, -1.0, true)
		draw_circle(c, 13.0, dark, true, -1.0, true)
		draw_circle(c, 10.0, rope, true, -1.0, true)
		draw_arc(c, 6.0, PI * 0.2, PI * 1.3, 8, dark, 2.5, true)
