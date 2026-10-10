extends Control
## __NAME__
##
## The event on the Godot client, in the **Hành động** layout (docs/experience.md): a tree in
## the middle with its lucky buds, the goal at the top left under the hub's ☰, the points and
## picks left at the top right and Hái lộc at the bottom right. It draws `snapshot.view` (State
## in src/game/<Name>Game.ts) and sends `pick`. The hub adds this scene when the event's game
## starts, calls `bind` and draws the ☰ menu and the result (the event's points).
##
## Named nodes for tests: Goal, Points, PicksLeft, Pick, Bud_<i> (one per bud picked).

const PICKS := 5
## The hub's ☰ button keeps the top left square: the goal goes under it.
const MENU := 88.0
const BUD := Color("#E5484D")

var _client: XomDaoClient
var _picked: Array = []
var _scene := Control.new()
var _goal: XomDaoChip = XomDaoChip.create("Hái %d lộc" % PICKS, "gift")
var _counter := VBoxContainer.new()
var _points := Label.new()
var _left := Label.new()
var _buds := HBoxContainer.new()
var _pick: XomDaoButton = XomDaoButton.create("Hái lộc", XomDaoUi.Kind.PLAY)


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
	_goal.name = "Goal"
	add_child(_goal)
	add_child(_counter)
	_points.name = "Points"
	_points.theme_type_variation = "HudLabel"
	_points.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_points.add_theme_font_size_override("font_size", XomDaoUi.TITLE)
	_counter.add_child(_points)
	_left.name = "PicksLeft"
	_left.theme_type_variation = "HudLabel"
	_left.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_counter.add_child(_left)
	_buds.name = "Buds"
	_buds.add_theme_constant_override("separation", 16)
	add_child(_buds)
	_pick.name = "Pick"
	_pick.custom_minimum_size.x = 260.0
	_pick.disabled = true
	_pick.pressed.connect(_on_pick)
	add_child(_pick)
	resized.connect(_layout)


func _show(snapshot: XomDaoRoomSnapshot) -> void:
	if snapshot.view is not Dictionary:
		return
	var picked: Array = (snapshot.view as Dictionary).get("picked", [])
	var points: int = 0
	for value: Variant in picked:
		points += int(value)
	_points.text = "%d điểm" % points
	_left.text = "Còn %d lượt" % (PICKS - picked.size())
	_pick.disabled = snapshot.status != "playing" or picked.size() >= PICKS
	if picked.size() < _picked.size():
		for child: Node in _buds.get_children():
			_buds.remove_child(child)
			child.queue_free()
	for i: int in range(_buds.get_child_count(), picked.size()):
		var bud: Control = _bud(i, int(picked[i]))
		_buds.add_child(bud)
		if is_inside_tree():
			bud.pivot_offset = bud.custom_minimum_size / 2.0
			bud.scale = Vector2(0.4, 0.4)
			bud.create_tween().tween_property(bud, "scale", Vector2.ONE, 0.25).set_trans(
				Tween.TRANS_BACK
			)
	_picked = picked
	_layout.call_deferred()


## One picked bud: a red disc with its points.
func _bud(index: int, points: int) -> Control:
	var bud := PanelContainer.new()
	bud.name = "Bud_%d" % index
	bud.custom_minimum_size = Vector2(88.0, 88.0)
	var box: StyleBoxFlat = XomDaoUi.box(BUD, XomDaoUi.GOLD_DARK, XomDaoUi.BORDER, 44.0)
	bud.add_theme_stylebox_override("panel", box)
	var label := Label.new()
	label.text = "+%d" % points
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_override("font", XomDaoUi.display_font(800))
	label.add_theme_font_size_override("font_size", 36)
	bud.add_child(label)
	return bud


func _on_pick() -> void:
	if _client == null:
		return
	_pick.disabled = true
	XomDaoUi.bounce(_pick)
	await _client.send("pick")


func _layout() -> void:
	if not is_inside_tree():
		return
	var inset: Vector2 = XomDaoFrame.safe_inset(self)
	var edge: float = float(XomDaoSettings.current().margin)
	var left: float = inset.x + edge
	var right: float = size.x - inset.x - edge
	_goal.reset_size()
	_goal.position = Vector2(left, edge + MENU + 12.0)
	_counter.reset_size()
	_counter.position = Vector2(right - _counter.size.x, edge)
	_pick.reset_size()
	_pick.position = Vector2(right - _pick.size.x, size.y - edge - _pick.size.y)
	_buds.reset_size()
	_buds.position = Vector2((size.x - _buds.size.x) / 2.0, size.y * 0.46)


## The scene: a spring sky, the ground and a tree with its branches.
func _draw_scene() -> void:
	var area: Vector2 = _scene.size
	_scene.draw_rect(Rect2(Vector2.ZERO, area), XomDaoUi.SKY)
	_scene.draw_rect(Rect2(0.0, area.y * 0.78, area.x, area.y * 0.22), XomDaoUi.BAMBOO)
	var trunk := Vector2(area.x / 2.0, area.y * 0.8)
	_scene.draw_line(trunk, trunk - Vector2(0.0, area.y * 0.5), XomDaoUi.HONEY_DARK, 28.0)
	for i: int in 5:
		var from: Vector2 = trunk - Vector2(0.0, area.y * (0.25 + i * 0.05))
		var to: Vector2 = from + Vector2((i - 2) * 90.0, -area.y * 0.12)
		_scene.draw_line(from, to, XomDaoUi.HONEY_DARK, 12.0)
		_scene.draw_circle(to, 60.0, Color("#F7C6CF"))
