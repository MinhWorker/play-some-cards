extends GutTest
## Bắn Tàu's table against made-up room snapshots (no server), and the fleet rules it mirrors.

const Rules := preload("res://content/battleship/rules.gd")
const FLEET: Array = [[0, 1, 2, 3, 4], [20, 21, 22, 23], [40, 41, 42], [60, 61, 62], [80, 81]]


func _ships(fleet: Array) -> Array:
	return fleet.map(func(cells: Array) -> Dictionary: return {"cells": cells})


func _snapshot(view: Dictionary) -> XomDaoRoomSnapshot:
	var people: Array = [{"id": "me", "name": "Minh"}, {"id": "b1", "name": "Máy", "bot": true}]
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "battleship",
				"hostId": "me",
				"players": people,
				"spectators": [],
				"seats": people,
				"status": "playing",
				"view": view,
				"options": {"spacing": true},
				"result": null,
				"score": {"wins": [0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _view(extra: Dictionary = {}) -> Dictionary:
	var view: Dictionary = {
		"players": ["me", "b1"],
		"phase": "setup",
		"ready": [false, true],
		"turn": 0,
		"last": null,
		"end": null,
		"waters":
		[
			{"ships": _ships(FLEET), "shots": [], "sunk": []},
			{"ships": [], "shots": [], "sunk": []},
		],
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view)
	var table: Control = add_child_autofree(
		load("res://content/battleship/main.tscn").instantiate()
	)
	table.call("bind", client)
	return table


func _text(table: Control, name_of: String) -> String:
	return (table.find_child(name_of, true, false) as Label).text


func test_fleet_rules() -> void:
	assert_eq(Rules.cell_name(14), "E2")
	assert_eq(Rules.ship_at(0, 8, 3, false), [])
	assert_eq(Rules.ship_at(7, 0, 3, true), [70, 80, 90])
	assert_false(Rules.fits([10, 11], [[0, 1]], true))
	assert_true(Rules.fits([10, 11], [[0, 1]], false))
	assert_false(Rules.fits([1, 2], [[0, 1]], false))


func test_arranging_picks_and_turns_a_ship() -> void:
	var table := _table(_view())
	assert_eq(_text(table, "Status"), "Xếp tàu")
	assert_true((table.find_child("Ready", true, false) as Control).visible)
	assert_false((table.find_child("Small", true, false) as Control).visible)
	var big: Control = table.find_child("Big", true, false)
	var at: Vector2 = big.call("cell_position", 80) + Vector2.ONE * 5.0
	for times: int in 2:
		for pressed: bool in [true, false]:
			var tap := InputEventMouseButton.new()
			tap.button_index = MOUSE_BUTTON_LEFT
			tap.pressed = pressed
			tap.position = at
			big.gui_input.emit(tap)
	# Picked, then turned down the sea from its first cell.
	assert_eq(big.get("ships")[4], [80, 90])


func test_battle_shows_the_turn_and_sunk_ships() -> void:
	var view := _view(
		{
			"phase": "battle",
			"ready": [true, true],
			"last": {"by": 0, "cell": 81, "hit": true, "sunk": [80, 81]},
		}
	)
	view["waters"][1] = {
		"ships": [{"cells": [80, 81]}],
		"shots": [{"cell": 80, "hit": true}, {"cell": 81, "hit": true}, {"cell": 5, "hit": false}],
		"sunk": [2],
	}
	var table := _table(view)
	assert_eq(_text(table, "Status"), "Lượt bạn")
	assert_eq(_text(table, "Shot"), "B9: Chìm Khu trục hạm")
	assert_true((table.find_child("Small", true, false) as Control).visible)
	assert_almost_eq((table.find_child("Fleet_4", true, false) as Control).modulate.a, 0.35, 0.01)
	assert_almost_eq((table.find_child("Fleet_0", true, false) as Control).modulate.a, 1.0, 0.01)


func test_the_end_names_the_winner() -> void:
	var table := _table(
		_view({"phase": "battle", "ready": [true, true], "end": {"reason": "resign", "winner": 0}})
	)
	assert_eq(_text(table, "Status"), "Máy đầu hàng")
	assert_false((table.find_child("Resign", true, false) as Control).visible)
