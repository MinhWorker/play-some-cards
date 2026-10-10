extends Control
## Bài Cào on the Godot client, in the **Bàn** layout (docs/experience.md): the sedge mat
## (XomDaoMat), you at the bottom with your three cards in the middle, the others round the
## table with theirs; the round, the dealer and the phase at the top; Cược 5 / 10 / 20 and Lật
## bài at the bottom right. It draws `snapshot.view` (View in src/game/model.ts: everyone's bets,
## points and turned-over cards, and your own cards) and sends `bet {amount}` and `reveal`.
##
## Your cards come face down. Tap one to open it, or drag it up (or right) to squeeze it: the back
## slides off and shows the face bit by bit; let go early and it covers up again. Lật bài turns
## all three over for everyone. At the count each hand's name and the points won or lost show at
## its seat, and the chips fly between the dealer and the players.
##
## Named nodes for tests: Mine_<k> (your cards), Card_<seat>_<k>, Seat_<seat>, Bet_5, Bet_10,
## Bet_20, Reveal, Round, Dealer, Status, Info, Countdown.

const Rules := preload("res://content/bai-cao/rules.gd")

## Where each seat sits, from yours (bottom) round the table, by how many play.
const SLOTS: Dictionary = {
	1: ["bottom"],
	2: ["bottom", "top"],
	3: ["bottom", "topLeft", "topRight"],
	4: ["bottom", "left", "top", "right"],
	5: ["bottom", "left", "topLeft", "topRight", "right"],
	6: ["bottom", "left", "topLeft", "top", "topRight", "right"],
}
const BETS: Array[int] = [5, 10, 20]
const PHASES: Array[String] = ["bet", "reveal", "showdown"]
const PHASE_NAMES: Array[String] = ["Cược", "Nặn bài", "So bài"]
const SOUNDS: Array[String] = [
	"ba-tay", "chip", "deal", "end", "lose", "peek", "reveal", "tick", "win"
]
const MY_CARD := 104.0
const THEIR_CARD := 54.0
const BUTTON_WIDTH := 190.0
const GOLD := Color("#FFD54F")
const PALE := Color("#FFE8A3")
const WIN := Color("#8DFF8A")
const LOSE := Color("#FF8A80")
## How far a drag must go (in card heights) to open a card.
const SQUEEZE_OPEN := 0.52

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your seat, or -1 for a spectator (who looks from seat 0).
var _me: int = -1

var _mat := XomDaoMat.new()
var _round_label := Label.new()
var _dealer_label := Label.new()
var _phases: Array[Label] = []
var _phase_row := HBoxContainer.new()
var _status := Label.new()
var _info := Label.new()
var _countdown := Label.new()
var _bets: Array[XomDaoButton] = []
var _reveal: XomDaoButton = XomDaoButton.create("Lật bài", XomDaoUi.Kind.PLAY)
var _fx := Control.new()
var _sounds: Dictionary = {}
var _textures: Dictionary = {}

## One entry per seat: slot, cards, chip, dealer badge, hand name, points won or lost.
var _seats: Array[Dictionary] = []
## Your three cards: each a clip box holding the face and the back that slides off it.
var _mine: Array[Control] = []
var _mine_faces: Array[XomDaoCard] = []
var _mine_backs: Array[XomDaoCard] = []
## Cards you opened this round, and the card being squeezed (-1 none) with where it started.
var _peeked: Array[int] = []
var _squeezing: int = -1
var _squeeze_from := Vector2.ZERO
var _squeeze_moved: float = 0.0
var _squeeze_progress: float = 0.0

## What the last view showed, to tell what changed.
var _round: int = -1
var _phase: String = ""
var _bets_seen: Array = []
var _revealed_seen: Array = []
var _shown: Array[String] = []
var _ended: bool = false
var _tick: int = -1
## When the last snapshot came (ms), to count its timer down.
var _shown_at: int = 0
var _center := Vector2.ZERO


## Options for a sandbox room (`?play=bai-cao` in a debug build): three computer players.
func sandbox_options() -> Dictionary:
	return {"bots": 3, "rounds": 5}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	return [
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3], ["4", 4], ["5", 5]],
		},
		{
			"key": "rounds",
			"label": "Số ván",
			"options": [["5", 5], ["10", 10], ["20", 20]],
			"default": 1
		},
	]


