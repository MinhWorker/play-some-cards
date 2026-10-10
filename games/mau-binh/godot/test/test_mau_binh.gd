extends GutTest
## Mậu Binh's table against made-up room snapshots (no server), and the rules it mirrors.

const Rules := preload("res://content/mau-binh/rules.gd")
## A A K K Q J 10 9 8 7 5 4 2: strongest first puts a straight over two pairs (binh lủng).
const HAND: Array = [1, 10, 13, 20, 27, 30, 33, 36, 40, 44, 45, 48, 49]


func _snapshot(view: Dictionary) -> XomDaoRoomSnapshot:
	var people: Array = [{"id": "me", "name": "Minh"}, {"id": "b1", "name": "Máy 1", "bot": true}]
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "mau-binh",
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


func _view(extra: Dictionary = {}) -> Dictionary:
	var view: Dictionary = {
		"round": 1,
		"rounds": 3,
		"phase": "arrange",
		"inRound": [true, true],
		"forfeits": [],
		"gone": [],
		"points": [0, 0],
		"results": [],
		"hand": HAND,
		"mine": null,
		"ready": [false, true],
	}
	view.merge(extra, true)
	return view


func _table(view: Dictionary) -> Control:
	var client: XomDaoClient = add_child_autofree(XomDaoClient.new())
	client.player_id = "me"
	client.snapshot = _snapshot(view)
	var table: Control = add_child_autofree(load("res://content/mau-binh/main.tscn").instantiate())
	table.call("bind", client)
	return table


func _text(table: Control, name_of: String) -> String:
	return (table.find_child(name_of, true, false) as Label).text


func _rank(table: Control, name_of: String) -> String:
	return (table.find_child(name_of, true, false) as XomDaoCard).rank


func _tap(table: Control, name_of: String) -> void:
	var tap := InputEventMouseButton.new()
	tap.button_index = MOUSE_BUTTON_LEFT
	tap.pressed = true
	(table.find_child(name_of, true, false) as Control).gui_input.emit(tap)


func test_hands_and_binh_lung() -> void:
	assert_eq(Rules.hand_name([48, 49, 44, 45, 40]), "Thú")
	assert_eq(Rules.hand_name([36, 33, 30, 27, 20]), "Sảnh")
	assert_eq(Rules.hand_name([48, 1, 5, 9, 13]), "Sảnh")
	assert_eq(Rules.hand_name([0, 4, 8, 12, 16]), "Thùng phá sảnh")
	assert_eq(Rules.hand_name([1, 2, 3]), "Sám cô")
	var rows: Array = Rules.rows_of([48, 49, 44, 45, 40, 36, 33, 30, 27, 20, 13, 10, 1])
	assert_eq(Rules.foul_of(rows), "Chi 2 mạnh hơn chi 1")
	var best: Array = Rules.best_order(HAND)
	assert_eq(best.size(), 13)
	assert_eq(Rules.foul_of(Rules.rows_of(best)), "")


func test_arranging_shows_your_rows_and_swaps_cards() -> void:
	var table := _table(_view())
	assert_eq(_text(table, "Round"), "Vòng 1/3")
	assert_eq(_text(table, "Info"), "Xong 1/2")
	assert_eq(_text(table, "Status"), "Binh lủng")
	assert_eq(_text(table, "Row_1"), "Chi 1 · Thú")
	assert_eq(_text(table, "Row_2"), "Chi 2 · Sảnh")
	assert_eq(_text(table, "Tag_1"), "Xong")
	assert_true((table.find_child("Done", true, false) as Control).visible)
	assert_eq(_rank(table, "Mine_0"), "A")
	assert_eq(_rank(table, "Mine_9"), "7")
	_tap(table, "Mine_0")
	_tap(table, "Mine_9")
	assert_eq(_rank(table, "Mine_0"), "7")
	assert_eq(_rank(table, "Mine_9"), "A")
	(table.find_child("Undo", true, false) as XomDaoButton).pressed.emit()
	assert_eq(_rank(table, "Mine_0"), "A")
	(table.find_child("Auto", true, false) as XomDaoButton).pressed.emit()
	assert_eq(_text(table, "Status"), "Đang xếp")


func test_the_reveal_shows_everyones_rows_and_points() -> void:
	var mine: Array = [[48, 49, 44, 45, 40], [36, 33, 30, 27, 20], [13, 10, 1]]
	var theirs: Array = [[0, 4, 8, 12, 16], [2, 6, 11, 14, 18], [21, 25, 29]]
	var result: Dictionary = {
		"rows": [mine, theirs],
		"fouls": [true, false],
		"forfeits": [false, false],
		"auto": [false, false],
		"specials": [null, null],
		"duels": [{"a": 0, "b": 1, "kind": "foul", "chi": [], "scoop": 0, "points": -6}],
		"points": [-6, 6],
	}
	var table := _table(
		_view({"phase": "show", "points": [-6, 6], "results": [result], "ready": [true, true]})
	)
	assert_eq(_text(table, "Tag_0"), "Binh lủng")
	assert_eq(_text(table, "Total_1"), "+6")
	assert_eq(_text(table, "Status"), "%s điểm" % XomDaoUi.delta(-6))
	assert_eq(_rank(table, "Card_1_0"), "2")
	assert_true((table.find_child("Card_1_12", true, false) as XomDaoCard).is_face_up())
