extends Control
## Cờ tỷ phú Classic on the Godot client, in the **Bàn** layout (docs/experience.md): the 2.5D
## board fills the frame, the players' slots stand in a column on the right (yours at the bottom,
## its chip your cash), the board's printed panel shows who acts now. It draws `snapshot.view`
## (View in src/game/model.ts) and sends the game's events (src/game/CoTyPhuClassicGame.ts).
##
## The green field in the middle holds the notice, the dice and your actions for the phase:
## Gieo, Nộp 50 / Dùng thẻ in jail, Mua / Bỏ qua, Góp / Từ bỏ at a bus station, Trả / Bỏ in an
## auction, Xây / Hết lượt, Trả nợ / Phá sản. A card over the field shows a drawn card or tax
## (Xác nhận), a trade offer (Đồng ý / Từ chối) or a tapped square: its price, rent and owner,
## and for your own deeds Thế chấp, Chuộc, Bán nhà, Đấu giá. Trao đổi (top right) opens trade.gd.
## Named nodes for tests: Board, Square_<i>, Pawn_<seat>, Die_0, Die_1, Seat_<seat>, Notice,
## Status, Card, CardTitle, CardText, and the buttons Roll, Bail, UseCard, Buy, Skip, Bid,
## Pass, Build, EndTurn, PayDebt, Bankrupt, Confirm, Accept, Decline, Mortgage, Redeem,
## SellHouse, Auction, Offer.

const Rules := preload("res://content/co-ty-phu-classic/rules.gd")
const Texts := preload("res://content/co-ty-phu-classic/texts.gd")
## The sounds in sounds/ (.wav), besides win.mp3.
const SOUNDS := "auction bankrupt build buy card-flip coin dice jail plane release rent step turn"
const INKS: Array[Color] = [Color("#DF6554"), Color("#5793D3"), Color("#60AF72"), Color("#E6BE52")]
const PAWNS: Array[String] = ["red", "blue", "green", "yellow"]
const DECKS: Dictionary = {"chance": "Cơ hội", "chest": "Khí vận"}
## The part of board.webp that is drawn (fractions of its width and height).
const SEEN := Rect2(0.07, 0.048, 0.86, 0.822)
const COLUMN := 210.0
const ROLL_SECONDS := 0.7
const STEP_SECONDS := 0.14
const FLY_SECONDS := 0.7
const GOLD := Color("#FFE2A0")
const FIELD_INK := Color("#2F4A3A")
## Phase actions: [node name, label, event, kind].
const ACTIONS: Array = [
	["Roll", "Gieo", "roll", XomDaoUi.Kind.GO],
	["Bail", "Nộp 50", "pay-bail", XomDaoUi.Kind.SOCIAL],
	["UseCard", "Dùng thẻ", "use-card", XomDaoUi.Kind.SOCIAL],
	["Buy", "Mua", "buy", XomDaoUi.Kind.CONFIRM],
	["Skip", "Bỏ qua", "end-turn", XomDaoUi.Kind.BACK],
	["Bid", "Góp", "bid", XomDaoUi.Kind.CONFIRM],
	["Pass", "Từ bỏ", "pass", XomDaoUi.Kind.BACK],
	["Build", "Xây", "build", XomDaoUi.Kind.CONFIRM],
	["EndTurn", "Hết lượt", "end-turn", XomDaoUi.Kind.GO],
	["PayDebt", "Trả nợ", "pay-debt", XomDaoUi.Kind.CONFIRM],
	["Bankrupt", "Phá sản", "bankrupt", XomDaoUi.Kind.DANGER],
]
## Card actions: [node name, label, event, kind].
const CARD_ACTIONS: Array = [
	["Confirm", "Xác nhận", "confirm-event", XomDaoUi.Kind.GO],
	["Accept", "Đồng ý", "accept-trade", XomDaoUi.Kind.CONFIRM],
	["Decline", "Từ chối", "decline-trade", XomDaoUi.Kind.BACK],
	["Mortgage", "Thế chấp", "mortgage", XomDaoUi.Kind.SOCIAL],
	["Redeem", "Chuộc", "redeem", XomDaoUi.Kind.CONFIRM],
	["SellHouse", "Bán nhà", "sell-house", XomDaoUi.Kind.SOCIAL],
	["Auction", "Đấu giá", "auction", XomDaoUi.Kind.GO],
]
var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your seat, or -1 for a spectator.
var _me: int = -1

