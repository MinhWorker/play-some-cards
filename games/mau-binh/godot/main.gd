extends Control
## Mậu Binh on the Godot client, in the **Bàn** layout (docs/experience.md): the sedge mat
## (XomDaoMat), you at the bottom with your 13 cards in three rows (chi 3 on top, chi 1 nearest
## you), the others round the table with theirs small; the round at the top, what is going on in
## the middle, Hoàn tác / Tự xếp / Xong at the bottom right. It draws `snapshot.view` (View in
## src/game/model.ts: your hand and rows, who is done, the round results) and sends
## `submit {rows}` and `cancel`.
##
## Tap a card, then another, to swap them; each row shows its hand, red where it breaks the
## order (binh lủng). Xong on binh lủng asks once more ("Vẫn nộp"). With two seconds left your
## rows go in as they are. When everyone is done: "Lật bài!", tới trắng, then chi 1, 2, 3 with
## the points each seat won on that chi, sập 3 chi, and the round's totals.
##
## Named nodes for tests: Mine_<position> (your cards: chi 1 = 0–4, chi 2 = 5–9, chi 3 = 10–12),
## Row_<chi>, Card_<seat>_<position>, Seat_<seat>, Tag_<seat>, Total_<seat>, Auto, Undo, Done,
## Cancel, Round, Status, Info, Countdown, Word.

const Rules := preload("res://content/mau-binh/rules.gd")

## Where each seat sits, from yours (bottom) round the table, by how many play.
const SLOTS: Dictionary = {
	1: ["bottom"],
	2: ["bottom", "top"],
	3: ["bottom", "right", "left"],
	4: ["bottom", "right", "top", "left"],
}
const SOUNDS: Array[String] = [
	"deal", "place", "reveal", "scoop", "special", "submit", "swap", "tick", "win", "standings"
]
const ROW_START: Array[int] = [0, 5, 10]
const ROW_LENGTH: Array[int] = [5, 5, 3]
const MY_CARD := 76.0
const THEIR_CARD := 36.0
## Cards in a row overlap: the next one starts this far on (in card widths), rows this far up
## (in card heights).
const STEP_X := 0.8
const STEP_Y := 0.6
const BUTTON_WIDTH := 190.0
const GOLD := Color("#FFD54F")
const PALE := Color("#FFE8A3")
const WIN := Color("#8DFF8A")
const LOSE := Color("#FF8A80")
## The reveal on screen (seconds), as REVEAL in src/game/model.ts.
const REVEAL_INTRO := 1.0
const REVEAL_SPECIAL := 2.0
const REVEAL_CHI := 2.6
const REVEAL_SCOOP := 1.8
## A second tap on Xong within this long hands binh lủng in (ms).
const FOUL_CONFIRM_MS := 4000

var _client: XomDaoClient
var _snapshot: XomDaoRoomSnapshot
var _view: Dictionary = {}
## Your seat, or -1 for a spectator (who looks from seat 0).
var _me: int = -1

var _mat := XomDaoMat.new()
var _round_label := Label.new()
var _status := Label.new()
var _info := Label.new()
var _countdown := Label.new()
var _word := Label.new()
var _undo: XomDaoButton = XomDaoButton.create("Hoàn tác", XomDaoUi.Kind.BACK)
var _auto: XomDaoButton = XomDaoButton.create("Tự xếp", XomDaoUi.Kind.SOCIAL)
var _done: XomDaoButton = XomDaoButton.create("Xong", XomDaoUi.Kind.PLAY)
var _cancel: XomDaoButton = XomDaoButton.create("Xếp lại", XomDaoUi.Kind.BACK)
var _fx := Control.new()
var _sounds: Dictionary = {}

## One entry per seat: slot, 13 small cards, three row labels, tag, the round's total.
var _seats: Array[Dictionary] = []
## Your 13 cards (by position) and the hand names beside your rows.
var _mine: Array[XomDaoCard] = []
var _my_rows: Array[Label] = []
## Your cards by position, as you arrange them, and the orders before each swap (Hoàn tác).
var _order: Array = []
var _history: Array = []
var _picked: int = -1
var _hand_key: String = ""
var _foul_warned_at: int = -1000000

## What the last view showed, to tell what changed.
var _round: int = -1
var _phase: String = ""
var _ended: bool = false
var _tick: int = -1
## When the last snapshot came (ms), to count its timer down.
var _shown_at: int = 0
var _auto_sent: int = -1
## How far the reveal has gone: chi shown (0–3), and whether the totals are up.
var _chi_shown: int = 0
var _totals_shown: bool = false
var _center := Vector2.ZERO


