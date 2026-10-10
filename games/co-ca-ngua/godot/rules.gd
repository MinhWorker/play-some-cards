extends RefCounted
## The board and the moves the table shows, ported from src/game/model.ts and src/scenes/board.ts
## (the server decides; this lights up the horses that can go and places them). A horse's
## position: -1 in the paddock, 0–51 the distance from its start, 52–57 home squares 1–6.

const TRACK_LENGTH := 52
## Colours by index (red, blue, yellow, green): their names and ink.
const COLOR_NAMES: Array[String] = ["Đỏ", "Xanh dương", "Vàng", "Xanh lá"]
const INKS: Array[Color] = [Color("#E95853"), Color("#52A5EE"), Color("#F7C94F"), Color("#54BB86")]
## One quarter of the track on the 15 × 15 grid; the others turn round the middle.
const SEGMENT: Array = [
	[0, 6],
	[1, 6],
	[2, 6],
	[3, 6],
	[4, 6],
	[5, 6],
	[6, 5],
	[6, 4],
	[6, 3],
	[6, 2],
	[6, 1],
	[6, 0],
	[7, 0]
]


static func rotate(x: float, y: float, color: int) -> Vector2:
	var at := Vector2(x, y)
	for i: int in color:
		at = Vector2(14.0 - at.y, at.x)
	return at


static func square_of(colors: Array, seat: int, position: int) -> int:
	return (int(colors[seat]) * 13 + position) % TRACK_LENGTH


## Where a horse stands on the 15 × 15 grid (the middle of a cell is its whole number).
static func point(colors: Array, seat: int, horse: int, position: int) -> Vector2:
	var color: int = int(colors[seat])
	if position < 0:
		return rotate(1.6 + (horse % 2) * 1.8, 1.6 + (horse / 2) * 1.8, color)
	if position >= TRACK_LENGTH:
		return rotate(position - 51, 7, color)
	var square: int = square_of(colors, seat, position)
	var cell: Array = SEGMENT[square % 13]
	return rotate(cell[0], cell[1], square / 13)


## The horses of the seat on turn that can go with the dice: {horse, to, path, capture, finish}.
static func legal_moves(state: Dictionary) -> Array:
	var dice: Variant = state.get("dice")
	var seat: int = int(state["turn"])
	var rankings: Array = state["rankings"]
	if dice == null or state.get("winner") != null or rankings.has(float(seat)):
		return []
	if rankings.has(seat):
		return []
	var roll: int = int(dice)
	var all: Array = state["horses"]
	var team: Array = all[seat]
	var finished: int = team.filter(func(h: Variant) -> bool: return bool(h["finished"])).size()
	var target: int = 6 - finished
	var moves: Array = []
	for index: int in team.size():
		var horse: Dictionary = team[index]
		if bool(horse["finished"]):
			continue
		var from: int = int(horse["position"])
		var to: int
		if from < 0:
			if roll != 1 and roll != 6:
				continue
			to = 0
		elif from == TRACK_LENGTH - 1:
			if roll > target:
				continue
			to = TRACK_LENGTH - 1 + roll
		elif from >= TRACK_LENGTH:
			if roll != from - TRACK_LENGTH + 2 or roll > target:
				continue
			to = from + 1
		else:
			to = from + roll
			if to >= TRACK_LENGTH:
				continue
		var path: Array = []
		for step: int in range(from + 1, to + 1):
			path.append(step)
		var blocked: bool = false
		for step: int in path.slice(0, path.size() - 1):
			if not _occupied(state, seat, index, step).is_empty():
				blocked = true
		if blocked:
			continue
		var capture: Dictionary = _occupied(state, seat, index, to)
		if not capture.is_empty() and (int(capture["seat"]) == seat or to >= TRACK_LENGTH):
			continue
		(
			moves
			. append(
				{
					"horse": index,
					"to": to,
					"path": path,
					"capture": capture,
					"finish": to == TRACK_LENGTH - 1 + target,
				}
			)
		)
	return moves


static func _occupied(state: Dictionary, seat: int, moving: int, position: int) -> Dictionary:
	var colors: Array = state["colors"]
	var all: Array = state["horses"]
	for s: int in all.size():
		var team: Array = all[s]
		for h: int in team.size():
			var at: int = int(team[h]["position"])
			if (s == seat and h == moving) or at < 0:
				continue
			if position >= TRACK_LENGTH:
				if s == seat and at == position:
					return {"seat": s, "horse": h}
			elif (
				at < TRACK_LENGTH and square_of(colors, s, at) == square_of(colors, seat, position)
			):
				return {"seat": s, "horse": h}
	return {}
