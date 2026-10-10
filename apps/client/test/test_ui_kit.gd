extends GutTest
## The shared UI kit (addons/xomdao_sdk/ui): formatting, the player slot, settings and the menu.


func _settings() -> XomDaoSettings:
	var settings := XomDaoSettings.new()
	settings.path = ""
	return settings


func test_money_has_dots_between_thousands() -> void:
	assert_eq(XomDaoUi.money(0), "0")
	assert_eq(XomDaoUi.money(950), "950")
	assert_eq(XomDaoUi.money(2450), "2.450")
	assert_eq(XomDaoUi.money(1234567), "1.234.567")
	assert_eq(XomDaoUi.money(-20), "−20")


func test_changes_are_signed_and_coloured() -> void:
	assert_eq(XomDaoUi.delta(120), "+120")
	assert_eq(XomDaoUi.delta(-20), "−20")
	assert_eq(XomDaoUi.delta(0), "0")
	assert_eq(XomDaoUi.delta_color(5), XomDaoUi.UP)
	assert_eq(XomDaoUi.delta_color(-5, true), XomDaoUi.DOWN_ON_PAPER)
	assert_eq(XomDaoUi.delta_color(0, false, XomDaoUi.CREAM), XomDaoUi.CREAM)


func test_each_kind_of_action_has_its_own_background() -> void:
	var seen: Array[Color] = []
	for kind: XomDaoUi.Kind in XomDaoUi.Kind.values():
		if kind == XomDaoUi.Kind.PLAY:
			continue
		var background: Color = XomDaoUi.kind_colors(kind)[0]
		assert_false(seen.has(background), "kind %d" % kind)
		seen.append(background)
	var play: XomDaoButton = autofree(XomDaoButton.create("CHƠI", XomDaoUi.Kind.PLAY))
	var leave: XomDaoButton = autofree(XomDaoButton.create("Rời phòng", XomDaoUi.Kind.DANGER))
	assert_eq(play.custom_minimum_size.y, XomDaoButton.PLAY_HEIGHT)
	assert_true(leave.custom_minimum_size.y >= XomDaoUi.TOUCH)


func test_player_slot_runs_the_turn_timer_down() -> void:
	var slot: XomDaoPlayerSlot = add_child_autofree(XomDaoPlayerSlot.new())
	watch_signals(slot)
	assert_false(slot.is_turn())
	slot.start_turn(20.0, 5.0)
	assert_true(slot.is_turn())
	assert_almost_eq(slot.time_left(), 15.0, 0.001)
	assert_almost_eq(slot.avatar.turn, 0.75, 0.001)
	slot._process(10.0)
	assert_almost_eq(slot.avatar.turn, 0.25, 0.001)
	assert_signal_not_emitted(slot, "turn_ended")
	slot._process(10.0)
	assert_signal_emitted(slot, "turn_ended")
	assert_eq(slot.time_left(), 0.0)
	assert_false(slot.is_processing())
	slot.end_turn()
	assert_false(slot.is_turn())
	slot.show_turn()
	assert_eq(slot.avatar.turn, 1.0)


func test_player_slot_shows_host_level_and_counter() -> void:
	var slot: XomDaoPlayerSlot = add_child_autofree(XomDaoPlayerSlot.new())
	slot.player_name = "minh"
	assert_eq(slot.avatar.initial, "M")
	assert_false(slot.avatar.crown)
	slot.host = true
	assert_true(slot.avatar.crown)
	assert_false(slot._level.visible, "no level chip at 0")
	slot.level = 12
	assert_true(slot._level.visible)
	assert_eq(slot._level.text, "12")
	assert_false(slot._extra.visible)
	slot.extra = "8 lá"
	assert_true(slot._extra.visible)
	slot.extra = ""
	assert_false(slot._extra.visible)
	assert_eq(slot.avatar.custom_minimum_size.x, XomDaoPlayerSlot.AVATAR)
	slot.compact = true
	assert_eq(slot.avatar.custom_minimum_size.x, XomDaoPlayerSlot.AVATAR_COMPACT)


func test_settings_keep_to_their_choices() -> void:
	var settings: XomDaoSettings = _settings()
	watch_signals(settings)
	settings.set_value("ui_scale", 1.2)
	assert_eq(settings.ui_scale, 1.15, "the nearest offered scale")
	settings.set_value("margin", 7)
	assert_eq(settings.margin, 24, "an unknown margin is ignored")
	settings.set_value("margin", 40)
	assert_eq(settings.margin, 40)
	settings.set_value("quality", "low")
	assert_eq(settings.quality, "low")
	assert_signal_emit_count(settings, "changed", 4)


