class_name HubResult
extends Control
## The end of a game, over the board: how it ended and the game's own figures (its
## `result_detail()`, after the time played), the ranks the game gave, each player's reward from
## the ledger (green up, red down), the balance on the top right that the coins fly into, and Chơi
## tiếp (a new game, same room), Về sảnh and Xem bàn (put the board away to look at the table;
## Kết quả at the top brings it back).

signal again_pressed
signal home_pressed

var money := HubMoneyRow.new()

var _shade := ColorRect.new()
var _board: XomDaoBoard = XomDaoBoard.create("Hết ván")
var _title := Label.new()
var _reason := Label.new()
var _rows := GridContainer.new()
var _ranks := VBoxContainer.new()
var _reopen: XomDaoButton = XomDaoButton.create("Kết quả", XomDaoUi.Kind.GO)
var _again: XomDaoButton = XomDaoButton.create("Chơi tiếp", XomDaoUi.Kind.GO)
var _reward_at: Control
var _settings: XomDaoSettings


## The ranks of a finished game: 1 for the winners, 2 for the others; everyone 0 in a draw.
static func ranks(snapshot: XomDaoRoomSnapshot) -> Dictionary:
	var out: Dictionary = {}
	var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
	for player: XomDaoPlayerInfo in _seated(snapshot):
		if winners.is_empty():
			out[player.id] = 0
		else:
			out[player.id] = 1 if winners.has(player.id) else 2
	return out


## Each player's coins from this game (`core:coin` in the result's rewards).
static func coins(snapshot: XomDaoRoomSnapshot, resource: String = "core:coin") -> Dictionary:
	var out: Dictionary = {}
	if snapshot.result == null:
		return out
	for reward: XomDaoReward in snapshot.result.rewards:
		if reward.resource == resource:
			out[reward.player] = int(out.get(reward.player, 0)) + reward.amount
	return out


static func _seated(snapshot: XomDaoRoomSnapshot) -> Array[XomDaoPlayerInfo]:
	return snapshot.seats if not snapshot.seats.is_empty() else snapshot.players


func _init(settings: XomDaoSettings = null) -> void:
	_settings = settings if settings != null else XomDaoSettings.current()
	name = "Result"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# Taps reach the table while the board is put away.
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_shade.color = Color(XomDaoUi.INK, 0.45)
	_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_shade)
	_board.name = "ResultBoard"
	add_child(_board)
	var column: VBoxContainer = _board.content
	column.add_theme_constant_override("separation", 14)
	_title.name = "ResultTitle"
	_title.theme_type_variation = "TitleLabel"
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(_title)
	_reason.name = "ResultReason"
	_reason.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_reason.add_theme_color_override("font_color", XomDaoUi.INK)
	_reason.visible = false
	column.add_child(_reason)
	_rows.name = "ResultRows"
	_rows.columns = 2
	_rows.add_theme_constant_override("h_separation", 24)
	_rows.add_theme_constant_override("v_separation", 4)
	_rows.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_rows.visible = false
	column.add_child(_rows)
	_ranks.add_theme_constant_override("separation", 8)
	column.add_child(_ranks)
	column.add_child(XomDaoDivider.new())
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 16)
	column.add_child(buttons)
	var home: XomDaoButton = XomDaoButton.create("Về sảnh", XomDaoUi.Kind.BACK)
	home.name = "Home"
	home.pressed.connect(home_pressed.emit)
	buttons.add_child(home)
	var look: XomDaoButton = XomDaoButton.create("Xem bàn", XomDaoUi.Kind.INFO)
	look.name = "ViewBoard"
	look.pressed.connect(show_board.bind(true))
	buttons.add_child(look)
	_again.name = "Again"
	_again.pressed.connect(again_pressed.emit)
	buttons.add_child(_again)
	add_child(money)
	_reopen.name = "ShowResult"
	_reopen.visible = false
	_reopen.pressed.connect(show_board.bind(false))
	add_child(_reopen)
	resized.connect(_layout)


func _ready() -> void:
	_layout()


## Fills the board for player `me`; `balance` is the coins shown before this game's reward. An
## event's game (`event`) is titled with the event points you got, also shown on your row.
## `detail` is the game's `result_detail()`: `{reason: String, rows: [[label, value], …]}`.
func show_result(
	snapshot: XomDaoRoomSnapshot,
	me: String,
	balance: int,
	event: bool = false,
	detail: Dictionary = {}
) -> void:
	var winners: Array[String] = snapshot.result.winners if snapshot.result != null else []
	var points: Dictionary = coins(snapshot, "event:point")
	if event:
		_title.text = "+%d điểm sự kiện" % int(points.get(me, 0))
	elif winners.is_empty():
		_title.text = "Hoà"
	elif winners.has(me):
		_title.text = "Bạn thắng!"
	else:
		_title.text = "%s thắng!" % _name_of(snapshot, winners[0])
	_show_detail(snapshot, detail)
	var rank: Dictionary = ranks(snapshot)
	var paid: Dictionary = coins(snapshot)
	var seated: Array[XomDaoPlayerInfo] = _seated(snapshot)
	seated.sort_custom(
		func(a: XomDaoPlayerInfo, b: XomDaoPlayerInfo) -> bool: return rank[a.id] < rank[b.id]
	)
	for player: XomDaoPlayerInfo in seated:
		var row: Control = _row(player, int(rank[player.id]), int(paid.get(player.id, 0)), me)
		if event and not player.bot:
			var got := XomDaoChip.create(
				"+%d điểm" % int(points.get(player.id, 0)), "flag-banner", XomDaoUi.LACQUER
			)
			if player.id == me:
				got.name = "EventReward"
			got.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			row.add_child(got)
			row.move_child(got, row.get_child_count() - 2)
		_ranks.add_child(row)
	_again.visible = snapshot.host_id == me
	money.show_balance(balance)
	_board.open()
	_layout.call_deferred()


