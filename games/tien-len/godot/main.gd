extends Control
## Tiến Lên on the Godot client, in the **Bàn** layout (docs/experience.md): a sedge mat, the
## others' seats at the sides and across, your cards at the bottom and Đánh / Bỏ lượt at the
## bottom right. It draws `snapshot.view` (the View in src/game/model.ts: your hand and the
## others' card counts) and sends `play {cards}` and `pass`. The hub adds this scene when the
## room's game starts, calls `bind` and draws the menu, the room and the final result.
##
## Plays fly to the pile in the middle; bombs and 2s get big words and their own sound. Named
## nodes for tests: Hand (Card_<n>), PlayCards, Pass, Status, Seat_<seat>, RoundBoard.

const Rules := preload("res://content/tien-len/rules.gd")
const CardView := preload("res://content/tien-len/card.gd")
const HandView := preload("res://content/tien-len/hand.gd")

## Where each seat sits, from yours (bottom) round the table, by how many play.
const SLOTS: Dictionary = {
	1: ["bottom"],
	2: ["bottom", "top"],
	3: ["bottom", "right", "left"],
	4: ["bottom", "right", "top", "left"],
}
const ROUND_PLACES: Array[String] = ["Nhất", "Nhì", "Ba", "Bét"]
const PLACE_COLORS: Array[Color] = [
	Color("#FFD84A"), Color("#E3ECF5"), Color("#F0A868"), Color("#FF9D9D")
]
const SOUNDS: Array[String] = [
	"bomb",
	"card-play",
	"combo",
	"deal",
	"last-card",
	"pass",
	"special-cut",
	"special-hand",
	"trick-clear",
	"turn",
	"win",
]
## The deal on screen, as in src/game/model.ts (DEAL, INTRO): the server starts play after it.
const DEAL_SHUFFLE := 0.76
const DEAL_STEP := 0.028
const DEAL_FLY := 0.24
const INTRO_ROUND := 1.2
## How wide one tile of mat.webp (512 px) lies on the table, in units.
const MAT_TILE := 220.0
const CARD_WIDTH := 84.0
const PILE_CARD := 72.0
const BUTTON_WIDTH := 200.0
const THROW_SECONDS := 0.23
const RED := Color("#B0261E")
const GREEN := Color("#26683A")

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your seat, or -1 for a spectator (who looks from seat 0).
var _me: int = -1

var _mat := TextureRect.new()
var _pattern := Control.new()
var _pile := Control.new()
var _fx := Control.new()
var _hand: HandView
var _status := Label.new()
var _play: XomDaoButton = XomDaoButton.create("Đánh", XomDaoUi.Kind.CONFIRM)
var _pass: XomDaoButton = XomDaoButton.create("Bỏ lượt", XomDaoUi.Kind.DANGER)
var _round_board: XomDaoBoard = XomDaoBoard.create("")
var _slots: Array[XomDaoPlayerSlot] = []
var _stamps: Array[Label] = []
var _sounds: Dictionary = {}

## What the last view showed, to tell what changed.
var _round: int = 0
var _phase: String = ""
var _played: int = 0
var _pile_trick: int = -1
var _passed: Array = []
var _counts: Array = []
var _out: Array = []
var _turn: int = -1
## Play is held until the deal on screen is over.
var _dealing: bool = false


