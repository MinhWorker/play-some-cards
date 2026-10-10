extends RefCounted
## The arena's rules the screen mirrors, ported from src/game/model.ts and src/game/arena.ts (the
## server decides; this walks your own fighter ahead of the snapshots, lights up where bombs will
## blow and which ring closes next). A view is the game's State: `cells` row by row, fighters,
## bombs, blasts and pickups with x/y in cells.

const WIDTH := 13
const HEIGHT := 11
const MATCH_TIME := 180000
const SELECT_TIME := 20000
const SHRINK_START := 120000
const SHRINK_EVERY := 12000
const SMALLEST_RING := 4
## Half the side of a fighter's square footprint, in cells.
const BODY := 0.26
const EPS := 1e-6
const ELEMENTS: Array[String] = ["fire", "water", "lightning", "ice", "wind"]
const DIRECTIONS: Dictionary = {
	"up": Vector2i(0, -1),
	"down": Vector2i(0, 1),
	"left": Vector2i(-1, 0),
	"right": Vector2i(1, 0),
	"none": Vector2i.ZERO,
}
## The five elemental friends: their name, element, skill, what it does and their colours.
const CHARACTERS: Dictionary = {
	"fire":
	{
		"name": "Cáo Lửa",
		"element": "Hỏa",
		"skill": "Thiêu Đốt",
		"about": "Bom +1 tầm nổ và +15 sát thương trong 6 giây",
		"color": Color("#ff8256"),
		"bar": Color("#f25f6b"),
		"pastel": Color("#ffe0cc"),
	},
	"water":
	{
		"name": "Hải Cẩu Nước",
		"element": "Thủy",
		"skill": "Thủy Vực",
		"about": "Bom nổ hình chữ nhật, làm chậm 2 giây",
		"color": Color("#56bcff"),
		"bar": Color("#4aa8f0"),
		"pastel": Color("#d3efff"),
	},
	"lightning":
	{
		"name": "Thỏ Sét",
		"element": "Lôi",
		"skill": "Lôi Kích",
		"about": "Bom nổ thẳng dài, nhảy điện hoặc choáng",
		"color": Color("#b895ff"),
		"bar": Color("#a77cf0"),
		"pastel": Color("#ebdfff"),
	},
	"ice":
	{
		"name": "Cánh Cụt Băng",
		"element": "Băng",
		"skill": "Băng Bộc",
		"about": "Đóng băng đối thủ và giữ bom lại",
		"color": Color("#a9edff"),
		"bar": Color("#37c2d6"),
		"pastel": Color("#d8f6fb"),
	},
	"wind":
	{
		"name": "Mèo Gió",
		"element": "Phong",
		"skill": "Cuồng Phong",
		"about": "Đẩy bom và đối thủ phía trước, 20 sát thương",
		"color": Color("#6ce7c2"),
		"bar": Color("#55c98a"),
		"pastel": Color("#d9f5df"),
	},
}


static func tile_at(view: Dictionary, x: int, y: int) -> String:
	if x < 0 or y < 0 or x >= WIDTH or y >= HEIGHT:
		return "wall"
	return str(view["cells"][y * WIDTH + x])


static func bomb_at(view: Dictionary, x: int, y: int) -> Dictionary:
	for bomb: Dictionary in view["bombs"]:
		if int(bomb["x"]) == x and int(bomb["y"]) == y:
			return bomb
	return {}


## Whether a fighter (by id) may step on the cell: floor, and no bomb it has not stepped off.
static func walkable(view: Dictionary, x: int, y: int, id: String) -> bool:
	if tile_at(view, x, y) != "floor":
		return false
	var bomb: Dictionary = bomb_at(view, x, y)
	return bomb.is_empty() or (bomb["pass"] as Array).has(id)


