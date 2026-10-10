class_name HubShelf
extends VBoxContainer
## Tabs over a row of item tiles that scrolls sideways (Nhà's shelf, Chợ's counters). A tab shows
## its tiles, or a line of text when it has none.

signal tab_changed(tab: String)

const ROW_WIDTH := 580.0

var tab: String = ""

var _tabs := HBoxContainer.new()
var _scroll := ScrollContainer.new()
var _row := HBoxContainer.new()
var _empty := Label.new()
var _labels: Dictionary = {}


func _init() -> void:
	add_theme_constant_override("separation", 14)
	_tabs.name = "Tabs"
	_tabs.add_theme_constant_override("separation", 10)
	add_child(_tabs)
	_scroll.name = "Shelf"
	_scroll.custom_minimum_size = Vector2(ROW_WIDTH, HubItemTile.SIZE.y + 12.0)
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	add_child(_scroll)
	_row.add_theme_constant_override("separation", 14)
	_scroll.add_child(_row)
	_empty.name = "ShelfEmpty"
	_empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_empty.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_empty.custom_minimum_size = _scroll.custom_minimum_size
	_empty.visible = false
	add_child(_empty)


## The tabs, as [[id, label], …]; the first is shown.
func set_tabs(tabs: Array) -> void:
	_labels.clear()
	for pair: Array in tabs:
		_labels[str(pair[0])] = str(pair[1])
	select(str(tabs[0][0]) if not tabs.is_empty() else "")


func select(id: String) -> void:
	tab = id
	for child: Node in _tabs.get_children():
		_tabs.remove_child(child)
		child.queue_free()
	for key: String in _labels:
		var button: XomDaoButton = XomDaoButton.create(
			_labels[key], XomDaoUi.Kind.GO if key == id else XomDaoUi.Kind.BACK
		)
		button.name = "Tab_" + key
		button.custom_minimum_size = Vector2(150.0, 72.0)
		button.pressed.connect(_on_tab.bind(key))
		_tabs.add_child(button)
	tab_changed.emit(id)


## Shows these tiles, or `empty` when there are none.
func show_tiles(tiles: Array[HubItemTile], empty: String = "") -> void:
	for child: Node in _row.get_children():
		_row.remove_child(child)
		child.queue_free()
	for tile: HubItemTile in tiles:
		_row.add_child(tile)
	_scroll.visible = not tiles.is_empty()
	_empty.visible = tiles.is_empty()
	_empty.text = empty


func _on_tab(id: String) -> void:
	if id != tab:
		select(id)