## The figures for the hub's result board.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty():
		return {}
	return {"reason": "Sau %d ván" % int(_view["rounds"]), "rows": []}


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	clip_contents = true
	add_child(_mat)
	for label: Label in [_round_label, _dealer_label, _status, _info, _countdown]:
		_hud(label, XomDaoUi.TEXT_MIN)
		add_child(label)
	_round_label.name = "Round"
	_dealer_label.name = "Dealer"
	_dealer_label.add_theme_color_override("font_color", PALE)
	_status.name = "Status"
	_status.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	_info.name = "Info"
	_countdown.name = "Countdown"
	_countdown.add_theme_color_override("font_color", PALE)
	_phase_row.add_theme_constant_override("separation", 18)
	_phase_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_phase_row)
	for text: String in PHASE_NAMES:
		var phase := Label.new()
		phase.text = text
		_hud(phase, XomDaoUi.TEXT_MIN)
		_phase_row.add_child(phase)
		_phases.append(phase)
	for amount: int in BETS:
		var button: XomDaoButton = XomDaoButton.create("Cược %d" % amount, XomDaoUi.Kind.SOCIAL)
		button.name = "Bet_%d" % amount
		button.pressed.connect(_on_bet.bind(amount))
		button.custom_minimum_size = Vector2(BUTTON_WIDTH, XomDaoUi.TOUCH)
		add_child(button)
		_bets.append(button)
	_reveal.name = "Reveal"
	_reveal.pressed.connect(_on_reveal)
	_reveal.custom_minimum_size = Vector2(BUTTON_WIDTH, XomDaoUi.TOUCH)
	add_child(_reveal)
	for k: int in 3:
		var box := Control.new()
		box.name = "Mine_%d" % k
		box.clip_contents = true
		box.mouse_filter = Control.MOUSE_FILTER_STOP
		box.gui_input.connect(_on_mine_input.bind(k))
		add_child(box)
		var face := XomDaoCard.new()
		box.add_child(face)
		var back := XomDaoCard.new()
		box.add_child(back)
		_mine.append(box)
		_mine_faces.append(face)
		_mine_backs.append(back)
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		player.stream = load("res://content/bai-cao/sounds/%s.wav" % sound)
		player.max_polyphony = 4
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


func _process(_delta: float) -> void:
	_show_countdown()


static func _hud(label: Label, font_size: int) -> void:
	label.theme_type_variation = "HudLabel"
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	label.add_theme_color_override("font_outline_color", XomDaoUi.INK)
	label.add_theme_constant_override("outline_size", 8)


func _art(name_of: String) -> Texture2D:
	if not _textures.has(name_of):
		_textures[name_of] = load("res://content/bai-cao/art/%s.webp" % name_of)
	return _textures[name_of]


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	_snapshot = snapshot
	_shown_at = Time.get_ticks_msec()
	if snapshot.view is not Dictionary:
		return
	var view: Dictionary = snapshot.view
	var live: bool = not _view.is_empty()
	_view = view
	_me = -1
	for i: int in snapshot.seats.size():
		if snapshot.seats[i].id == _client.player_id:
			_me = i
	var count: int = (view["points"] as Array).size()
	if count != _seats.size():
		_build_seats(count)
		_layout()
	var round_number: int = int(view["round"])
	var phase: String = str(view["phase"])
	if round_number != _round:
		_new_round()
	if live:
		_present(view, phase, round_number)
	_round = round_number
	_phase = phase
	_bets_seen = (view["bets"] as Array).duplicate()
	_revealed_seen = (view["revealed"] as Array).duplicate()
	_show_seats(live)
	_show_mine()
	_show_hud()
	var ended: bool = snapshot.result != null
	if ended and not _ended and live:
		_sfx("end")
	_ended = ended
	_layout()


## A new round: every card face down again, nothing peeked.
func _new_round() -> void:
	_peeked.clear()
	_squeezing = -1
	_shown.clear()
	for seat: Dictionary in _seats:
		_shown.append("")
		(seat["delta"] as Label).text = ""
		(seat["hand"] as Label).text = ""
		for card: XomDaoCard in seat["cards"]:
			card.show_face("", 0)
			card.rotation = 0.0
			card.modulate.a = 1.0
	for k: int in 3:
		_mine_backs[k].position = Vector2.ZERO
		_mine_backs[k].visible = true


