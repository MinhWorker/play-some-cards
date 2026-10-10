extends GutTest
## Câu cá Trung Thu against made-up room snapshots (no server).


func _snapshot(caught: Array, status: String = "playing") -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "trung-thu",
				"hostId": "me",
				"players": [{"id": "me", "name": "Minh"}],
				"spectators": [],
				"seats": [{"id": "me", "name": "Minh"}],
				"status": status,
				"view": {"caught": caught},
				"result": null,
				"score": {"wins": [0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func test_shows_catches_points_and_casts_left() -> void:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot([])
	var pond: Control = add_child_autofree(load("res://content/trung-thu/main.tscn").instantiate())
	pond.call("bind", client)
	var cast: XomDaoButton = pond.find_child("Cast", true, false)
	assert_false(cast.disabled)
	assert_eq((pond.find_child("CastsLeft", true, false) as Label).text, "Còn 5 lượt")
	client.state_changed.emit(_snapshot(["carp", "golden-carp"]))
	assert_eq((pond.find_child("Points", true, false) as Label).text, "8 điểm")
	assert_not_null(pond.find_child("Catch_1", true, false))
	client.state_changed.emit(_snapshot(["carp", "golden-carp", "fry", "sandal", "perch"], "ended"))
	assert_eq((pond.find_child("Points", true, false) as Label).text, "11 điểm")
	assert_true(cast.disabled, "no casts left")
