class_name HubShop
extends Control
## Chợ (docs/experience.md): the items for sale (not the free ones), by slot (Khung, Lưng bài),
## each with its price and Mua, or "Đã có". Paying and handing the item over are the server's
## (`shop:buy`): this screen only asks and shows.

signal back_pressed
signal buy_requested(item_id: String)

var top := HubTopBar.new()

var _items: Array[XomDaoShopItem] = []
var _coins: int = 0
var _board: XomDaoBoard = XomDaoBoard.create("Chợ")
var _shelf := HubShelf.new()


func _init(settings: XomDaoSettings = null) -> void:
	name = "Shop"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(HubSea.new())
	top = HubTopBar.new(settings)
	top.back_pressed.connect(back_pressed.emit)
	add_child(top)
	_board.name = "ShopBoard"
	add_child(_board)
	_board.content.add_child(_shelf)
	_shelf.tab_changed.connect(func(_tab: String) -> void: _show_shelf())
	_shelf.set_tabs([["frame", "Khung"], ["card-back", "Lưng bài"]])
	resized.connect(_layout)


func _ready() -> void:
	_layout()


## The items (`shop:list`) and the balance they are priced against.
func show_items(items: Array[XomDaoShopItem], coins: int) -> void:
	_items = items
	_coins = coins
	_show_shelf()
	_layout.call_deferred()


func _show_shelf() -> void:
	var tiles: Array[HubItemTile] = []
	for item: XomDaoShopItem in _items:
		# Free items belong to everyone: Chợ shows only what is for sale.
		if item.slot == _shelf.tab and item.price > 0:
			tiles.append(_tile(item))
	_shelf.show_tiles(tiles, "Chưa có hàng")


func _tile(item: XomDaoShopItem) -> HubItemTile:
	var tile := HubItemTile.create(item.id, item.slot, item.look, item.name)
	if item.owned:
		var chip := XomDaoChip.create("Đã có", "check-circle", XomDaoUi.BAMBOO_DARK)
		chip.name = "Owned_" + HubItemTile.key_of(item.id)
		chip.compact()
		tile.foot.add_child(chip)
		return tile
	var buy: XomDaoButton = XomDaoButton.create(
		"Mua %s" % XomDaoUi.money(item.price), XomDaoUi.Kind.CONFIRM
	)
	buy.name = "Buy_" + HubItemTile.key_of(item.id)
	buy.custom_minimum_size = Vector2(156.0, 64.0)
	if item.price > _coins:
		buy.modulate = Color(1, 1, 1, 0.6)
	buy.pressed.connect(func() -> void: buy_requested.emit(item.id))
	tile.foot.add_child(buy)
	return tile


func _layout() -> void:
	top._layout()
	var edge: float = XomDaoSettings.current().margin
	_board.reset_size()
	var k: float = minf(1.0, (size.x - edge * 2.0) / maxf(1.0, _board.size.x))
	_board.scale = Vector2.ONE * k
	_board.position = Vector2((size.x - _board.size.x * k) / 2.0, top.bottom() + 8.0)
