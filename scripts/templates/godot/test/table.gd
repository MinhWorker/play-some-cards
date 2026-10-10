extends GutTest
## __NAME__'s table against a made-up room snapshot (no server).


func _snapshot(total: int, turn: int) -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "__ID__",
				"hostId": "me",
				"players":
				[{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"spectators": [],
				"seats": [{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"status": "playing",
				"view": {"total": total, "turn": turn},
				"result": null,
				"score": {"wins": [0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _table(total: int, turn: int) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(total, turn)
	var table: Control = add_child_autofree(load("res://content/__ID__/main.tscn").instantiate())
	table.call("bind", client)
	return table


func _button(table: Control, amount: int) -> Button:
	return table.find_child("Add_%d" % amount, true, false)


func test_your_turn_opens_the_amounts_that_fit() -> void:
	var table := _table(19, 0)
	assert_eq((table.find_child("Total", true, false) as Label).text, "19")
	assert_eq((table.find_child("Status", true, false) as Label).text, "Lượt bạn")
	assert_false(_button(table, 1).disabled)
	assert_false(_button(table, 2).disabled)
	assert_true(_button(table, 3).disabled, "22 is past the target")


func test_nothing_opens_on_the_other_turn() -> void:
	var table := _table(4, 1)
	assert_true(_button(table, 1).disabled)
	assert_eq((table.find_child("Status", true, false) as Label).text, "Lượt Máy")
	assert_not_null(table.find_child("Seat_1", true, false))
