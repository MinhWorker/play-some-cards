extends GutTest
## The hub's room screens: Tạo phòng options, the result's ranks and rewards, Luật, and what the
## hub remembers.


func _snapshot(winners: Array, rewards: Array) -> XomDaoRoomSnapshot:
	return (
		XomDaoRoomSnapshot
		. from_dict(
			{
				"code": "K7M2",
				"gameId": "tic-tac-toe",
				"hostId": "minh",
				"players":
				[
					{"id": "minh", "name": "Minh", "connected": true},
					{"id": "bot:1", "name": "Máy", "connected": true, "bot": true},
				],
				"status": "finished",
				"result": {"winners": winners, "rewards": rewards},
			}
		)
	)


func test_setup_sends_the_picked_options() -> void:
	var setup: HubRoomSetup = add_child_autofree(HubRoomSetup.new())
	(
		setup
		. show_setup(
			"Caro",
			[
				{
					"key": "opponent",
					"label": "Chơi với",
					"options": [["Bạn bè", "human"], ["Máy", "bot"]]
				},
				{"key": "level", "label": "Máy chơi", "options": [["Dễ", "easy"], ["Khó", "hard"]]},
			]
		)
	)
	assert_eq(setup.options(), {"opponent": "human", "level": "easy"})
	setup.choices["opponent"].choose(1)
	setup.choices["level"].choose(1)
	watch_signals(setup)
	setup.find_child("ConfirmCreate", true, false).pressed.emit()
	assert_signal_emitted_with_parameters(setup, "created", [{"opponent": "bot", "level": "hard"}])


func test_result_ranks_and_rewards() -> void:
	var won: XomDaoRoomSnapshot = _snapshot(
		["minh"], [{"player": "minh", "resource": "core:coin", "amount": 20}]
	)
	assert_eq(HubResult.ranks(won), {"minh": 1, "bot:1": 2})
	assert_eq(HubResult.coins(won), {"minh": 20})
	assert_eq(HubResult.ranks(_snapshot([], [])), {"minh": 0, "bot:1": 0})
	var settings := XomDaoSettings.new()
	settings.path = ""
	var result: HubResult = add_child_autofree(HubResult.new(settings))
	result.show_result(won, "minh", 100)
	assert_eq(result.find_child("ResultTitle", true, false).text, "Bạn thắng!")
	assert_eq(result.find_child("Reward", true, false).amount, 20)
	assert_eq(result.money.coins.amount, 100)
	assert_true(result.find_child("Again", true, false).visible, "the host plays again")
	result.receive(120)
	await wait_seconds(1.5)
	assert_eq(result.money.coins.text, "120")


func test_rules_read_as_plain_text() -> void:
	var text: String = HubRulesBoard.plain(
		"# Luật Caro\n\nHai người **lần lượt**.\n\n## Thắng\n\n- Đủ `5` quân thì thắng."
	)
	assert_eq(text, "Hai người lần lượt.\n\nThắng\n\n• Đủ 5 quân thì thắng.")


func test_the_selected_game_is_kept_per_account() -> void:
	var path: String = "user://test_hub.cfg"
	HubPrefs.set_selected_game("u1", "tic-tac-toe", path)
	HubPrefs.set_selected_game("u2", "tien-len", path)
	assert_eq(HubPrefs.selected_game("u1", path), "tic-tac-toe")
	assert_eq(HubPrefs.selected_game("u2", path), "tien-len")
	assert_eq(HubPrefs.selected_game("u3", path), "")
	DirAccess.remove_absolute(path)
