extends PanelContainer
## Cờ tỷ phú's trade offer (`offer-trade` in src/game/CoTyPhuClassicGame.ts): pick the other
## player, then on each side a deed (or a jail ticket) and some cash. Tapping a deed button steps
## through that side's deeds without houses; tapping a cash button steps through the amounts.
## A jail ticket goes alone for 200, as the rules ask. Gửi emits `offered` with the payload.
##
## Named nodes: TradeWith, GiveDeed, GiveCash, TakeDeed, TakeCash, SendTrade, CloseTrade.

signal offered(payload: Dictionary)

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const AMOUNTS: Array[int] = [0, 50, 100, 200, 500, 1000]
const TICKET := -2
const TICKET_PRICE := 200

var _view: Dictionary = {}
var _me: int = -1
var _names: Array[String] = []
## The seats you can trade with, in the order of the choice.
var _others: Array[int] = []
var _with := XomDaoChoice.new()
var _give: XomDaoButton = XomDaoButton.create("", XomDaoUi.Kind.SOCIAL)
var _give_cash: XomDaoButton = XomDaoButton.create("", XomDaoUi.Kind.SOCIAL)
var _take: XomDaoButton = XomDaoButton.create("", XomDaoUi.Kind.INFO)
var _take_cash: XomDaoButton = XomDaoButton.create("", XomDaoUi.Kind.INFO)
var _send: XomDaoButton = XomDaoButton.create("Gửi", XomDaoUi.Kind.CONFIRM)
var _close: XomDaoButton = XomDaoButton.create("Đóng", XomDaoUi.Kind.BACK)
## What is picked: a square, TICKET or -1, and an index into AMOUNTS.
var _give_deed: int = -1
var _take_deed: int = -1
var _give_amount: int = 0
var _take_amount: int = 0


func _init() -> void:
	name = "Trade"
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	var paper: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.HONEY_DARK, XomDaoUi.BORDER, 18.0)
	)
	paper.set_content_margin_all(16.0)
	add_theme_stylebox_override("panel", paper)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	add_child(column)
	var title := Label.new()
	title.text = "Trao đổi"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_override("font", XomDaoUi.display_font(800))
	title.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	title.add_theme_color_override("font_color", XomDaoUi.INK)
	column.add_child(title)
	_with.name = "TradeWith"
	_with.alignment = BoxContainer.ALIGNMENT_CENTER
	_with.changed.connect(_on_with)
	column.add_child(_with)
	var rows: Array = [
		["Đưa", _give, "GiveDeed", _give_cash, "GiveCash"],
		["Nhận", _take, "TakeDeed", _take_cash, "TakeCash"],
	]
	for item: Array in rows:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		var label := Label.new()
		label.text = item[0]
		label.custom_minimum_size.x = 80.0
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.add_theme_font_override("font", XomDaoUi.display_font(800))
		label.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
		label.add_theme_color_override("font_color", XomDaoUi.INK)
		row.add_child(label)
		var deed: XomDaoButton = item[1]
		deed.name = item[2]
		deed.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		deed.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		row.add_child(deed)
		var cash: XomDaoButton = item[3]
		cash.name = item[4]
		cash.custom_minimum_size.x = 150.0
		row.add_child(cash)
		column.add_child(row)
	_give.pressed.connect(_step_deed.bind(true))
	_take.pressed.connect(_step_deed.bind(false))
	_give_cash.pressed.connect(_step_cash.bind(true))
	_take_cash.pressed.connect(_step_cash.bind(false))
	var actions := HBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_CENTER
	actions.add_theme_constant_override("separation", 12)
	_send.name = "SendTrade"
	_send.pressed.connect(_on_send)
	_close.name = "CloseTrade"
	_close.pressed.connect(hide)
	actions.add_child(_close)
	actions.add_child(_send)
	column.add_child(actions)


