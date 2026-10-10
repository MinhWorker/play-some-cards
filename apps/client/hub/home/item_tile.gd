class_name HubItemTile
extends PanelContainer
## One item on Nhà's shelf or at Chợ: its picture (a frame, a card back), its name, and a row
## below for the screen's own chip or button. Named `Item_<slot>-<look>` ("Item_frame-jade").

const SIZE := Vector2(180.0, 236.0)

var item_id: String = ""
## Where the screen puts its chip or button.
var foot := HBoxContainer.new()

var _name := Label.new()


## A tile for an item ({id, slot, look, name}, as `XomDaoShopItem` or a dictionary).
static func create(id: String, slot: String, look: String, title: String) -> HubItemTile:
	var tile := HubItemTile.new()
	tile.item_id = id
	tile.name = "Item_" + key_of(id)
	tile._name.text = title
	var picture := TextureRect.new()
	picture.texture = XomDaoLooks.preview(slot, look)
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.custom_minimum_size = Vector2(0.0, 104.0)
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tile.get_child(0).add_child(picture)
	tile.get_child(0).move_child(picture, 0)
	return tile


## A node-name-safe key of an item id: "core:frame-jade" → "frame-jade".
static func key_of(id: String) -> String:
	return id.get_slice(":", id.get_slice_count(":") - 1)


func _init() -> void:
	custom_minimum_size = SIZE
	var box: StyleBoxFlat = XomDaoUi.box(XomDaoUi.CREAM, XomDaoUi.PAPER_DARK, 2, 18.0)
	box.set_content_margin_all(12.0)
	add_theme_stylebox_override("panel", box)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	add_child(column)
	_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_name.custom_minimum_size = Vector2(SIZE.x - 24.0, 60.0)
	_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_name.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	column.add_child(_name)
	foot.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_child(foot)