## Options for a sandbox room (`?play=mau-binh` in a debug build): three computer players.
func sandbox_options() -> Dictionary:
	return {"bots": 3, "rounds": 3, "arrangeSeconds": 60}


## The hub's Tạo phòng board (`optionsSchema` in src/game/model.ts, with its defaults).
func room_setup() -> Array:
	return [
		{
			"key": "bots",
			"label": "Máy chơi cùng",
			"options": [["Không", 0], ["1", 1], ["2", 2], ["3", 3]],
		},
		{
			"key": "rounds",
			"label": "Số vòng",
			"options": [["1", 1], ["3", 3], ["5", 5]],
			"default": 2,
		},
		{
			"key": "arrangeSeconds",
			"label": "Thời gian xếp",
			"options": [["60 giây", 60], ["90 giây", 90]],
			"default": 1,
		},
	]


## The figures for the hub's result board.
func result_detail() -> Dictionary:
	if _client != null and _client.snapshot != null:
		_show(_client.snapshot)
	if _view.is_empty():
		return {}
	return {"reason": "Sau %d vòng" % (_view["results"] as Array).size(), "rows": []}


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
	for label: Label in [_round_label, _status, _info, _countdown]:
		_hud(label, XomDaoUi.TEXT_MIN)
		add_child(label)
	_round_label.name = "Round"
	_status.name = "Status"
	_status.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	_info.name = "Info"
	_countdown.name = "Countdown"
	_countdown.add_theme_color_override("font_color", PALE)
	for k: int in 13:
		var card := XomDaoCard.new()
		card.name = "Mine_%d" % k
		card.mouse_filter = Control.MOUSE_FILTER_STOP
		card.gui_input.connect(_on_card_input.bind(k))
		_mine.append(card)
	# Chi 3 first, so the nearer rows lie over the farther ones.
	for k: int in [10, 11, 12, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4]:
		add_child(_mine[k])
	for row: int in 3:
		var label := Label.new()
		label.name = "Row_%d" % (row + 1)
		_hud(label, XomDaoUi.TEXT_MIN)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		add_child(label)
		_my_rows.append(label)
	_undo.name = "Undo"
	_undo.pressed.connect(_on_undo)
	_auto.name = "Auto"
	_auto.pressed.connect(_on_auto)
	_done.name = "Done"
	_done.pressed.connect(_on_done)
	_cancel.name = "Cancel"
	_cancel.pressed.connect(_on_cancel)
	for button: XomDaoButton in [_undo, _auto, _done, _cancel]:
		button.custom_minimum_size = Vector2(BUTTON_WIDTH, XomDaoUi.TOUCH)
		add_child(button)
	_fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fx.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_fx)
	_word.name = "Word"
	_hud(_word, XomDaoUi.TITLE)
	_word.add_theme_color_override("font_color", GOLD)
	_word.add_theme_constant_override("outline_size", 12)
	_word.visible = false
	add_child(_word)
	for sound: String in SOUNDS:
		var player := AudioStreamPlayer.new()
		var path: String = "res://content/mau-binh/sounds/%s.wav" % sound
		if not ResourceLoader.exists(path):
			path = path.get_basename() + ".mp3"
		player.stream = load(path)
		player.max_polyphony = 4
		add_child(player)
		_sounds[sound] = player
	resized.connect(_layout)
	_layout.call_deferred()


func _process(_delta: float) -> void:
	_show_countdown()
	_info.visible = not _word.visible
	_status.visible = not _word.visible
	if _done.text == "Vẫn nộp" and Time.get_ticks_msec() - _foul_warned_at > FOUL_CONFIRM_MS:
		_done.text = "Xong"


static func _hud(label: Label, font_size: int) -> void:
	label.theme_type_variation = "HudLabel"
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", XomDaoUi.CREAM)
	label.add_theme_color_override("font_outline_color", XomDaoUi.INK)
	label.add_theme_constant_override("outline_size", 8)


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
	var round_number: int = int(view["round"])
	var phase: String = str(view["phase"])
	var fresh: bool = round_number != _round or phase != _phase
	if round_number != _round:
		_new_round()
	_take_hand()
	if fresh and phase == "show":
		if live:
			_play_reveal.call_deferred(round_number)
		else:
			_chi_shown = 3
			_totals_shown = true
	_round = round_number
	_phase = phase
	_show_seats()
	_show_mine()
	_show_hud()
	_layout()
	if fresh and live and phase == "deal":
		_deal.call_deferred(round_number)
	var ended: bool = snapshot.result != null
	if ended and not _ended and live:
		_sfx("standings")
	_ended = ended