func test_settings_are_saved_and_loaded() -> void:
	var path: String = "user://test_settings.cfg"
	var settings: XomDaoSettings = _settings()
	settings.path = path
	settings.set_value("ui_scale", 1.3)
	settings.set_value("quality", "medium")
	var again: XomDaoSettings = _settings()
	again.path = path
	again.load_file()
	assert_eq(again.ui_scale, 1.3)
	assert_eq(again.quality, "medium")
	DirAccess.remove_absolute(path)


func test_sound_setting_mutes_the_master_bus() -> void:
	var settings: XomDaoSettings = _settings()
	var master: int = AudioServer.get_bus_index("Master")
	settings.set_value("sound", false)
	assert_true(AudioServer.is_bus_mute(master))
	settings.set_value("sound", true)
	assert_false(AudioServer.is_bus_mute(master))


func test_menu_opens_and_reports_choices() -> void:
	var settings: XomDaoSettings = _settings()
	var menu: XomDaoMenu = add_child_autofree(XomDaoMenu.new(settings))
	watch_signals(menu)
	assert_false(menu.is_open())
	menu.button.pressed.emit()
	assert_true(menu.is_open())
	menu.board.find_child("Leave", true, false).pressed.emit()
	assert_signal_emitted(menu, "leave_requested")
	assert_false(menu.is_open())
	menu.open()
	menu.board.find_child("thumbs-up", true, false).pressed.emit()
	assert_signal_emitted_with_parameters(menu, "emote_chosen", ["thumbs-up"])
	menu.open()
	menu.board.find_child("Rules", true, false).pressed.emit()
	assert_signal_emitted(menu, "rules_requested")


func test_menu_changes_the_settings() -> void:
	var settings: XomDaoSettings = _settings()
	var menu: XomDaoMenu = add_child_autofree(XomDaoMenu.new(settings))
	menu.ui_scale.choose(2)
	assert_eq(settings.ui_scale, XomDaoSettings.SCALES[2])
	assert_eq(menu.button.scale, Vector2.ONE * XomDaoSettings.SCALES[2])
	menu.margin.choose(2)
	assert_eq(settings.margin, XomDaoSettings.MARGINS[2])
	menu.sound.choose(1)
	assert_false(settings.sound)
	settings.set_value("sound", true)
	assert_eq(menu.sound.selected, 0, "the board follows the settings")


func test_choice_reports_only_changes() -> void:
	var choice: XomDaoChoice = add_child_autofree(XomDaoChoice.create(["2", "3", "4"], 1))
	watch_signals(choice)
	choice.choose(1)
	assert_signal_not_emitted(choice, "changed")
	choice.choose(2)
	assert_signal_emitted_with_parameters(choice, "changed", [2])
	choice.choose(9)
	assert_eq(choice.selected, 2)


func test_game_tile_labels() -> void:
	assert_eq(XomDaoGameTile.players_label(2, 2), "2 người")
	assert_eq(XomDaoGameTile.players_label(2, 4), "2–4 người")
	assert_eq(XomDaoGameTile.duration_label({"min": 10, "max": 10}), "10 phút")
	assert_eq(XomDaoGameTile.duration_label({"min": 5, "max": 10}), "5–10 phút")
	var card := (
		XomDaoGameCard
		. from_dict(
			{
				"id": "tien-len",
				"name": "Tiến Lên",
				"minPlayers": 2,
				"maxPlayers": 4,
				"duration": {"min": 5, "max": 10},
				"playing": 32,
			}
		)
	)
	var tile: XomDaoGameTile = add_child_autofree(XomDaoGameTile.new())
	tile.show_card(card)
	assert_eq(tile.title, "Tiến Lên")
	assert_eq(tile.players_text, "2–4 người")
	assert_eq(tile.duration_text, "5–10 phút")
	assert_eq(tile.playing, 32)


func test_every_gallery_page_builds() -> void:
	var gallery: Control = add_child_autofree(load("res://hub/gallery/gallery.tscn").instantiate())
	for page: int in range(1, gallery.PAGES + 1):
		gallery.show_page(page)
		await wait_process_frames(2)
		assert_gt(gallery._core.get_child_count(), 0, "page %d" % page)
