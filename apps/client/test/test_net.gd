extends GutTest
## XomDaoClient against a real server. `npm run godot:net` starts one (dev, no database) and
## sets XOMDAO_TEST_SERVER to its /ws URL; without it these tests are skipped.

var _url: String = OS.get_environment("XOMDAO_TEST_SERVER")


func _client() -> XomDaoClient:
	var client: XomDaoClient = add_child_autoqfree(XomDaoClient.new())
	return client


func test_two_clients_play_caro_by_room_code() -> void:
	if _url == "":
		pending("XOMDAO_TEST_SERVER is not set: run npm run godot:net")
		return
	var lan := _client()
	var minh := _client()
	assert_true(await lan.connect_to_server(_url), "Lan connects")
	assert_true(await minh.connect_to_server(_url), "Minh connects")
	assert_true(await lan.login_guest("Lan"), "Lan logs in as a guest")
	assert_true(await minh.login_guest("Minh"), "Minh logs in as a guest")
	assert_eq(lan.user.name, "Lan")
	assert_ne(lan.token, "")

	assert_true(await lan.create_room("tic-tac-toe"), "Lan makes a room")
	assert_eq(lan.room_code.length(), 4)
	assert_true(await minh.join_room(lan.room_code.to_lower()), "Minh joins by code")
	assert_eq(minh.room_code, lan.room_code)
	assert_true(await lan.start_game(), "Lan starts")

	watch_signals(minh)
	assert_false(await minh.send("place", {"x": 4, "y": 4}), "not Minh's turn yet")
	assert_signal_emitted_with_parameters(minh, "error", ["Chưa tới lượt bạn"])
	assert_true(await lan.send("place", {"x": 4, "y": 4}), "Lan plays")
	await wait_until(func() -> bool: return _moves(minh) == 1, 3.0)
	var seen: XomDaoRoomSnapshot = minh.snapshot
	assert_eq(seen.status, "playing")
	assert_eq(seen.players.size(), 2)
	assert_eq(seen.last.player, lan.player_id)
	assert_eq(seen.view["turn"], minh.player_id)


func test_wrong_token_is_refused() -> void:
	if _url == "":
		pending("XOMDAO_TEST_SERVER is not set: run npm run godot:net")
		return
	var client := _client()
	assert_true(await client.connect_to_server(_url))
	watch_signals(client)
	assert_false(await client.login_token("nope"))
	assert_signal_emitted_with_parameters(client, "error", ["unauthorized"])
	assert_false(await client.start_game())


func test_offline_requests_fail() -> void:
	var client := _client()
	assert_eq(await client.request(XomDaoProtocol.CATALOG_GET), {"ok": false, "error": "offline"})


func _moves(client: XomDaoClient) -> int:
	if client.snapshot == null or client.snapshot.last == null:
		return 0
	return client.snapshot.last.seq