var _cloth := ColorRect.new()
var _board := TextureRect.new()
var _marks: Control = preload("res://content/co-ty-phu-classic/marks.gd").new()
var _squares: Array[Control] = []
var _pawns: Array[TextureRect] = []
var _dice: Array[TextureRect] = []
var _faces: Array[Texture2D] = []
var _turn_pawn := TextureRect.new()
var _turn_name := Label.new()
var _turn_cash := Label.new()
var _notice := Label.new()
var _status := Label.new()
var _row := HBoxContainer.new()
var _buttons: Dictionary = {}
var _card := PanelContainer.new()
var _card_title := Label.new()
var _card_text := Label.new()
var _card_row := HBoxContainer.new()
var _slots: Array[XomDaoPlayerSlot] = []
var _trade: PanelContainer = preload("res://content/co-ty-phu-classic/trade.gd").new()
var _offer_trade: XomDaoButton = XomDaoButton.create("Trao đổi", XomDaoUi.Kind.SOCIAL)
var _fx := Control.new()
var _sounds: Dictionary = {}
var _textures: Array[Texture2D] = []

## The square you tapped, shown on the card (-1 for none).
var _focus: int = -1
## Where each pawn is drawn now (it lags the view while it walks).
var _shown: Array[int] = []
## Cash as shown on the slots (it changes when the money moves).
var _cash: Array[int] = []
## Animations run one after another; the actions wait for them.
var _jobs: Array[Callable] = []
var _running: bool = false
var _readied: int = -1
var _sent: bool = false
var _field := Rect2()


## Options for a sandbox room (`?play=co-ty-phu-classic` in a debug build): three computer players.
func sandbox_options() -> Dictionary:
	return {"bots": 3, "turnSeconds": 30}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	return [
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3]],
		},
		{
			"key": "turnSeconds",
			"label": "Thời gian mỗi lượt",
			"options": [["15 giây", 15], ["30 giây", 30], ["60 giây", 60]],
			"default": 1,
		},
	]


## The figures for the hub's result board.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty() or _view.get("winner") == null:
		return {}
	var winner: int = int(_view["winner"])
	var rows: Array = [
		["Số vòng", str(int(_view["round"]) + 1)],
		["Tiền của người thắng", XomDaoUi.money(int(_view["players"][winner]["cash"])) + " ₫"],
	]
	return {"reason": "Các đối thủ đã phá sản", "rows": rows}


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	_cloth.color = Color("#123447")
	_cloth.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_cloth)
	_board.name = "Board"
	_board.texture = load("res://content/co-ty-phu-classic/art/board.webp")
	_board.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_board.mouse_filter = Control.MOUSE_FILTER_STOP
	_board.gui_input.connect(_on_board_input)
	add_child(_board)
	_marks.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_marks)
	for i: int in Rules.SQUARES.size():
		var square := Control.new()
		square.name = "Square_%d" % i
		square.mouse_filter = Control.MOUSE_FILTER_STOP
		square.gui_input.connect(_on_square_input.bind(i))
		add_child(square)
		_squares.append(square)
	for face: int in 6:
		_faces.append(load("res://content/co-ty-phu-classic/art/dice-%d.webp" % (face + 1)))
	for k: int in 2:
		var die := TextureRect.new()
		die.name = "Die_%d" % k
		die.texture = _faces[0]
		die.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		die.mouse_filter = Control.MOUSE_FILTER_STOP
		die.gui_input.connect(_on_dice_input)
		add_child(die)
		_dice.append(die)
	for color: String in PAWNS:
		_textures.append(load("res://content/co-ty-phu-classic/art/pawn-%s.webp" % color))
	_turn_pawn.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_turn_pawn.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_turn_pawn.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_turn_pawn)
	for label: Label in [_turn_name, _turn_cash]:
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		label.add_theme_font_override("font", XomDaoUi.display_font(800))
		label.add_theme_color_override("font_color", XomDaoUi.INK)
		label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		add_child(label)
	_turn_name.name = "TurnName"
	_turn_cash.name = "TurnCash"
	_turn_cash.add_theme_color_override("font_color", XomDaoUi.HONEY_DARK)
	_notice.name = "Notice"
	_status.name = "Status"
	for label: Label in [_notice, _status]:
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.add_theme_font_override("font", XomDaoUi.display_font(800))
		label.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
		add_child(label)
	_notice.add_theme_color_override("font_color", FIELD_INK)
	_status.add_theme_color_override("font_color", XomDaoUi.LACQUER_DARK)
	_row.name = "Actions"
	_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_row.add_theme_constant_override("separation", 10)
	add_child(_row)
	for action: Array in ACTIONS:
		_row.add_child(_action_button(action))
	_build_card()
	_offer_trade.name = "Offer"
	_offer_trade.visible = false
	_offer_trade.pressed.connect(func() -> void: _trade.call("open", _view, _me, _names()))
	add_child(_offer_trade)
	_trade.connect("offered", _on_offer)
	_trade.visibility_changed.connect(_refresh)
	add_child(_trade)
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)
	for sound: String in SOUNDS.split(" "):
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/co-ty-phu-classic/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	var win := AudioStreamPlayer.new()
	win.stream = load("res://content/co-ty-phu-classic/sounds/win.mp3")
	add_child(win)
	_sounds["win"] = win
	resized.connect(_layout)
	_layout.call_deferred()


