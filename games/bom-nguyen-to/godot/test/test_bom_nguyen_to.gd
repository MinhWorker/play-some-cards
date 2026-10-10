extends GutTest
## Bom Nguyên Tố's arena against made-up room snapshots (no server), and the rules it mirrors.

const Rules := preload("res://content/bom-nguyen-to/rules.gd")


func _cells(crates: Array = []) -> Array:
	var cells: Array = []
	for y: int in Rules.HEIGHT:
		for x: int in Rules.WIDTH:
			var edge: bool = x == 0 or y == 0 or x == Rules.WIDTH - 1 or y == Rules.HEIGHT - 1
			var wall: bool = edge or (x % 2 == 0 and y % 2 == 0)
			cells.append("wall" if wall else ("crate" if crates.has(Vector2i(x, y)) else "floor"))
	return cells


func _fighter(id: String, seat: int, at: Vector2, extra: Dictionary = {}) -> Dictionary:
	var one: Dictionary = {
		"id": id,
		"name": "Minh" if id == "me" else "Máy %d" % seat,
		"seat": seat,
		"bot": id != "me",
		"team": seat % 2,
		"element": "fire",
		"hp": 100,
		"ready": true,
		"dir": "none",
		"facing": "right",
		"x": at.x,
		"y": at.y,
		"capacity": 2,
		"range": 2,
		"speed": 3.2,
		"skillUntil": 0,
		"skillReady": 0,
		"dashUntil": 0,
		"dashReady": 0,
		"frozenUntil": 0,
		"slowUntil": 0,
		"stunUntil": 0,
		"invulnerableUntil": 0,
		"nextBomb": 0,
		"kills": 0,
		"crates": 0,
	}
	one.merge(extra, true)
	return one


func _view(extra: Dictionary = {}) -> Dictionary:
	var view: Dictionary = {
		"phase": "playing",
		"time": 5000,
		"elapsed": 1000,
		"cells": _cells([Vector2i(3, 1)]),
		"fighters": [_fighter("me", 0, Vector2(1, 1)), _fighter("b1", 1, Vector2(11, 9))],
		"bombs": [],
		"blasts": [],
		"pickups": [],
		"nextId": 1,
		"ring": 0,
		"winners": [],
		"reason": "",
		"mode": "solo",
		"friendlyFire": false,
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary) -> Control:
	var people: Array = [{"id": "me", "name": "Minh"}, {"id": "b1", "name": "Máy 1", "bot": true}]
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "bom-nguyen-to",
				"hostId": "me",
				"players": people,
				"spectators": [],
				"seats": people,
				"status": "playing",
				"view": view,
				"result": null,
				"score": {"wins": [0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)
	var table: Control = add_child_autofree(
		load("res://content/bom-nguyen-to/main.tscn").instantiate()
	)
	table.call("bind", client)
	return table


func test_walking_keeps_to_the_lanes() -> void:
	var view := _view()
	# Right along row 1 stops at the centre before the crate at (3, 1).
	assert_eq(Rules.move(view, "me", Vector2(1, 1), Vector2(5, 0)), Vector2(2, 1))
	# Down from (1, 1) is open; a turn off-lane lines up with the open lane first.
	assert_eq(Rules.move(view, "me", Vector2(1, 1), Vector2(0, 0.5)), Vector2(1, 1.5))
	assert_eq(Rules.move(view, "me", Vector2(1.2, 1), Vector2(0, 0.5)), Vector2(1, 1.3))
	# A bomb blocks everyone but whoever has not stepped off it yet.
	view["bombs"] = [{"id": 1, "x": 2, "y": 1, "pass": ["me"]}]
	assert_eq(Rules.move(view, "b1", Vector2(1, 1), Vector2(1, 0)), Vector2(1, 1))
	assert_eq(Rules.move(view, "me", Vector2(1, 1), Vector2(1, 0)), Vector2(2, 1))


func test_blasts_stop_at_walls_and_crates() -> void:
	var view := _view()
	var bomb: Dictionary = {
		"id": 1, "x": 1, "y": 1, "element": "fire", "enhanced": false, "range": 3, "axis": "x"
	}
	var cells: Array[Vector2i] = Rules.blast_cells(view, bomb)
	assert_true(cells.has(Vector2i(2, 1)))
	assert_true(cells.has(Vector2i(3, 1)), "the crate itself is hit")
	assert_false(cells.has(Vector2i(4, 1)), "the crate stops the ray")
	assert_true(cells.has(Vector2i(1, 4)))
	assert_false(cells.has(Vector2i(0, 1)), "the fence is never in it")
	# A bomb in the blast blows with it.
	bomb["explodeAt"] = 6000
	var other: Dictionary = bomb.duplicate()
	other.merge({"id": 2, "x": 1, "y": 3, "explodeAt": 7500}, true)
	view["bombs"] = [bomb, other]
	assert_eq(float(Rules.blow_times(view)[2]), 6000.0)


func test_the_ring_and_the_clock() -> void:
	assert_true(Rules.in_ring(Vector2i(1, 5), 1))
	assert_false(Rules.in_ring(Vector2i(2, 5), 1))
	var view := _view({"elapsed": 116000, "time": 120000})
	assert_eq(Rules.next_ring(view)["at"], 120000)
	assert_gt(Rules.closing_in(view, 120000.0), 0.0)
	assert_eq(Rules.clock(view, 120000.0), "01:04")


func test_the_table_shows_the_arena_and_the_cards() -> void:
	var table := _table(_view())
	await wait_process_frames(2)
	assert_not_null(table.find_child("Fighter_0", true, false))
	assert_not_null(table.find_child("Fighter_1", true, false))
	assert_true((table.find_child("Pad", true, false) as Control).visible)
	assert_true((table.find_child("Card_1", true, false) as Control).visible)
	assert_false((table.find_child("Select", true, false) as Control).visible)


func test_choosing_shows_the_friends() -> void:
	var table := _table(_view({"phase": "select", "time": 2000}))
	await wait_process_frames(2)
	assert_true((table.find_child("Select", true, false) as Control).visible)
	assert_false((table.find_child("Pad", true, false) as Control).visible)
	assert_eq((table.find_child("Status", true, false) as Label).text, "Chọn bạn nhỏ")
	assert_eq((table.find_child("Clock", true, false) as Label).text, "00:18")
