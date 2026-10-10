extends Control
## The hub (docs/experience.md): the lobby's island ring, the game select, Bến, the waiting
## room, the game with its ☰ menu, and the result. Links: ?room=<code> joins that room;
## ?play=<id> (debug builds) is the sandbox, a real room on the server with the computer in the
## empty seats.
##
## Out of a room the hub shows the screen the player went to (lobby, select, Bến); in a room it
## follows the room: the waiting room before a game, the game while it runs, the result after.
## Every node a test taps or reads has a name (TestBridge, core/test_bridge.gd).
## ?gallery=<page> (web) or `-- --gallery=<page>` opens the UI component gallery instead.

## How long to keep trying while the server wakes up.
const WAKE_MS := 120_000

var _client: XomDaoClient = Net.client
var _screen: Control
var _shown: String = ""
var _menu: XomDaoMenu
var _catalog: HubCatalog
## The game on CHƠI and the genre of the lobby's front island.
var _game_id: String = ""
var _genre: String = ""
## Where the player is out of a room: "lobby", "select", "ben", "nha" or "cho".
var _place: String = "lobby"
## The balance the screens show; the result rolls it up to the ledger's.
var _coins: int = 0
## Quick match is looking for players for the room we are in.
var _quick: bool = false
var _game: Control
var _game_id_shown: String = ""
var _loading: bool = false
var _result: HubResult
var _music := HubMusic.new()
var _ben: HubBen
## A shop:buy is on its way.
var _buying: bool = false
## An event:claim is on its way.
var _claiming: bool = false
## The screen on now (the lobby, the waiting room…).
var _current: Control


func _ready() -> void:
	print("xomdao:ready")
	var page: int = gallery_page()
	if page > 0:
		var gallery: Control = load("res://hub/gallery/gallery.tscn").instantiate()
		gallery.set("page", page)
		get_tree().root.add_child.call_deferred(gallery)
		queue_free()
		return
	theme = XomDaoUi.theme()
	_screen = Control.new()
	_screen.name = "Screen"
	_screen.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_screen)
	_menu = XomDaoMenu.new()
	_menu.name = "Shell"
	_menu.button.name = "Menu"
	_menu.button.visible = false
	_menu.leave_requested.connect(_leave_game)
	_menu.rules_requested.connect(func() -> void: _show_rules(_client.snapshot.game_id))
	add_child(_menu)
	add_child(_music)
	_client.state_changed.connect(func(_s: XomDaoRoomSnapshot) -> void: _refresh())
	_client.room_changed.connect(_on_room_changed)
	_client.rewarded.connect(_on_rewarded)
	_client.achieved.connect(_on_achieved)
	_client.event_received.connect(_on_event)
	_client.disconnected.connect(func() -> void: _say("Mất kết nối, đang nối lại"))
	_show_status("Đang kết nối")
	await _start()


## The gallery page asked for in the URL or on the command line, 0 when none.
static func gallery_page() -> int:
	var args: String = " ".join(OS.get_cmdline_user_args())
	if OS.has_feature("web"):
		args += " " + str(JavaScriptBridge.eval("window.location.search", true))
	var found: RegExMatch = RegEx.create_from_string("gallery(?:=(\\d+))?").search(args)
	if found == null:
		return 0
	return maxi(1, found.get_string(1).to_int())


func _start() -> void:
	if not await _connect():
		_show_status("Không kết nối được máy chủ")
		return
	if not await Session.log_in(_client):
		if _client.refused():
			_show_update()
		else:
			_show_status("Không đăng nhập được")
		return
	_client.error.connect(_say)
	_coins = _balance()
	var reply: Dictionary = await _client.request(XomDaoProtocol.CATALOG_GET)
	if reply.get("ok") != true:
		_show_status("Không tải được danh sách trò")
		return
	_catalog = HubCatalog.create(XomDaoCatalog.from_dict(reply), await ContentLoader.available())
	_pick_game(HubPrefs.selected_game(_client.user.id))
	var play: String = _query("play") if OS.is_debug_build() else ""
	var code: String = _query("room")
	if play != "" and _client.room_code == "":
		await _sandbox(play)
	elif code != "" and _client.room_code == "":
		await _client.join_room(code)
	_refresh()


## Connects, trying again while a sleeping server wakes up (a free host takes up to a minute).
func _connect() -> bool:
	var started: int = Time.get_ticks_msec()
	while not await _client.connect_to_server(Net.server_url()):
		if Time.get_ticks_msec() - started > WAKE_MS:
			return false
		_show_status("Đang đánh thức máy chủ")
		await get_tree().create_timer(2.0).timeout
	return true


