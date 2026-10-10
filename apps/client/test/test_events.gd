extends GutTest
## Events in the hub against a made-up catalog (no server): the lobby's banner and island, and
## the event's board in the game select.


func _catalog(with_event: bool) -> HubCatalog:
	var catalog := XomDaoCatalog.new()
	for genre: Array in [["co", "Cờ", 1, true], ["su-kien", "Sự kiện", 3, false]]:
		catalog.genres.append(
			XomDaoGenre.from_dict(
				{"id": genre[0], "name": genre[1], "order": genre[2], "island": genre[0]}.merged(
					{"main": genre[3]}
				)
			)
		)
	var cards: Array = [
		{
			"id": "tic-tac-toe",
			"name": "Caro",
			"kind": "table",
			"genre": "co",
			"status": "ready",
			"minPlayers": 2,
			"maxPlayers": 2,
			"duration": {"min": 5, "max": 15},
		}
	]
	if with_event:
		(
			cards
			. append(
				{
					"id": "trung-thu",
					"name": "Trung Thu: câu cá",
					"kind": "event",
					"genre": "su-kien",
					"status": "ready",
					"minPlayers": 1,
					"maxPlayers": 1,
					"duration": {"min": 1, "max": 2},
					"closesIn": 2 * 86_400_000 + 5000,
					"event":
					{
						"opensAt": "2026-09-18T00:00:00+07:00",
						"closesAt": "2026-10-04T00:00:00+07:00",
						"color": "#B3261E",
						"tiers":
						[
							{"points": 10, "reward": {"core:coin": 50}},
							{"points": 25, "reward": {"core:coin": 100}},
						],
					},
				}
			)
		)
	for card: Dictionary in cards:
		catalog.games.append(XomDaoGameCard.from_dict(card))
	return HubCatalog.create(catalog, ["tic-tac-toe", "trung-thu"])


func test_an_open_event_takes_the_banner_and_lights_its_island() -> void:
	var lobby: HubLobby = add_child_autofree(HubLobby.new())
	lobby.show_catalog(_catalog(true), "co")
	assert_eq((lobby.find_child("BannerTitle", true, false) as Label).text, "Sự kiện")
	assert_eq((lobby.find_child("BannerTag", true, false) as XomDaoChip).text, "Còn 3 ngày")
	assert_not_null(lobby.find_child("Dot", true, false), "the red dot")
	var island: HubIsland = lobby.find_child("Island_su-kien", true, false)
	assert_eq(island.days_left, 3)
	assert_false(island.locked)
	watch_signals(lobby)
	(lobby.find_child("Banner", true, false) as Button).pressed.emit()
	assert_signal_emitted_with_parameters(lobby, "event_pressed", ["trung-thu"])


func test_without_an_event_the_banner_is_cho_and_the_island_is_fogged() -> void:
	var lobby: HubLobby = add_child_autofree(HubLobby.new())
	lobby.show_catalog(_catalog(false), "co")
	assert_eq((lobby.find_child("BannerTitle", true, false) as Label).text, "Chợ")
	var island: HubIsland = lobby.find_child("Island_su-kien", true, false)
	assert_true(island.locked)
	watch_signals(lobby)
	(lobby.find_child("Banner", true, false) as Button).pressed.emit()
	assert_signal_emitted_with_parameters(lobby, "place_pressed", ["cho"])


func test_the_event_board_shows_tiers_and_claims() -> void:
	var select: HubGameSelect = add_child_autofree(HubGameSelect.new())
	watch_signals(select)
	select.show_genre(_catalog(true), "su-kien", "trung-thu")
	assert_signal_emitted_with_parameters(select, "progress_needed", ["trung-thu"])
	assert_true((select.find_child("JoinEvent", true, false) as Control).visible)
	assert_false((select.find_child("Choose", true, false) as Control).visible)
	select.show_progress(
		XomDaoEventProgress.from_dict({"eventId": "trung-thu", "points": 12, "claimed": []})
	)
	assert_eq((select.find_child("EventPoints", true, false) as Label).text, "12 điểm")
	var first: XomDaoButton = select.find_child("Claim_0", true, false)
	var second: XomDaoButton = select.find_child("Claim_1", true, false)
	assert_false(first.disabled)
	assert_true(second.disabled, "25 points not reached")
	first.pressed.emit()
	assert_signal_emitted_with_parameters(select, "claim_pressed", ["trung-thu", 0])
	select.show_progress(
		XomDaoEventProgress.from_dict({"eventId": "trung-thu", "points": 12, "claimed": [0]})
	)
	await wait_process_frames(1)
	assert_not_null(select.find_child("Claimed_0", true, false))


func test_a_table_game_keeps_its_buttons() -> void:
	var select: HubGameSelect = add_child_autofree(HubGameSelect.new())
	select.show_genre(_catalog(true), "co", "tic-tac-toe")
	assert_true((select.find_child("Choose", true, false) as Control).visible)
	assert_false((select.find_child("JoinEvent", true, false) as Control).visible)
	assert_false((select.find_child("EventTiers", true, false) as Control).visible)
