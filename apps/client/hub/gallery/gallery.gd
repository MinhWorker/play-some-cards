extends Control
## Every shared UI component on a few pages, to look at and screenshot (npm run shots). Open
## with ?gallery=<page> on the web or `-- --gallery=<page>` on the command line; ← and → turn
## pages. `-- --gallery=<page> --save=<file.png>` saves the page as an image and quits.

const PAGES := 4
const SAMPLES := "res://hub/gallery/samples/"

var page: int = 1

var _core := Control.new()


func _ready() -> void:
	theme = XomDaoUi.theme()
	var sky := ColorRect.new()
	sky.color = XomDaoUi.SKY
	sky.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(sky)
	_core.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_core.custom_minimum_size = XomDaoFrame.CORE
	_core.offset_left = -XomDaoFrame.CORE.x / 2.0
	_core.offset_right = XomDaoFrame.CORE.x / 2.0
	_core.offset_top = -XomDaoFrame.CORE.y / 2.0
	_core.offset_bottom = XomDaoFrame.CORE.y / 2.0
	add_child(_core)
	show_page(page)
	print("xomdao:gallery %d" % page)
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--save="):
			_save(arg.trim_prefix("--save="))


func _save(path: String) -> void:
	for i: int in 30:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(path)
	get_tree().quit()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_right"):
		show_page(page % PAGES + 1)
	elif event.is_action_pressed("ui_left"):
		show_page((page + PAGES - 2) % PAGES + 1)


func show_page(number: int) -> void:
	page = clampi(number, 1, PAGES)
	for child: Node in _core.get_children():
		child.queue_free()
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side: String in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 24)
	_core.add_child(margin)
	match page:
		1:
			margin.add_child(_buttons_page())
		2:
			margin.add_child(_players_page())
		3:
			margin.add_child(_board_page())
		4:
			_menu_page()


func _buttons_page() -> Control:
	var column := _column(20)
	var plays := _row(24)
	plays.add_child(XomDaoButton.create("CHƠI", XomDaoUi.Kind.PLAY))
	var off: XomDaoButton = XomDaoButton.create("CHƠI", XomDaoUi.Kind.PLAY)
	off.disabled = true
	plays.add_child(off)
	column.add_child(plays)
	var kinds := HFlowContainer.new()
	kinds.add_theme_constant_override("h_separation", 16)
	kinds.add_theme_constant_override("v_separation", 16)
	var labels: Array = [
		["Đánh", XomDaoUi.Kind.GO],
		["Tạo phòng", XomDaoUi.Kind.SOCIAL],
		["Nhận thưởng", XomDaoUi.Kind.CONFIRM],
		["Bỏ lượt", XomDaoUi.Kind.BACK],
		["Luật", XomDaoUi.Kind.INFO],
		["Đầu hàng", XomDaoUi.Kind.DANGER],
	]
	for pair: Array in labels:
		kinds.add_child(XomDaoButton.create(pair[0], pair[1]))
	column.add_child(kinds)
	var icons := _row(20)
	for name_of_icon: String in ["list", "arrow-left", "gear", "speaker-high", "x"]:
		var button: XomDaoIconButton = XomDaoIconButton.create(name_of_icon)
		icons.add_child(button)
		button.dot = name_of_icon == "list"
	column.add_child(icons)
	var money := _row(24)
	money.add_child(XomDaoMoney.create(2450))
	money.add_child(XomDaoMoney.create(38, XomDaoResourceIcon.Currency.GEM))
	money.add_child(XomDaoDelta.create(120))
	money.add_child(XomDaoDelta.create(-20))
	column.add_child(money)
	var chips := _row(16)
	chips.add_child(XomDaoChip.create("12", "", XomDaoUi.LACQUER))
	chips.add_child(XomDaoChip.create("8 lá", "", XomDaoUi.BAMBOO_DARK))
	chips.add_child(XomDaoChip.create("10 phút", "clock"))
	chips.add_child(XomDaoToast.create("Đã sao chép mã phòng"))
	var dot := XomDaoDot.new()
	dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	chips.add_child(dot)
	column.add_child(chips)
	return column


func _players_page() -> Control:
	var row := _row(32)
	var slots := _column(28)
	var minh := XomDaoPlayerSlot.new()
	minh.player_name = "Minh"
	minh.level = 12
	minh.extra = "8 lá"
	minh.host = true
	minh.picture = load(SAMPLES + "avatar-boy.webp")
	minh.start_turn(600.0, 210.0)
	slots.add_child(minh)
	var lan := XomDaoPlayerSlot.new()
	lan.player_name = "Lan"
	lan.level = 7
	lan.extra = "13 lá"
	lan.compact = true
	lan.picture = load(SAMPLES + "avatar-cat.webp")
	slots.add_child(lan)
	var hoa := XomDaoPlayerSlot.new()
	hoa.player_name = "Hoa"
	hoa.level = 3
	hoa.show_turn()
	slots.add_child(hoa)
	row.add_child(slots)
	var chosen := XomDaoGameTile.new()
	chosen.title = "Tiến Lên"
	chosen.art = load(SAMPLES + "tien-len.webp")
	chosen.set_chips("4 người", "10 phút", 32)
	chosen.selected = true
	row.add_child(chosen)
	var other := XomDaoGameTile.new()
	other.title = "Cờ Tướng"
	other.set_chips(
		XomDaoGameTile.players_label(2, 2), XomDaoGameTile.duration_label({"min": 10, "max": 20}), 5
	)
	row.add_child(other)
	return row


func _board_page() -> Control:
	var center := CenterContainer.new()
	var board: XomDaoBoard = XomDaoBoard.create("Tạo phòng", true)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 24)
	grid.add_theme_constant_override("v_separation", 16)
	var rows: Array = [["Số người", ["2", "3", "4"], 2], ["Máy chơi cùng", ["Có", "Không"], 0]]
	for row: Array in rows:
		var label := Label.new()
		label.text = row[0]
		label.add_theme_font_override("font", XomDaoUi.body_font(true))
		grid.add_child(label)
		var options: Array[String] = []
		options.assign(row[1])
		grid.add_child(XomDaoChoice.create(options, row[2]))
	board.content.add_child(grid)
	board.content.add_child(XomDaoDivider.create())
	var buttons := _row(16)
	buttons.alignment = BoxContainer.ALIGNMENT_END
	buttons.add_child(XomDaoButton.create("Huỷ", XomDaoUi.Kind.BACK))
	buttons.add_child(XomDaoButton.create("Tạo phòng", XomDaoUi.Kind.SOCIAL))
	board.content.add_child(buttons)
	center.add_child(board)
	return center


func _menu_page() -> void:
	var table := ColorRect.new()
	table.color = XomDaoUi.SEA
	table.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_core.add_child(table)
	var menu := XomDaoMenu.new()
	_core.add_child(menu)
	menu.open.call_deferred()


func _row(gap: int) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", gap)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	return row


func _column(gap: int) -> VBoxContainer:
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", gap)
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	return column