## The server runs a newer version than this page: Tải lại loads it.
func _show_update() -> void:
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 24)
	center.add_child(column)
	var label := Label.new()
	label.name = "Status"
	label.text = "Đã có bản mới"
	label.theme_type_variation = "HudLabel"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(label)
	var reload: XomDaoButton = XomDaoButton.create("Tải lại", XomDaoUi.Kind.GO)
	reload.name = "Reload"
	reload.pressed.connect(_reload_page)
	column.add_child(reload)
	_set_screen("status", center)


func _reload_page() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("location.reload()", true)
	else:
		get_tree().reload_current_scene()


## Tài khoản over your Nhà.
func _show_account() -> void:
	var account := HubAccount.create(_client.user)
	account.signed_in.connect(_switch_account)
	account.signed_out.connect(
		func() -> void:
			await Session.log_out(_client.token)
			await _switch_account("")
	)
	add_child(account)


## Starts again as another player: `token` ("" = a new guest).
func _switch_account(token: String) -> void:
	Session.save_token(token)
	await _client.reset()
	get_tree().reload_current_scene()


## Debug builds: a real room for this game, the computer in the seats it can take, started.
func _sandbox(id: String) -> void:
	_show_status("Đang tải")
	var scene: PackedScene = await ContentLoader.load_game(id)
	if scene == null:
		_show_status("Không tải được %s" % id)
		return
	var probe: Node = scene.instantiate()
	var options: Variant = null
	if probe.has_method("sandbox_options"):
		options = probe.call("sandbox_options")
	probe.free()
	if await _client.create_room(id, options):
		await _client.start_game()


## The game on CHƠI: `wanted` when the catalog has it, else the first playable game.
func _pick_game(wanted: String) -> void:
	var card: XomDaoGameCard = _catalog.card(wanted)
	if card == null:
		for genre: XomDaoGenre in _catalog.ordered_genres():
			var cards: Array[XomDaoGameCard] = _catalog.games_of(genre.id)
			if not cards.is_empty() and (card == null or _catalog.can_play(cards[0].id)):
				card = cards[0]
				if _catalog.can_play(card.id):
					break
	_game_id = card.id if card != null else ""
	_genre = card.genre if card != null else ""


func _choose_game(game_id: String) -> void:
	_pick_game(game_id)
	if _client.user != null and _game_id != "":
		HubPrefs.set_selected_game(_client.user.id, _game_id)


func _refresh() -> void:
	if _catalog == null:
		return
	var snapshot: XomDaoRoomSnapshot = _client.snapshot
	var playing: bool = snapshot != null and snapshot.status != "lobby"
	_menu.button.visible = playing
	if not playing and _menu.is_open() and _shown != "lobby":
		_menu.close()
	if _client.room_code == "":
		_drop_game()
		_show_place()
	elif snapshot == null or snapshot.status == "lobby":
		_drop_game()
		_show_waiting_room(snapshot)
	else:
		_quick = false
		_show_game(snapshot)


func _on_room_changed(code: String) -> void:
	if code == "":
		_quick = false
	_refresh()


# ── Out of a room ─────────────────────────────────────────────────────────────────────────


func _show_place() -> void:
	match _place:
		"select":
			_show_select(_genre)
		"ben":
			_show_ben()
		"nha":
			_show_home()
		"cho":
			_show_shop()
		"dinh":
			_show_dinh()
		_:
			_show_lobby()


func _show_lobby() -> void:
	_place = "lobby"
	if _shown == "lobby":
		return
	var lobby := HubLobby.new()
	_set_screen("lobby", lobby)
	lobby.show_user(_client.user)
	_fill_level(lobby)
	lobby.money.show_balance(_coins)
	lobby.money.settings_pressed.connect(_menu.open_settings)
	lobby.show_catalog(_catalog, _genre)
	lobby.show_game(_catalog.card(_game_id), _catalog.can_play(_game_id))
	lobby.genre_changed.connect(_on_genre_changed.bind(lobby))
	lobby.play_pressed.connect(_quick_match)
	lobby.create_pressed.connect(_open_setup)
	lobby.select_opened.connect(_show_select)
	lobby.place_pressed.connect(_on_place)
	lobby.event_pressed.connect(
		func(id: String) -> void:
			_choose_game(id)
			_show_select(_genre)
	)