func _action_button(action: Array) -> XomDaoButton:
	var button: XomDaoButton = XomDaoButton.create(str(action[1]), action[3])
	button.name = str(action[0])
	button.visible = false
	button.pressed.connect(_on_action.bind(str(action[0]), str(action[2])))
	_buttons[str(action[0])] = button
	return button


func _build_card() -> void:
	_card.name = "Card"
	_card.visible = false
	_card.mouse_filter = Control.MOUSE_FILTER_STOP
	var paper: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.HONEY_DARK, XomDaoUi.BORDER, 18.0)
	)
	paper.set_content_margin_all(16.0)
	_card.add_theme_stylebox_override("panel", paper)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	_card.add_child(column)
	_card_title.name = "CardTitle"
	_card_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_card_title.add_theme_font_override("font", XomDaoUi.display_font(800))
	_card_title.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	_card_title.add_theme_color_override("font_color", XomDaoUi.INK)
	column.add_child(_card_title)
	_card_text.name = "CardText"
	_card_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_card_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_card_text.add_theme_font_override("font", XomDaoUi.body_font(true))
	_card_text.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	_card_text.add_theme_color_override("font_color", XomDaoUi.INK)
	column.add_child(_card_text)
	_card_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_card_row.add_theme_constant_override("separation", 10)
	column.add_child(_card_row)
	for action: Array in CARD_ACTIONS:
		_card_row.add_child(_action_button(action))
	add_child(_card)


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	_me = -1
	for i: int in snapshot.seats.size():
		if snapshot.seats[i].id == _client.player_id:
			_me = i
	var players: Array = view["players"]
	if players.size() != _slots.size():
		_build(players.size(), view)
	if _view.is_empty():
		_view = view
		_place_all()
		_refresh()
		return
	var before: Dictionary = _view
	_view = view
	_sent = false
	_animate(before, view)
	if not _running:
		_refresh()


func _build(count: int, view: Dictionary) -> void:
	for slot: XomDaoPlayerSlot in _slots:
		slot.queue_free()
	for pawn: TextureRect in _pawns:
		pawn.queue_free()
	_slots.clear()
	_pawns.clear()
	_shown.clear()
	_cash.clear()
	for seat: int in count:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.compact = true
		add_child(slot)
		move_child(slot, _card.get_index())
		_slots.append(slot)
		var pawn := TextureRect.new()
		pawn.name = "Pawn_%d" % seat
		pawn.texture = _textures[seat % 4]
		pawn.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pawn.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(pawn)
		move_child(pawn, _dice[0].get_index())
		_pawns.append(pawn)
		var player: Dictionary = view["players"][seat]
		_shown.append(int(player["position"]))
		_cash.append(int(player["cash"]))
	_layout()


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if _snapshot != null and seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "Người %d" % (seat + 1)


func _player(seat: int) -> Dictionary:
	return _view["players"][seat]


func _deed(i: int) -> Dictionary:
	return _view["properties"][i]


func _owner(i: int) -> int:
	var owner: Variant = _deed(i).get("owner")
	return -1 if owner == null else int(owner)


# ── Animation ────────────────────────────────────────────────────────────────────────────────