## Options for a sandbox room (`?play=tien-len` in a debug build): three computer players.
func sandbox_options() -> Dictionary:
	return {"bots": 3, "rounds": 3}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	return [
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3]],
		},
		{
			"key": "level",
			"label": "Máy chơi",
			"options": [["Dễ", "easy"], ["Vừa", "normal"], ["Khó", "hard"]],
			"default": 1,
		},
		{
			"key": "rounds",
			"label": "Số vòng",
			"options": [["1", 1], ["3", 3], ["5", 5], ["10", 10]],
			"default": 2,
		},
		{
			"key": "turnSeconds",
			"label": "Giây mỗi lượt",
			"options": [["15", 15], ["20", 20], ["30", 30]],
			"default": 1,
		},
	]


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	var sea := ColorRect.new()
	sea.color = Color("#C9A86A")
	sea.set_anchors_preset(Control.PRESET_FULL_RECT)
	sea.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(sea)
	_mat.texture = load("res://content/tien-len/art/mat.webp")
	_mat.stretch_mode = TextureRect.STRETCH_TILE
	_mat.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	_mat.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mat.scale = Vector2.ONE * MAT_TILE / 512.0
	add_child(_mat)
	_pattern.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_pattern.draw.connect(_draw_pattern)
	add_child(_pattern)
	_pile.name = "Pile"
	_pile.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_pile)

	_status.name = "Status"
	_status.theme_type_variation = "HudLabel"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.add_theme_font_override("font", XomDaoUi.display_font(800))
	_status.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	_status.add_theme_color_override("font_color", XomDaoUi.CREAM)
	_status.add_theme_color_override("font_outline_color", XomDaoUi.INK)
	_status.add_theme_constant_override("outline_size", 8)
	add_child(_status)

	_hand = HandView.new()
	_hand.picked_changed.connect(_refresh_buttons)
	add_child(_hand)
	_play.name = "PlayCards"
	_play.pressed.connect(_on_play)
	add_child(_play)
	_pass.name = "Pass"
	_pass.pressed.connect(_on_pass)
	add_child(_pass)

	_round_board.name = "RoundBoard"
	_round_board.visible = false
	_round_board.content.add_theme_constant_override("separation", 6)
	add_child(_round_board)
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)

	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/tien-len/sounds/%s.wav" % sound)
		player.max_polyphony = 3
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	_view = view
	_me = -1
	for i: int in snapshot.seats.size():
		if snapshot.seats[i].id == _client.player_id:
			_me = i
	var count: int = (view["counts"] as Array).size()
	if count != _slots.size():
		_build_seats(count)
	var round_number: int = int(view["round"])
	var phase: String = str(view["phase"])
	var played: Array = view["played"]
	var new_round: bool = (
		round_number != _round or (phase == "deal" and _phase != "deal") or played.size() < _played
	)
	if new_round:
		_start_round(view)
	else:
		# Where your cards were before they left the hand: the plays fly from there.
		var from: Dictionary = {}
		for card: int in _hand.cards:
			var card_view: Control = _hand.view_of(card)
			if card_view != null:
				from[card] = card_view.global_position
		for i: int in range(_played, played.size()):
			_throw(played[i], played[i - 1] if i > 0 else {}, from)
		_hand.set_cards(_ints(view["hand"]))
		if view["table"] == null and _pile.get_child_count() > 0 and played.size() == _played:
			_sweep()
		_follow_seats(view)
	_round = round_number
	_phase = phase
	_played = played.size()
	_passed = (view["passed"] as Array).duplicate()
	_counts = (view["counts"] as Array).duplicate()
	_out = (view["out"] as Array).duplicate()
	var turn: int = int(view["turn"]) if phase == "play" else -1
	if turn != _turn and turn == _me and turn >= 0 and not _dealing:
		_sfx("turn")
	_turn = turn
	_show_seats()
	_show_round_board()
	_refresh_buttons()
	# Names and card counts change the seats' widths.
	_layout()


## A new round: the pile is cleared and the hand is dealt again.
func _start_round(view: Dictionary) -> void:
	for child: Node in _pile.get_children():
		child.queue_free()
	_pile_trick = -1
	_hand.clear_picks()
	_hand.set_cards(_ints(view["hand"]))
	var dealt: int = 0
	for seat_count: Variant in view["counts"]:
		dealt += int(seat_count)
	if str(view["phase"]) != "deal":
		# Joined (or came back) mid-round: show it as it is.
		_dealing = false
		_follow_seats(view)
		return
	_dealing = true
	_sfx("deal")
	# After the layout: the hand needs its size to know where the cards go.
	_deal.call_deferred(dealt)
	var deal_seconds: float = DEAL_SHUFFLE + dealt * DEAL_STEP + DEAL_FLY + 0.22
	var timer: SceneTreeTimer = get_tree().create_timer(deal_seconds)
	timer.timeout.connect(
		_announce.bind(int(view["round"]), int(view["rounds"]), int(view["lead"]))
	)
	_follow_seats(view)