## Sounds and moves for what changed since the last view.
func _present(view: Dictionary, phase: String, round_number: int) -> void:
	var bets: Array = view["bets"]
	for i: int in bets.size():
		if bets[i] != null and (i >= _bets_seen.size() or _bets_seen[i] == null):
			_sfx("chip")
			break
	if phase == "reveal" and (_phase != "reveal" or round_number != _round):
		_sfx("deal")
		_deal.call_deferred()
	else:
		var revealed: Array = view["revealed"]
		for i: int in revealed.size():
			if bool(revealed[i]) and (i >= _revealed_seen.size() or not bool(_revealed_seen[i])):
				_sfx("reveal")
				break
	if phase == "showdown" and _phase != "showdown" and view["results"] != null:
		_settle.call_deferred(view)


## The cards fly in from the middle of the table, one seat after another.
func _deal() -> void:
	if not is_inside_tree():
		return
	var dealer: int = int(_view["dealer"])
	var count: int = _seats.size()
	for i: int in count:
		var order: int = (i - dealer + count) % count
		var cards: Array[Control] = []
		if i == _me:
			cards.assign(_mine)
		else:
			cards.assign(_seats[i]["cards"])
		for k: int in cards.size():
			var card: Control = cards[k]
			if not card.visible:
				continue
			var target: Vector2 = card.position
			card.position = _center - card.size / 2.0
			card.modulate.a = 0.0
			var tween: Tween = card.create_tween().set_parallel()
			var delay: float = (k * count + order) * 0.065
			tween.tween_property(card, "position", target, 0.26).set_delay(delay).set_trans(
				Tween.TRANS_QUAD
			)
			tween.tween_property(card, "modulate:a", 1.0, 0.26).set_delay(delay)


## The count: the win or lose sound, then a chip flies between the dealer and each player.
func _settle(view: Dictionary) -> void:
	if not is_inside_tree():
		return
	await get_tree().create_timer(0.32).timeout
	if not is_inside_tree():
		return
	var results: Array = view["results"]
	var hands: Array = view["hands"]
	var tay: bool = hands.any(
		func(hand: Variant) -> bool: return hand is Array and Rules.is_tay(hand as Array)
	)
	var mine: int = 0
	for result: Variant in results:
		if int((result as Dictionary)["seat"]) == _me:
			mine = int((result as Dictionary)["delta"])
	_sfx("ba-tay" if tay else ("lose" if mine < 0 else "win"))
	var dealer: int = int(view["dealer"])
	var bets: Array = view["bets"]
	for result: Variant in results:
		var seat: int = int((result as Dictionary)["seat"])
		var delta: int = int((result as Dictionary)["delta"])
		if seat == dealer or seat >= _seats.size() or dealer >= _seats.size():
			continue
		var from: Vector2 = _chip_spot(dealer if delta > 0 else seat)
		var to: Vector2 = _chip_spot(seat if delta > 0 else dealer)
		var chip := TextureRect.new()
		chip.texture = _art("chip-%d" % int(bets[seat] if bets[seat] != null else 5))
		chip.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		chip.size = Vector2(44.0, 44.0)
		chip.position = from - chip.size / 2.0
		chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_fx.add_child(chip)
		var tween: Tween = chip.create_tween()
		tween.tween_property(chip, "position", to - chip.size / 2.0, 0.55).set_trans(
			Tween.TRANS_CUBIC
		)
		tween.tween_callback(_sfx.bind("chip"))
		tween.tween_callback(chip.queue_free)


# ── Seats ─────────────────────────────────────────────────────────────────────────────────