## Queues what changed from `before` to `view`: the dice, each pawn's walk or flight, the money.
func _animate(before: Dictionary, view: Dictionary) -> void:
	var turn: int = int(before["turn"])
	var dice: Variant = view.get("dice")
	var rolled: bool = (
		str(before["phase"]) == "roll"
		and dice is Array
		and (
			before.get("dice") != dice
			or int(before["players"][turn]["position"]) != int(view["players"][turn]["position"])
			or int(view["players"][turn]["jailRolls"]) != int(before["players"][turn]["jailRolls"])
		)
	)
	if rolled:
		_enqueue(_roll.bind((dice as Array).duplicate()))
	var players: Array = view["players"]
	for seat: int in players.size():
		var was: Dictionary = before["players"][seat]
		var now: Dictionary = players[seat]
		var to: int = int(now["position"])
		if bool(now["bankrupt"]) and not bool(was["bankrupt"]):
			_enqueue(_sfx_job.bind("bankrupt"))
		if to == int(was["position"]) and bool(now["jailed"]) == bool(was["jailed"]):
			continue
		var steps: int = posmod(to - int(was["position"]), 40)
		var jailing: bool = bool(now["jailed"]) and not bool(was["jailed"])
		if jailing:
			_enqueue(_fly.bind(seat, to, "jail"))
		elif bool(was["jailed"]) and not bool(now["jailed"]) and steps == 0:
			_enqueue(_sfx_job.bind("release"))
		elif steps > 0 and steps <= 12 and int(was["position"]) != 20:
			_enqueue(_walk.bind(seat, int(was["position"]), steps))
		else:
			_enqueue(_fly.bind(seat, to, "plane" if int(was["position"]) == 20 else "step"))
	if int(view.get("moneySequence", 0)) != int(before.get("moneySequence", 0)):
		var transfers: Array = view.get("transfers", [])
		if not transfers.is_empty():
			_enqueue(_money.bind(transfers.duplicate(true)))
	if view.get("specialEvent") is Dictionary and before.get("specialEvent") is not Dictionary:
		_enqueue(_sfx_job.bind("card-flip"))
	if str(view["phase"]) == "auction" and str(before["phase"]) != "auction":
		_enqueue(_sfx_job.bind("auction"))
	var houses_before: int = 0
	var houses_now: int = 0
	for i: int in 40:
		houses_before += int(before["properties"][i]["houses"])
		houses_now += int(view["properties"][i]["houses"])
	if houses_now > houses_before:
		_enqueue(_sfx_job.bind("build"))
	if view.get("winner") != null and before.get("winner") == null:
		_enqueue(_sfx_job.bind("win"))
	elif int(view["turn"]) != turn and int(view["turn"]) == _me:
		_enqueue(_sfx_job.bind("turn"))


func _enqueue(job: Callable) -> void:
	_jobs.append(job)
	if not _running:
		_run()


func _run() -> void:
	_running = true
	_refresh()
	while not _jobs.is_empty():
		var job: Callable = _jobs.pop_front()
		await job.call()
		if not is_inside_tree():
			return
	_running = false
	_place_all()
	_refresh()


func _sfx_job(sound: String) -> void:
	_sfx(sound)
	await get_tree().process_frame


func _roll(values: Array) -> void:
	_sfx("dice")
	var start: int = Time.get_ticks_msec()
	while Time.get_ticks_msec() - start < ROLL_SECONDS * 1000.0:
		for die: TextureRect in _dice:
			die.texture = _faces[randi() % 6]
			die.rotation = randf_range(-0.5, 0.5)
		await get_tree().create_timer(0.07).timeout
		if not is_inside_tree():
			return
	for k: int in 2:
		_dice[k].texture = _faces[clampi(int(values[k]), 1, 6) - 1]
		_dice[k].rotation = 0.0
		XomDaoUi.bounce(_dice[k])
	await get_tree().create_timer(0.2).timeout


func _walk(seat: int, from: int, steps: int) -> void:
	for k: int in steps:
		var square: int = (from + k + 1) % 40
		_shown[seat] = square
		var tween: Tween = create_tween()
		var pawn: TextureRect = _pawns[seat]
		var target: Vector2 = _pawn_position(seat, square)
		var lift := Vector2(0.0, -pawn.size.y * 0.25)
		tween.tween_property(
			pawn, "position", (pawn.position + target) / 2.0 + lift, STEP_SECONDS / 2.0
		)
		tween.tween_property(pawn, "position", target, STEP_SECONDS / 2.0)
		_sfx("step")
		await tween.finished
		if not is_inside_tree():
			return
	_place_pawns()


func _fly(seat: int, to: int, sound: String) -> void:
	_sfx(sound)
	_shown[seat] = to
	var pawn: TextureRect = _pawns[seat]
	var target: Vector2 = _pawn_position(seat, to)
	var tween: Tween = create_tween()
	tween.tween_property(
		pawn, "position", (pawn.position + target) / 2.0 - Vector2(0.0, 80.0), FLY_SECONDS / 2.0
	)
	tween.tween_property(pawn, "position", target, FLY_SECONDS / 2.0)
	await tween.finished
	if is_inside_tree():
		_place_pawns()


## Shows each player's net change over their slot, then updates the cash.
func _money(transfers: Array) -> void:
	_sfx(Rules.money_sound(transfers))
	var net: Dictionary = Rules.net_changes(transfers)
	for seat: Variant in net:
		var change: int = int(net[seat])
		if change == 0 or int(seat) >= _slots.size():
			continue
		_cash[int(seat)] += change
		var slot: XomDaoPlayerSlot = _slots[int(seat)]
		var label: Label = Texts.floater(XomDaoUi.delta(change), XomDaoUi.delta_color(change))
		_fx.add_child(label)
		label.reset_size()
		label.position = slot.position + Vector2(slot.size.x - label.size.x, -8.0)
		var tween: Tween = label.create_tween()
		tween.tween_property(label, "position:y", label.position.y - 40.0, 1.1)
		tween.parallel().tween_property(label, "modulate:a", 0.0, 1.1).set_delay(0.5)
		tween.tween_callback(label.queue_free)
	_show_slots()
	await get_tree().create_timer(0.35).timeout


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


