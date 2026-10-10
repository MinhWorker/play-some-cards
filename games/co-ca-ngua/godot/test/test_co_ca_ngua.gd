extends GutTest
## Cờ Cá Ngựa's table against made-up room snapshots (no server), and the moves it mirrors.

const Rules := preload("res://content/co-ca-ngua/rules.gd")


func _team(positions: Array) -> Array:
	return positions.map(func(at: int) -> Dictionary: return {"position": at, "finished": at >= 55})


func _state(extra: Dictionary = {}) -> Dictionary:
	var state: Dictionary = {
		"horses": [_team([-1, -1, -1, -1]), _team([-1, -1, -1, -1])],
		"colors": [0, 2],
		"turn": 0,
		"phase": "roll",
		"dice": null,
		"lastRoll": null,
		"lastMove": null,
		"notice": "",
		"moves": 0,
		"winner": null,
		"rankings": [],
	}
	state.merge(extra, true)
	return state


func _table(view: Dictionary) -> Control:
	var people: Array = [{"id": "me", "name": "Minh"}, {"id": "b1", "name": "Máy 1", "bot": true}]
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "co-ca-ngua",
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
		load("res://content/co-ca-ngua/main.tscn").instantiate()
	)
	table.call("bind", client)
	return table


func test_the_track_and_the_moves() -> void:
	assert_eq(Rules.point([0], 0, 0, 0), Vector2(0, 6))
	assert_eq(Rules.point([2], 0, 0, 0), Vector2(14, 8))
	assert_eq(Rules.point([0], 0, 0, 53), Vector2(2, 7))
	# A 6 lets every horse out of the paddock; a 3 lets none.
	assert_eq(Rules.legal_moves(_state({"phase": "choose", "dice": 6})).size(), 4)
	assert_eq(Rules.legal_moves(_state({"phase": "choose", "dice": 3})).size(), 0)
	# A horse may not pass another, and kicks one it lands on.
	var state := _state({"phase": "choose", "dice": 3})
	state["horses"][0] = _team([0, 2, -1, -1])
	var moves: Array = Rules.legal_moves(state)
	assert_eq(moves.size(), 1)
	assert_eq(int(moves[0]["horse"]), 1)
	state["horses"][1] = _team([-1, -1, -1, -1])
	state["horses"][1][0]["position"] = 31
	state["dice"] = 3
	state["horses"][0] = _team([2, -1, -1, -1])
	moves = Rules.legal_moves(state)
	assert_eq(int(moves[0]["capture"]["seat"]), 1)


func test_the_table_shows_the_turn_and_the_horses() -> void:
	var table := _table(_state())
	assert_eq((table.find_child("Status", true, false) as Label).text, "Lượt bạn")
	await wait_frames(2)
	var red: Control = table.find_child("Horse_0_0", true, false)
	var yellow: Control = table.find_child("Horse_1_0", true, false)
	assert_true(red.position.x < yellow.position.x)
	assert_true(red.position.y < yellow.position.y)


func test_the_winner_is_named() -> void:
	var state := _state({"winner": 1, "rankings": [1]})
	state["horses"][1] = _team([57, 56, 55, 54])
	var table := _table(state)
	assert_eq((table.find_child("Status", true, false) as Label).text, "Máy 1 thắng!")
