class_name HubRankTile
extends PanelContainer
## Where a player stands on one board, on Nhà's shelf (tab Xếp hạng): the board ("Cả xóm" or a
## game), "Hạng N" big, and the value it ranks by. Named `Rank_<board>` ("Rank_core").

var _board := Label.new()
var _rank := Label.new()
var _value := Label.new()


## `board_name` names the board; `unit` the value ("kinh nghiệm", "ván thắng").
static func create(info: XomDaoRankInfo, board_name: String, unit: String) -> HubRankTile:
	var tile := HubRankTile.new()
	tile.name = "Rank_" + info.board
	tile._board.text = board_name
	tile._rank.text = "Hạng %d" % info.rank
	tile._value.text = "%s %s" % [XomDaoUi.money(info.value), unit]
	return tile


func _init() -> void:
	custom_minimum_size = HubItemTile.SIZE
	var box: StyleBoxFlat = XomDaoUi.box(XomDaoUi.CREAM, XomDaoUi.PAPER_DARK, 2, 18.0)
	box.set_content_margin_all(12.0)
	add_theme_stylebox_override("panel", box)
	var column := VBoxContainer.new()
	column.alignment = BoxContainer.ALIGNMENT_CENTER
	column.add_theme_constant_override("separation", 10)
	add_child(column)
	for label: Label in [_board, _rank, _value]:
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		label.custom_minimum_size.x = HubItemTile.SIZE.x - 24.0
		label.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
		column.add_child(label)
	_rank.name = "RankValue"
	_rank.add_theme_font_override("font", XomDaoUi.display_font(800))
	_rank.add_theme_font_size_override("font_size", 40)
	_rank.add_theme_color_override("font_color", XomDaoUi.HONEY_DARK)
