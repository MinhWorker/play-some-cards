extends Control
## Your cards at the bottom of the table, weakest on the left, overlapping when they need to.
## Tap a card to pick it (it rises) or put it back; press and slide across cards to pick or put
## back all of them at once. Each card is a child named Card_<n> (the card's number, 0–51).

signal picked_changed

const CardView := preload("res://content/tien-len/card.gd")

## How far a picked card rises, in card heights.
const LIFT := 0.2
const SLIDE_SECONDS := 0.18

## The card width (set by the table's layout).
var card_width: float = 84.0:
	set(value):
		if value != card_width:
			card_width = value
			_layout(false)

## The cards in the hand, in order.
var cards: Array[int] = []
## The picked cards, in the order they were picked.
var picked: Array[int] = []

var _views: Dictionary = {}
## Running moves per card, ended when the hand lays out again.
var _tweens: Dictionary = {}
## While a press slides across the hand: whether it picks (true) or puts back (false).
var _paint: Variant = null
var _sound: AudioStreamPlayer


func _init() -> void:
	name = "Hand"
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(_layout.bind(false))
	_sound = AudioStreamPlayer.new()
	_sound.stream = load("res://content/tien-len/sounds/card-select.wav")
	_sound.max_polyphony = 3
	add_child(_sound)


## Shows these cards (sorted weakest first). Cards that stay keep their node; picks of cards that
## left are dropped.
func set_cards(next: Array[int]) -> void:
	var sorted: Array[int] = next.duplicate()
	sorted.sort()
	if sorted == cards:
		return
	for card: int in cards:
		if not sorted.has(card):
			var view: CardView = _views[card]
			_stop(card)
			_views.erase(card)
			view.queue_free()
	for card: int in sorted:
		if not _views.has(card):
			var view: CardView = CardView.create(card, card_width) as CardView
			view.name = "Card_%d" % card
			add_child(view)
			_views[card] = view
	var kept: Array[int] = []
	for card: int in picked:
		if sorted.has(card):
			kept.append(card)
	var changed: bool = kept.size() != picked.size()
	picked = kept
	cards = sorted
	_layout(is_inside_tree())
	if changed:
		picked_changed.emit()


## The node of a card in the hand, or null.
func view_of(card: int) -> CardView:
	return _views.get(card)


## Where a card sits (its rect in the hand's own coordinates, before rising).
func slot_rect(index: int, count: int = -1) -> Rect2:
	var n: int = cards.size() if count < 0 else count
	var height: float = card_width * CardView.RATIO
	var step: float = card_width * 0.62
	if n > 1:
		step = minf(step, (size.x - card_width) / (n - 1))
	var width: float = card_width + step * maxi(0, n - 1)
	var left: float = (size.x - width) / 2.0
	return Rect2(left + step * index, size.y - height, card_width, height)


func set_picked(next: Array[int]) -> void:
	picked.assign(next.filter(func(card: int) -> bool: return cards.has(card)))
	_layout(true)
	picked_changed.emit()


func clear_picks() -> void:
	if picked.is_empty():
		return
	set_picked([])


func _toggle(card: int, on: bool) -> void:
	if picked.has(card) == on:
		return
	if on:
		picked.append(card)
	else:
		picked.erase(card)
	if XomDaoSettings.current().sound and is_inside_tree():
		_sound.play()
	_layout(true)
	picked_changed.emit()


func _layout(animate: bool) -> void:
	for i: int in cards.size():
		var card: int = cards[i]
		var view: CardView = _views[card]
		var rect: Rect2 = slot_rect(i)
		var up: bool = picked.has(card)
		if up:
			rect.position.y -= rect.size.y * LIFT
		_stop(card)
		view.card = card
		view.modulate.a = 1.0
		view.scale = Vector2.ONE
		view.picked = up
		view.size = rect.size
		move_child(view, -1)
		if animate and view.position != Vector2.ZERO:
			var tween: Tween = view.create_tween()
			tween.tween_property(view, "position", rect.position, SLIDE_SECONDS).set_trans(
				Tween.TRANS_QUAD
			)
			_tweens[card] = tween
		else:
			view.position = rect.position


## Deals the hand: each card flies face down from `from` (in the hand's coordinates) to its
## place, `step` seconds after the one before it, after `wait`, then turns face up.
func deal(from: Vector2, wait: float, step: float, fly: float) -> void:
	_layout(false)
	for i: int in cards.size():
		var card: int = cards[i]
		var view: CardView = _views[card]
		var target: Vector2 = view.position
		view.position = from - view.size / 2.0
		view.card = -1
		view.modulate.a = 0.0
		var tween: Tween = view.create_tween()
		tween.tween_interval(wait + i * step)
		tween.tween_property(view, "modulate:a", 1.0, 0.05)
		tween.tween_property(view, "position", target, fly).set_trans(Tween.TRANS_QUAD).set_ease(
			Tween.EASE_OUT
		)
		tween.tween_property(view, "scale:x", 0.0, 0.1)
		tween.tween_callback(func() -> void: view.card = card)
		tween.tween_property(view, "scale:x", 1.0, 0.1)
		_tweens[card] = tween


func _stop(card: int) -> void:
	var tween: Tween = _tweens.get(card)
	if tween != null and tween.is_valid():
		tween.kill()
	_tweens.erase(card)


## The card under a point (the topmost, so the visible strip of each card), or -1.
func card_at(point: Vector2) -> int:
	for i: int in range(cards.size() - 1, -1, -1):
		var card: int = cards[i]
		var rect: Rect2 = slot_rect(i)
		# A picked card can be taken from where it rose to or from its place in the row.
		if picked.has(card):
			rect = rect.merge(Rect2(rect.position - Vector2(0, rect.size.y * LIFT), rect.size))
		if rect.has_point(point):
			return card
	return -1


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			var card: int = card_at(event.position)
			if card >= 0:
				_paint = not picked.has(card)
				_toggle(card, _paint)
		else:
			_paint = null
		accept_event()
	elif event is InputEventMouseMotion and _paint != null:
		var card: int = card_at(event.position)
		if card >= 0:
			_toggle(card, _paint)
		accept_event()
