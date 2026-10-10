class_name HubIslandRing
extends Control
## The lobby's ring of genre islands (docs/experience.md, "Sảnh: vòng đảo thể loại"): a tilted
## circle on the sea seen from above, like a carousel. The island at the front centre is the
## selected one; the others shrink and pale with distance. Swipe sideways or tap an island to
## turn the ring; tapping the selected island again emits `opened`.
##
## The ring fills its own rect, which the lobby keeps clear of the HUD.

signal selected_changed(index: int)
signal opened(index: int)

## Size of the islands at the back of the ring, against the front one.
const BACK_SCALE := 0.45
## The front island grows up to this times HubIsland.BASE when the sea has room.
const FRONT_MAX := 1.3
## A drag this long (in units) is a swipe, not a tap.
const TAP_SLOP := 16.0
## Units of drag per island turned.
const DRAG_PER_ISLAND := 180.0
const TURN_SECONDS := 0.35

## The ring's islands, in ring order.
var islands: Array[HubIsland] = []
## The selected island's index.
var selected: int = 0
## Where the ring stands, in islands (selected = this rounded, modulo the count).
var turn: float = 0.0:
	set(value):
		turn = value
		_layout()

var _press: Vector2 = Vector2.INF
var _press_turn: float = 0.0
var _dragging: bool = false
var _tween: Tween


## The ring's entries for these genres: the main genres first, then the others, each in their
## `order`; "Sắp có" after them while there is no secondary genre. `ready` lists genre ids with
## at least one ready game: the others are locked islands in fog.
static func entries(genres: Array[XomDaoGenre], ready: Array[String]) -> Array[Dictionary]:
	var sorted: Array[XomDaoGenre] = genres.duplicate()
	sorted.sort_custom(
		func(a: XomDaoGenre, b: XomDaoGenre) -> bool:
			return a.order < b.order if a.main == b.main else a.main
	)
	var out: Array[Dictionary] = []
	for genre: XomDaoGenre in sorted:
		(
			out
			. append(
				{
					"id": genre.id,
					"name": genre.name,
					"island": genre.island,
					"locked": not ready.has(genre.id),
				}
			)
		)
	if not sorted.any(func(g: XomDaoGenre) -> bool: return not g.main):
		out.append({"id": HubIsland.SOON, "name": "Sắp có", "island": "", "locked": true})
	return out


## Where each of `count` islands goes in `area` when the ring stands at `at_turn`: its rect and
## how near the front it is (1 front, 0 back). The front island is as big as the area allows,
## up to FRONT_MAX.
static func layout(count: int, at_turn: float, area: Rect2) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if count == 0:
		return out
	var base: Vector2 = HubIsland.BASE
	# The front island and the one behind it, stacked, must fit the height with some ring between.
	var front: float = minf(
		FRONT_MAX, area.size.y / (base.y * (1.0 + BACK_SCALE) / 2.0 + base.y * 0.9)
	)
	front = minf(front, area.size.x / (base.x * 2.2))
	var front_size: Vector2 = base * front
	var back_h: float = front_size.y * BACK_SCALE
	var ry: float = maxf(0.0, (area.size.y - front_size.y / 2.0 - back_h / 2.0) / 2.0)
	var side_w: float = front_size.x * (1.0 + BACK_SCALE) / 2.0
	var rx: float = maxf(0.0, area.size.x / 2.0 - side_w / 2.0)
	var center := Vector2(area.get_center().x, area.position.y + back_h / 2.0 + ry)
	for i: int in count:
		var angle: float = TAU * (i - at_turn) / count
		var near: float = (cos(angle) + 1.0) / 2.0
		var island_size: Vector2 = front_size * lerpf(BACK_SCALE, 1.0, near)
		var at: Vector2 = center + Vector2(sin(angle) * rx, cos(angle) * ry)
		out.append({"rect": Rect2(at - island_size / 2.0, island_size), "depth": near})
	return out


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(_layout)


## Puts these entries (see `entries`) on the ring, `selected_index` at the front.
func set_entries(list: Array[Dictionary], selected_index: int = 0) -> void:
	for island: HubIsland in islands:
		island.queue_free()
	islands.clear()
	for entry: Dictionary in list:
		var island := HubIsland.create(entry)
		islands.append(island)
		add_child(island)
	selected = clampi(selected_index, 0, maxi(0, list.size() - 1))
	turn = selected


## Turns the ring to an island the short way round.
func select(index: int, animate: bool = true) -> void:
	var count: int = islands.size()
	if count == 0:
		return
	var steps: float = wrapf(index - turn, -count / 2.0, count / 2.0)
	_turn_to(turn + steps, animate)


## The selected island's entry id ("" with no islands).
func selected_id() -> String:
	return islands[selected].genre_id if selected < islands.size() else ""


func _turn_to(target: float, animate: bool) -> void:
	if _tween != null:
		_tween.kill()
	if animate and is_inside_tree():
		_tween = create_tween()
		(
			_tween
			. tween_property(self, "turn", target, TURN_SECONDS)
			. set_trans(Tween.TRANS_CUBIC)
			. set_ease(Tween.EASE_OUT)
		)
	else:
		turn = target
	_set_selected(posmod(roundi(target), islands.size()))


func _set_selected(index: int) -> void:
	if index == selected:
		return
	selected = index
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	selected_changed.emit(index)


func _layout() -> void:
	var spots: Array[Dictionary] = layout(islands.size(), turn, Rect2(Vector2.ZERO, size))
	var order: Array[int] = []
	for i: int in islands.size():
		var island: HubIsland = islands[i]
		var spot: Dictionary = spots[i]
		var rect: Rect2 = spot["rect"]
		island.position = rect.position
		island.size = rect.size
		island.depth = spot["depth"]
		island.selected = i == posmod(roundi(turn), islands.size())
		order.append(i)
	# The nearest islands are drawn last, on top.
	order.sort_custom(func(a: int, b: int) -> bool: return spots[a]["depth"] < spots[b]["depth"])
	for i: int in order:
		move_child(islands[i], -1)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_press = event.position
			_press_turn = turn
			_dragging = false
		elif _press != Vector2.INF:
			if _dragging:
				_turn_to(roundf(turn), true)
			else:
				_tap(event.position)
			_press = Vector2.INF
		accept_event()
	elif event is InputEventMouseMotion and _press != Vector2.INF:
		var dx: float = event.position.x - _press.x
		if absf(dx) > TAP_SLOP:
			_dragging = true
		if _dragging and not islands.is_empty():
			if _tween != null:
				_tween.kill()
			turn = _press_turn - dx / DRAG_PER_ISLAND
			_set_selected(posmod(roundi(turn), islands.size()))
		accept_event()


## The nearest island under the tap turns to the front, or opens when it already is.
func _tap(at: Vector2) -> void:
	var hit: int = -1
	var best: float = -1.0
	for i: int in islands.size():
		var island: HubIsland = islands[i]
		var body: Rect2 = island.body_rect()
		body.position += island.position
		if body.has_point(at) and island.depth > best:
			hit = i
			best = island.depth
	if hit < 0:
		return
	if hit == selected and is_equal_approx(turn, roundf(turn)):
		opened.emit(hit)
	else:
		select(hit)