func _announce(round_number: int, rounds: int, lead: int) -> void:
	if not is_inside_tree():
		return
	var middle: Vector2 = _pile.position
	if rounds > 1:
		_callout("Vòng %d" % round_number, middle, 56, XomDaoUi.GOLD)
	var timer: SceneTreeTimer = get_tree().create_timer(INTRO_ROUND if rounds > 1 else 0.0)
	await timer.timeout
	if not is_inside_tree():
		return
	var who: String = "Bạn đi trước" if lead == _me else "%s đi trước" % _seat_name(lead)
	_callout(who, middle, 40, XomDaoUi.CREAM)
	_dealing = false
	if int(_view.get("turn", -1)) == _me and str(_view.get("phase", "")) == "play":
		_sfx("turn")
	_refresh_buttons()


func _deal(dealt: int) -> void:
	var step: float = DEAL_STEP * maxf(1.0, dealt / 13.0)
	_hand.deal(_pile.position - _hand.position, DEAL_SHUFFLE, step, DEAL_FLY)


## A play lands on the pile: thrown from the seat (or from your hand), then the slap, and big
## words for special plays. `from` holds where your cards were in the hand.
func _throw(play: Dictionary, before: Dictionary, from: Dictionary) -> void:
	var trick: int = int(play["trick"])
	if trick != _pile_trick:
		_sweep()
		_pile_trick = trick
	for child: Node in _pile.get_children():
		if child is CardView and not child.is_queued_for_deletion():
			(child as CardView).dim = true
	var cards: Array[int] = _ints(play["cards"])
	cards.sort()
	var index: int = _pile.get_child_count()
	var seat: int = int(play["seat"])
	var source: Vector2 = _seat_center(seat) - _pile.position
	var angle: float = deg_to_rad(float((index * 7) % 11 - 5))
	var offset := Vector2(float((index * 5) % 7 - 3) * 6.0, float((index * 3) % 5 - 2) * 5.0)
	var step: float = PILE_CARD * 0.42
	var width: float = PILE_CARD + step * (cards.size() - 1)
	for i: int in cards.size():
		var card_view: CardView = CardView.create(cards[i], PILE_CARD) as CardView
		card_view.name = "Pile_%d" % cards[i]
		_pile.add_child(card_view)
		var target: Vector2 = (
			offset + Vector2(-width / 2.0 + step * i, -card_view.size.y / 2.0).rotated(angle)
		)
		if from.has(cards[i]):
			card_view.global_position = from[cards[i]]
			card_view.scale = Vector2.ONE * CARD_WIDTH / PILE_CARD
		else:
			card_view.position = source - card_view.size / 2.0
			card_view.scale = Vector2.ONE * 0.5
		var tween: Tween = card_view.create_tween().set_parallel()
		(
			tween
			. tween_property(card_view, "position", target, THROW_SECONDS)
			. set_trans(Tween.TRANS_QUAD)
			. set_ease(Tween.EASE_OUT)
		)
		tween.tween_property(card_view, "scale", Vector2.ONE, THROW_SECONDS)
		tween.tween_property(card_view, "rotation", angle, THROW_SECONDS)
	var hit: Dictionary = Rules.impact(play, before)
	var timer: SceneTreeTimer = get_tree().create_timer(THROW_SECONDS)
	timer.timeout.connect(_land.bind(hit))


func _land(hit: Dictionary) -> void:
	if not is_inside_tree():
		return
	_sfx(str(hit["sound"]))
	if bool(hit["bomb"]):
		_shake()
	if str(hit["words"]) != "":
		_callout(str(hit["words"]), _pile.position - Vector2(0, PILE_CARD * 1.6), 52, hit["color"])