func _build_seats(count: int) -> void:
	for seat: Dictionary in _seats:
		for key: String in ["slot", "chip", "badge", "hand", "delta", "tag"]:
			(seat[key] as Node).queue_free()
		for card: XomDaoCard in seat["cards"]:
			card.queue_free()
	_seats.clear()
	_shown.clear()
	for i: int in count:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % i
		slot.compact = true
		add_child(slot)
		move_child(slot, _fx.get_index())
		var cards: Array[XomDaoCard] = []
		for k: int in 3:
			var card := XomDaoCard.new()
			card.name = "Card_%d_%d" % [i, k]
			card.size = Vector2(THEIR_CARD, THEIR_CARD * XomDaoCard.RATIO)
			add_child(card)
			move_child(card, _fx.get_index())
			cards.append(card)
		var chip := TextureRect.new()
		chip.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		chip.size = Vector2(40.0, 40.0)
		chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(chip)
		var badge := TextureRect.new()
		badge.texture = _art("dealer")
		badge.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		badge.size = Vector2(46.0, 46.0)
		badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(badge)
		var hand := Label.new()
		_hud(hand, XomDaoUi.TEXT_MIN)
		add_child(hand)
		var delta := Label.new()
		delta.name = "Delta_%d" % i
		_hud(delta, XomDaoUi.TEXT)
		add_child(delta)
		var tag := Label.new()
		tag.name = "Tag_%d" % i
		_hud(tag, XomDaoUi.TEXT_MIN)
		add_child(tag)
		(
			_seats
			. append(
				{
					"slot": slot,
					"cards": cards,
					"chip": chip,
					"badge": badge,
					"hand": hand,
					"delta": delta,
					"tag": tag,
				}
			)
		)
		_shown.append("")


func _slot_of(seat: int) -> String:
	var count: int = _seats.size()
	var places: Array = SLOTS.get(count, SLOTS[6])
	var from: int = maxi(_me, 0)
	return str(places[(seat - from + count) % count])


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "…"


func _show_seats(live: bool) -> void:
	var dealer: int = int(_view["dealer"])
	var phase: String = str(_view["phase"])
	var gone: Array = _view["gone"]
	var bets: Array = _view["bets"]
	var points: Array = _view["points"]
	var revealed: Array = _view["revealed"]
	var hands: Array = _view["hands"]
	var results: Variant = _view["results"]
	var over: bool = _snapshot.result != null
	for i: int in _seats.size():
		var seat: Dictionary = _seats[i]
		var slot: XomDaoPlayerSlot = seat["slot"]
		var info: XomDaoPlayerInfo = (
			_snapshot.seats[i] if i < _snapshot.seats.size() else XomDaoPlayerInfo.new()
		)
		var left: bool = gone.has(float(i)) or gone.has(i)
		slot.player_name = _seat_name(i)
		slot.frame = info.frame
		slot.host = info.id != "" and info.id == str(_snapshot.host_id)
		slot.extra = "%d điểm" % int(points[i])
		slot.modulate.a = 0.45 if left else 1.0
		var bet: Variant = bets[i]
		var waiting: bool = (
			not over
			and not left
			and (
				(phase == "bet" and i != dealer and bet == null)
				or (phase == "reveal" and not bool(revealed[i]))
			)
		)
		if waiting and not slot.is_turn():
			slot.show_turn()
		elif not waiting and slot.is_turn():
			slot.end_turn()
		var tag: Label = seat["tag"]
		tag.text = (
			"Rời bàn"
			if left
			else (
				"Nhà cái"
				if i == dealer
				else (
					("Chờ cược" if bet == null else "Cược %d" % int(bet))
					if phase == "bet"
					else ("Đã lật" if bool(revealed[i]) else "Đang nặn")
				)
			)
		)
		tag.add_theme_color_override(
			"font_color", GOLD if i == dealer else (PALE if waiting else XomDaoUi.CREAM)
		)
		(seat["badge"] as Control).visible = i == dealer and not left
		var chip: TextureRect = seat["chip"]
		chip.visible = bet != null and not left
		if bet != null:
			chip.texture = _art("chip-%d" % int(bet))
		# The cards: others' face down until turned over; yours are drawn by _show_mine.
		var hand: Variant = hands[i]
		var dealt: bool = hand == null or (hand as Array).size() > 0
		var cards: Array[XomDaoCard] = []
		cards.assign(seat["cards"])
		var key: String = ""
		for k: int in 3:
			var card: XomDaoCard = cards[k]
			card.visible = dealt and i != _me
			if hand is Array and k < (hand as Array).size():
				var value: int = int((hand as Array)[k])
				key += "%d," % value
				if i != _me:
					_turn_over(card, value, live and _shown[i] != "")
			else:
				key += "_,"
				card.show_face("", 0)
				card.back = XomDaoLooks.card_back(_card_back_of(info.id))
		_shown[i] = key if dealt else ""
		# The count: the hand's name, and the points won or lost.
		var full: bool = (
			hand is Array
			and (hand as Array).size() == 3
			and (bool(revealed[i]) or phase == "showdown" or (i == _me and _peeked.size() == 3))
		)
		var name_label: Label = seat["hand"]
		name_label.text = Rules.hand_name(hand as Array) if full else ""
		name_label.add_theme_color_override(
			"font_color",
			Color("#FFE078") if full and Rules.is_tay(hand as Array) else XomDaoUi.CREAM
		)
		var delta_label: Label = seat["delta"]
		var delta_text: String = ""
		if phase == "showdown" and results is Array:
			for result: Variant in results:
				if int((result as Dictionary)["seat"]) == i:
					delta_text = XomDaoUi.delta(int((result as Dictionary)["delta"]))
					delta_label.add_theme_color_override(
						"font_color", WIN if int((result as Dictionary)["delta"]) > 0 else LOSE
					)
		if delta_text != "" and delta_label.text == "" and live:
			delta_label.scale = Vector2.ONE * 0.6
			delta_label.pivot_offset = delta_label.size / 2.0
			(
				delta_label
				. create_tween()
				. tween_property(delta_label, "scale", Vector2.ONE, 0.26)
				. set_trans(Tween.TRANS_BACK)
			)
		delta_label.text = delta_text