func _on_genre_changed(genre_id: String, lobby: HubLobby) -> void:
	var cards: Array[XomDaoGameCard] = _catalog.games_of(genre_id)
	if cards.is_empty():
		_genre = genre_id
		lobby.show_game(null, false)
		return
	_choose_game(cards[0].id)
	lobby.show_game(cards[0], _catalog.can_play(cards[0].id))


func _on_place(place: String) -> void:
	match place:
		"ben":
			_show_ben()
		"nha":
			_show_home()
		"cho":
			_show_shop()
		"dinh":
			_show_dinh()
		_:
			XomDaoToast.show_on(self, "Sắp có", "lock-simple")


## Nhà: your profile card and Túi đồ, where you wear what you own.
func _show_home() -> void:
	_place = "nha"
	if _shown == "nha":
		return
	var home := HubHome.new()
	_set_screen("nha", home)
	home.top.money.show_balance(_coins)
	home.top.money.settings_pressed.connect(_menu.open_settings)
	home.back_pressed.connect(_back_to_lobby)
	home.equip_requested.connect(_equip.bind(home))
	home.account_pressed.connect(_show_account)
	await _fill_home(home, "")


## Someone's Nhà over the screen, read-only (tap a player in the waiting room).
func _show_profile_of(user_id: String) -> void:
	if user_id == _client.player_id:
		return
	var home := HubHome.new(null, false)
	home.name = "OtherHome"
	add_child(home)
	home.top.money.show_balance(_coins)
	home.top.money.settings_pressed.connect(_menu.open_settings)
	home.back_pressed.connect(home.queue_free)
	if not await _fill_home(home, user_id):
		home.queue_free()


## Fills a Nhà with `inventory:get` (yours for ""), naming the items from `shop:list`, then
## its level, achievements and ranks (`stats:get`).
func _fill_home(home: HubHome, user_id: String) -> bool:
	var data: Dictionary = {} if user_id == "" else {"userId": user_id}
	var reply: Dictionary = await _client.request(XomDaoProtocol.INVENTORY_GET, data)
	var list: Dictionary = await _client.request(XomDaoProtocol.SHOP_LIST)
	if reply.get("ok") != true or list.get("ok") != true:
		_say(str(reply.get("error", list.get("error", "Không tải được"))))
		return false
	if not is_instance_valid(home):
		return true
	home.show_profile(XomDaoProfile.from_dict(reply), XomDaoShopList.from_dict(list).items)
	var stats: Dictionary = await _client.request(XomDaoProtocol.STATS_GET, data)
	if stats.get("ok") == true and is_instance_valid(home):
		home.show_stats(XomDaoPlayerStats.from_dict(stats), _catalog.names())
	return true


## The level chip by your name in the lobby.
func _fill_level(lobby: HubLobby) -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.STATS_GET)
	if reply.get("ok") == true and is_instance_valid(lobby):
		lobby.show_level(XomDaoPlayerStats.from_dict(reply).level)


## Đình: the rankings, Cả xóm first.
func _show_dinh() -> void:
	_place = "dinh"
	if _shown == "dinh":
		return
	var dinh := HubDinh.new()
	_set_screen("dinh", dinh)
	dinh.top.money.show_balance(_coins)
	dinh.top.money.settings_pressed.connect(_menu.open_settings)
	dinh.back_pressed.connect(_back_to_lobby)
	dinh.board_changed.connect(_fill_ranking.bind(dinh))
	dinh.set_boards(_catalog.ranked_games())


func _fill_ranking(board: String, dinh: HubDinh) -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.RANKING_GET, {"board": board})
	if reply.get("ok") != true:
		_say(str(reply.get("error", "Không tải được")))
		return
	if is_instance_valid(dinh):
		dinh.show_ranking(
			XomDaoRanking.from_dict(reply), _client.user.id if _client.user != null else ""
		)


func _equip(item_id: String, home: HubHome) -> void:
	var reply: Dictionary = await _client.request(
		XomDaoProtocol.INVENTORY_EQUIP, {"itemId": item_id}
	)
	if reply.get("ok") != true:
		_say(str(reply.get("error", "")))
		return
	_client.user = XomDaoUser.from_dict(reply["user"])
	XomDaoUi.play(self, XomDaoUi.SOUND_TAP)
	if is_instance_valid(home):
		await _fill_home(home, "")


