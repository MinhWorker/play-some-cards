class_name HubDinh
extends Control
## Đình (docs/experience.md): the village's rankings. One board with a tab per ranking (Cả xóm
## by experience, then each game by wins) over the top players, each a row with their place,
## avatar, name and value; your own row stays under the list when you are below the top.

signal back_pressed
## A tab was picked: the hub fetches that board (`ranking:get`).
signal board_changed(board: String)

const WIDTH := 640.0
const ROW_HEIGHT := 72.0

var top := HubTopBar.new()
var board: String = "core"

var _board: XomDaoBoard = XomDaoBoard.create("Xếp hạng")
var _tabs := HBoxContainer.new()
var _scroll := ScrollContainer.new()
var _rows := VBoxContainer.new()
var _empty := Label.new()
var _me := VBoxContainer.new()
## Tabs as [[board, label], …].
var _boards: Array = []


func _init(settings: XomDaoSettings = null) -> void:
	name = "Dinh"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	top = HubTopBar.new(settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	_board.name = "RankingBoard"
	add_child(_board)
	var column: VBoxContainer = _board.content
	column.add_theme_constant_override("separation", 12)
	# Many games' tabs scroll sideways.
	var strip := ScrollContainer.new()
	strip.custom_minimum_size = Vector2(WIDTH, 84.0)
	strip.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	strip.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	column.add_child(strip)
	_tabs.name = "Tabs"
	_tabs.add_theme_constant_override("separation", 10)
	strip.add_child(_tabs)
	_scroll.name = "Ranking"
	_scroll.custom_minimum_size = Vector2(WIDTH, ROW_HEIGHT * 5.0)
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(_scroll)
	_rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_rows.add_theme_constant_override("separation", 6)
	_scroll.add_child(_rows)
	_empty.name = "RankingEmpty"
	_empty.text = "Đang tải"
	_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty.custom_minimum_size = Vector2(WIDTH, ROW_HEIGHT)
	column.add_child(_empty)
	column.add_child(_me)
	resized.connect(_layout)


func _ready() -> void:
	_layout()


## The tabs: Cả xóm, then `games` ([[id, name], …]); the first is picked.
func set_boards(games: Array) -> void:
	_boards = [["core", "Cả xóm"]]
	_boards.append_array(games)
	select("core")


func select(id: String) -> void:
	board = id
	for child: Node in _tabs.get_children():
		_tabs.remove_child(child)
		child.queue_free()
	for pair: Array in _boards:
		var button: XomDaoButton = XomDaoButton.create(
			str(pair[1]), XomDaoUi.Kind.GO if pair[0] == id else XomDaoUi.Kind.BACK
		)
		button.name = "Tab_" + str(pair[0])
		button.custom_minimum_size = Vector2(150.0, 72.0)
		button.pressed.connect(_on_tab.bind(str(pair[0])))
		_tabs.add_child(button)
	board_changed.emit(id)
	_layout.call_deferred()


## Shows a board's top players and, when it is not among them, your row below.
func show_ranking(ranking: XomDaoRanking, me: String) -> void:
	if ranking.board != board:
		return
	for parent: Node in [_rows, _me]:
		for child: Node in parent.get_children():
			parent.remove_child(child)
			child.queue_free()
	var unit: String = "kinh nghiệm" if board == "core" else "thắng"
	for entry: XomDaoRankingEntry in ranking.entries:
		_rows.add_child(_row(entry, unit, entry.id == me))
	_scroll.visible = not ranking.entries.is_empty()
	_empty.visible = ranking.entries.is_empty()
	_empty.text = "Chưa có ai"
	var listed: bool = ranking.entries.any(func(e: XomDaoRankingEntry) -> bool: return e.id == me)
	if ranking.me != null and not listed:
		var row: Control = _row(ranking.me, unit, true)
		row.name = "RankMe"
		_me.add_child(row)
	_layout.call_deferred()


func _row(entry: XomDaoRankingEntry, unit: String, mine: bool) -> Control:
	var row := PanelContainer.new()
	row.name = "Rank_%d" % entry.rank if not mine else "RankMine"
	row.custom_minimum_size = Vector2(WIDTH - 20.0, ROW_HEIGHT)
	var box: StyleBoxFlat = XomDaoUi.box(
		XomDaoUi.SAND if mine else XomDaoUi.CREAM, XomDaoUi.PAPER_DARK, 2, 14.0
	)
	box.content_margin_left = 12.0
	box.content_margin_right = 12.0
	row.add_theme_stylebox_override("panel", box)
	var line := HBoxContainer.new()
	line.add_theme_constant_override("separation", 14)
	row.add_child(line)
	var place := XomDaoChip.create(
		str(entry.rank),
		"crown" if entry.rank == 1 else "",
		XomDaoUi.GOLD_DARK if entry.rank == 1 else XomDaoUi.HUD
	)
	place.compact()
	place.custom_minimum_size.x = 84.0
	place.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(place)
	var avatar := XomDaoAvatar.new()
	avatar.custom_minimum_size = Vector2(56.0, 56.0)
	avatar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	avatar.initial = entry.name
	avatar.frame = entry.frame
	line.add_child(avatar)
	var name_label := Label.new()
	name_label.name = "Name"
	name_label.text = entry.name
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	name_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	line.add_child(name_label)
	var value := XomDaoChip.create("%s %s" % [XomDaoUi.money(entry.value), unit])
	value.name = "Value"
	value.compact()
	value.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(value)
	return row


func _on_tab(id: String) -> void:
	if id != board:
		select(id)


func _layout() -> void:
	top._layout()
	var y: float = top.bottom() + 8.0
	_board.reset_size()
	var edge: float = XomDaoSettings.current().margin
	var k: float = minf(
		1.0, minf((size.x - 2.0 * edge) / _board.size.x, (size.y - y - edge) / _board.size.y)
	)
	_board.scale = Vector2.ONE * maxf(k, 0.1)
	_board.position = Vector2((size.x - _board.size.x * _board.scale.x) / 2.0, y)