## Flips a card to its face (turning it over when `animate`).
func _turn_over(card: XomDaoCard, value: int, animate: bool) -> void:
	var rank: String = Rules.RANKS[Rules.rank_of(value)]
	var suit: int = Rules.CARD_SUIT[value % 4]
	if card.rank == rank and card.suit == suit:
		return
	if not animate or not is_inside_tree():
		card.show_face(rank, suit)
		return
	var tween: Tween = card.create_tween()
	tween.tween_property(card, "scale:x", 0.0, 0.13)
	tween.tween_callback(card.show_face.bind(rank, suit))
	tween.tween_property(card, "scale:x", 1.0, 0.13)


## The card back a member of the room wears ("" when unknown: the default).
func _card_back_of(id: String) -> String:
	for player: XomDaoPlayerInfo in _snapshot.players:
		if player.id == id:
			return player.card_back
	return ""


# ── Your cards ────────────────────────────────────────────────────────────────────────────


## Your three cards: face down until you open them or turn the hand over.
func _show_mine() -> void:
	var hands: Array = _view["hands"]
	var hand: Variant = hands[_me] if _me >= 0 and _me < hands.size() else null
	var dealt: bool = hand is Array and (hand as Array).size() == 3
	var phase: String = str(_view["phase"])
	var revealed: bool = _me >= 0 and bool((_view["revealed"] as Array)[_me])
	var back: Texture2D = XomDaoLooks.card_back(_card_back_of(_client.player_id))
	for k: int in 3:
		var box: Control = _mine[k]
		box.visible = dealt
		if not dealt:
			continue
		var value: int = int((hand as Array)[k])
		_mine_faces[k].show_face(Rules.RANKS[Rules.rank_of(value)], Rules.CARD_SUIT[value % 4])
		_mine_backs[k].back = back
		var open: bool = revealed or phase == "showdown" or _peeked.has(k)
		if open and _mine_backs[k].visible and _squeezing != k:
			_slide_back(k, true)
		box.mouse_default_cursor_shape = (
			Control.CURSOR_POINTING_HAND if _can_squeeze(k) else Control.CURSOR_ARROW
		)


func _can_squeeze(k: int) -> bool:
	if _me < 0 or _snapshot.result != null or str(_view.get("phase", "")) != "reveal":
		return false
	var gone: Array = _view["gone"]
	if gone.has(float(_me)) or gone.has(_me) or bool((_view["revealed"] as Array)[_me]):
		return false
	return not _peeked.has(k)