## A new round: nothing picked, nothing shown yet.
func _new_round() -> void:
	_picked = -1
	_history.clear()
	_chi_shown = 0
	_totals_shown = false
	_word.visible = false
	for seat: Dictionary in _seats:
		(seat["total"] as Label).text = ""


## Your cards as they start: the rows you handed in, else strongest first (chi 1 gets the high
## cards). Kept while the hand is the same, so a new view doesn't undo your swaps.
func _take_hand() -> void:
	var hand: Array = _view.get("hand", [])
	var mine: Variant = _view.get("mine")
	var key: String = ",".join(hand.map(func(card: Variant) -> String: return str(int(card))))
	if mine is Array:
		var rows: Array = mine
		_order = []
		for row: Variant in rows:
			for card: Variant in row:
				_order.append(int(card))
	elif key != _hand_key or _order.size() != hand.size():
		_order = hand.map(func(card: Variant) -> int: return int(card))
		_order.sort_custom(
			func(a: int, b: int) -> bool: return a / 4 > b / 4 or (a / 4 == b / 4 and a > b)
		)
		_history.clear()
	if _phase == "show" or str(_view["phase"]) == "show":
		var result: Variant = _result()
		if result is Dictionary and _me >= 0:
			var rows: Variant = ((result as Dictionary)["rows"] as Array)[_me]
			if rows is Array:
				_order = []
				for row: Variant in rows:
					for card: Variant in row:
						_order.append(int(card))
	_hand_key = key


## This round's result, once shown (RoundResult in src/game/model.ts).
func _result() -> Variant:
	var results: Array = _view["results"]
	if str(_view["phase"]) != "show" or results.is_empty():
		return null
	return results[results.size() - 1]


## Whether you are arranging now (and haven't handed in yet).
func _arranging() -> bool:
	if _me < 0 or _snapshot.result != null or str(_view["phase"]) != "arrange":
		return false
	if not bool((_view["inRound"] as Array)[_me]) or _left(_me):
		return false
	return _view.get("mine") == null


func _left(seat: int) -> bool:
	for key: String in ["gone", "forfeits"]:
		var seats: Array = _view[key]
		if seats.has(float(seat)) or seats.has(seat):
			return true
	return false


func _seat_name(seat: int) -> String:
	if seat == _me:
		return "Bạn"
	if seat < _snapshot.seats.size():
		return _snapshot.seats[seat].name
	return "…"


## A card's face for XomDaoCard: its rank and suit.
static func _face(card: XomDaoCard, value: int) -> void:
	card.show_face(Rules.RANKS[Rules.rank_of(value)], value % 4)


# ── Effects ───────────────────────────────────────────────────────────────────────────────


## The cards fly in from the middle of the table, one to each seat in turn, then the round is
## announced.
func _deal(round_number: int) -> void:
	if not is_inside_tree():
		return
	_sfx("deal")
	var cards: Array[Control] = []
	var count: int = _seats.size()
	for k: int in 13:
		for step: int in count:
			var seat: int = (maxi(_me, 0) + 1 + step) % count
			var card: Control = _mine[k] if seat == _me else _seats[seat]["cards"][k]
			if card.visible:
				cards.append(card)
	for n: int in cards.size():
		var card: Control = cards[n]
		var target: Vector2 = card.position
		card.position = _center - card.size / 2.0
		card.modulate.a = 0.0
		var tween: Tween = card.create_tween().set_parallel()
		var delay: float = n * 0.028
		tween.tween_property(card, "position", target, 0.24).set_delay(delay).set_trans(
			Tween.TRANS_QUAD
		)
		tween.tween_property(card, "modulate:a", 1.0, 0.24).set_delay(delay)
	await get_tree().create_timer(cards.size() * 0.028 + 0.3).timeout
	if _round == round_number and is_inside_tree():
		_announce("Vòng %d" % round_number, "place")