## Chợ: the items for sale; Mua pays through the ledger on the server.
func _show_shop() -> void:
	_place = "cho"
	if _shown == "cho":
		return
	_coins = _balance()
	var shop := HubShop.new()
	_set_screen("cho", shop)
	shop.top.money.show_balance(_coins)
	shop.top.money.settings_pressed.connect(_menu.open_settings)
	shop.back_pressed.connect(_back_to_lobby)
	shop.buy_requested.connect(_buy.bind(shop))
	await _fill_shop(shop)


func _fill_shop(shop: HubShop) -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.SHOP_LIST)
	if reply.get("ok") != true:
		_say(str(reply.get("error", "Không tải được")))
		return
	if is_instance_valid(shop):
		shop.show_items(XomDaoShopList.from_dict(reply).items, _coins)


func _buy(item_id: String, shop: HubShop) -> void:
	# A second tap while the first is on its way asks nothing more (the server pays once anyway).
	if _buying:
		return
	_buying = true
	var reply: Dictionary = await _client.request(XomDaoProtocol.SHOP_BUY, {"itemId": item_id})
	_buying = false
	if reply.get("ok") != true:
		_say(str(reply.get("error", "")))
		return
	var purchase := XomDaoPurchase.from_dict(reply)
	_client.balances = purchase.balances
	_coins = _balance()
	XomDaoUi.play(self, XomDaoUi.SOUND_COIN)
	XomDaoToast.show_on(self, "Đã mua %s" % purchase.item.name, "check-circle")
	if is_instance_valid(shop):
		shop.top.money.show_balance(_coins)
		await _fill_shop(shop)


func _show_select(genre_id: String) -> void:
	_place = "select"
	if _shown == "select":
		return
	var select := HubGameSelect.new()
	_set_screen("select", select)
	select.top.money.show_balance(_coins)
	select.top.money.settings_pressed.connect(_menu.open_settings)
	select.back_pressed.connect(_back_to_lobby)
	select.chosen.connect(
		func(id: String) -> void:
			_choose_game(id)
			_back_to_lobby()
	)
	select.create_pressed.connect(_open_setup)
	select.rooms_pressed.connect(
		func(id: String) -> void:
			_choose_game(id)
			_show_ben()
	)
	select.rules_pressed.connect(_show_rules)
	select.progress_needed.connect(_fill_progress.bind(select))
	select.join_pressed.connect(_quick_match)
	select.claim_pressed.connect(_claim.bind(select))
	select.show_genre(_catalog, genre_id, _game_id)


## An event's progress (`event:get`) on the select's detail board.
func _fill_progress(game_id: String, select: HubGameSelect) -> void:
	var reply: Dictionary = await _client.request(XomDaoProtocol.EVENT_GET, {"eventId": game_id})
	if reply.get("ok") == true and is_instance_valid(select):
		select.show_progress(XomDaoEventProgress.from_dict(reply))


## Nhận: an event tier's reward, paid by the server once.
func _claim(game_id: String, tier: int, select: HubGameSelect) -> void:
	if _claiming:
		return
	_claiming = true
	var reply: Dictionary = await _client.request(
		XomDaoProtocol.EVENT_CLAIM, {"eventId": game_id, "tier": tier}
	)
	_claiming = false
	if reply.get("ok") != true:
		_say(str(reply.get("error", "")))
		return
	var claim := XomDaoEventClaim.from_dict(reply)
	var gained: int = int(claim.balances.get("core:coin", 0)) - _coins
	_client.balances = claim.balances
	_coins = _balance()
	XomDaoUi.play(self, XomDaoUi.SOUND_COIN)
	XomDaoToast.show_on(self, "Nhận %s xu" % XomDaoUi.money(gained), "gift")
	if is_instance_valid(select):
		select.top.money.show_balance(_coins)
		select.show_progress(claim.progress)


func _show_ben() -> void:
	_place = "ben"
	if _shown == "ben":
		return
	_ben = HubBen.new()
	_set_screen("ben", _ben)
	_ben.top.money.show_balance(_coins)
	_ben.top.money.settings_pressed.connect(_menu.open_settings)
	_ben.back_pressed.connect(_back_to_lobby)
	_ben.join_requested.connect(func(code: String) -> void: _client.join_room(code))
	var card: XomDaoGameCard = _catalog.card(_game_id)
	var title: String = card.name if card != null else ""
	_ben.show_rooms(title, [])
	if _game_id == "":
		return
	var reply: Dictionary = await _client.request(XomDaoProtocol.LOBBY_WATCH, {"gameId": _game_id})
	if reply.get("ok") == true and _ben != null and is_instance_valid(_ben):
		_ben.show_rooms(title, XomDaoRoomList.from_dict(reply).rooms)