## Press on a card to squeeze it: dragging up or right slides the back off; a tap or a long
## enough drag opens it, a short one covers it again.
func _on_mine_input(event: InputEvent, k: int) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).button_index == 1:
		var button := event as InputEventMouseButton
		if button.pressed and _squeezing < 0 and _can_squeeze(k):
			_squeezing = k
			_squeeze_from = button.global_position
			_squeeze_moved = 0.0
			_squeeze_progress = 0.0
			_sfx("peek")
		elif not button.pressed and _squeezing == k:
			_squeezing = -1
			var open: bool = _squeeze_moved < 8.0 or _squeeze_progress >= SQUEEZE_OPEN
			if open and _can_squeeze(k):
				_peeked.append(k)
			_slide_back(k, open)
			_show_hud()
			_show_seats(false)
	elif event is InputEventMouseMotion and _squeezing == k:
		var at: Vector2 = (event as InputEventMouseMotion).global_position
		_squeeze_moved = maxf(_squeeze_moved, at.distance_to(_squeeze_from))
		var height: float = _mine[k].size.y
		var pulled: float = maxf(_squeeze_from.y - at.y, (at.x - _squeeze_from.x) * 0.8)
		_squeeze_progress = clampf(pulled / (height * 0.65), 0.0, 0.96)
		_mine_backs[k].position = Vector2(0.0, -_squeeze_progress * height)
		_mine[k].rotation = deg_to_rad(-_squeeze_progress * 3.0)


## The back slides off the card (open) or back over it.
func _slide_back(k: int, open: bool) -> void:
	var back: XomDaoCard = _mine_backs[k]
	var height: float = _mine[k].size.y
	back.visible = true
	_mine[k].rotation = 0.0
	if not is_inside_tree():
		back.position = Vector2(0.0, -height if open else 0.0)
		back.visible = not open
		return
	var tween: Tween = back.create_tween()
	tween.tween_property(back, "position:y", -height if open else 0.0, 0.32 if open else 0.18)
	if open:
		tween.tween_callback(func() -> void: back.visible = false)


# ── Top, status and buttons ───────────────────────────────────────────────────────────────


func _show_hud() -> void:
	var phase: String = str(_view["phase"])
	var dealer: int = int(_view["dealer"])
	var gone: Array = _view["gone"]
	var bets: Array = _view["bets"]
	var revealed: Array = _view["revealed"]
	var over: bool = _snapshot.result != null
	_round_label.text = "Ván %d/%d" % [int(_view["round"]), int(_view["rounds"])]
	_dealer_label.text = "Cái: %s" % _seat_name(dealer)
	for k: int in _phases.size():
		_phases[k].add_theme_color_override(
			"font_color", GOLD if PHASES[k] == phase else Color("#BDA787")
		)
	var active: Array[int] = []
	for i: int in _seats.size():
		if not gone.has(float(i)) and not gone.has(i):
			active.append(i)
	var done: int = 0
	var of: int = 0
	for i: int in active:
		if phase == "bet" and i != dealer:
			of += 1
			done += 1 if bets[i] != null else 0
		elif phase != "bet":
			of += 1
			done += 1 if bool(revealed[i]) else 0
	var mine_gone: bool = _me >= 0 and (gone.has(float(_me)) or gone.has(_me))
	var info: String = (
		"Đã cược %d/%d" % [done, of]
		if phase == "bet"
		else ("Đã lật %d/%d" % [done, of] if phase == "reveal" else "Đã so bài")
	)
	var status: String
	if _me < 0:
		status = "Đang xem"
	elif mine_gone:
		status = "Rời bàn"
	elif phase == "bet":
		status = (
			"Bạn làm cái"
			if _me == dealer
			else ("Cược %d" % int(bets[_me]) if bets[_me] != null else "Đặt cược")
		)
	elif phase == "reveal":
		status = "Đã lật bài" if bool(revealed[_me]) else "Đã nặn %d/3" % _peeked.size()
	else:
		status = "Ván sau"
	if over:
		info = "Kết thúc"
		status = ""
	elif phase == "showdown" and _view["results"] == null:
		info = "Nhà cái rời bàn, huỷ ván"
	elif phase == "showdown" and _me >= 0:
		for result: Variant in _view["results"]:
			if int((result as Dictionary)["seat"]) == _me:
				status = "%s điểm" % XomDaoUi.delta(int((result as Dictionary)["delta"]))
	_info.text = info
	_status.text = status
	var betting: bool = (
		not over and phase == "bet" and _me >= 0 and _me != dealer and bets[_me] == null
	)
	betting = betting and not mine_gone
	for button: XomDaoButton in _bets:
		button.visible = betting
	var hands: Array = _view["hands"]
	_reveal.visible = (
		not over
		and phase == "reveal"
		and _me >= 0
		and not mine_gone
		and not bool(revealed[_me])
		and hands[_me] is Array
		and (hands[_me] as Array).size() > 0
	)