## A big word in the middle of the table for a moment.
func _announce(text: String, sound: String = "") -> void:
	_word.text = text
	_word.visible = true
	_word.reset_size()
	_word.position = _center - _word.size / 2.0
	_word.pivot_offset = _word.size / 2.0
	_word.scale = Vector2.ONE * 0.6
	_word.modulate.a = 1.0
	var tween: Tween = _word.create_tween()
	tween.tween_property(_word, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_BACK)
	tween.tween_interval(0.8)
	tween.tween_property(_word, "modulate:a", 0.0, 0.25)
	tween.tween_callback(func() -> void: _word.visible = false)
	if sound != "":
		_sfx(sound)


## The reveal, as on the server's clock: everyone's cards turn over, tới trắng, chi 1, 2, 3
## with each seat's points on that chi, sập 3 chi, then the totals.
func _play_reveal(round_number: int) -> void:
	var result: Variant = _result()
	if result is not Dictionary or not is_inside_tree():
		return
	var still := func() -> bool: return _round == round_number and is_inside_tree()
	_announce("Lật bài!", "reveal")
	_show_seats(true)
	await get_tree().create_timer(REVEAL_INTRO).timeout
	if not still.call():
		return
	var specials: Array = (result as Dictionary)["specials"]
	if specials.any(func(kind: Variant) -> bool: return kind != null):
		var names: Array = []
		for kind: Variant in specials:
			if kind != null:
				names.append(Rules.SPECIAL_NAMES.get(str(kind), ""))
		_announce(" · ".join(names), "special")
		await get_tree().create_timer(REVEAL_SPECIAL).timeout
		if not still.call():
			return
	for chi: int in 3:
		_chi_shown = chi + 1
		_announce("Chi %d" % (chi + 1), "place")
		_refresh()
		await get_tree().create_timer(REVEAL_CHI).timeout
		if not still.call():
			return
	var duels: Array = (result as Dictionary)["duels"]
	if duels.any(func(duel: Variant) -> bool: return int((duel as Dictionary)["scoop"]) != 0):
		_announce("Sập 3 chi!", "scoop")
		await get_tree().create_timer(REVEAL_SCOOP).timeout
		if not still.call():
			return
	_totals_shown = true
	var points: Array = (result as Dictionary)["points"]
	if _me >= 0 and int(points[_me]) > 0:
		_sfx("win")
	for i: int in _seats.size():
		var total: Label = _seats[i]["total"]
		total.scale = Vector2.ONE * 0.6
		total.create_tween().tween_property(total, "scale", Vector2.ONE, 0.26).set_trans(
			Tween.TRANS_BACK
		)
	_refresh()


## Draws everything again from the last view.
func _refresh() -> void:
	_show_seats()
	_show_mine()
	_show_hud()
	_layout()


## What `seat` won or lost on chi `chi` this round, against everyone (chi duels only).
static func _chi_points(result: Dictionary, seat: int, chi: int) -> int:
	var sum: int = 0
	for item: Variant in result["duels"]:
		var duel: Dictionary = item
		if str(duel["kind"]) != "chi":
			continue
		if int(duel["a"]) == seat:
			sum += int((duel["chi"] as Array)[chi])
		elif int(duel["b"]) == seat:
			sum -= int((duel["chi"] as Array)[chi])
	return sum


# ── Seats ─────────────────────────────────────────────────────────────────────────────────


func _build_seats(count: int) -> void:
	for seat: Dictionary in _seats:
		for key: String in ["slot", "tag", "total"]:
			(seat[key] as Node).queue_free()
		for node: Node in (seat["cards"] as Array) + (seat["labels"] as Array):
			node.queue_free()
	_seats.clear()
	for i: int in count:
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat_%d" % i
		slot.compact = true
		add_child(slot)
		move_child(slot, _fx.get_index())
		var cards: Array[XomDaoCard] = []
		for k: int in 13:
			var card := XomDaoCard.new()
			card.name = "Card_%d_%d" % [i, k]
			cards.append(card)
		for k: int in [10, 11, 12, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4]:
			add_child(cards[k])
			move_child(cards[k], _fx.get_index())
		var labels: Array[Label] = []
		for row: int in 3:
			var label := Label.new()
			_hud(label, XomDaoUi.TEXT_MIN)
			add_child(label)
			labels.append(label)
		var tag := Label.new()
		tag.name = "Tag_%d" % i
		_hud(tag, XomDaoUi.TEXT_MIN)
		add_child(tag)
		var total := Label.new()
		total.name = "Total_%d" % i
		_hud(total, XomDaoUi.TEXT)
		add_child(total)
		_seats.append({"slot": slot, "cards": cards, "labels": labels, "tag": tag, "total": total})