# ── Input ────────────────────────────────────────────────────────────────────────────────


static func _is_tap(event: InputEvent) -> bool:
	if event is InputEventMouseButton:
		var mouse: InputEventMouseButton = event
		return mouse.button_index == MOUSE_BUTTON_LEFT and not mouse.pressed
	if event is InputEventScreenTouch:
		return not (event as InputEventScreenTouch).pressed
	return false


func _on_square_input(event: InputEvent, i: int) -> void:
	if not _is_tap(event):
		return
	_focus = -1 if _focus == i else i
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	_refresh()


func _on_board_input(event: InputEvent) -> void:
	if _is_tap(event) and _focus >= 0:
		_focus = -1
		_refresh()


func _on_dice_input(event: InputEvent) -> void:
	if _is_tap(event) and (_buttons["Roll"] as Control).visible:
		_on_action("Roll", "roll")


func _on_action(button: String, event: String) -> void:
	if _client == null or _sent:
		return
	var payload: Dictionary = {}
	match button:
		"Bid":
			payload = {"amount": Rules.bid_amount(_view)}
		"Build":
			payload = {"square": int(_view["buildable"])}
		"Mortgage", "Redeem", "SellHouse", "Auction":
			payload = {"square": _focus}
	_sent = true
	_refresh()
	var ok: bool = await _client.send(event, payload)
	if not ok:
		_sent = false
		if is_inside_tree():
			_refresh()


func _on_offer(payload: Dictionary) -> void:
	if _client != null and not _sent:
		_sent = true
		if not await _client.send("offer-trade", payload):
			_sent = false


# ── State ────────────────────────────────────────────────────────────────────────────────


func _refresh() -> void:
	if _view.is_empty() or not is_inside_tree():
		return
	if not _running:
		for seat: int in _cash.size():
			_cash[seat] = int(_player(seat)["cash"])
		_ready_event()
	_show_slots()
	_show_panel()
	_show_actions()
	_show_card()
	_marks.set("view", _view)
	_marks.set("focus", _focus)
	_marks.queue_redraw()
	_layout()


## Tells the server the drawn card is on screen, so its countdown starts (`event-ready`).
func _ready_event() -> void:
	var event: Variant = _view.get("specialEvent")
	if event is not Dictionary or str(_view["phase"]) != "event" or int(_view["turn"]) != _me:
		return
	var id: int = int((event as Dictionary)["id"])
	if bool((event as Dictionary)["ready"]) or id == _readied:
		return
	_readied = id
	_client.send("event-ready", {"id": id})


func _show_slots() -> void:
	var timer: XomDaoRoomTimer = _snapshot.timer
	var winner: Variant = _view.get("winner")
	var acting: int = Rules.decision_seat(_view)
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		var player: Dictionary = _player(seat)
		var info: XomDaoPlayerInfo = (
			_snapshot.seats[seat] if seat < _snapshot.seats.size() else null
		)
		slot.player_name = _seat_name(seat)
		if info != null:
			slot.frame = info.frame
			slot.host = info.id != "" and info.id == str(_snapshot.host_id)
		if bool(player["bankrupt"]):
			slot.extra = "Phá sản"
		elif bool(player["jailed"]):
			slot.extra = "Tù · %s" % XomDaoUi.money(_cash[seat])
		else:
			slot.extra = XomDaoUi.money(_cash[seat]) + " ₫"
		slot.modulate.a = 0.45 if bool(player["bankrupt"]) else 1.0
		_pawns[seat].visible = not bool(player["bankrupt"])
		var on_turn: bool = winner == null and seat == acting
		if on_turn and timer != null and timer.ms > 0.0:
			slot.start_turn(timer.ms / 1000.0, maxf(0.0, (timer.ms - timer.left) / 1000.0))
		elif on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()


## The board's printed panel: who acts now, with their pawn and cash.
func _show_panel() -> void:
	var seat: int = Rules.decision_seat(_view)
	if _view.get("winner") != null:
		seat = int(_view["winner"])
	_turn_pawn.texture = _textures[seat % 4]
	_turn_name.text = _seat_name(seat)
	_turn_cash.text = XomDaoUi.money(_cash[seat]) + " ₫"


