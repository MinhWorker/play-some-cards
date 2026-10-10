extends Control
## One 10 × 10 sea of Bắn Tàu: the water and its grid with A–J over the columns and 1–10 by the
## rows, the ships (top-down sprites turned along their length, dark once sunk), the shots (a
## ring of foam for a miss, fire for a hit, a gold frame round the last one) and, while you
## arrange, the picked ship and where a dragged ship would land. The table sets `cell` and the
## data; it reads taps from `gui_input` and turns them into cells with `cell_at`.

const SIZE := 10
const LETTERS := "ABCDEFGHIJ"
const WATER := Color(0.12, 0.37, 0.55, 0.55)
const GRID := Color(0.44, 0.66, 0.81, 0.45)
const FRAME := Color("#0F3552")
const HIT := Color("#FF5A36")
const MISS := Color("#EAF6FF")
const PICKED := Color("#FFE066")
const GOOD := Color(0.3, 0.9, 0.45, 0.45)
const BAD := Color(1.0, 0.23, 0.19, 0.45)

## One cell's side, in design units.
var cell: float = 40.0:
	set(value):
		cell = value
		size = Vector2.ONE * cell * SIZE
		_place_ships()
		queue_redraw()
		_marks.queue_redraw()
## The ships shown: each its cells along its length.
var ships: Array = []
## Which of `ships` are sunk.
var sunk: Array[bool] = []
## The shots on this sea: {cell, hit}.
var shots: Array = []
var last: int = -1
var picked: int = -1
## Where a dragged ship would land, and whether it may.
var ghost: Array = []
var ghost_ok: bool = true
## Letters and numbers round the grid.
var labels: bool = true:
	set(value):
		labels = value
		queue_redraw()

var _marks := Control.new()
var _sprites := Control.new()
var _textures: Dictionary = {}


func _init() -> void:
	clip_contents = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	_sprites.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_sprites)
	_marks.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_marks.draw.connect(_draw_marks)
	add_child(_marks)


## Shows these ships (`sunk` by index) and shots.
func show_sea(new_ships: Array, new_sunk: Array[bool], new_shots: Array, new_last: int) -> void:
	ships = new_ships
	sunk = new_sunk
	shots = new_shots
	last = new_last
	_place_ships()
	_marks.queue_redraw()


func redraw_marks() -> void:
	_marks.queue_redraw()


## The cell under a point in this sea's coordinates, or -1 off the grid.
func cell_at(at: Vector2) -> int:
	var col: int = floori(at.x / cell)
	var row: int = floori(at.y / cell)
	if col < 0 or col >= SIZE or row < 0 or row >= SIZE:
		return -1
	return row * SIZE + col


## The top left of a cell in this sea's coordinates.
func cell_position(at: int) -> Vector2:
	return Vector2(at % SIZE, at / SIZE) * cell


func _texture(length: int) -> Texture2D:
	if not _textures.has(length):
		_textures[length] = load("res://content/battleship/art/ship-%d.webp" % length)
	return _textures[length]


func _place_ships() -> void:
	_sprites.size = size
	_marks.size = size
	for child: Node in _sprites.get_children():
		child.queue_free()
	for i: int in ships.size():
		var cells: Array = ships[i]
		if cells.is_empty():
			continue
		var length: int = cells.size()
		var first: int = int(cells.min())
		var vertical: bool = length > 1 and absi(int(cells[1]) - int(cells[0])) == SIZE
		var sprite := TextureRect.new()
		sprite.texture = _texture(clampi(length, 2, 5))
		sprite.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		sprite.mouse_filter = Control.MOUSE_FILTER_IGNORE
		sprite.size = Vector2(length * cell, cell)
		var at: Vector2 = cell_position(first)
		if vertical:
			sprite.rotation = PI / 2.0
			sprite.position = at + Vector2(cell, 0.0)
		else:
			sprite.position = at
		if i < sunk.size() and sunk[i]:
			sprite.modulate = Color(0.45, 0.42, 0.42)
		_sprites.add_child(sprite)


func _draw() -> void:
	var side: float = cell * SIZE
	draw_rect(Rect2(Vector2.ZERO, size), WATER)
	for i: int in SIZE + 1:
		draw_line(Vector2(i * cell, 0.0), Vector2(i * cell, side), GRID, 1.0)
		draw_line(Vector2(0.0, i * cell), Vector2(side, i * cell), GRID, 1.0)
	draw_rect(Rect2(Vector2.ZERO, size), FRAME, false, maxf(2.0, cell * 0.06))
	if not labels:
		return
	var font: Font = XomDaoUi.display_font(700)
	var font_size: int = clampi(roundi(cell * 0.42), 12, 24)
	for i: int in SIZE:
		draw_string(
			font,
			Vector2(i * cell, -font_size * 0.35),
			LETTERS[i],
			HORIZONTAL_ALIGNMENT_CENTER,
			cell,
			font_size,
			Color("#DFF1FF")
		)
		draw_string(
			font,
			Vector2(-font_size * 1.6, i * cell + cell / 2.0 + font_size * 0.35),
			str(i + 1),
			HORIZONTAL_ALIGNMENT_RIGHT,
			font_size * 1.3,
			font_size,
			Color("#DFF1FF")
		)


func _draw_marks() -> void:
	for at: Variant in ghost:
		_marks.draw_rect(
			Rect2(cell_position(int(at)), Vector2.ONE * cell), GOOD if ghost_ok else BAD
		)
	if picked >= 0 and picked < ships.size():
		for at: Variant in ships[picked]:
			_marks.draw_rect(
				Rect2(cell_position(int(at)) + Vector2.ONE * 2.0, Vector2.ONE * (cell - 4.0)),
				PICKED,
				false,
				3.0
			)
	for shot: Variant in shots:
		var at: int = int((shot as Dictionary)["cell"])
		var middle: Vector2 = cell_position(at) + Vector2.ONE * cell / 2.0
		if bool((shot as Dictionary)["hit"]):
			_marks.draw_circle(middle, cell * 0.3, HIT)
			_marks.draw_circle(middle, cell * 0.14, Color("#FFD27A"))
		else:
			_marks.draw_arc(middle, cell * 0.2, 0.0, TAU, 24, MISS, maxf(2.0, cell * 0.07))
	if last >= 0:
		_marks.draw_rect(
			Rect2(cell_position(last) + Vector2.ONE, Vector2.ONE * (cell - 2.0)), PICKED, false, 2.0
		)
