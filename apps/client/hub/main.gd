extends Control
## The tracer's temporary hub (#113), until the island ring lobby: play Caro with the computer,
## make a room and share its code or link, or join one by code; then the room, the game and its
## result. Links: ?room=<code> joins that room; ?play=<id> (debug builds) is the sandbox, a real
## room on the server with the computer in the empty seats.
##
## Screens are rebuilt from the connection's state (room code and snapshot) whenever it changes.
## Every node a test taps or reads has a name (TestBridge, core/test_bridge.gd).
## ?gallery=<page> (web) or `-- --gallery=<page>` opens the UI component gallery instead.

## The game this hub offers until the lobby lists them all.
const GAME := "tic-tac-toe"

var _client: XomDaoClient = Net.client
var _screen: Control
var _game: Control
var _game_id: String = ""
var _loading: bool = false
var _shown: String = ""
var _menu: XomDaoMenu
var _code_input: LineEdit


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
	_build_hud()
	_client.state_changed.connect(func(_s: XomDaoRoomSnapshot) -> void: _refresh())
	_client.room_changed.connect(func(_c: String) -> void: _refresh())
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
	if not await _client.connect_to_server(Net.server_url()):
		_show_status("Không kết nối được máy chủ")
		return
	if not await Session.log_in(_client):
		_show_status("Không đăng nhập được")
		return
	_client.error.connect(_say)
	var play: String = _query("play") if OS.is_debug_build() else ""
	var code: String = _query("room")
	if play != "" and _client.room_code == "":
		await _sandbox(play)
	elif code != "" and _client.room_code == "":
		await _client.join_room(code)
	_refresh()


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


func _refresh() -> void:
	var snapshot: XomDaoRoomSnapshot = _client.snapshot
	_menu.visible = snapshot != null and snapshot.status != "lobby"
	if not _menu.visible:
		_menu.close()
	if _client.room_code == "":
		_drop_game()
		_show_home()
	elif snapshot == null or snapshot.status == "lobby":
		_drop_game()
		_show_room(snapshot)
	else:
		_show_game(snapshot)


func _show_status(text: String) -> void:
	_set_screen("status")
	_centered().add_child(_label("Status", text, "HudLabel"))
	TestBridge.scene = "status"


func _show_home() -> void:
	if _shown == "home":
		return
	_set_screen("home")
	var board := XomDaoBoard.create("Caro")
	board.name = "HomeBoard"
	_centered().add_child(board)
	var column: VBoxContainer = board.content
	column.add_theme_constant_override("separation", 20)
	var bot := _button("PlayBot", "Chơi với máy", XomDaoUi.Kind.GO)
	bot.pressed.connect(_play_bot)
	column.add_child(bot)
	var create := _button("CreateRoom", "Tạo phòng", XomDaoUi.Kind.SOCIAL)
	create.pressed.connect(_create)
	column.add_child(create)
	column.add_child(XomDaoDivider.new())
	var join := HBoxContainer.new()
	join.add_theme_constant_override("separation", 16)
	column.add_child(join)
	_code_input = LineEdit.new()
	_code_input.name = "CodeInput"
	_code_input.placeholder_text = "Mã phòng"
	_code_input.max_length = 4
	_code_input.alignment = HORIZONTAL_ALIGNMENT_CENTER
	_code_input.custom_minimum_size = Vector2(220, XomDaoUi.TOUCH)
	_code_input.add_theme_font_override("font", XomDaoUi.display_font(800))
	_code_input.add_theme_font_size_override("font_size", XomDaoUi.TEXT)
	_code_input.text_submitted.connect(func(_t: String) -> void: _join())
	join.add_child(_code_input)
	var go := _button("Join", "Vào", XomDaoUi.Kind.SOCIAL)
	go.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	go.pressed.connect(_join)
	join.add_child(go)
	TestBridge.scene = "home"


func _show_room(snapshot: XomDaoRoomSnapshot) -> void:
	_set_screen("room")
	TestBridge.scene = "room"
	var board := XomDaoBoard.create("Phòng")
	board.name = "RoomBoard"
	_centered().add_child(board)
	var column: VBoxContainer = board.content
	column.add_theme_constant_override("separation", 20)
	var code := _label("RoomCode", _client.room_code, "TitleLabel")
	code.add_theme_font_size_override("font_size", 72)
	code.add_theme_color_override("font_color", XomDaoUi.LACQUER)
	column.add_child(code)
	if snapshot == null:
		return
	var seats := HBoxContainer.new()
	seats.alignment = BoxContainer.ALIGNMENT_CENTER
	seats.add_theme_constant_override("separation", 24)
	column.add_child(seats)
	for i: int in snapshot.players.size():
		var player: XomDaoPlayerInfo = snapshot.players[i]
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat%d" % i
		slot.compact = true
		slot.player_name = player.name
		slot.host = player.id == snapshot.host_id
		seats.add_child(slot)
	column.add_child(XomDaoDivider.new())
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 16)
	column.add_child(buttons)
	var leave := _button("LeaveRoom", "Rời phòng", XomDaoUi.Kind.BACK)
	leave.pressed.connect(_leave)
	buttons.add_child(leave)
	var invite := _button("Invite", "Mời bạn", XomDaoUi.Kind.SOCIAL)
	invite.pressed.connect(_invite)
	buttons.add_child(invite)
	if snapshot.host_id == _client.player_id:
		var start := _button("Start", "Bắt đầu", XomDaoUi.Kind.GO)
		start.disabled = snapshot.players.size() < 2
		start.pressed.connect(_client.start_game)
		buttons.add_child(start)