func _on_event(_event: String, data: Variant) -> void:
	if data is XomDaoLobbyRooms and _shown == "ben" and data.game_id == _game_id:
		var card: XomDaoGameCard = _catalog.card(_game_id)
		_ben.show_rooms(card.name if card != null else "", data.rooms)


func _back_to_lobby() -> void:
	if _shown == "ben":
		_client.request(XomDaoProtocol.LOBBY_UNWATCH)
	_place = "lobby"
	_show_lobby()


func _quick_match(game_id: String) -> void:
	_choose_game(game_id)
	_quick = true
	if not await _client.quick_match(game_id):
		_quick = false


## Tạo phòng: the game's own options board, then the room.
func _open_setup(game_id: String) -> void:
	_choose_game(game_id)
	var card: XomDaoGameCard = _catalog.card(game_id)
	var scene: PackedScene = await ContentLoader.load_game(game_id)
	if scene == null or card == null:
		_say("Không tải được trò chơi")
		return
	var probe: Node = scene.instantiate()
	var spec: Array = probe.call("room_setup") if probe.has_method("room_setup") else []
	probe.free()
	var setup := HubRoomSetup.new()
	add_child(setup)
	setup.show_setup(card.name, spec)
	setup.cancelled.connect(setup.queue_free)
	setup.created.connect(
		func(options: Dictionary) -> void:
			setup.queue_free()
			await _client.create_room(game_id, options if not options.is_empty() else null)
	)


func _show_rules(game_id: String) -> void:
	var card: XomDaoGameCard = _catalog.card(game_id)
	if card == null:
		return
	var text: String = card.tagline
	if _catalog.can_play(game_id) and await ContentLoader.load_game(game_id) != null:
		var rules: String = "res://content/%s/RULES.md" % game_id
		if FileAccess.file_exists(rules):
			text = HubRulesBoard.plain(FileAccess.get_file_as_string(rules))
	add_child(HubRulesBoard.create("Luật %s" % card.name, text))


# ── In a room ─────────────────────────────────────────────────────────────────────────────


func _show_waiting_room(snapshot: XomDaoRoomSnapshot) -> void:
	var room: HubWaitingRoom = _current as HubWaitingRoom if _shown == "room" else null
	if room == null:
		room = HubWaitingRoom.new()
		_set_screen("room", room)
		room.top.money.show_balance(_coins)
		room.top.money.settings_pressed.connect(_menu.open_settings)
		room.leave_pressed.connect(_leave)
		room.invite_pressed.connect(_invite)
		room.start_pressed.connect(_client.start_game)
		room.player_pressed.connect(_show_profile_of)
	if snapshot == null:
		return
	var card: XomDaoGameCard = _catalog.card(snapshot.game_id)
	room.show_room(snapshot, _client.player_id, card.max_players if card != null else 2, _quick)
	if snapshot.game_id != _game_id:
		_choose_game(snapshot.game_id)
	ContentLoader.preload_game(snapshot.game_id)


func _show_game(snapshot: XomDaoRoomSnapshot) -> void:
	if _game_id_shown != snapshot.game_id:
		_drop_game()
		_game_id_shown = snapshot.game_id
		if snapshot.game_id != _game_id:
			_choose_game(snapshot.game_id)
	if _game == null:
		if _loading:
			return
		_loading = true
		_show_status("Đang tải")
		var scene: PackedScene = await ContentLoader.load_game(snapshot.game_id)
		_loading = false
		if scene == null:
			_show_status("Không tải được trò chơi")
			return
		_game = scene.instantiate()
		_set_screen("game", _game)
		_music.play_for(snapshot.game_id)
		if _game.has_method("bind"):
			_game.call("bind", _client)
		_refresh()
		return
	if _shown != "game":
		_set_screen("game", _game)
	TestBridge.scene = snapshot.game_id
	if snapshot.status == "finished":
		if _result == null:
			_show_result(snapshot)
	elif _result != null:
		_result.queue_free()
		_result = null


func _show_result(snapshot: XomDaoRoomSnapshot) -> void:
	_result = HubResult.new()
	_screen.add_child(_result)
	_result.money.settings_pressed.connect(_menu.open_settings)
	_result.again_pressed.connect(_client.start_game)
	_result.home_pressed.connect(_leave)
	var card: XomDaoGameCard = _catalog.card(snapshot.game_id)
	var detail: Variant = _game.call("result_detail") if _game.has_method("result_detail") else {}
	_result.show_result(
		snapshot,
		_client.player_id,
		_coins,
		card != null and card.kind == "event",
		detail if detail is Dictionary else {}
	)
	# The ledger may have paid before the board came up.
	if _balance() != _coins:
		_on_rewarded(null)


