extends GutTest
## Bài Cào's table against made-up room snapshots (no server).


func _snapshot(view: Dictionary, status: String = "playing") -> XomDaoRoomSnapshot:
	var people: Array = [
		{"id": "me", "name": "Minh"},
		{"id": "b1", "name": "Máy 1", "bot": true},
		{"id": "b2", "name": "Máy 2", "bot": true},
	]
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "bai-cao",
				"hostId": "me",
				"players": people,
				"spectators": [],
				"seats": people,
				"status": status,
				"view": view,
				"result": null,
				"score": {"wins": [0, 0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _view(extra: Dictionary = {}) -> Dictionary:
	var view: Dictionary = {
		"round": 2,
		"rounds": 10,
		"phase": "bet",
		"dealer": 1,
		"points": [15, -5, -10],
		"bets": [null, null, 10],
		"hands": [[], [], []],
		"revealed": [false, false, false],
		"gone": [],
		"results": null,
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view)
	var table: Control = add_child_autofree(load("res://content/bai-cao/main.tscn").instantiate())
	table.call("bind", client)
	return table


func _text(table: Control, name_of: String) -> String:
	return (table.find_child(name_of, true, false) as Label).text


func test_betting_shows_the_bets_and_the_dealer() -> void:
	var table := _table(_view())
	assert_eq(_text(table, "Round"), "Ván 2/10")
	assert_eq(_text(table, "Dealer"), "Cái: Máy 1")
	assert_eq(_text(table, "Status"), "Đặt cược")
	assert_eq(_text(table, "Info"), "Đã cược 1/2")
	assert_true((table.find_child("Bet_10", true, false) as Control).visible)
	assert_false((table.find_child("Reveal", true, false) as Control).visible)
	assert_eq(_text(table, "Tag_1"), "Nhà cái")
	assert_eq(_text(table, "Tag_2"), "Cược 10")


func test_your_cards_open_one_by_one_then_turn_over() -> void:
	# 9♣ 10♠ K♥ for you; the others' cards are still face down (null).
	var table := _table(
		_view({"phase": "reveal", "bets": [5, null, 10], "hands": [[32, 37, 50], null, null]})
	)
	assert_true((table.find_child("Mine_0", true, false) as Control).visible)
	assert_true((table.find_child("Reveal", true, false) as Control).visible)
	assert_eq(_text(table, "Status"), "Đã nặn 0/3")
	var tap := InputEventMouseButton.new()
	tap.button_index = MOUSE_BUTTON_LEFT
	tap.pressed = true
	(table.find_child("Mine_0", true, false) as Control).gui_input.emit(tap)
	var up := InputEventMouseButton.new()
	up.button_index = MOUSE_BUTTON_LEFT
	up.pressed = false
	(table.find_child("Mine_0", true, false) as Control).gui_input.emit(up)
	assert_eq(_text(table, "Status"), "Đã nặn 1/3")


func test_the_count_shows_hands_and_points() -> void:
	var table := _table(
		_view(
			{
				"phase": "showdown",
				"bets": [5, null, 10],
				"hands": [[40, 44, 48], [0, 4, 8], [32, 37, 50]],
				"revealed": [true, true, true],
				"results":
				[{"seat": 0, "delta": 10}, {"seat": 1, "delta": -20}, {"seat": 2, "delta": 10}],
			}
		)
	)
	assert_eq(_text(table, "Status"), "+10 điểm")
	assert_eq(_text(table, "Delta_1"), XomDaoUi.delta(-20))
	assert_eq((table.find_child("Card_1_0", true, false) as XomDaoCard).rank, "A")