## The trick is over: its cards slide off the table.
func _sweep() -> void:
	var cards: Array[Node] = _pile.get_children().filter(
		func(child: Node) -> bool: return not child.is_queued_for_deletion()
	)
	if cards.is_empty():
		return
	_sfx("trick-clear")
	var away := Vector2(size.x * 0.5 + PILE_CARD * 2.0, -PILE_CARD)
	for i: int in cards.size():
		var card_view: CardView = cards[i]
		card_view.name = "Swept_%d" % i
		var tween: Tween = card_view.create_tween()
		tween.tween_interval(0.03 * i)
		tween.tween_property(card_view, "position", card_view.position + away, 0.35).set_trans(
			Tween.TRANS_QUAD
		)
		tween.tween_callback(card_view.queue_free)


## Words for the seats: who passed, who is down to one card, who went out.
func _follow_seats(view: Dictionary) -> void:
	var passed: Array = view["passed"]
	var counts: Array = view["counts"]
	var out: Array = view["out"]
	for seat: int in counts.size():
		if seat < passed.size() and bool(passed[seat]) and not _was(_passed, seat):
			_sfx("pass")
		var cards: int = int(counts[seat])
		var before: int = int(_counts[seat]) if seat < _counts.size() else 0
		if cards == 1 and before > 1 and str(view["phase"]) == "play":
			_sfx("last-card")
			_callout("Còn 1 lá!", _seat_spot(seat), 34, Color("#FF9D4A"))
	for i: int in range(_out.size(), out.size()):
		var seat: int = int(out[i])
		var place: String = _place_name(i, _in_round(view))
		if seat == _me and i == 0:
			_sfx("win")
		_callout(
			"Về %s!" % place.to_lower(), _seat_spot(seat), 40, _place_color(i, _in_round(view))
		)


func _was(list: Array, seat: int) -> bool:
	return seat < list.size() and bool(list[seat])


func _in_round(view: Dictionary) -> int:
	var count: int = 0
	for dealt: Variant in view["inRound"]:
		if bool(dealt):
			count += 1
	return count


func _place_name(place: int, players: int) -> String:
	if place == players - 1 and players > 1:
		return "Bét"
	return ROUND_PLACES[mini(place, ROUND_PLACES.size() - 1)]


func _place_color(place: int, players: int) -> Color:
	return PLACE_COLORS[3 if place == players - 1 and players > 1 else mini(place, 3)]


## Seats: names, cards left, the turn ring (with the clock when the room has one) and stamps.
func _show_seats() -> void:
	var counts: Array = _view["counts"]
	var passed: Array = _view["passed"]
	var out: Array = _view["out"]
	var gone: Array = _view["gone"]
	var phase: String = str(_view["phase"])
	var timer: XomDaoRoomTimer = _snapshot.timer
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		var info: XomDaoPlayerInfo = (
			_snapshot.seats[seat] if seat < _snapshot.seats.size() else XomDaoPlayerInfo.new()
		)
		slot.player_name = _seat_name(seat)
		slot.host = info.id == str(_snapshot.host_id)
		slot.extra = "%d lá" % int(counts[seat]) if seat != _me and int(counts[seat]) > 0 else ""
		var on_turn: bool = (
			_snapshot.status == "playing" and phase == "play" and int(_view["turn"]) == seat
		)
		if on_turn and timer != null and timer.event == "turn-over" and timer.ms > 0.0:
			slot.start_turn(timer.ms / 1000.0, (timer.ms - timer.left) / 1000.0)
		elif on_turn and not slot.is_turn():
			slot.show_turn()
		elif not on_turn and slot.is_turn():
			slot.end_turn()
		var stamp: Label = _stamps[seat]
		stamp.visible = true
		if gone.has(seat):
			_stamp(stamp, "Rời bàn", Color("#6B6B6B"), XomDaoUi.CREAM)
		elif out.has(seat):
			var place: int = out.find(seat)
			var players: int = _in_round(_view)
			_stamp(stamp, _place_name(place, players), _place_color(place, players), XomDaoUi.INK)
		elif seat < passed.size() and bool(passed[seat]) and phase == "play":
			_stamp(stamp, "Bỏ lượt", XomDaoUi.LACQUER, XomDaoUi.CREAM)
		else:
			stamp.visible = false
	if _snapshot.status != "playing":
		_status.text = ""
	elif phase == "play" and int(_view["turn"]) == _me:
		_status.text = "Lượt bạn"
	elif phase == "play":
		_status.text = "Lượt %s" % _seat_name(int(_view["turn"]))
	elif int(_view["rounds"]) > 1:
		_status.text = "Vòng %d/%d" % [int(_view["round"]), int(_view["rounds"])]
	else:
		_status.text = ""


