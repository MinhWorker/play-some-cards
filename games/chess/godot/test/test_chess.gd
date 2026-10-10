extends GutTest
## Cờ Vua's table against made-up room snapshots (no server).


func _start() -> Array:
	var board: Array = []
	for row: String in [
		"rnbqkbnr",
		"pppppppp",
		"........",
		"........",
		"........",
		"........",
		"PPPPPPPP",
		"RNBQKBNR"
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
				"gameId": "chess",
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
		"turn": turn,
		"castling": "KQkq",
		"ep": null,
		"players": players,
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
	var table: Control = add_child_autofree(load("res://content/chess/main.tscn").instantiate())
	table.call("bind", client)
	return table


func test_shows_the_pieces_and_whose_turn() -> void:
	var table := _table(_view(["me", "bot"], "w", [{"from": 52, "to": 36}]))
	assert_not_null(table.find_child("Piece_60", true, false), "the white king on e1")
	assert_not_null(table.find_child("Piece_4", true, false), "the black king on e8")
	assert_null(table.find_child("Piece_36", true, false), "e4 is empty")
	assert_eq((table.find_child("Status", true, false) as Label).text, "Tới lượt bạn")
	assert_eq((table.find_child("MoveCount", true, false) as Label).text, "Nước 3")
	assert_not_null(table.find_child("Square_0", true, false), "every square is a button")


func test_black_sees_the_board_turned_round() -> void:
	var white := _table(_view(["me", "bot"], "w", []))
	var black := _table(_view(["bot", "me"], "w", []))
	await wait_frames(2)
	var mine: Control = white.find_child("Square_60", true, false)
	var turned: Control = black.find_child("Square_60", true, false)
	assert_gt(mine.position.y, turned.position.y, "e1 is at the bottom for White only")
	assert_eq((black.find_child("Status", true, false) as Label).text, "Lượt Trắng · Máy")


func test_a_piece_is_picked_and_dropped() -> void:
	var table := _table(_view(["me", "bot"], "w", [{"from": 52, "to": 36}]))
	(table.find_child("Square_52", true, false) as Button).pressed.emit()
	assert_eq(table.get("_picked"), 52, "the pawn is picked")
	(table.find_child("Square_20", true, false) as Button).pressed.emit()
	assert_eq(table.get("_picked"), -1, "a square it can't go to drops the pick")


func test_a_pawn_on_the_last_rank_asks_what_it_becomes() -> void:
	var board: Array = []
	board.resize(64)
	board[4] = "k"
	board[60] = "K"
	board[9] = "P"
	var moves: Array = []
	for kind: String in ["q", "r", "b", "n"]:
		moves.append({"from": 9, "to": 1, "promotion": kind})
	var table := _table(_view(["me", "bot"], "w", moves, {"board": board}))
	(table.find_child("Square_9", true, false) as Button).pressed.emit()
	(table.find_child("Square_1", true, false) as Button).pressed.emit()
	var picker: Control = table.find_child("Promotion", true, false)
	assert_true(picker.visible, "Phong cấp opens")
	assert_not_null(picker.find_child("Promote_n", true, false))
	(table.find_child("Square_9", true, false) as Button).pressed.emit()
	assert_false(picker.visible, "a tap on the board closes it")


func test_check_shows_in_the_status_and_the_end_on_the_result_board() -> void:
	var checked := _table(_view(["me", "bot"], "w", [{"from": 52, "to": 36}], {"check": true}))
	assert_eq((checked.find_child("Status", true, false) as Label).text, "Tới lượt bạn · Chiếu!")
	var ended := _table(
		_view(
			["me", "bot"],
			"w",
			[],
			{"captured": ["p", "p", "N"], "end": {"reason": "resign", "winner": "w"}}
		),
		"finished"
	)
	var detail: Dictionary = ended.call("result_detail")
	assert_eq(detail["reason"], "Bạn thắng · Máy đầu hàng")
	assert_eq(detail["rows"], [["Số lượt đi", "4"], ["Quân đã ăn", "Trắng 2 · Đen 1"]])
	assert_false((ended.find_child("Resign", true, false) as Control).visible)