func _slot_of(seat: int) -> String:
	var count: int = _seats.size()
	var places: Array = SLOTS.get(count, SLOTS[4])
	var from: int = maxi(_me, 0)
	return str(places[(seat - from + count) % count])


func _show_seats(turning: bool = false) -> void:
	var phase: String = str(_view["phase"])
	var in_round: Array = _view["inRound"]
	var ready: Array = _view["ready"]
	var points: Array = _view["points"]
	var result: Variant = _result()
	for i: int in _seats.size():
		var seat: Dictionary = _seats[i]
		var slot: XomDaoPlayerSlot = seat["slot"]
		var info: XomDaoPlayerInfo = (
			_snapshot.seats[i] if i < _snapshot.seats.size() else XomDaoPlayerInfo.new()
		)
		var gone: bool = _left(i)
		var dealt: bool = bool(in_round[i]) if i < in_round.size() else false
		var round_points: int = 0
		if result is Dictionary:
			round_points = int(((result as Dictionary)["points"] as Array)[i])
		slot.player_name = _seat_name(i)
		slot.frame = info.frame
		slot.host = info.id != "" and info.id == str(_snapshot.host_id)
		var shown_points: int = int(points[i]) - (0 if _totals_shown else round_points)
		slot.extra = "%d điểm" % shown_points
		slot.modulate.a = 0.45 if gone else 1.0
		var waiting: bool = (
			phase == "arrange"
			and dealt
			and not gone
			and not bool(ready[i])
			and _snapshot.result == null
		)
		if waiting and not slot.is_turn():
			slot.show_turn()
		elif not waiting and slot.is_turn():
			slot.end_turn()
		var tag: Label = seat["tag"]
		tag.text = _tag_of(i, dealt, gone, result)
		tag.add_theme_color_override("font_color", PALE if waiting else XomDaoUi.CREAM)
		# The cards: face down until the reveal; yours are drawn by _show_mine.
		var rows: Variant = null
		if result is Dictionary:
			rows = ((result as Dictionary)["rows"] as Array)[i]
		var order: Array = []
		if rows is Array:
			for row: Variant in rows:
				order.append_array(row as Array)
		var cards: Array[XomDaoCard] = []
		cards.assign(seat["cards"])
		var back: Texture2D = XomDaoLooks.card_back(_card_back_of(info.id))
		for k: int in 13:
			var card: XomDaoCard = cards[k]
			card.visible = dealt and i != _me
			card.back = back
			card.dim = false
			if k < order.size():
				_turn_over(card, int(order[k]), turning)
			else:
				card.show_face("", 0)
		# Each row's hand and its points, chi by chi as the reveal goes.
		var labels: Array[Label] = []
		labels.assign(seat["labels"])
		for row: int in 3:
			var label: Label = labels[row]
			label.text = ""
			if order.size() == 13 and row < _chi_shown and i != _me:
				label.text = _row_text(result, i, row, Rules.rows_of(order)[row], false)
				label.add_theme_color_override("font_color", _row_color(result, i, row))
			if order.size() == 13 and _chi_shown > 0 and not _totals_shown:
				for k: int in ROW_LENGTH[row]:
					cards[ROW_START[row] + k].dim = row != _chi_shown - 1
		var total: Label = seat["total"]
		total.text = ""
		if _totals_shown and result is Dictionary and dealt:
			total.text = XomDaoUi.delta(round_points) if round_points != 0 else "0"
			total.add_theme_color_override(
				"font_color", WIN if round_points > 0 else (LOSE if round_points < 0 else PALE)
			)


## The word under a seat: what they are doing, or how their round went.
func _tag_of(seat: int, dealt: bool, gone: bool, result: Variant) -> String:
	var text: String = ""
	if gone:
		text = "Rời bàn"
	elif not dealt:
		text = "Ngồi ngoài"
	elif result is Dictionary:
		var round: Dictionary = result
		var special: Variant = (round["specials"] as Array)[seat]
		if special != null:
			text = Rules.SPECIAL_NAMES.get(str(special), "")
		elif bool((round["fouls"] as Array)[seat]):
			text = "Binh lủng"
		elif bool((round["auto"] as Array)[seat]):
			text = "Máy xếp"
	elif str(_view["phase"]) == "arrange":
		text = "Xong" if bool((_view["ready"] as Array)[seat]) else "Đang xếp"
	return text