func _show_actions() -> void:
	for name_of: String in _buttons:
		(_buttons[name_of] as Control).visible = false
	var phase: String = _view["phase"]
	_notice.text = "" if _running else str(_view.get("notice", ""))
	_status.text = "" if _running else Texts.status(_view, _me, _names())
	var dice: Variant = _view.get("dice")
	if dice is Array and not _running:
		for k: int in 2:
			_dice[k].texture = _faces[clampi(int(dice[k]), 1, 6) - 1]
	var trading: bool = (
		not _running
		and not _sent
		and _me >= 0
		and _view.get("winner") == null
		and int(_view["turn"]) == _me
		and phase in ["roll", "buy", "end"]
	)
	_offer_trade.visible = trading and not _trade.visible
	if not trading:
		_trade.hide()
	_trade.call("update", _view)
	if _running or _sent or _me < 0 or _view.get("winner") != null or _trade.visible:
		return
	if Rules.decision_seat(_view) != _me:
		return
	var me: Dictionary = _player(_me)
	var cash: int = int(me["cash"])
	match phase:
		"roll":
			_offer("Roll")
			if bool(me["jailed"]):
				_offer("Bail", "Nộp %d" % Rules.BAIL, cash >= Rules.BAIL)
				if not (me["freeCards"] as Array).is_empty():
					_offer("UseCard")
		"buy":
			var price: int = Rules.price(int(_view["pending"]))
			_offer("Buy", "Mua %s" % XomDaoUi.money(price), cash >= price)
			_offer("Skip")
		"auction":
			_offer_auction(cash)
		"end":
			_offer_build(cash)
			_offer("EndTurn")
		"debt":
			var amount: int = int(_view["debt"]["amount"])
			_offer("PayDebt", "Trả %s" % XomDaoUi.money(amount), cash >= amount)
			if cash < amount:
				_offer("Bankrupt")


func _offer(button: String, label: String = "", enabled: bool = true) -> void:
	var node: XomDaoButton = _buttons[button]
	if label != "":
		node.text = label
	node.disabled = not enabled
	node.visible = true


func _offer_auction(cash: int) -> void:
	var auction: Dictionary = _view["auction"]
	var amount: int = Rules.bid_amount(_view)
	var leading: bool = auction.get("leader") != null and int(auction["leader"]) == _me
	if auction.get("seller") == null:
		_offer("Bid", "Góp %s" % XomDaoUi.money(Rules.STATION_STEP), not leading and cash >= amount)
		_offer("Pass", "Từ bỏ")
	else:
		_offer("Bid", "Trả %s" % XomDaoUi.money(amount), cash >= amount)
		_offer("Pass", "Bỏ", not leading)


func _offer_build(cash: int) -> void:
	var square: Variant = _view.get("buildable")
	if square == null or int(_player(_me)["position"]) != int(square):
		return
	var i: int = int(square)
	var deed: Dictionary = _deed(i)
	var houses: int = int(deed["houses"])
	if houses >= 5 or bool(deed["mortgaged"]) or _owner(i) != _me:
		return
	var properties: Array = _view["properties"]
	var bank: int = Rules.bank_hotels(properties) if houses == 4 else Rules.bank_houses(properties)
	var cost: int = int(Rules.SQUARES[i]["houseCost"])
	var what: String = "khách sạn" if houses == 4 else "nhà"
	_offer("Build", "Xây %s %s" % [what, XomDaoUi.money(cost)], bank > 0 and cash >= cost)


## The card over the field: the drawn card or tax, a trade offer, or the tapped square.
func _show_card() -> void:
	for action: Array in CARD_ACTIONS:
		(_buttons[str(action[0])] as Control).visible = false
	var event: Variant = _view.get("specialEvent")
	var trade: Variant = _view.get("trade")
	_card.visible = true
	if event is Dictionary and str(_view["phase"]) == "event" and not _running:
		_show_event(event)
	elif trade is Dictionary and str(_view["phase"]) == "trade":
		_show_trade(trade)
	elif _focus >= 0:
		_show_square(_focus)
	else:
		_card.visible = false


func _show_event(event: Dictionary) -> void:
	var kind: String = event["kind"]
	match kind:
		"card":
			_card_title.text = DECKS.get(str(event["deck"]), "Thẻ")
		"tax":
			_card_title.text = str(event["reason"])
		"jail":
			_card_title.text = "Vào tù"
		_:
			_card_title.text = "Sân bay"
	_card_text.text = str(_view.get("notice", ""))
	if int(_view["turn"]) == _me and not _sent:
		_offer("Confirm")


func _show_trade(trade: Dictionary) -> void:
	var from: int = int(trade["from"])
	var to: int = int(trade["to"])
	_card_title.text = "Trao đổi"
	_card_text.text = Texts.trade(trade, _names())
	if _sent:
		return
	if to == _me:
		_offer("Accept")
		_offer("Decline", "Từ chối")
	elif from == _me:
		_offer("Decline", "Huỷ")


func _show_square(i: int) -> void:
	_card_title.text = str(Rules.SQUARES[i]["name"])
	_card_text.text = Texts.square(_view, i, _names())
	if Rules.is_deed(i) and _owner(i) == _me:
		_offer_deed(i)