## Achievements a game got you: one notice naming them; their coins join the balance.
func _on_achieved(notice: XomDaoAchievementNotice) -> void:
	var names: Array[String] = []
	for info: XomDaoAchievementInfo in notice.achievements:
		names.append(info.name)
	var toast: XomDaoToast = XomDaoToast.show_on(self, "Thành tích: " + ", ".join(names), "trophy")
	toast.name = "AchievementToast"
	XomDaoUi.play(self, XomDaoUi.SOUND_COIN)
	_on_rewarded(null)


func _on_rewarded(_notice: XomDaoRewardNotice) -> void:
	var balance: int = _balance()
	if _result != null and is_instance_valid(_result):
		_result.receive(balance)
	_coins = balance


## ☰ → Rời phòng: in the middle of a game, ask first.
func _leave_game() -> void:
	if _client.snapshot == null or _client.snapshot.status != "playing":
		await _leave()
		return
	var confirm: XomDaoBoard = XomDaoBoard.create("Rời ván?", true)
	confirm.name = "ConfirmBoard"
	var shade := ColorRect.new()
	shade.color = Color(XomDaoUi.INK, 0.45)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.add_child(center)
	center.add_child(confirm)
	var note := Label.new()
	note.text = "Ván đang chơi sẽ dừng."
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	confirm.content.add_child(note)
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 16)
	confirm.content.add_child(buttons)
	var stay: XomDaoButton = XomDaoButton.create("Ở lại", XomDaoUi.Kind.BACK)
	stay.name = "Stay"
	stay.pressed.connect(shade.queue_free)
	buttons.add_child(stay)
	var leave: XomDaoButton = XomDaoButton.create("Rời phòng", XomDaoUi.Kind.DANGER)
	leave.name = "ConfirmLeave"
	leave.pressed.connect(
		func() -> void:
			shade.queue_free()
			_leave()
	)
	buttons.add_child(leave)
	confirm.closed.connect(shade.queue_free)
	confirm.open()


func _leave() -> void:
	_menu.close()
	# Out of an event's game, back to its board (your points and tiers); else the lobby.
	var snapshot: XomDaoRoomSnapshot = _client.snapshot
	var card: XomDaoGameCard = _catalog.card(snapshot.game_id) if snapshot != null else null
	_place = "select" if card != null and card.kind == "event" else "lobby"
	await _client.leave_room()


func _invite() -> void:
	var link: String = _client.room_code
	if OS.has_feature("web"):
		var page: String = str(JavaScriptBridge.eval("location.origin + location.pathname", true))
		link = "%s?room=%s" % [page, _client.room_code]
	DisplayServer.clipboard_set(link)
	XomDaoToast.show_on(self, "Đã sao chép link mời")


# ── Screens ───────────────────────────────────────────────────────────────────────────────


func _show_status(text: String) -> void:
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var label := Label.new()
	label.name = "Status"
	label.text = text
	label.theme_type_variation = "HudLabel"
	center.add_child(label)
	_set_screen("status", center)


## Puts `screen` on, freeing the one before (the game stays: it lives across rounds).
func _set_screen(shown: String, screen: Control) -> void:
	_shown = shown
	_current = screen
	for child: Node in _screen.get_children():
		if child != _game and child != screen:
			child.queue_free()
	if _result != null and not is_instance_valid(_result):
		_result = null
	if shown != "game" and _result != null:
		_result = null
	if _ben != null and shown != "ben":
		_ben = null
	if screen.get_parent() == null:
		_screen.add_child(screen)
	if _game != null:
		_game.visible = shown == "game"
	TestBridge.scene = shown if shown != "game" else _game_id_shown


func _drop_game() -> void:
	_music.quiet()
	if _game != null:
		_game.queue_free()
		_game = null
	_game_id_shown = ""
	_result = null


func _balance() -> int:
	return int(_client.balances.get("core:coin", 0))


func _say(text: String) -> void:
	XomDaoToast.show_on(self, text, "warning")


## A query parameter of the page's URL (web only).
func _query(key: String) -> String:
	if not OS.has_feature("web"):
		return ""
	var js: String = "new URLSearchParams(location.search).get('%s') || ''" % key
	return str(JavaScriptBridge.eval(js, true))