func _stamp(stamp: Label, text: String, fill: Color, ink: Color) -> void:
	stamp.text = text
	stamp.add_theme_color_override("font_color", ink)
	var box: StyleBoxFlat = XomDaoUi.box(fill, XomDaoUi.INK, 2, 12.0)
	box.content_margin_left = 12.0
	box.content_margin_right = 12.0
	stamp.add_theme_stylebox_override("normal", box)
	stamp.reset_size()
	stamp.pivot_offset = stamp.size / 2.0


## Between rounds: the round's ranking with the points it gave and the match total.
func _show_round_board() -> void:
	var results: Array = _view["results"]
	var show: bool = (
		_snapshot.status == "playing" and str(_view["phase"]) == "over" and not results.is_empty()
	)
	if show == _round_board.visible:
		return
	_round_board.visible = show
	if not show:
		return
	for child: Node in _round_board.content.get_children():
		child.queue_free()
	var result: Dictionary = results[results.size() - 1]
	_round_board.title = "Hết vòng %d" % int(_view["round"])
	var order: Array = result["order"]
	var points: Array = result["points"]
	var totals: Array = _view["points"]
	for place: int in order.size():
		var seat: int = int(order[place])
		var row := HBoxContainer.new()
		row.name = "Rank_%d" % place
		row.add_theme_constant_override("separation", 16)
		var rank := Label.new()
		rank.text = _place_name(place, order.size())
		rank.custom_minimum_size.x = 80.0
		rank.add_theme_color_override(
			"font_color", _place_color(place, order.size()).darkened(0.45)
		)
		row.add_child(rank)
		var who := Label.new()
		who.text = _seat_name(seat)
		who.custom_minimum_size.x = 200.0
		who.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		row.add_child(who)
		var gained := Label.new()
		gained.text = "+%d" % int(points[seat])
		gained.custom_minimum_size.x = 56.0
		gained.add_theme_color_override("font_color", XomDaoUi.UP_ON_PAPER)
		row.add_child(gained)
		var total := Label.new()
		total.text = "%d điểm" % int(totals[seat])
		row.add_child(total)
		_round_board.content.add_child(row)
	_layout.call_deferred()


func _refresh_buttons() -> void:
	if _view.is_empty() or _snapshot == null:
		_play.disabled = true
		_pass.disabled = true
		return
	var mine: bool = (
		_snapshot.status == "playing"
		and str(_view["phase"]) == "play"
		and int(_view["turn"]) == _me
		and _me >= 0
		and not _dealing
	)
	var table: Dictionary = {}
	if _view["table"] is Dictionary:
		table = Rules.combo_of((_view["table"] as Dictionary)["cards"])
	var combo: Dictionary = Rules.combo_of(_hand.picked)
	var must: Variant = _view.get("mustPlay")
	var has_must: bool = must == null or _hand.picked.has(int(must))
	_play.disabled = not (mine and Rules.beats(combo, table) and has_must)
	_pass.disabled = not (mine and not table.is_empty())
	_play.visible = _me >= 0
	_pass.visible = _me >= 0