## The seconds left to bet or turn over, and a tick in the last three when you still have to.
func _show_countdown() -> void:
	if _snapshot == null or _view.is_empty():
		return
	var timer: XomDaoRoomTimer = _snapshot.timer
	var counting: bool = (
		timer != null
		and _snapshot.result == null
		and (timer.event == "bet-over" or timer.event == "reveal-over")
	)
	if not counting:
		_countdown.text = ""
		return
	var left_ms: float = timer.left - (Time.get_ticks_msec() - _shown_at)
	var left: int = ceili(maxf(0.0, left_ms) / 1000.0)
	_countdown.text = "%d giây" % left
	var acting: bool = (_bets.size() > 0 and _bets[0].visible) or _reveal.visible
	if acting and left <= 3 and left > 0 and left != _tick:
		_sfx("tick")
	_tick = left


func _on_bet(amount: int) -> void:
	for button: XomDaoButton in _bets:
		button.visible = false
	await _client.send("bet", {"amount": amount})


func _on_reveal() -> void:
	_reveal.visible = false
	await _client.send("reveal")


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## Where a seat's chip sits (for the chips that fly at the count).
func _chip_spot(seat: int) -> Vector2:
	var chip: Control = _seats[seat]["chip"]
	return chip.position + chip.size / 2.0