## "Thùng +2": a row's hand, and once its chi is compared, the points on it.
func _row_text(result: Variant, seat: int, row: int, cards: Array, mine: bool) -> String:
	var text: String = Rules.hand_name(cards)
	if mine:
		text = "Chi %d · %s" % [row + 1, text]
	if result is Dictionary and row < _chi_shown:
		var points: int = _chi_points(result as Dictionary, seat, row)
		text += " %s" % (XomDaoUi.delta(points) if points != 0 else "0")
	return text


func _row_color(result: Variant, seat: int, row: int) -> Color:
	if result is not Dictionary or row >= _chi_shown:
		return XomDaoUi.CREAM
	var points: int = _chi_points(result as Dictionary, seat, row)
	return WIN if points > 0 else (LOSE if points < 0 else XomDaoUi.CREAM)


## Flips a card to its face (turning it over when `animate`).
func _turn_over(card: XomDaoCard, value: int, animate: bool) -> void:
	var rank: String = Rules.RANKS[Rules.rank_of(value)]
	if card.rank == rank and card.suit == value % 4:
		return
	if not animate or not is_inside_tree():
		_face(card, value)
		return
	var tween: Tween = card.create_tween()
	tween.tween_property(card, "scale:x", 0.0, 0.13)
	tween.tween_callback(_face.bind(card, value))
	tween.tween_property(card, "scale:x", 1.0, 0.13)


## The card back a member of the room wears ("" when unknown: the default).
func _card_back_of(id: String) -> String:
	for player: XomDaoPlayerInfo in _snapshot.players:
		if player.id == id:
			return player.card_back
	return ""


# ── Your cards ────────────────────────────────────────────────────────────────────────────


## Your 13 cards in their rows, and each row's hand (red where it breaks the order).
func _show_mine() -> void:
	var dealt: bool = _me >= 0 and _order.size() == 13
	var result: Variant = _result()
	var foul: String = Rules.foul_of(Rules.rows_of(_order)) if dealt else ""
	for k: int in 13:
		var card: XomDaoCard = _mine[k]
		card.visible = dealt
		if not dealt:
			continue
		_face(card, int(_order[k]))
		card.picked = k == _picked
		card.dim = false
		card.mouse_default_cursor_shape = (
			Control.CURSOR_POINTING_HAND if _arranging() else Control.CURSOR_ARROW
		)
	for row: int in 3:
		var label: Label = _my_rows[row]
		label.visible = dealt
		if not dealt:
			continue
		var cards: Array = Rules.rows_of(_order)[row]
		label.text = _row_text(result, _me, row, cards, true)
		var broken: bool = (
			(foul.begins_with("Chi 2") and row == 1) or (foul.begins_with("Chi 3") and row == 2)
		)
		label.add_theme_color_override(
			"font_color", LOSE if broken and result == null else _row_color(result, _me, row)
		)
		if result is Dictionary and _chi_shown > 0 and not _totals_shown:
			for k: int in ROW_LENGTH[row]:
				_mine[ROW_START[row] + k].dim = row != _chi_shown - 1


## Tap a card to pick it, another to swap the two; the same card again puts it down.
func _on_card_input(event: InputEvent, k: int) -> void:
	var button := event as InputEventMouseButton
	if button == null or button.button_index != 1 or not button.pressed:
		return
	if not _arranging():
		return
	accept_event()
	if _picked < 0:
		_picked = k
		_sfx("place")
	elif _picked == k:
		_picked = -1
	else:
		_swap(_picked, k)
		_picked = -1
	_refresh()


func _swap(a: int, b: int) -> void:
	_history.append(_order.duplicate())
	var held: int = _order[a]
	_order[a] = _order[b]
	_order[b] = held
	_sfx("swap")
	if not is_inside_tree():
		return
	for pair: Array in [[a, b], [b, a]]:
		var card: XomDaoCard = _mine[pair[0]]
		var home: Vector2 = card.position
		card.position = _mine[pair[1]].position
		card.create_tween().tween_property(card, "position", home, 0.18).set_trans(Tween.TRANS_QUAD)


func _on_undo() -> void:
	if _history.is_empty() or not _arranging():
		return
	_order = _history.pop_back()
	_picked = -1
	_sfx("swap")
	_refresh()


func _on_auto() -> void:
	if not _arranging():
		return
	var best: Array = Rules.best_order(_order)
	if best == _order:
		return
	_history.append(_order.duplicate())
	_order = best
	_picked = -1
	_sfx("swap")
	_refresh()


