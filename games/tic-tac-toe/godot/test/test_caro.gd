extends GutTest
## The Caro board against a made-up room snapshot (no server).


func _snapshot(turn: String, cells: Array) -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "tic-tac-toe",
				"hostId": "me",
				"players":
				[{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"spectators": [],
				"seats": [{"id": "me", "name": "Minh"}, {"id": "bot", "name": "Máy", "bot": true}],
				"status": "playing",
				"view":
				{
					"board": {"left": -1, "top": 0, "cols": 3, "rows": 2, "cells": cells},
					"players": ["me", "bot"],
					"turn": turn,
				},
				"result": null,
				"score": {"wins": [0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _board(turn: String, cells: Array) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(turn, cells)
	var board: Control = add_child_autofree(
		load("res://content/tic-tac-toe/main.tscn").instantiate()
	)
	board.call("bind", client)
	return board


func test_cells_are_named_by_board_coordinates() -> void:
	var board := _board("me", ["X", null, null, null, "O", null])
	var first: Button = board.find_child("Cell_-1_0", true, false)
	assert_not_null(board.find_child("Piece_-1_0", true, false), "X on the first cell")
	assert_true(first.disabled, "a marked cell can't be played")
	assert_not_null(board.find_child("Piece_0_1", true, false), "O in the middle")
	assert_null(board.find_child("Piece_1_1", true, false), "an empty cell has no piece")
	assert_false((board.find_child("Cell_1_1", true, false) as Button).disabled)
	assert_eq((board.find_child("Status", true, false) as Label).text, "Lượt bạn")


func test_no_cell_is_open_on_the_other_turn() -> void:
	var board := _board("bot", [null, null, null, null, null, null])
	assert_true((board.find_child("Cell_1_1", true, false) as Button).disabled)
	assert_eq((board.find_child("Status", true, false) as Label).text, "Lượt Máy")


func test_the_room_setup_offers_the_first_move() -> void:
	var board := _board("me", [null, null, null, null, null, null])
	var keys: Array = (board.call("room_setup") as Array).map(
		func(option: Dictionary) -> String: return option["key"]
	)
	assert_eq(keys, ["opponent", "level", "swap"])
