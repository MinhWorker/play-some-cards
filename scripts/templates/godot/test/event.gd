extends GutTest
## __NAME__'s scene against a made-up room snapshot (no server).


func _scene(picked: Array, status: String = "playing") -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "__ID__",
				"hostId": "me",
				"players": [{"id": "me", "name": "Minh"}],
				"spectators": [],
				"seats": [{"id": "me", "name": "Minh"}],
				"status": status,
				"view": {"picked": picked},
				"result": null,
				"score": {"wins": [0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)
	var scene: Control = add_child_autofree(load("res://content/__ID__/main.tscn").instantiate())
	scene.call("bind", client)
	return scene


func test_shows_the_points_and_the_picks_left() -> void:
	var scene := _scene([2, 3])
	assert_eq((scene.find_child("Points", true, false) as Label).text, "5 điểm")
	assert_eq((scene.find_child("PicksLeft", true, false) as Label).text, "Còn 3 lượt")
	assert_not_null(scene.find_child("Bud_1", true, false))
	assert_false((scene.find_child("Pick", true, false) as Button).disabled)


func test_no_pick_once_they_run_out() -> void:
	var scene := _scene([1, 1, 1, 1, 1], "finished")
	assert_true((scene.find_child("Pick", true, false) as Button).disabled)