## Xong: hands your rows in; binh lủng asks for a second tap first.
func _on_done() -> void:
	if not _arranging():
		return
	var foul: String = Rules.foul_of(Rules.rows_of(_order))
	if foul != "" and Time.get_ticks_msec() - _foul_warned_at > FOUL_CONFIRM_MS:
		_foul_warned_at = Time.get_ticks_msec()
		_done.text = "Vẫn nộp"
		_status.text = "Binh lủng: %s" % foul.to_lower()
		return
	_submit()


func _submit() -> void:
	_done.text = "Xong"
	_picked = -1
	_auto_sent = _round
	_sfx("submit")
	await _client.send("submit", {"rows": Rules.rows_of(_order)})


func _on_cancel() -> void:
	_cancel.visible = false
	await _client.send("cancel")


# ── Status and buttons ────────────────────────────────────────────────────────────────────


func _show_hud() -> void:
	var phase: String = str(_view["phase"])
	var over: bool = _snapshot.result != null
	var in_round: Array = _view["inRound"]
	var ready: Array = _view["ready"]
	_round_label.text = "Vòng %d/%d" % [int(_view["round"]), int(_view["rounds"])]
	var playing: int = 0
	var done: int = 0
	for i: int in in_round.size():
		if bool(in_round[i]) and not _left(i):
			playing += 1
			done += 1 if bool(ready[i]) else 0
	var info: String = ""
	if over:
		info = "Kết thúc"
	elif phase == "deal":
		info = "Chia bài"
	elif phase == "arrange":
		info = "Xong %d/%d" % [done, playing]
	else:
		info = "Lật bài" if _chi_shown == 0 else ("Chi %d" % _chi_shown)
		if _totals_shown:
			info = "Vòng sau" if int(_view["round"]) < int(_view["rounds"]) else "Tổng kết"
	var status: String = ""
	var result: Variant = _result()
	if _me < 0:
		status = "Đang xem"
	elif _left(_me):
		status = "Rời bàn"
	elif phase == "arrange" and _view.get("mine") != null:
		status = "Đã nộp bài"
	elif phase == "arrange" and bool(in_round[_me]):
		var foul: String = Rules.foul_of(Rules.rows_of(_order)) if _order.size() == 13 else ""
		status = "Binh lủng" if foul != "" else "Đang xếp"
	elif result is Dictionary and _totals_shown:
		status = "%s điểm" % XomDaoUi.delta(int(((result as Dictionary)["points"] as Array)[_me]))
	if over:
		status = ""
	_info.text = info
	_status.text = status
	var arranging: bool = _arranging()
	_undo.visible = arranging
	_undo.disabled = _history.is_empty()
	_auto.visible = arranging
	_done.visible = arranging
	_cancel.visible = (
		not over
		and phase == "arrange"
		and _me >= 0
		and _view.get("mine") != null
		and not _left(_me)
	)


## The seconds left to arrange; a tick in the last five, and your rows go in with two left.
func _show_countdown() -> void:
	if _snapshot == null or _view.is_empty():
		return
	var timer: XomDaoRoomTimer = _snapshot.timer
	var counting: bool = (
		timer != null and _snapshot.result == null and timer.event == "arrange-over"
	)
	if not counting:
		_countdown.text = ""
		return
	var left_ms: float = timer.left - (Time.get_ticks_msec() - _shown_at)
	var left: int = ceili(maxf(0.0, left_ms) / 1000.0)
	_countdown.text = "%d giây" % left
	var arranging: bool = _arranging()
	if arranging and left <= 5 and left > 0 and left != _tick:
		_sfx("tick")
	_tick = left
	if arranging and left_ms <= 2000.0 and _auto_sent != _round and _order.size() == 13:
		_submit()


func _sfx(sound: String) -> void:
	var player: AudioStreamPlayer = _sounds.get(sound)
	if player != null and XomDaoSettings.current().sound and is_inside_tree():
		player.play()


# ── Layout ────────────────────────────────────────────────────────────────────────────────


## Puts 13 cards in rows from `at` (the top left of chi 3's row), chi 3 centred over the others.
static func _place_rows(cards: Array, at: Vector2, width: float) -> void:
	var height: float = width * XomDaoCard.RATIO
	for k: int in 13:
		var row: int = 0 if k < 5 else (1 if k < 10 else 2)
		var column: int = k - ROW_START[row]
		var x: float = at.x + column * width * STEP_X + (width * STEP_X if row == 2 else 0.0)
		var y: float = at.y + (2 - row) * height * STEP_Y
		var card: Control = cards[k]
		card.size = Vector2(width, height)
		card.pivot_offset = card.size / 2.0
		card.position = Vector2(x, y)


