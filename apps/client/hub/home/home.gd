class_name HubHome
extends Control
## Nhà (docs/experience.md): a player's profile card on the left (their avatar in the frame they
## wear, their level and its progress, games played and won, the back of their cards) and a shelf
## on the right with tabs Túi đồ, Thành tích and Xếp hạng. In your own Nhà each item in Túi đồ has
## Dùng; someone else's is read-only.

signal back_pressed
## Dùng on an item of Túi đồ (your own Nhà only).
signal equip_requested(item_id: String)
## Tài khoản under the profile card (your own Nhà only).
signal account_pressed

const CARD_WIDTH := 240.0

var top := HubTopBar.new()
var editable: bool = true

var _profile: XomDaoProfile
## Level, achievements and ranks (`stats:get`); null until they come.
var _stats: XomDaoPlayerStats
## Game names by id, for achievements and ranks.
var _games: Dictionary = {}
## Every item (`shop:list`), for names and pictures.
var _items: Array[XomDaoShopItem] = []
var _card: XomDaoBoard = XomDaoBoard.create("")
var _avatar := XomDaoAvatar.new()
var _back := TextureRect.new()
var _level: XomDaoChip = XomDaoChip.create("Cấp 1", "star", XomDaoUi.HONEY_DARK)
var _xp := ProgressBar.new()
var _played: XomDaoChip = XomDaoChip.create("0 ván")
var _won: XomDaoChip = XomDaoChip.create("0 thắng", "trophy")
var _board: XomDaoBoard = XomDaoBoard.create("")
var _shelf := HubShelf.new()
## Tài khoản, next to ← (your own Nhà only).
var _account: XomDaoIconButton = XomDaoIconButton.create("user-plus")