## `true` puts the board away to look at the table, with Kết quả to bring it back.
func show_board(looking: bool) -> void:
	_shade.visible = not looking
	_board.visible = not looking
	money.visible = not looking
	_reopen.visible = looking
	XomDaoUi.play(self, XomDaoUi.SOUND_PANEL)
	_layout.call_deferred()


## Whether the board is put away (Xem bàn).
func looking() -> bool:
	return _reopen.visible


## How it ended (the game's words) and the figures: the time played, then the game's rows.
func _show_detail(snapshot: XomDaoRoomSnapshot, detail: Dictionary) -> void:
	var reason: String = str(detail.get("reason", ""))
	_reason.text = reason
	_reason.visible = reason != ""
	for child: Node in _rows.get_children():
		_rows.remove_child(child)
		child.queue_free()
	var rows: Array = []
	if snapshot.played != null and snapshot.played.ms > 0.0:
		rows.append(["Thời gian", played_text(snapshot.played.ms)])
	var extra: Variant = detail.get("rows", [])
	if extra is Array:
		rows.append_array(extra)
	for row: Variant in rows:
		if row is not Array or (row as Array).size() < 2:
			continue
		var pair: Array = row
		var label := Label.new()
		label.text = str(pair[0])
		label.add_theme_color_override("font_color", XomDaoUi.HONEY_DARK)
		_rows.add_child(label)
		var value := Label.new()
		value.text = str(pair[1])
		value.add_theme_color_override("font_color", XomDaoUi.INK)
		value.add_theme_font_override("font", XomDaoUi.display_font(800))
		_rows.add_child(value)
	_rows.visible = _rows.get_child_count() > 0


## "12:05" for 12 minutes 5 seconds; "1:02:05" past an hour.
static func played_text(ms: float) -> String:
	var seconds: int = int(ms / 1000.0)
	if seconds >= 3600:
		return "%d:%02d:%02d" % [seconds / 3600, seconds / 60 % 60, seconds % 60]
	return "%d:%02d" % [seconds / 60, seconds % 60]


## The ledger paid: coins fly from your reward into the balance.
func receive(balance: int) -> void:
	var from: Vector2 = _board.global_position + _board.size / 2.0
	if _reward_at != null and is_instance_valid(_reward_at):
		from = _reward_at.global_position + _reward_at.size / 2.0
	money.receive(balance, from)


func _row(player: XomDaoPlayerInfo, rank: int, amount: int, me: String) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	var place := XomDaoChip.create(
		"Hoà" if rank == 0 else "Hạng %d" % rank,
		"crown" if rank == 1 else "",
		XomDaoUi.GOLD_DARK if rank == 1 else XomDaoUi.HUD
	)
	place.custom_minimum_size.x = 150.0
	place.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(place)
	var avatar := XomDaoAvatar.new()
	avatar.custom_minimum_size = Vector2(64.0, 64.0)
	avatar.initial = player.name
	avatar.frame = player.frame
	row.add_child(avatar)
	var label := Label.new()
	label.text = "Bạn" if player.id == me else player.name
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.custom_minimum_size.x = 200.0
	row.add_child(label)
	var delta := XomDaoDelta.create(amount)
	delta.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if player.id == me:
		delta.name = "Reward"
		_reward_at = delta
	elif player.bot:
		delta.visible = false
	row.add_child(delta)
	return row


func _name_of(snapshot: XomDaoRoomSnapshot, id: String) -> String:
	for player: XomDaoPlayerInfo in snapshot.seats + snapshot.players:
		if player.id == id:
			return player.name
	return "?"


func _layout() -> void:
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = _settings.margin
	var k: float = _settings.ui_scale
	money.reset_size()
	money.scale = Vector2.ONE * k
	money.position = Vector2(size.x - inset.x - edge - money.size.x * k, inset.y + edge)
	_board.reset_size()
	_board.position = (size - _board.size) / 2.0
	_reopen.reset_size()
	_reopen.position = Vector2((size.x - _reopen.size.x) / 2.0, inset.y + edge)
