class_name HubTopBar
extends Control
## The top of every hub screen other than the lobby and the game: ← ("Back") on the top left,
## the balance and ⚙ on the top right (docs/experience.md). Fills its parent; the screen's own
## content goes below `HEIGHT`.

signal back_pressed

const HEIGHT := 88.0

var back: XomDaoIconButton = XomDaoIconButton.create("arrow-left")
var money := HubMoneyRow.new()
var _settings: XomDaoSettings


func _init(settings: XomDaoSettings = null) -> void:
	_settings = settings if settings != null else XomDaoSettings.current()
	name = "TopBar"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	back.name = "Back"
	back.pressed.connect(back_pressed.emit)
	add_child(back)
	add_child(money)
	resized.connect(_layout)
	_settings.changed.connect(_layout)


func _ready() -> void:
	_layout()


## How far down the bar reaches, in this control's units: content starts below it.
func bottom() -> float:
	return XomDaoFrame.safe_inset(self).y + _settings.margin + HEIGHT * _settings.ui_scale


func _layout() -> void:
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var k: float = _settings.ui_scale
	back.scale = Vector2.ONE * k
	back.position = inset + Vector2.ONE * edge
	money.reset_size()
	money.scale = Vector2.ONE * k
	money.position = Vector2(size.x - inset.x - edge - money.size.x * k, inset.y + edge)