## Opens a blank offer to the first player you can trade with.
func open(view: Dictionary, me: int, names: Array[String]) -> void:
	_view = view
	_me = me
	_names = names
	_others.clear()
	var labels: Array[String] = []
	for seat: int in (view["players"] as Array).size():
		if seat != me and not bool(view["players"][seat]["bankrupt"]):
			_others.append(seat)
			labels.append(names[seat])
	_with.options = labels
	_with.selected = 0
	_reset()
	visible = true


## Keeps the open offer in step with a new view (a deed may have changed hands).
func update(view: Dictionary) -> void:
	_view = view
	if visible and _others.size() > 0:
		if not _deeds(_me).has(_give_deed) and _give_deed != -1:
			_give_deed = -1
		if not _deeds(_to()).has(_take_deed) and _take_deed != -1:
			_take_deed = -1
		_show()


func _to() -> int:
	return _others[_with.selected] if _with.selected < _others.size() else -1


func _reset() -> void:
	_give_deed = -1
	_take_deed = -1
	_give_amount = 0
	_take_amount = 0
	_show()


func _on_with(_index: int) -> void:
	_reset()


## What one side may put on the table: deeds without houses, then a jail ticket.
func _deeds(seat: int) -> Array[int]:
	var out: Array[int] = [-1]
	if seat < 0:
		return out
	for i: int in 40:
		var deed: Dictionary = _view["properties"][i]
		if deed.get("owner") != null and int(deed["owner"]) == seat and int(deed["houses"]) == 0:
			out.append(i)
	if not (_view["players"][seat]["freeCards"] as Array).is_empty():
		out.append(TICKET)
	return out


func _step_deed(giving: bool) -> void:
	var list: Array[int] = _deeds(_me if giving else _to())
	var now: int = _give_deed if giving else _take_deed
	var next: int = list[(list.find(now) + 1) % list.size()]
	if giving:
		_give_deed = next
	else:
		_take_deed = next
	# A ticket is sold alone, for its price.
	if next == TICKET:
		if giving:
			_take_deed = -1
		else:
			_give_deed = -1
		_give_amount = AMOUNTS.find(TICKET_PRICE) if not giving else 0
		_take_amount = AMOUNTS.find(TICKET_PRICE) if giving else 0
	elif TICKET in [_give_deed, _take_deed]:
		_give_deed = -1 if _give_deed == TICKET else _give_deed
		_take_deed = -1 if _take_deed == TICKET else _take_deed
		_give_amount = 0
		_take_amount = 0
	_show()


func _step_cash(giving: bool) -> void:
	if TICKET in [_give_deed, _take_deed]:
		return
	if giving:
		_give_amount = (_give_amount + 1) % AMOUNTS.size()
	else:
		_take_amount = (_take_amount + 1) % AMOUNTS.size()
	_show()


func _deed_label(square: int) -> String:
	if square == TICKET:
		return "Vé ra tù"
	if square < 0:
		return "Không có đất"
	return str(Rules.SQUARES[square]["name"])


func _show() -> void:
	_give.text = _deed_label(_give_deed)
	_take.text = _deed_label(_take_deed)
	_give_cash.text = XomDaoUi.money(AMOUNTS[_give_amount]) + " ₫"
	_take_cash.text = XomDaoUi.money(AMOUNTS[_take_amount]) + " ₫"
	var to: int = _to()
	var empty: bool = (
		_give_deed == -1 and _take_deed == -1 and _give_amount == 0 and _take_amount == 0
	)
	var affordable: bool = (
		to >= 0
		and int(_view["players"][_me]["cash"]) >= AMOUNTS[_give_amount]
		and int(_view["players"][to]["cash"]) >= AMOUNTS[_take_amount]
	)
	_send.disabled = empty or not affordable


func _on_send() -> void:
	(
		offered
		. emit(
			{
				"to": _to(),
				"give": _give_deed,
				"take": _take_deed,
				"giveCash": AMOUNTS[_give_amount],
				"takeCash": AMOUNTS[_take_amount],
			}
		)
	)
	hide()
