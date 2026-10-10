class_name HubAchievementTile
extends PanelContainer
## One achievement on Nhà's shelf (tab Thành tích): a trophy, gold once reached, its name, then
## "Đã đạt" or the count so far ("3/10") and its reward. Named `Achievement_<id>` with the id's
## ":" as "-" ("Achievement_core-played-1").

var achievement_id: String = ""

var _trophy := TextureRect.new()
var _name := Label.new()
var _foot := HBoxContainer.new()


static func create(info: XomDaoAchievementInfo, game_name: String = "") -> HubAchievementTile:
	var tile := HubAchievementTile.new()
	tile.achievement_id = info.id
	tile.name = "Achievement_" + info.id.replace(":", "-")
	tile._name.text = info.name if game_name == "" else "%s\n%s" % [info.name, game_name]
	tile._trophy.modulate = XomDaoUi.GOLD if info.unlocked else Color(XomDaoUi.INK, 0.25)
	if info.unlocked:
		var done := XomDaoChip.create("Đã đạt", "check-circle", XomDaoUi.BAMBOO_DARK)
		done.name = "Reached"
		done.compact()
		tile._foot.add_child(done)
	else:
		var count := XomDaoChip.create("%d/%d" % [mini(info.progress, info.at), info.at])
		count.compact()
		tile._foot.add_child(count)
	var coins: int = int(info.reward.get("core:coin", 0))
	if coins > 0:
		var reward := XomDaoChip.create("+" + XomDaoUi.money(coins), "", XomDaoUi.COIN_DARK)
		reward.compact()
		tile._foot.add_child(reward)
	return tile


func _init() -> void:
	custom_minimum_size = HubItemTile.SIZE
	var box: StyleBoxFlat = XomDaoUi.box(XomDaoUi.CREAM, XomDaoUi.PAPER_DARK, 2, 18.0)
	box.set_content_margin_all(12.0)
	add_theme_stylebox_override("panel", box)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	add_child(column)
	_trophy.texture = XomDaoUi.icon("trophy")
	_trophy.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_trophy.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_trophy.custom_minimum_size = Vector2(0.0, 72.0)
	column.add_child(_trophy)
	_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_name.custom_minimum_size = Vector2(HubItemTile.SIZE.x - 24.0, 80.0)
	_name.add_theme_font_size_override("font_size", XomDaoUi.TEXT_MIN)
	column.add_child(_name)
	_foot.alignment = BoxContainer.ALIGNMENT_CENTER
	_foot.add_theme_constant_override("separation", 6)
	column.add_child(_foot)