func _on_play() -> void:
	var cards: Array[int] = _hand.picked.duplicate()
	if cards.is_empty():
		return
	_play.disabled = true
	await _client.send("play", {"cards": cards})


func _on_pass() -> void:
	_pass.disabled = true
	_hand.clear_picks()
	await _client.send("pass")


## Builds a slot and a stamp per seat.
func _build_seats(count: int) -> void:
	for slot: XomDaoPlayerSlot in _slots:
		slot.queue_free()
	for stamp: Label in _stamps:
		stamp.queue_free()
	_slots.clear()
	_stamps.clear()
	for seat: int in count:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % seat
		slot.compact = true
		add_child(slot)
		move_child(slot, _hand.get_index())
		_slots.append(slot)
		var stamp := Label.new()
		stamp.name = "Stamp_%d" % seat
		stamp.visible = false
		stamp.rotation = deg_to_rad(-8.0)
		stamp.add_theme_font_override("font", XomDaoUi.display_font(800))
		stamp.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
		stamp.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(stamp)
		move_child(stamp, _hand.get_index())
		_stamps.append(stamp)
	_layout.call_deferred()


func _slot_of(seat: int) -> String:
	var count: int = _slots.size()
	var places: Array = SLOTS.get(count, SLOTS[4])
	var from: int = maxi(_me, 0)
	return str(places[posmod(seat - from, count) % places.size()])


func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - edge
	var top: float = edge
	var bottom: float = size.y - edge
	_mat.size = size / _mat.scale
	_pattern.size = size
	_pattern.queue_redraw()

	# Action buttons, bottom right: Đánh over Bỏ lượt.
	for button: XomDaoButton in [_play, _pass]:
		button.custom_minimum_size = Vector2(BUTTON_WIDTH, XomDaoUi.TOUCH)
		button.reset_size()
	_pass.position = Vector2(right - BUTTON_WIDTH, bottom - _pass.size.y)
	_play.position = Vector2(right - BUTTON_WIDTH, _pass.position.y - 12.0 - _play.size.y)

	# Seats. The ☰ menu keeps the top-left square: the left seat sits below it.
	var top_bottom: float = top
	var side_y: float = size.y * 0.42
	var my_right: float = left
	for seat: int in _slots.size():
		var slot: XomDaoPlayerSlot = _slots[seat]
		slot.reset_size()
		var box: Vector2 = slot.get_combined_minimum_size()
		match _slot_of(seat):
			"bottom":
				slot.position = Vector2(left, bottom - box.y)
				my_right = left + box.x
			"top":
				slot.position = Vector2((size.x - box.x) / 2.0, top)
				top_bottom = top + box.y
			"left":
				slot.position = Vector2(
					left, maxf(top + XomDaoUi.TOUCH + 16.0, side_y - box.y / 2.0)
				)
			"right":
				slot.position = Vector2(right - box.x, side_y - box.y / 2.0)
		var stamp: Label = _stamps[seat]
		stamp.reset_size()
		stamp.position = slot.position + Vector2(box.x * 0.5, box.y * 0.62) - stamp.size / 2.0

	# The hand between your seat and the buttons.
	var hand_left: float = my_right + 16.0
	var hand_right: float = _play.position.x - 16.0
	var hand_height: float = CARD_WIDTH * CardView.RATIO * (1.0 + HandView.LIFT)
	_hand.position = Vector2(hand_left, bottom - hand_height)
	_hand.size = Vector2(maxf(CARD_WIDTH, hand_right - hand_left), hand_height)
	_hand.card_width = CARD_WIDTH
	_status.reset_size()
	_status.position = Vector2((size.x - _status.size.x) / 2.0, _hand.position.y - _status.size.y)

	var pile_y: float = (maxf(top_bottom, top + XomDaoUi.TOUCH) + _status.position.y) / 2.0
	_pile.position = Vector2(size.x / 2.0, pile_y)
	_round_board.reset_size()
	_round_board.position = (Vector2(size.x / 2.0, pile_y) - _round_board.size / 2.0)