func _show_game(snapshot: XomDaoRoomSnapshot) -> void:
	if _game_id != snapshot.game_id:
		_drop_game()
		_game_id = snapshot.game_id
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
		_set_screen("game")
		_game = scene.instantiate()
		_screen.add_child(_game)
		if _game.has_method("bind"):
			_game.call("bind", _client)
		_refresh()
		return
	if _shown != "game" and _shown != "result":
		_set_screen("game")
	TestBridge.scene = snapshot.game_id
	var old: Node = _screen.get_node_or_null("Result")
	if old != null:
		old.free()
	if snapshot.status == "finished":
		_show_result(snapshot)


## The result over the board: who won, what you earned, and what next.
func _show_result(snapshot: XomDaoRoomSnapshot) -> void:
	var overlay := ColorRect.new()
	overlay.name = "Result"
	overlay.color = Color(XomDaoUi.INK, 0.45)
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_screen.add_child(overlay)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(center)
	var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
	var title: String = "Hoà"
	if _client.player_id in winners:
		title = "Bạn thắng!"
	elif not winners.is_empty():
		title = "%s thắng!" % _player_name(snapshot, winners[0])
	var board := XomDaoBoard.create("Hết ván")
	board.name = "ResultBoard"
	center.add_child(board)
	var column: VBoxContainer = board.content
	column.add_theme_constant_override("separation", 20)
	column.add_child(_label("ResultTitle", title, "TitleLabel"))
	if snapshot.result != null:
		for reward: XomDaoReward in snapshot.result.rewards:
			if reward.player == _client.player_id and reward.resource == "core:coin":
				var delta := XomDaoDelta.create(reward.amount)
				delta.name = "Reward"
				delta.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
				column.add_child(delta)
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 16)
	column.add_child(buttons)
	var home := _button("Home", "Về sảnh", XomDaoUi.Kind.BACK)
	home.pressed.connect(_leave)
	buttons.add_child(home)
	if snapshot.host_id == _client.player_id:
		var again := _button("Again", "Chơi ván mới", XomDaoUi.Kind.GO)
		again.pressed.connect(_client.start_game)
		buttons.add_child(again)
	board.open()
	TestBridge.scene = snapshot.game_id


func _play_bot() -> void:
	if await _client.create_room(GAME, {"opponent": "bot"}):
		await _client.start_game()


func _create() -> void:
	await _client.create_room(GAME)


func _join() -> void:
	var code: String = _code_input.text.strip_edges()
	if code != "":
		await _client.join_room(code)


func _leave() -> void:
	_menu.close()
	await _client.leave_room()


func _invite() -> void:
	var link: String = _client.room_code
	if OS.has_feature("web"):
		var page: String = str(JavaScriptBridge.eval("location.origin + location.pathname", true))
		link = "%s?room=%s" % [page, _client.room_code]
	DisplayServer.clipboard_set(link)
	XomDaoToast.show_on(self, "Đã sao chép link mời")


func _drop_game() -> void:
	if _game != null:
		_game.queue_free()
		_game = null
	_game_id = ""


## Empties the screen for another one (the game stays: it lives across rounds).
func _set_screen(screen: String) -> void:
	_shown = screen
	for child: Node in _screen.get_children():
		if child != _game:
			child.queue_free()
	if _game != null:
		_game.visible = screen == "game"


func _build_hud() -> void:
	_menu = XomDaoMenu.new()
	_menu.name = "Shell"
	_menu.button.name = "Menu"
	_menu.visible = false
	_menu.leave_requested.connect(_leave)
	add_child(_menu)


func _say(text: String) -> void:
	XomDaoToast.show_on(self, text, "warning")


func _centered() -> CenterContainer:
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_screen.add_child(center)
	return center


func _label(node_name: String, text: String, variation: String = "") -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = text
	label.theme_type_variation = variation
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return label


func _button(node_name: String, text: String, kind: XomDaoUi.Kind) -> XomDaoButton:
	var button := XomDaoButton.create(text, kind)
	button.name = node_name
	return button


func _player_name(snapshot: XomDaoRoomSnapshot, id: String) -> String:
	for player: XomDaoPlayerInfo in snapshot.seats + snapshot.players:
		if player.id == id:
			return player.name
	return "?"


## A query parameter of the page's URL (web only).
func _query(key: String) -> String:
	if not OS.has_feature("web"):
		return ""
	var js: String = "new URLSearchParams(location.search).get('%s') || ''" % key
	return str(JavaScriptBridge.eval(js, true))