## How big a block of 13 cards is.
static func _block_size(width: float) -> Vector2:
	var height: float = width * XomDaoCard.RATIO
	return Vector2(width + 4.0 * width * STEP_X, height + 2.0 * height * STEP_Y)


func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	var top: float = edge
	var bottom: float = size.y - edge
	_center = Vector2(size.x / 2.0, size.y * 0.42)

	_round_label.reset_size()
	_round_label.position = Vector2((size.x - _round_label.size.x) / 2.0, top)

	# Bottom right: Hoàn tác, Tự xếp, Xong (or Xếp lại).
	var y: float = bottom
	for button: XomDaoButton in [_done, _auto, _undo]:
		button.reset_size()
		y -= button.size.y
		button.position = Vector2(right - button.size.x, y)
		y -= 10.0
	_cancel.reset_size()
	_cancel.position = Vector2(right - _cancel.size.x, bottom - _cancel.size.y)

	# The middle: what is going on, your status and the seconds left.
	var middle: float = size.y * 0.37
	for label: Label in [_info, _status, _countdown]:
		label.reset_size()
		label.size.x = 320.0
		label.position = Vector2((size.x - label.size.x) / 2.0, middle)
		middle += label.size.y

	# Your cards: three rows in the bottom middle, each row's hand on its left.
	var mine: Vector2 = _block_size(MY_CARD)
	var mine_at := Vector2((size.x - mine.x) / 2.0, bottom - mine.y)
	_place_rows(_mine, mine_at, MY_CARD)
	for row: int in 3:
		var label: Label = _my_rows[row]
		label.reset_size()
		var row_y: float = mine_at.y + (2 - row) * MY_CARD * XomDaoCard.RATIO * STEP_Y
		var row_x: float = mine_at.x + (MY_CARD * STEP_X if row == 2 else 0.0)
		label.position = Vector2(row_x - label.size.x - 10.0, row_y)
	if _picked >= 0:
		_mine[_picked].position.y -= 14.0

	# Seats round the table, each with its block of cards.
	var block: Vector2 = _block_size(THEIR_CARD)
	var row_height: float = THEIR_CARD * XomDaoCard.RATIO * STEP_Y
	for i: int in _seats.size():
		var seat: Dictionary = _seats[i]
		var slot: XomDaoPlayerSlot = seat["slot"]
		slot.reset_size()
		var box: Vector2 = slot.get_combined_minimum_size()
		var at := Vector2.ZERO
		var labels_right: bool = true
		var place: String = _slot_of(i)
		match place:
			"bottom":
				slot.position = Vector2(left, bottom - box.y)
				at = Vector2((size.x - block.x) / 2.0, bottom - block.y)
			"top":
				at = Vector2((size.x - block.x) / 2.0, top + 48.0)
				slot.position = Vector2(at.x - 24.0 - box.x, top)
			"left":
				slot.position = Vector2(left, top + XomDaoUi.TOUCH + 24.0)
				at = slot.position + Vector2(0.0, box.y + 10.0)
			"right":
				slot.position = Vector2(right - box.x, top + XomDaoUi.TOUCH + 24.0)
				at = Vector2(right - block.x, slot.position.y + box.y + 10.0)
				labels_right = false
		_place_rows(seat["cards"], at, THEIR_CARD)
		var labels: Array[Label] = []
		labels.assign(seat["labels"])
		for row: int in 3:
			var label: Label = labels[row]
			label.reset_size()
			var row_y: float = at.y + (2 - row) * row_height
			label.position = Vector2(
				at.x + block.x + 8.0 if labels_right else at.x - label.size.x - 8.0, row_y
			)
		var tag: Label = seat["tag"]
		tag.reset_size()
		tag.position = slot.position + Vector2((box.x - tag.size.x) / 2.0, -tag.size.y + 6.0)
		if place == "top":
			tag.position.y = slot.position.y + box.y
		var total: Label = seat["total"]
		total.reset_size()
		total.pivot_offset = total.size / 2.0
		if i == _me:
			total.position = Vector2(
				size.x / 2.0 - total.size.x / 2.0, mine_at.y - total.size.y - 4.0
			)
		elif place == "bottom":
			total.position = Vector2(size.x / 2.0 - total.size.x / 2.0, at.y - total.size.y)
		else:
			total.position = Vector2(at.x + (block.x - total.size.x) / 2.0, at.y + block.y + 2.0)
