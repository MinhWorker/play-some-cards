class_name XomDaoChoice
extends HBoxContainer
## One choice among a few options on a row (players, a rule, a setting): the chosen option is
## dark with cream text, the others light on the paper. Every option is a full touch target.
##
##   var seats := XomDaoChoice.create(["2", "3", "4"], 2)
##   seats.changed.connect(func(index: int) -> void: ...)

signal changed(index: int)

const HEIGHT := 88.0

var options: Array[String] = []:
	set(value):
		options = value
		_rebuild()

var selected: int = 0:
	set(value):
		selected = clampi(value, 0, maxi(0, options.size() - 1))
		_restyle()


static func create(labels: Array[String], chosen: int = 0) -> XomDaoChoice:
	var choice := XomDaoChoice.new()
	choice.options = labels
	choice.selected = chosen
	return choice


func _init() -> void:
	add_theme_constant_override("separation", 8)


## Chooses an option as if the player tapped it (emits `changed` when it changes).
func choose(index: int) -> void:
	if index == selected or index < 0 or index >= options.size():
		return
	selected = index
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	changed.emit(index)


func _rebuild() -> void:
	for child: Node in get_children():
		remove_child(child)
		child.queue_free()
	for i: int in options.size():
		var option := Button.new()
		option.text = options[i]
		option.focus_mode = Control.FOCUS_NONE
		option.custom_minimum_size = Vector2(HEIGHT, HEIGHT)
		option.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		option.add_theme_font_override("font", XomDaoUi.display_font(800))
		option.add_theme_font_size_override("font_size", 28)
		option.pressed.connect(choose.bind(i))
		add_child(option)
	selected = selected


func _restyle() -> void:
	for i: int in get_child_count():
		var option: Button = get_child(i)
		var on: bool = i == selected
		var fill: Color = XomDaoUi.SEA_DEEP if on else XomDaoUi.PAPER
		var edge: Color = Color("#14687A") if on else XomDaoUi.PAPER_DARK
		var style: StyleBoxFlat = XomDaoUi.box(fill, edge, XomDaoUi.BORDER, 20.0)
		style.content_margin_left = 14.0
		style.content_margin_right = 14.0
		var hover: StyleBoxFlat = style.duplicate()
		hover.bg_color = fill.lightened(0.08) if on else fill.darkened(0.04)
		for state: String in ["normal", "pressed", "hover_pressed", "disabled"]:
			option.add_theme_stylebox_override(state, style)
		option.add_theme_stylebox_override("hover", hover)
		option.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
		var text: Color = XomDaoUi.CREAM if on else XomDaoUi.INK
		for state: String in ["font_color", "font_hover_color", "font_pressed_color"]:
			option.add_theme_color_override(state, text)
