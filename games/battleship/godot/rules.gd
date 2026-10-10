extends RefCounted
## Fleets on the 10 × 10 sea, ported from src/game/rules.ts (the server checks every fleet;
## this lets the table preview a move before sending it). cell = row * 10 + col.

const SIZE := 10
## The fleet, longest first, and each length's name.
const FLEET: Array[int] = [5, 4, 3, 3, 2]
const SHIP_NAMES: Dictionary = {
	5: "Tàu sân bay", 4: "Thiết giáp hạm", 3: "Tuần dương hạm", 2: "Khu trục hạm"
}
const LETTERS := "ABCDEFGHIJ"


## "B5": a cell's name, column letter then row number.
static func cell_name(cell: int) -> String:
	return "%s%d" % [LETTERS[cell % SIZE], cell / SIZE + 1]


## A ship of `length` from (row, col) going right or down, or [] if it leaves the sea.
static func ship_at(row: int, col: int, length: int, vertical: bool) -> Array:
	var cells: Array = []
	for i: int in length:
		var r: int = row + i if vertical else row
		var c: int = col if vertical else col + i
		if r < 0 or r >= SIZE or c < 0 or c >= SIZE:
			return []
		cells.append(r * SIZE + c)
	return cells


static func is_vertical(ship: Array) -> bool:
	return ship.size() > 1 and int(ship[1]) - int(ship[0]) == SIZE


## The up to 8 cells around `cell`.
static func around(cell: int) -> Array:
	var out: Array = []
	for dr: int in [-1, 0, 1]:
		for dc: int in [-1, 0, 1]:
			var r: int = cell / SIZE + dr
			var c: int = cell % SIZE + dc
			if (dr != 0 or dc != 0) and r >= 0 and r < SIZE and c >= 0 and c < SIZE:
				out.append(r * SIZE + c)
	return out


## Whether `ship` may join `others`: no shared cell and, with spacing, no touching.
static func fits(ship: Array, others: Array, spacing: bool) -> bool:
	if ship.is_empty():
		return false
	var taken: Dictionary = {}
	for other: Variant in others:
		for cell: Variant in other:
			taken[int(cell)] = true
	for cell: Variant in ship:
		if taken.has(int(cell)):
			return false
		if spacing:
			for near: int in around(int(cell)):
				if taken.has(near):
					return false
	return true


## Whether every cell of `ship` is among the hits in `shots` ({cell, hit}).
static func is_sunk(ship: Array, shots: Array) -> bool:
	var hit: Dictionary = {}
	for shot: Variant in shots:
		if bool((shot as Dictionary)["hit"]):
			hit[int((shot as Dictionary)["cell"])] = true
	return ship.all(func(cell: Variant) -> bool: return hit.has(int(cell)))
