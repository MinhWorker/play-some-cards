class_name XomDaoPlayerSlot
extends HBoxContainer
## A player at the table: the round avatar in its bamboo ring, the name on a HUD pill, the
## level and the game's own counter (cards left, dice) as separate chips, the brass turn timer
## and the host's 👑. `compact` shrinks the avatar from 96 to 72 for crowded tables.
##
##   var slot := XomDaoPlayerSlot.new()
##   slot.player_name = "Minh"; slot.level = 12; slot.extra = "8 lá"; slot.host = true
##   slot.start_turn(20.0)    # the timer runs down; turn_ended when it runs out
##   slot.end_turn()

## The turn timer ran out (the server decides what happens; this only shows it).
signal turn_ended

const AVATAR := 96.0
const AVATAR_COMPACT := 72.0

var player_name: String = "":
	set(value):
		player_name = value
		_name.text = value
		avatar.initial = value

var level: int = 0:
	set(value):
		level = value
		_level.text = str(value)
		_level.visible = value > 0

## The game's own counter shown as a chip ("8 lá"); "" hides it.
var extra: String = "":
	set(value):
		extra = value
		_extra.text = value
		_extra.visible = value != ""

var host: bool = false:
	set(value):
		host = value
		avatar.crown = value

var compact: bool = false:
	set(value):
		compact = value
		_resize()

var picture: Texture2D:
	set(value):
		picture = value
		avatar.picture = value

var avatar := XomDaoAvatar.new()

var _name := Label.new()
var _name_pill := PanelContainer.new()
var _level: XomDaoChip = XomDaoChip.create("", "", XomDaoUi.LACQUER)
var _extra: XomDaoChip = XomDaoChip.create("", "", XomDaoUi.BAMBOO_DARK)
var _turn_seconds: float = 0.0
var _turn_left: float = 0.0


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_PASS
	add_theme_constant_override("separation", 8)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", -10)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(column)
	avatar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(avatar)
	var pill: StyleBoxFlat = XomDaoUi.box(XomDaoUi.HUD, XomDaoUi.BAMBOO_DARK, 2, 20.0)
	pill.content_margin_left = 16.0
	pill.content_margin_right = 16.0
	pill.content_margin_bottom = 2.0
	_name_pill.add_theme_stylebox_override("panel", pill)
	_name_pill.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_name_pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(_name_pill)
	_name.add_theme_font_override("font", XomDaoUi.display_font(800))
	_name.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_name_pill.add_child(_name)
	var chips := VBoxContainer.new()
	chips.alignment = BoxContainer.ALIGNMENT_CENTER
	chips.add_theme_constant_override("separation", 8)
	add_child(chips)
	_level.visible = false
	_extra.visible = false
	chips.add_child(_level)
	chips.add_child(_extra)
	_resize()


func _ready() -> void:
	# Godot turns processing on for a node with _process: only a running timer needs it.
	set_process(_timing())


func is_turn() -> bool:
	return avatar.turn >= 0.0


## Seconds left on the turn timer (0 when it is not this player's turn).
func time_left() -> float:
	return _turn_left if is_turn() else 0.0


## Starts this player's turn timer: `seconds` long, already `elapsed` in (after a reconnect).
func start_turn(seconds: float, elapsed: float = 0.0) -> void:
	_turn_seconds = maxf(seconds, 0.001)
	_turn_left = clampf(seconds - elapsed, 0.0, seconds)
	avatar.turn = _turn_left / _turn_seconds
	set_process(true)


## Shows the turn with no timer (a game without a clock): a full brass ring.
func show_turn() -> void:
	_turn_seconds = 0.0
	avatar.turn = 1.0
	set_process(false)


func end_turn() -> void:
	avatar.turn = -1.0
	set_process(false)


func _process(delta: float) -> void:
	if not _timing():
		set_process(false)
		return
	_turn_left = maxf(0.0, _turn_left - delta)
	avatar.turn = _turn_left / _turn_seconds
	if _turn_left <= 0.0:
		set_process(false)
		turn_ended.emit()


func _timing() -> bool:
	return is_turn() and _turn_seconds > 0.0 and _turn_left > 0.0


func _resize() -> void:
	var side: float = AVATAR_COMPACT if compact else AVATAR
	avatar.custom_minimum_size = Vector2(side, side)
	_name.add_theme_font_size_override("font_size", 24 if compact else 30)
	_name.custom_minimum_size.x = side + 24.0