func _names() -> Array[String]:
	var out: Array[String] = []
	for seat: int in _slots.size():
		out.append(_seat_name(seat))
	return out


## Thế chấp, Chuộc, Bán nhà and Đấu giá for your own deed, when the rules allow them now.
func _offer_deed(i: int) -> void:
	var phase: String = _view["phase"]
	if _sent or _running or _view.get("winner") != null or phase in ["event", "trade", "auction"]:
		return
	var deed: Dictionary = _deed(i)
	var cash: int = int(_player(_me)["cash"])
	var houses: int = int(deed["houses"])
	var properties: Array = _view["properties"]
	if houses > 0 and not bool(deed["mortgaged"]):
		var back: int = int(Rules.SQUARES[i]["houseCost"] / 2)
		_offer(
			"SellHouse",
			"Bán nhà +%s" % XomDaoUi.money(back),
			houses < 5 or Rules.bank_houses(properties) >= 4
		)
	if Rules.decision_seat(_view) != _me:
		return
	if bool(deed["mortgaged"]):
		var cost: int = Rules.redeem_amount(properties, i)
		_offer("Redeem", "Chuộc %s" % XomDaoUi.money(cost), cash >= cost)
	else:
		_offer("Mortgage", "Thế chấp +%s" % XomDaoUi.money(Rules.mortgage_amount(properties, i)))
		if houses == 0:
			_offer("Auction")


# ── Board ────────────────────────────────────────────────────────────────────────────────


## A point of board.webp (fractions of its size) on this table.
func _at(fraction: Vector2) -> Vector2:
	return _board.position + fraction * _board.size


func _quad(i: int) -> PackedVector2Array:
	var out := PackedVector2Array()
	for corner: Vector2 in Rules.CELLS[i]:
		out.append(_at(corner))
	return out


## The pawn's top left when it stands on `square`: side by side, jailed ones behind the bars.
func _pawn_position(seat: int, square: int) -> Vector2:
	var u: float = 0.2 + 0.2 * seat
	var v: float = 0.62
	if square == 10:
		var jailed: bool = bool(_player(seat)["jailed"])
		u = 0.55 + 0.12 * seat if jailed else 0.15 + 0.1 * seat
		v = 0.4 if jailed else 0.85
	var foot: Vector2 = _at(Rules.cell_point(square, u, v))
	var pawn: TextureRect = _pawns[seat]
	return foot - Vector2(pawn.size.x / 2.0, pawn.size.y * 0.92)


func _place_all() -> void:
	for seat: int in _shown.size():
		_shown[seat] = int(_player(seat)["position"])
	_place_pawns()


func _place_pawns() -> void:
	if _pawns.is_empty() or _view.is_empty():
		return
	var height: float = _board.size.y * 0.085
	for seat: int in _pawns.size():
		var pawn: TextureRect = _pawns[seat]
		pawn.size = Vector2(height * 0.75, height)
		pawn.position = _pawn_position(seat, _shown[seat])
	# Lower pawns stand in front.
	var order: Array[int] = []
	for seat: int in _pawns.size():
		order.append(seat)
	order.sort_custom(
		func(a: int, b: int) -> bool: return _pawns[a].position.y < _pawns[b].position.y
	)
	for seat: int in order:
		move_child(_pawns[seat], _dice[0].get_index() - 1)


## The inner edge of square `i` (towards the field): its two corners.
# ── Layout ────────────────────────────────────────────────────────────────────────────────


