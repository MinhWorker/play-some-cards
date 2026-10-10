extends GutTest
## Cờ Tướng's table against made-up room snapshots (no server).


func _start() -> Array:
	var board: Array = []
	for row: String in [
		"rnbakabnr",
		".........",
		".c.....c.",
		"p.p.p.p.p",
		".........",
		".........",
		"P.P.P.P.P",
		".C.....C.",
		".........",
		"RNBAKABNR",
	]:
		for letter: String in row:
			board.append(null if letter == "." else letter)
	return board


func _snapshot(view: Dictionary, status: String = "playing") -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "xiangqi",
				"hostId": "me",
				"players":
				[{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"spectators": [],
				"seats": [{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"status": status,
				"view": view,
				"result": null,
				"score": {"wins": [1, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _view(players: Array, turn: String, moves: Array, extra: Dictionary = {}) -> Dictionary:
	var view: Dictionary = {
		"board": _start(),
		"players": players,
		"turn": turn,
		"last": null,
		"check": false,
		"captured": [],
		"plies": 4,
		"quiet": 0,
		"drawOffer": null,
		"end": null,
		"moves": moves,
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary, status: String = "playing") -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view, status)
	var table: Control = add_child_autofree(load("res://content/xiangqi/main.tscn").instantiate())
	table.call("bind", client)
	return table


func test_shows_the_pieces_and_whose_turn() -> void:
	var table := _table(_view(["me", "bot"], "r", [{"from": 70, "to": 67}]))
	assert_not_null(table.find_child("Piece_85", true, false), "the red general")
	assert_not_null(table.find_child("Piece_4", true, false), "the black general")
	assert_null(table.find_child("Piece_40", true, false), "the river is empty")
	assert_eq((table.find_child("Status", true, false) as Label).text, "Tới lượt bạn")
	assert_eq((table.find_child("MoveCount", true, false) as Label).text, "Nước 3")


func test_black_sees_the_board_turned_round() -> void:
	var red := _table(_view(["me", "bot"], "r", []))
	var black := _table(_view(["bot", "me"], "r", []))
	await wait_frames(2)
	var mine: Control = red.find_child("Square_85", true, false)
	var turned: Control = black.find_child("Square_85", true, false)
	assert_gt(mine.position.y, turned.position.y, "the red general is at the bottom for Red only")
	assert_eq((black.find_child("Status", true, false) as Label).text, "Lượt Đỏ")


func test_a_piece_is_picked_and_dropped() -> void:
	var table := _table(_view(["me", "bot"], "r", [{"from": 70, "to": 67}]))
	(table.find_child("Square_70", true, false) as Button).pressed.emit()
	assert_eq(table.get("_picked"), 70, "the cannon is picked")
	(table.find_child("Square_40", true, false) as Button).pressed.emit()
	assert_eq(table.get("_picked"), -1, "a point it can't go to drops the pick")


func test_check_rings_the_general_and_the_end_fills_the_result_board() -> void:
	var checked := _table(_view(["me", "bot"], "r", [{"from": 85, "to": 76}], {"check": true}))
	assert_eq(
		(checked.find_child("Status", true, false) as Label).text, "Tới lượt bạn · Chiếu tướng!"
	)
	assert_true((checked.find_child("CheckRing", true, false) as Control).visible)
	var ended := _table(
		_view(
			["me", "bot"],
			"r",
			[],
			{"captured": ["p", "p", "N"], "end": {"reason": "perpetual-check", "winner": "r"}}
		),
		"finished"
	)
	var detail: Dictionary = ended.call("result_detail")
	assert_eq(detail["reason"], "Bạn thắng · Máy chiếu dai")
	assert_eq(detail["rows"], [["Số nước", "4"], ["Quân đã ăn", "Đỏ 2 · Đen 1"]])
	assert_false((ended.find_child("Resign", true, false) as Control).visible)
