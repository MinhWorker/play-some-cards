extends GutTest
## The Tiến Lên table against made-up room snapshots (no server), and the card rules it uses.

const Rules := preload("res://content/tien-len/rules.gd")


func _view(overrides: Dictionary = {}) -> Dictionary:
	var view: Dictionary = {
		"round": 1,
		"rounds": 3,
		"phase": "play",
		"inRound": [true, true, true, true],
		"lead": 0,
		"table": null,
		"played": [],
		"trick": 0,
		"turn": 0,
		"passed": [false, false, false, false],
		"mustPlay": null,
		"out": [],
		"sunk": [],
		"gone": [],
		"points": [0, 0, 0, 0],
		"firsts": [0, 0, 0, 0],
		"results": [],
		"hand": [0, 5, 6, 9, 20, 21, 30, 33, 40, 44, 45, 48, 51],
		"counts": [13, 13, 13, 13],
	}
	view.merge(overrides, true)
	return view


func _snapshot(view: Dictionary) -> XomDaoRoomSnapshot:
	var seats: Array = [
		{"id": "me", "name": "Minh"},
		{"id": "b1", "name": "Máy 1", "bot": true},
		{"id": "b2", "name": "Máy 2", "bot": true},
		{"id": "b3", "name": "Máy 3", "bot": true},
	]
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "tien-len",
				"hostId": "me",
				"players": seats,
				"spectators": [],
				"seats": seats,
				"status": "playing",
				"view": view,
				"result": null,
				"score": {"wins": [0, 0, 0, 0], "draws": 0},
				"round": 1,
				"last": null,
				"timer": null,
				"played": null,
			}
		)
	)


func _table(view: Dictionary) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view)
	var table: Control = add_child_autofree(load("res://content/tien-len/main.tscn").instantiate())
	table.call("bind", client)
	return table


func _button(table: Control, button_name: String) -> XomDaoButton:
	return table.find_child(button_name, true, false)


func test_combos() -> void:
	assert_eq(Rules.combo_of([7])["kind"], "single")
	assert_eq(Rules.combo_of([4, 5])["kind"], "pair")
	assert_eq(Rules.combo_of([0, 4, 8])["kind"], "straight")
	assert_eq(Rules.combo_of([0, 1, 4, 5, 8, 9])["kind"], "pairs")
	assert_true(Rules.combo_of([0, 4]).is_empty(), "two ranks are no pair")
	assert_true(Rules.combo_of([40, 44, 48]).is_empty(), "no straight runs through the 2")


func test_bombs_chop_the_twos() -> void:
	var two: Dictionary = Rules.combo_of([51])
	var quad: Dictionary = Rules.combo_of([8, 9, 10, 11])
	var three_pairs: Dictionary = Rules.combo_of([0, 1, 4, 5, 8, 9])
	assert_true(Rules.beats(quad, two))
	assert_true(Rules.beats(three_pairs, two))
	assert_false(Rules.beats(three_pairs, Rules.combo_of([50, 51])), "three pairs chop one 2")
	assert_false(Rules.beats(Rules.combo_of([44]), two))
	var chop: Dictionary = Rules.impact(
		{"cards": [8, 9, 10, 11], "trick": 2}, {"cards": [51], "trick": 2}
	)
	assert_eq(chop["words"], "Chặt heo!")


func test_your_hand_and_the_seats() -> void:
	var table := _table(_view())
	var hand: Control = table.find_child("Hand", true, false)
	assert_eq(hand.get("cards").size(), 13)
	assert_not_null(hand.find_child("Card_51", true, false))
	assert_eq((table.find_child("Status", true, false) as Label).text, "Lượt bạn")
	var right: XomDaoPlayerSlot = table.find_child("Seat_1", true, false)
	assert_eq(right.player_name, "Máy 1")
	assert_eq(right.extra, "13 lá")


func test_play_needs_a_combination_that_beats_the_table() -> void:
	var table := _table(_view({"table": {"seat": 3, "cards": [20], "kind": "single", "trick": 0}}))
	var hand: Control = table.find_child("Hand", true, false)
	assert_true(_button(table, "PlayCards").disabled, "nothing picked")
	assert_false(_button(table, "Pass").disabled)
	hand.call("set_picked", [9] as Array[int])
	assert_true(_button(table, "PlayCards").disabled, "a 5 does not beat a 8")
	hand.call("set_picked", [30] as Array[int])
	assert_false(_button(table, "PlayCards").disabled)
	hand.call("set_picked", [30, 33] as Array[int])
	assert_true(_button(table, "PlayCards").disabled, "two ranks are no combination")


func test_a_new_trick_cannot_be_passed() -> void:
	var table := _table(_view())
	assert_true(_button(table, "Pass").disabled)


func test_the_first_play_must_hold_the_lowest_card() -> void:
	var table := _table(_view({"mustPlay": 0}))
	var hand: Control = table.find_child("Hand", true, false)
	hand.call("set_picked", [5] as Array[int])
	assert_true(_button(table, "PlayCards").disabled)
	hand.call("set_picked", [0] as Array[int])
	assert_false(_button(table, "PlayCards").disabled)


func test_tap_and_slide_pick_cards() -> void:
	var table := _table(_view())
	var hand: Control = table.find_child("Hand", true, false)
	await wait_process_frames(2)
	var first: Rect2 = hand.call("slot_rect", 0)
	var third: Rect2 = hand.call("slot_rect", 2)
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = first.position + Vector2(6, 30)
	hand.call("_gui_input", press)
	var slide := InputEventMouseMotion.new()
	slide.position = third.position + Vector2(6, 30)
	hand.call("_gui_input", slide)
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.position = slide.position
	hand.call("_gui_input", release)
	assert_eq(
		hand.get("picked"), [0, 6] as Array[int], "the slide skipped the card it never crossed"
	)


func test_round_board_between_rounds() -> void:
	var result: Dictionary = {
		"order": [2, 0, 3, 1], "points": [2, 0, 3, 1], "holder": 1, "leftover": [51]
	}
	var view: Dictionary = _view(
		{"phase": "over", "results": [result], "points": [2, 0, 3, 1], "hand": []}
	)
	var table := _table(view)
	var board: XomDaoBoard = table.find_child("RoundBoard", true, false)
	assert_true(board.visible)
	assert_eq(board.title, "Hết vòng 1")
	var first: Control = board.find_child("Rank_0", true, false)
	assert_eq((first.get_child(1) as Label).text, "Máy 2")
	assert_eq((first.get_child(0) as Label).text, "Nhất")