func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var top: float = edge
	var bottom: float = size.y - edge
	_center = Vector2(size.x / 2.0, size.y * 0.47)

	# Top middle: the round and the dealer, then the three phases.
	_round_label.reset_size()
	_dealer_label.reset_size()
	var heading: float = _round_label.size.x + 24.0 + _dealer_label.size.x
	_round_label.position = Vector2((size.x - heading) / 2.0, top)
	_dealer_label.position = Vector2(_round_label.position.x + _round_label.size.x + 24.0, top)
	_phase_row.reset_size()
	_phase_row.position = Vector2((size.x - _phase_row.size.x) / 2.0, top + _round_label.size.y)

	# Bottom right: the bets (or Lật bài), the status and the seconds above them.
	var y: float = bottom
	for button: XomDaoButton in [_reveal] + _bets:
		button.reset_size()
	_reveal.position = Vector2(right - _reveal.size.x, bottom - _reveal.size.y)
	for i: int in range(_bets.size() - 1, -1, -1):
		var button: XomDaoButton = _bets[i]
		y -= button.size.y
		button.position = Vector2(right - button.size.x, y)
		y -= 10.0
	# The middle of the table: what is going on, your status and the seconds left.
	var middle: float = size.y * 0.41
	for label: Label in [_info, _status, _countdown]:
		label.reset_size()
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.size.x = 420.0
		label.position = Vector2((size.x - label.size.x) / 2.0, middle)
		middle += label.size.y

	# Your three cards, big, in the bottom middle.
	var my_height: float = MY_CARD * XomDaoCard.RATIO
	var my_y: float = bottom - my_height - 4.0
	for k: int in 3:
		var box: Control = _mine[k]
		box.size = Vector2(MY_CARD, my_height)
		box.pivot_offset = box.size / 2.0
		box.position = Vector2(size.x / 2.0 + (k - 1) * (MY_CARD + 12.0) - MY_CARD / 2.0, my_y)
		for card: XomDaoCard in [_mine_faces[k], _mine_backs[k]]:
			card.size = box.size
		if _mine_backs[k].visible and _squeezing != k:
			_mine_backs[k].position.y = 0.0 if not _peeked.has(k) else -my_height

	# Seats round the table: each with its three cards towards the middle.
	var width: float = THEIR_CARD
	var height: float = THEIR_CARD * XomDaoCard.RATIO
	var group: float = width * 3.0 + 12.0
	for i: int in _seats.size():
		var seat: Dictionary = _seats[i]
		var slot: XomDaoPlayerSlot = seat["slot"]
		slot.reset_size()
		var box: Vector2 = slot.get_combined_minimum_size()
		var cards_at := Vector2.ZERO
		match _slot_of(i):
			"bottom":
				slot.position = Vector2(left, bottom - box.y)
				cards_at = Vector2(size.x / 2.0 - group / 2.0, my_y)
			"top":
				cards_at = Vector2(size.x / 2.0 - group / 2.0, top + 84.0)
				slot.position = Vector2(size.x / 2.0 + group / 2.0 + 24.0, cards_at.y)
			"topLeft":
				slot.position = Vector2(size.x * 0.27 - box.x / 2.0, top + 70.0)
				cards_at = slot.position + Vector2((box.x - group) / 2.0, box.y + 8.0)
			"topRight":
				slot.position = Vector2(size.x * 0.73 - box.x / 2.0, top + 70.0)
				cards_at = slot.position + Vector2((box.x - group) / 2.0, box.y + 8.0)
			"left":
				slot.position = Vector2(
					left, maxf(top + XomDaoUi.TOUCH + 16.0, size.y * 0.42 - box.y)
				)
				cards_at = slot.position + Vector2(0.0, box.y + 8.0)
			"right":
				slot.position = Vector2(right - box.x, size.y * 0.42 - box.y)
				cards_at = slot.position + Vector2(box.x - group, box.y + 8.0)
		var cards: Array[XomDaoCard] = []
		cards.assign(seat["cards"])
		for k: int in 3:
			cards[k].size = Vector2(width, height)
			cards[k].position = cards_at + Vector2(k * (width + 6.0), 0.0)
		var group_center: Vector2 = cards_at + Vector2(group / 2.0, height / 2.0)
		if i == _me:
			group_center = Vector2(size.x / 2.0, my_y + my_height / 2.0)
			cards_at = Vector2(size.x / 2.0 - (MY_CARD * 1.5 + 12.0), my_y)
		var chip: Control = seat["chip"]
		chip.position = cards_at + Vector2(-chip.size.x - 8.0, 0.0)
		if i == _me:
			chip.position = Vector2(_mine[0].position.x - chip.size.x - 14.0, my_y)
		elif _slot_of(i) == "left":
			chip.position = cards_at + Vector2(group + 8.0, 0.0)
		var badge: Control = seat["badge"]
		var avatar: Control = slot.avatar
		badge.position = (
			avatar.global_position - global_position + avatar.size - badge.size * 0.62
		)
		var tag: Label = seat["tag"]
		tag.reset_size()
		tag.position = slot.position + Vector2((box.x - tag.size.x) / 2.0, -tag.size.y + 6.0)
		if _slot_of(i) == "bottom":
			tag.position.y = slot.position.y - tag.size.y
		elif _slot_of(i) == "top":
			tag.position.y = slot.position.y + box.y
		var name_label: Label = seat["hand"]
		name_label.reset_size()
		var below: float = my_y - name_label.size.y if i == _me else cards_at.y + height
		name_label.position = Vector2(group_center.x - name_label.size.x / 2.0, below)
		var delta: Label = seat["delta"]
		delta.reset_size()
		delta.pivot_offset = delta.size / 2.0
		var delta_y: float = (
			(my_y - name_label.size.y - delta.size.y) if i == _me else below + name_label.size.y
		)
		delta.position = Vector2(group_center.x - delta.size.x / 2.0, delta_y)
	_place_badges.call_deferred()


## Each dealer badge sits on its player's avatar, once the slots have laid out.
func _place_badges() -> void:
	for seat: Dictionary in _seats:
		var avatar: Control = (seat["slot"] as XomDaoPlayerSlot).avatar
		var badge: Control = seat["badge"]
		badge.position = (
			avatar.global_position - global_position + avatar.size - badge.size * 0.62
		)
