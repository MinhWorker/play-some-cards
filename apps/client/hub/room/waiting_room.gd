class_name HubWaitingRoom
extends Control
## The room before its game starts: the code to share, the seats, and Rời phòng, Mời bạn (the
## link) and, for the host, Bắt đầu. A quick-match room says it is still looking for players.

signal leave_pressed
signal invite_pressed
signal start_pressed

var top := HubTopBar.new()

var _board: XomDaoBoard = XomDaoBoard.create("Phòng")
var _code := Label.new()
var _seats := HBoxContainer.new()
var _status := Label.new()
var _start: XomDaoButton = XomDaoButton.create("Bắt đầu", XomDaoUi.Kind.GO)


func _init(settings: XomDaoSettings = null) -> void:
	name = "WaitingRoom"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	top = HubTopBar.new(settings)
	top.back_pressed.connect(leave_pressed.emit)
	add_child(top)
	_board.name = "RoomBoard"
	add_child(_board)
	var column: VBoxContainer = _board.content
	column.add_theme_constant_override("separation", 16)
	_code.name = "RoomCode"
	_code.theme_type_variation = "TitleLabel"
	_code.add_theme_font_size_override("font_size", 72)
	_code.add_theme_color_override("font_color", XomDaoUi.LACQUER)
	_code.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_code)
	_seats.alignment = BoxContainer.ALIGNMENT_CENTER
	_seats.add_theme_constant_override("separation", 24)
	column.add_child(_seats)
	_status.name = "RoomStatus"
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.add_theme_color_override("font_color", Color(XomDaoUi.INK, 0.75))
	column.add_child(_status)
	column.add_child(XomDaoDivider.new())
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 16)
	column.add_child(buttons)
	var leave: XomDaoButton = XomDaoButton.create("Rời phòng", XomDaoUi.Kind.BACK)
	leave.name = "LeaveRoom"
	leave.pressed.connect(leave_pressed.emit)
	buttons.add_child(leave)
	var invite: XomDaoButton = XomDaoButton.create("Mời bạn", XomDaoUi.Kind.SOCIAL)
	invite.name = "Invite"
	invite.icon = XomDaoUi.icon("link")
	invite.pressed.connect(invite_pressed.emit)
	buttons.add_child(invite)
	_start.name = "Start"
	_start.pressed.connect(start_pressed.emit)
	buttons.add_child(_start)
	resized.connect(_layout)


func _ready() -> void:
	_layout()


## `me` is your member id; `max_players` the game's seats; `quick` while quick match looks for
## players.
func show_room(snapshot: XomDaoRoomSnapshot, me: String, max_players: int, quick: bool) -> void:
	_code.text = snapshot.code
	for child: Node in _seats.get_children():
		child.queue_free()
	for i: int in maxi(max_players, snapshot.players.size()):
		var slot := XomDaoPlayerSlot.new()
		slot.name = "Seat%d" % i
		slot.compact = true
		if i < snapshot.players.size():
			var player: XomDaoPlayerInfo = snapshot.players[i]
			slot.player_name = player.name
			slot.host = player.id == snapshot.host_id
		else:
			slot.player_name = "Trống"
			slot.modulate = Color(1, 1, 1, 0.45)
		_seats.add_child(slot)
	var host: bool = snapshot.host_id == me
	_start.visible = host and not quick
	_start.disabled = snapshot.players.size() < 2
	if quick:
		_status.text = "Đang tìm người chơi"
	elif not host:
		_status.text = "Chờ chủ phòng bắt đầu"
	else:
		_status.text = ""
	_status.visible = _status.text != ""
	_layout.call_deferred()


func _layout() -> void:
	top._layout()
	_board.reset_size()
	var y: float = top.bottom() + 8.0
	_board.position = Vector2(
		(size.x - _board.size.x) / 2.0, maxf(y, (size.y - _board.size.y) / 2.0)
	)