func _init(settings: XomDaoSettings = null, own: bool = true) -> void:
	name = "Home"
	editable = own
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	top = HubTopBar.new(settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	_card.name = "ProfileCard"
	add_child(_card)
	var column: VBoxContainer = _card.content
	column.custom_minimum_size.x = CARD_WIDTH
	column.add_theme_constant_override("separation", 12)
	_avatar.name = "HomeAvatar"
	_avatar.custom_minimum_size = Vector2(150.0, 150.0)
	_avatar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(_avatar)
	_level.name = "HomeLevel"
	_level.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(_level)
	_xp.name = "HomeXp"
	_xp.show_percentage = false
	_xp.custom_minimum_size = Vector2(CARD_WIDTH - 20.0, 16.0)
	_xp.add_theme_stylebox_override(
		"background", XomDaoUi.box(XomDaoUi.PAPER_DARK, Color.TRANSPARENT, 0, 8.0)
	)
	_xp.add_theme_stylebox_override("fill", XomDaoUi.box(XomDaoUi.GOLD, Color.TRANSPARENT, 0, 8.0))
	column.add_child(_xp)
	var totals := HBoxContainer.new()
	totals.alignment = BoxContainer.ALIGNMENT_CENTER
	totals.add_theme_constant_override("separation", 8)
	column.add_child(totals)
	for chip: XomDaoChip in [_played, _won]:
		chip.compact()
		totals.add_child(chip)
	_played.name = "HomePlayed"
	_won.name = "HomeWon"
	var backs := HBoxContainer.new()
	backs.alignment = BoxContainer.ALIGNMENT_CENTER
	backs.add_theme_constant_override("separation", 12)
	column.add_child(backs)
	_back.name = "HomeCardBack"
	_back.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_back.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_back.custom_minimum_size = Vector2(60.0, 90.0)
	backs.add_child(_back)
	var label := Label.new()
	label.text = "Lưng bài"
	backs.add_child(label)
	if own:
		_account.name = "AccountButton"
		_account.pressed.connect(account_pressed.emit)
		top.add_child(_account)
	_board.name = "ShelfBoard"
	add_child(_board)
	_board.content.add_child(_shelf)
	_shelf.tab_changed.connect(func(_tab: String) -> void: _show_shelf())
	_shelf.set_tabs([["tui-do", "Túi đồ"], ["thanh-tich", "Thành tích"], ["xep-hang", "Xếp hạng"]])
	resized.connect(_layout)


func _ready() -> void:
	_layout()


## Shows a player's Nhà (`inventory:get`), naming items from `items` (`shop:list`).
func show_profile(profile: XomDaoProfile, items: Array[XomDaoShopItem]) -> void:
	_profile = profile
	_items = items
	_card.title = profile.name
	_avatar.initial = profile.name
	_avatar.frame = profile.frame
	_back.texture = XomDaoLooks.card_back(profile.card_back)
	_show_shelf()
	_layout.call_deferred()


## Shows their level, totals, achievements and ranks (`stats:get`); `games` names games by id.
func show_stats(stats: XomDaoPlayerStats, games: Dictionary) -> void:
	_stats = stats
	_games = games
	_level.text = "Cấp %d" % stats.level
	_xp.max_value = maxi(1, stats.next_xp - stats.level_xp)
	_xp.value = stats.xp - stats.level_xp
	_played.text = "%s ván" % XomDaoUi.money(stats.played)
	_won.text = "%s thắng" % XomDaoUi.money(stats.won)
	_show_shelf()
	_layout.call_deferred()


func _show_shelf() -> void:
	if _shelf.tab == "thanh-tich":
		_show_achievements()
	elif _shelf.tab == "xep-hang":
		_show_ranks()
	elif _profile != null:
		var tiles: Array[HubItemTile] = []
		# What was bought first, then what everyone has.
		for bought: bool in [true, false]:
			for item: XomDaoShopItem in _items:
				if _profile.owned.has(item.id) and (item.price > 0) == bought:
					tiles.append(_tile(item))
		_shelf.show_tiles(tiles, "Túi đồ trống")


## Reached first, then the rest in their order (the hub's own, then each game's).
func _show_achievements() -> void:
	var tiles: Array[Control] = []
	if _stats != null:
		for reached: bool in [true, false]:
			for info: XomDaoAchievementInfo in _stats.achievements:
				if info.unlocked == reached:
					tiles.append(HubAchievementTile.create(info, str(_games.get(info.game_id, ""))))
	_shelf.show_nodes(tiles, "Đang tải")


func _show_ranks() -> void:
	var tiles: Array[Control] = []
	if _stats != null:
		for info: XomDaoRankInfo in _stats.ranks:
			var core: bool = info.board == "core"
			tiles.append(
				HubRankTile.create(
					info,
					"Cả xóm" if core else str(_games.get(info.board, info.board)),
					"kinh nghiệm" if core else "ván thắng"
				)
			)
	_shelf.show_nodes(tiles, "Chưa có hạng" if _stats != null else "Đang tải")


func _tile(item: XomDaoShopItem) -> HubItemTile:
	var tile := HubItemTile.create(item.id, item.slot, item.look, item.name)
	var worn: bool = (
		(item.slot == "frame" and item.look == _profile.frame)
		or (item.slot == "card-back" and item.look == _profile.card_back)
	)
	if editable:
		var button: XomDaoButton = XomDaoButton.create(
			"Đang dùng" if worn else "Dùng", XomDaoUi.Kind.CONFIRM if worn else XomDaoUi.Kind.GO
		)
		button.name = "Equip_" + HubItemTile.key_of(item.id)
		button.custom_minimum_size = Vector2(150.0, 64.0)
		button.disabled = worn
		button.pressed.connect(func() -> void: equip_requested.emit(item.id))
		tile.foot.add_child(button)
	elif worn:
		var chip := XomDaoChip.create("Đang dùng", "check-circle")
		chip.compact()
		tile.foot.add_child(chip)
	return tile


func _layout() -> void:
	top._layout()
	_account.scale = top.back.scale
	_account.position = (
		top.back.position + Vector2((XomDaoIconButton.SIZE + 12.0) * _account.scale.x, 0.0)
	)
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = XomDaoSettings.current().margin
	var y: float = top.bottom() + 8.0
	_card.reset_size()
	_board.reset_size()
	var width: float = _card.size.x + 16.0 + _board.size.x
	var left: float = maxf(inset.x + edge, (size.x - width) / 2.0)
	var k: float = minf(1.0, (size.x - left - edge) / width)
	for board: Control in [_card, _board]:
		board.scale = Vector2.ONE * k
	_card.position = Vector2(left, y)
	_board.position = Vector2(left + (_card.size.x + 16.0) * k, y)