func _layout() -> void:
	if not is_inside_tree():
		return
	_cloth.size = size
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var top: float = edge
	var bottom: float = size.y - edge

	# The board: its drawn part as big as the room left of the column allows, clear of ☰.
	var room_right: float = right - COLUMN - 12.0
	var ratio: float = Rules.IMAGE_RATIO
	var width: float = minf((room_right - left) / SEEN.size.x, (bottom - top) / SEEN.size.y * ratio)
	var seen_w: float = width * SEEN.size.x
	var seen_left: float = left + (room_right - left - seen_w) / 2.0
	var corner_x: float = seen_left + width * (Rules.CELLS[20][0].x - SEEN.position.x)
	var menu: float = edge + XomDaoUi.TOUCH + 8.0
	var seen_top: float = top
	if corner_x < menu:
		width = minf(width, (bottom - menu) / SEEN.size.y * ratio)
		seen_w = width * SEEN.size.x
		seen_left = left + (room_right - left - seen_w) / 2.0
		seen_top = menu
	var height: float = width / ratio
	seen_top += maxf(0.0, (bottom - seen_top - height * SEEN.size.y) / 2.0)
	_board.size = Vector2(width, height)
	_board.position = Vector2(
		seen_left - width * SEEN.position.x, seen_top - height * SEEN.position.y
	)
	_marks.position = _board.position
	_marks.size = _board.size
	for i: int in 40:
		var quad: PackedVector2Array = _quad(i)
		var low := Vector2(INF, INF)
		var high := Vector2(-INF, -INF)
		for point: Vector2 in quad:
			low = low.min(point)
			high = high.max(point)
		_squares[i].position = low
		_squares[i].size = high - low

	# The printed panel: the acting player's pawn, name and cash.
	var avatar: Vector2 = _at(
		Rules.plane_point(Vector2(Rules.PANEL_AVATAR.x, Rules.PANEL_AVATAR.y))
	)
	var radius: float = Rules.PANEL_AVATAR.z * width * 0.75
	_turn_pawn.size = Vector2.ONE * radius * 1.6
	_turn_pawn.position = avatar - _turn_pawn.size / 2.0
	var font: int = clampi(roundi(height * 0.042), XomDaoUi.TEXT_MIN, 40)
	for pair: Array in [[_turn_name, Rules.PANEL_NAME], [_turn_cash, Rules.PANEL_CASH]]:
		var label: Label = pair[0]
		label.add_theme_font_size_override("font_size", font)
		label.reset_size()
		var at: Vector2 = _at(Rules.plane_point(pair[1]))
		label.size.x = width * 0.25
		label.position = Vector2(at.x, at.y - label.size.y / 2.0)

	# The field: notice on top, the dice, your actions at the bottom.
	var field_top: Vector2 = _at(Rules.plane_point(Rules.FIELD.position))
	var field_end: Vector2 = _at(Rules.plane_point(Rules.FIELD.end))
	var field_right: Vector2 = _at(
		Rules.plane_point(Vector2(Rules.FIELD.end.x, Rules.FIELD.position.y))
	)
	_field = Rect2(field_top, Vector2(field_right.x - field_top.x, field_end.y - field_top.y))
	_notice.size = Vector2(_field.size.x - 24.0, 0.0)
	_notice.reset_size()
	_notice.size.x = _field.size.x - 24.0
	_notice.position = Vector2(_field.position.x + 12.0, _field.position.y + 8.0)
	_row.reset_size()
	_row.position = Vector2(
		_field.get_center().x - _row.size.x / 2.0, _field.end.y - _row.size.y - 10.0
	)
	_status.size = Vector2(_field.size.x - 24.0, 0.0)
	_status.reset_size()
	_status.size.x = _field.size.x - 24.0
	_status.position = Vector2(_field.position.x + 12.0, _row.position.y - _status.size.y - 2.0)
	var die: float = clampf(_field.size.y * 0.3, 44.0, 96.0)
	var dice_top: float = _notice.position.y + _notice.size.y
	var dice_bottom: float = _status.position.y
	var dice_y: float = (dice_top + dice_bottom - die) / 2.0
	for k: int in 2:
		_dice[k].size = Vector2.ONE * die
		_dice[k].pivot_offset = Vector2.ONE * die / 2.0
		_dice[k].position = Vector2(_field.get_center().x + (k - 1) * (die + 10.0) + 5.0, dice_y)

	# The card: over the field, a little wider than it.
	var card_width: float = clampf(_field.size.x + 40.0, 360.0, 560.0)
	_card_text.custom_minimum_size.x = card_width - 32.0
	_card.custom_minimum_size.x = card_width
	_card.size = Vector2.ZERO
	_card.reset_size()
	_card.position = Vector2(
		clampf(_field.get_center().x - _card.size.x / 2.0, left, right - _card.size.x),
		clampf(_field.get_center().y - _card.size.y / 2.0, top, bottom - _card.size.y)
	)

	# Trao đổi: top right; its board over the middle of the table.
	_offer_trade.reset_size()
	_offer_trade.position = Vector2(right - _offer_trade.size.x, top)
	_trade.custom_minimum_size.x = 560.0
	_trade.size = Vector2.ZERO
	_trade.reset_size()
	var middle: Vector2 = _board.position + _board.size * Vector2(0.5, 0.46)
	_trade.position = Vector2(
		clampf(middle.x - _trade.size.x / 2.0, left, right - _trade.size.x),
		clampf(middle.y - _trade.size.y / 2.0, top, bottom - _trade.size.y)
	)

	# The slots: a column on the right, yours at the bottom, the others above in turn order.
	var count: int = _slots.size()
	var y: float = bottom
	for k: int in count:
		var seat: int = (maxi(_me, 0) - k + count) % count if _me >= 0 else count - 1 - k
		var slot: XomDaoPlayerSlot = _slots[seat]
		slot.reset_size()
		y -= slot.size.y
		slot.position = Vector2(right - slot.size.x, y)
		y -= 12.0
	if not _running:
		_place_pawns()