func _draw_pattern() -> void:
	# A red band and a thin green one woven into the mat around the play area, a flower in each
	# corner (src/scenes/Mat.ts).
	var edge: float = float(XomDaoSettings.current().margin) + 8.0
	var frame := Rect2(Vector2(edge, edge), size - Vector2(edge, edge) * 2.0)
	_pattern.draw_rect(frame, Color(RED, 0.55), false, 10.0)
	_pattern.draw_rect(frame.grow(-17.0), Color(GREEN, 0.5), false, 4.0)
	for corner: Vector2 in [
		frame.position + Vector2(48, 48),
		Vector2(frame.end.x - 48, frame.position.y + 48),
		Vector2(frame.position.x + 48, frame.end.y - 48),
		frame.end - Vector2(48, 48),
	]:
		var points := PackedVector2Array(
			[
				corner + Vector2(0, -22),
				corner + Vector2(22, 0),
				corner + Vector2(0, 22),
				corner + Vector2(-22, 0)
			]
		)
		_pattern.draw_colored_polygon(points, Color(GREEN, 0.3))
		points.append(points[0])
		_pattern.draw_polyline(points, Color(RED, 0.55), 3.0, true)
	var light := Color(1.0, 0.95, 0.8, 0.12)
	_pattern.draw_circle(size / 2.0, minf(size.x, size.y) * 0.32, light)


## The middle of a seat's slot (for cards thrown from it).
func _seat_center(seat: int) -> Vector2:
	if seat < 0 or seat >= _slots.size():
		return _pile.position
	var slot: XomDaoPlayerSlot = _slots[seat]
	return slot.position + slot.size / 2.0


## Where a seat's words pop up: towards the middle from its slot.
func _seat_spot(seat: int) -> Vector2:
	var at: Vector2 = _seat_center(seat)
	return at.lerp(_pile.position, 0.35)


func _seat_name(seat: int) -> String:
	if seat == _me and _me >= 0:
		return "Bạn"
	if _snapshot != null and seat >= 0 and seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "?"


## Big words that spring in over the table, hold, then float up and fade.
func _callout(text: String, at: Vector2, font_size: int, color: Color) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_outline_color", XomDaoUi.INK)
	label.add_theme_constant_override("outline_size", 12)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.add_child(label)
	label.reset_size()
	var width: float = minf(label.size.x, size.x - 32.0)
	label.position = Vector2(clampf(at.x - width / 2.0, 16.0, size.x - 16.0 - width), at.y)
	label.position.y -= label.size.y / 2.0
	label.pivot_offset = label.size / 2.0
	label.scale = Vector2.ONE * 0.2
	label.modulate.a = 0.0
	var tween: Tween = label.create_tween()
	tween.set_parallel()
	tween.tween_property(label, "scale", Vector2.ONE * 1.15, 0.2).set_trans(Tween.TRANS_BACK)
	tween.tween_property(label, "modulate:a", 1.0, 0.15)
	tween.chain().tween_property(label, "scale", Vector2.ONE, 0.11)
	tween.chain().tween_interval(0.65)
	tween.chain().tween_property(label, "position:y", label.position.y - 36.0, 0.38)
	tween.tween_property(label, "modulate:a", 0.0, 0.38)
	tween.chain().tween_callback(label.queue_free)


func _shake() -> void:
	var home: Vector2 = _pile.position
	var tween: Tween = _pile.create_tween()
	for i: int in 5:
		var push := Vector2(randf_range(-6.0, 6.0), randf_range(-4.0, 4.0))
		tween.tween_property(_pile, "position", home + push, 0.04)
	tween.tween_property(_pile, "position", home, 0.05)


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


static func _ints(list: Variant) -> Array[int]:
	var out: Array[int] = []
	if list is Array:
		for value: Variant in list:
			out.append(int(value))
	return out
