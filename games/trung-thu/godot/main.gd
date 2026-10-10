extends Control
## Câu cá Trung Thu on the Godot client: a pond under the full moon with lanterns, the catches so
## far, the points and Thả câu (`cast`). The state (`snapshot.view`) is src/game/model.ts.
##
## Nodes tests use: Cast (the button), Points, CastsLeft, Catch_<i> (one row per catch).

const CASTS := 5
## Each catch's name and points (CATCHES in src/game/model.ts).
const CATCHES: Dictionary = {
	"golden-carp": ["Cá chép vàng", 5],
	"carp": ["Cá chép", 3],
	"perch": ["Cá rô", 2],
	"fry": ["Cá con", 1],
	"sandal": ["Dép rách", 0],
}
const NIGHT := Color("#1B2A4A")
const POND := Color("#24507A")
const MOON := Color("#FFE9A8")
const FISH_COLORS: Dictionary = {
	"golden-carp": Color("#F2B530"),
	"carp": Color("#E2603A"),
	"perch": Color("#7FA36B"),
	"fry": Color("#9FC7D9"),
	"sandal": Color("#8A6E58"),
}

var _client: XomDaoClient
var _scene := Control.new()
var _points := Label.new()
var _left := Label.new()
var _list := VBoxContainer.new()
var _cast: XomDaoButton = XomDaoButton.create("Thả câu", XomDaoUi.Kind.PLAY)
var _shown: int = 0


func bind(client: XomDaoClient) -> void:
	_client = client
	client.state_changed.connect(_show)
	if client.snapshot != null:
		_show(client.snapshot)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = XomDaoUi.theme()
	_scene.set_anchors_preset(Control.PRESET_FULL_RECT)
	_scene.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scene.draw.connect(_draw_scene)
	_scene.resized.connect(_scene.queue_redraw)
	add_child(_scene)
	var row := HBoxContainer.new()
	row.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	row.grow_horizontal = Control.GROW_DIRECTION_BOTH
	row.grow_vertical = Control.GROW_DIRECTION_BOTH
	row.add_theme_constant_override("separation", 48)
	add_child(row)
	var side := VBoxContainer.new()
	side.add_theme_constant_override("separation", 16)
	side.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(side)
	_points.name = "Points"
	_points.theme_type_variation = "HudLabel"
	_points.add_theme_font_size_override("font_size", XomDaoUi.TITLE)
	_points.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	side.add_child(_points)
	_left.name = "CastsLeft"
	_left.theme_type_variation = "HudLabel"
	_left.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	side.add_child(_left)
	_cast.name = "Cast"
	_cast.custom_minimum_size.x = 260.0
	_cast.pressed.connect(_on_cast)
	side.add_child(_cast)
	var board := PanelContainer.new()
	var paper: StyleBoxFlat = XomDaoUi.with_shadow(
		XomDaoUi.box(XomDaoUi.PAPER, XomDaoUi.GOLD_DARK, XomDaoUi.BORDER, 20.0)
	)
	paper.set_content_margin_all(20.0)
	board.add_theme_stylebox_override("panel", paper)
	board.custom_minimum_size = Vector2(340.0, 360.0)
	row.add_child(board)
	_list.add_theme_constant_override("separation", 8)
	board.add_child(_list)


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	if snapshot.view is not Dictionary:
		return
	var caught: Array = (snapshot.view as Dictionary).get("caught", [])
	var points: int = 0
	for id: Variant in caught:
		points += int(CATCHES.get(str(id), ["", 0])[1])
	_points.text = "%d điểm" % points
	_left.text = "Còn %d lượt" % (CASTS - caught.size())
	_cast.disabled = snapshot.status != "playing" or caught.size() >= CASTS
	if caught.size() < _shown:
		for child: Node in _list.get_children():
			_list.remove_child(child)
			child.queue_free()
		_shown = 0
	for i: int in range(_shown, caught.size()):
		var item: Control = _row(i, str(caught[i]))
		_list.add_child(item)
		if is_inside_tree():
			item.pivot_offset = Vector2(150.0, 28.0)
			item.scale = Vector2(0.6, 0.6)
			item.create_tween().tween_property(item, "scale", Vector2.ONE, 0.2).set_trans(
				Tween.TRANS_BACK
			)
	_shown = caught.size()


func _row(index: int, id: String) -> Control:
	var entry: Array = CATCHES.get(id, ["", 0])
	var line := HBoxContainer.new()
	line.name = "Catch_%d" % index
	line.add_theme_constant_override("separation", 12)
	var fish := ColorRect.new()
	fish.color = FISH_COLORS.get(id, XomDaoUi.INK)
	fish.custom_minimum_size = Vector2(40.0, 24.0)
	fish.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	line.add_child(fish)
	var name_label := Label.new()
	name_label.text = str(entry[0])
	name_label.add_theme_color_override("font_color", XomDaoUi.INK)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	line.add_child(name_label)
	var worth := Label.new()
	worth.text = "+%d" % int(entry[1])
	worth.add_theme_color_override(
		"font_color", XomDaoUi.UP_ON_PAPER if int(entry[1]) > 0 else XomDaoUi.INK
	)
	line.add_child(worth)
	return line


func _on_cast() -> void:
	if _client == null:
		return
	_cast.disabled = true
	XomDaoUi.bounce(_cast)
	await _client.send("cast")


## The night: sky, moon, a string of lanterns and the pond.
func _draw_scene() -> void:
	var area: Vector2 = _scene.size
	_scene.draw_rect(Rect2(Vector2.ZERO, area), NIGHT)
	var moon := Vector2(area.x * 0.82, area.y * 0.2)
	_scene.draw_circle(moon, 70.0, MOON.darkened(0.1))
	_scene.draw_circle(moon, 62.0, MOON)
	var pond := Rect2(0.0, area.y * 0.62, area.x, area.y * 0.38)
	_scene.draw_rect(pond, POND)
	_scene.draw_circle(Vector2(moon.x, pond.position.y + 40.0), 30.0, Color(MOON, 0.25))
	var count: int = 7
	for i: int in count:
		var x: float = area.x * (i + 0.5) / count
		var y: float = 40.0 + 18.0 * sin(i * 1.3)
		_scene.draw_line(Vector2(x, 0.0), Vector2(x, y), XomDaoUi.GOLD_DARK, 2.0)
		_scene.draw_circle(Vector2(x, y + 16.0), 16.0, XomDaoUi.LANTERN)
		_scene.draw_rect(Rect2(x - 6.0, y + 30.0, 12.0, 6.0), XomDaoUi.GOLD)
