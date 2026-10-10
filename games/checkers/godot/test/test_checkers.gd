extends GutTest
## Cờ Đam's table against made-up room snapshots (no server).

const START := ".w.w.w.ww.w.w.w..w.w.w.w" + "................" + "b.b.b.b..b.b.b.bb.b.b.b."


func _snapshot(view: Dictionary, status: String = "playing") -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "checkers",
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


func _view(players: Array, turn: String, moves: Array, end: Variant = null) -> Dictionary:
	return {
		"board": START,
		"players": players,
		"turn": turn,
		"last": null,
		"taken": {"w": 0, "b": 2},
		"plies": 4,
		"quiet": 0,
		"drawOffer": null,
		"end": end,
		"moves": moves,
	}


func _table(view: Dictionary, status: String = "playing") -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view, status)
	var table: Control = add_child_autofree(load("res://content/checkers/main.tscn").instantiate())
	table.call("bind", client)
	return table


func test_shows_the_pieces_and_whose_turn() -> void:
	var table := _table(_view(["me", "bot"], "b", [{"path": [40, 33], "captures": []}]))
	assert_not_null(table.find_child("Piece_1", true, false), "a white man on square 1")
	assert_not_null(table.find_child("Piece_40", true, false), "a black man on square 40")
	assert_null(table.find_child("Piece_0", true, false), "light squares stay empty")
	assert_eq((table.find_child("Status", true, false) as Label).text, "Tới lượt bạn")
	assert_eq((table.find_child("MoveCount", true, false) as Label).text, "Nước 3")
	assert_null(table.find_child("Square_0", true, false), "only dark squares are buttons")


func test_the_second_side_sees_the_board_turned_round() -> void:
	var first := _table(_view(["me", "bot"], "b", []))
	var second := _table(_view(["bot", "me"], "b", []))
	await wait_frames(2)
	var mine: Control = first.find_child("Square_62", true, false)
	var turned: Control = second.find_child("Square_62", true, false)
	assert_gt(mine.position.y, turned.position.y, "square 62 is at the bottom for the first side")


func test_a_move_is_sent_after_its_squares_are_tapped() -> void:
	var view := _view(["me", "bot"], "b", [{"path": [40, 33], "captures": []}])
	var table := _table(view)
	var square: Button = table.find_child("Square_40", true, false)
	square.pressed.emit()
	assert_eq(table.get("_path"), [40] as Array[int], "the piece is picked")
	(table.find_child("Square_42", true, false) as Button).pressed.emit()
	assert_eq(table.get("_path"), [] as Array[int], "a square it can't go to drops the pick")


func test_the_end_gives_the_result_board_its_words() -> void:
	var table := _table(
		_view(["me", "bot"], "w", [], {"reason": "resign", "winner": "b"}), "finished"
	)
	var detail: Dictionary = table.call("result_detail")
	assert_eq(detail["reason"], "Bạn thắng · Máy đầu hàng")
	assert_eq(detail["rows"], [["Số lượt đi", "4"], ["Quân đã ăn", "Trắng 0 · Đen 2"]])
	assert_false((table.find_child("Resign", true, false) as Control).visible)
