class_name XomDaoMoney
extends Control
## One currency in the HUD: a dark pill 64 units tall with the coin (or gem) spilling over its
## left edge and the amount in cream, "2.450". count_to() rolls the number up or down.

const HEIGHT := 64.0

var amount: int = 0:
	set(value):
		amount = value
		_label.text = XomDaoUi.money(value)

var currency: XomDaoResourceIcon.Currency = XomDaoResourceIcon.Currency.COIN:
	set(value):
		currency = value
		_icon.currency = value

var _pill := Panel.new()
var _label := Label.new()
var _icon := XomDaoResourceIcon.new()
var _shown: float = 0.0


static func create(
	value: int, kind: XomDaoResourceIcon.Currency = XomDaoResourceIcon.Currency.COIN
) -> XomDaoMoney:
	var money := XomDaoMoney.new()
	money.amount = value
	money.currency = kind
	return money


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	custom_minimum_size = Vector2(220.0, HEIGHT + 8.0)
	_pill.add_theme_stylebox_override(
		"panel", XomDaoUi.box(XomDaoUi.HUD, Color.TRANSPARENT, 0, HEIGHT / 2.0)
	)
	_pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_pill)
	_label.add_theme_font_override("font", XomDaoUi.display_font(800))
	_label.add_theme_font_size_override("font_size", 38)
	_label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_pill.add_child(_label)
	add_child(_icon)
	resized.connect(_layout)
	_layout()


## Rolls the shown number to `value` over `seconds` (the balance counting up after a reward).
func count_to(value: int, seconds: float = 0.6) -> void:
	_shown = amount
	amount = value
	_label.text = XomDaoUi.money(int(_shown))
	var tween: Tween = create_tween()
	tween.tween_method(_show_number, _shown, float(value), seconds)


func _show_number(value: float) -> void:
	_label.text = XomDaoUi.money(roundi(value))


func _layout() -> void:
	var icon_size: float = HEIGHT + 8.0
	_icon.size = Vector2(icon_size, icon_size)
	_icon.position = Vector2(0.0, (size.y - icon_size) / 2.0)
	_pill.position = Vector2(icon_size * 0.55, (size.y - HEIGHT) / 2.0)
	_pill.size = Vector2(size.x - icon_size * 0.55, HEIGHT)
	_label.position = Vector2(icon_size * 0.45, 0.0)
	_label.size = Vector2(_pill.size.x - icon_size * 0.45 - 12.0, HEIGHT)