## Where a fighter at `from` ends up walking `delta` cells (arena.ts moveFighter): along the
## lanes, lined up with the nearer open lane on a turn, stopping at the centre before a wall,
## crate or bomb.
static func move(view: Dictionary, id: String, from: Vector2, delta: Vector2) -> Vector2:
	var horizontal: bool = absf(delta.x) >= absf(delta.y)
	var amount: float = delta.x if horizontal else delta.y
	if amount == 0.0:
		return from
	var sign_of: float = signf(amount)
	var budget: float = absf(amount)
	var along: float = from.x if horizontal else from.y
	var cross: float = from.y if horizontal else from.x
	var open := func(a: int, c: int) -> bool:
		return walkable(view, a if horizontal else c, c if horizontal else a, id)
	var near: float = roundf(cross)
	if absf(cross - near) > EPS:
		var far: float = near + 1.0 if cross > near else near - 1.0
		var ahead: int = int(roundf(along) + sign_of)
		var lane: float = near
		if not open.call(ahead, int(near)) and open.call(ahead, int(far)):
			lane = far
		var shift: float = minf(budget, absf(lane - cross))
		cross += signf(lane - cross) * shift
		budget -= shift
	if absf(cross - roundf(cross)) <= EPS:
		cross = roundf(cross)
		while budget > EPS:
			var cell: float = roundf(along)
			var to_centre: float = (cell - along) * sign_of
			if to_centre > EPS:
				var step: float = minf(budget, to_centre)
				along += sign_of * step
				budget -= step
				continue
			if not open.call(int(cell + sign_of), int(cross)):
				break
			var stride: float = minf(budget, 1.0 + to_centre)
			along += sign_of * stride
			budget -= stride
	return Vector2(along, cross) if horizontal else Vector2(cross, along)


## The cells a bomb's blast covers (arena.ts blastCells): rays stop at a wall and include the
## first crate or bomb; lightning makes one long line, water three parallel ones.
static func blast_cells(view: Dictionary, bomb: Dictionary) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	var at := Vector2i(int(bomb["x"]), int(bomb["y"]))
	var element: String = str(bomb["element"])
	var enhanced: bool = bool(bomb.get("enhanced", false))
	var range_of: int = int(bomb["range"])
	var along := Vector2i(1, 0) if str(bomb.get("axis", "x")) == "x" else Vector2i(0, 1)
	_add(out, at)
	if enhanced and element == "lightning":
		_ray(view, bomb, out, at, along, range_of * 2 + 1)
		_ray(view, bomb, out, at, -along, range_of * 2 + 1)
	elif enhanced and element == "water":
		for offset: int in [-1, 0, 1]:
			var start := Vector2i(at.x + along.y * offset, at.y + along.x * offset)
			var tile: String = tile_at(view, start.x, start.y)
			if tile == "wall":
				continue
			_add(out, start)
			if tile == "crate" or _other_bomb(view, bomb, start):
				continue
			_ray(view, bomb, out, start, along, range_of)
			_ray(view, bomb, out, start, -along, range_of)
	else:
		for step: Vector2i in [Vector2i(0, -1), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(1, 0)]:
			_ray(view, bomb, out, at, step, range_of)
	return out


static func _ray(
	view: Dictionary,
	bomb: Dictionary,
	out: Array[Vector2i],
	start: Vector2i,
	step: Vector2i,
	n: int
) -> void:
	for i: int in range(1, n + 1):
		var cell: Vector2i = start + step * i
		var tile: String = tile_at(view, cell.x, cell.y)
		if tile == "wall":
			return
		_add(out, cell)
		if tile == "crate" or _other_bomb(view, bomb, cell):
			return


static func _other_bomb(view: Dictionary, bomb: Dictionary, cell: Vector2i) -> bool:
	var other: Dictionary = bomb_at(view, cell.x, cell.y)
	return not other.is_empty() and int(other["id"]) != int(bomb["id"])


static func _add(out: Array[Vector2i], cell: Vector2i) -> void:
	if not out.has(cell):
		out.append(cell)


## When each bomb really blows (bot.ts dangerMap): a blast reaching another bomb sets it off.
static func blow_times(view: Dictionary) -> Dictionary:
	var bombs: Array = view["bombs"]
	var times: Dictionary = {}
	var cells: Dictionary = {}
	for bomb: Dictionary in bombs:
		var id: int = int(bomb["id"])
		times[id] = maxf(float(bomb["explodeAt"]), float(bomb.get("frozenUntil", 0)))
		cells[id] = blast_cells(view, bomb)
	for _pass: int in bombs.size():
		for bomb: Dictionary in bombs:
			if bool(bomb.get("enhanced", false)) and str(bomb["element"]) == "ice":
				continue
			var time: float = times[int(bomb["id"])]
			for other: Dictionary in bombs:
				var other_id: int = int(other["id"])
				if other_id == int(bomb["id"]) or float(other.get("frozenUntil", 0)) > time:
					continue
				var at := Vector2i(int(other["x"]), int(other["y"]))
				if (cells[int(bomb["id"])] as Array).has(at):
					times[other_id] = minf(times[other_id], time)
	return times


## The cells about to blow: [{cell, start, element, frozen}], the earliest bomb per cell.
static func warnings(view: Dictionary) -> Array[Dictionary]:
	var times: Dictionary = blow_times(view)
	var by_cell: Dictionary = {}
	var now: float = float(view["time"])
	for bomb: Dictionary in view["bombs"]:
		var start: float = times[int(bomb["id"])]
		for cell: Vector2i in blast_cells(view, bomb):
			if by_cell.has(cell) and float(by_cell[cell]["start"]) <= start:
				continue
			by_cell[cell] = {
				"cell": cell,
				"start": start,
				"element": str(bomb["element"]),
				"frozen": float(bomb.get("frozenUntil", 0)) > now,
			}
	var out: Array[Dictionary] = []
	for cell: Vector2i in by_cell:
		out.append(by_cell[cell])
	return out


## Whether a cell lies in ring `ring` or further out (ring 1 = the cells along the fence).
static func in_ring(cell: Vector2i, ring: int) -> bool:
	return (
		cell.x <= ring
		or cell.y <= ring
		or cell.x >= WIDTH - 1 - ring
		or cell.y >= HEIGHT - 1 - ring
	)


## The ring that closes next and when (play time, `elapsed`): {ring, at}, or {} at the smallest.
static func next_ring(view: Dictionary) -> Dictionary:
	var ring: int = int(view.get("ring", 0)) + 1
	if ring > SMALLEST_RING:
		return {}
	return {"ring": ring, "at": SHRINK_START + (ring - 1) * SHRINK_EVERY}


## How long until the next ring closes when that is within `warning` ms, else -1.
static func closing_in(view: Dictionary, now: float, warning: float = 5000.0) -> float:
	if str(view["phase"]) != "playing":
		return -1.0
	var next: Dictionary = next_ring(view)
	if next.is_empty():
		return -1.0
	var left: float = float(next["at"]) - (float(view["elapsed"]) + now - float(view["time"]))
	return left if left > 0.0 and left <= warning else -1.0


## The fighter with this id in the view, or {}.
static func fighter(view: Dictionary, id: String) -> Dictionary:
	for one: Dictionary in view.get("fighters", []):
		if str(one["id"]) == id:
			return one
	return {}


## Bombs this fighter can still place now.
static func bombs_left(view: Dictionary, one: Dictionary) -> int:
	var live: int = 0
	for bomb: Dictionary in view["bombs"]:
		if str(bomb["owner"]) == str(one["id"]):
			live += 1
	return maxi(0, int(one["capacity"]) - live)


## The match mode as players see it.
static func mode_name(view: Dictionary) -> String:
	if str(view.get("mode", "solo")) == "teams":
		return "Đấu đội 2v2"
	return "Luyện tập" if (view["fighters"] as Array).size() == 1 else "Sinh tồn đơn"


## The clock: time left to choose, or of the match, as mm:ss.
static func clock(view: Dictionary, now: float) -> String:
	var left: float
	if str(view["phase"]) == "select":
		left = SELECT_TIME - now
	else:
		left = MATCH_TIME - (float(view["elapsed"]) + now - float(view["time"]))
		if str(view["phase"]) != "playing":
			left = MATCH_TIME - float(view["elapsed"])
	var seconds: int = maxi(0, ceili(left / 1000.0))
	return "%02d:%02d" % [seconds / 60, seconds % 60]
