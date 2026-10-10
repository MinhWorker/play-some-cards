extends Control
## The garden arena (src/scenes/BomNguyenToView.ts): grass and dirt tiles in a wooden fence seen
## from slightly above, stones and gift crates standing on them, the ticking bombs, the blasts and
## the five friends walking the lanes. `show_view` takes each snapshot, `step` runs every frame:
## your own fighter walks ahead of the server (it follows where this screen shows you), the
## others glide to their snapshot positions.
##
## Named nodes for tests: Fighter_<seat>, Bomb_<id>.

signal cue(sound: String)

const Rules := preload("res://content/bom-nguyen-to/rules.gd")
const Atlas := preload("res://content/bom-nguyen-to/atlas.gd")
const ART := "res://content/bom-nguyen-to/art/"
## Vertical squash of the slightly tilted top-down camera.
const TILT := 0.86
## The board's reach around the inner cells' centres (1–11, 1–9), in cells.
const REACH := Rect2(0.18, -0.12, 11.64, 9.87)
const TEAM_INK: Array[Color] = [Color("#4c9be8"), Color("#f0708f")]
const ITEM_LABEL: Dictionary = {
	"heal": "+30 HP", "range": "Tầm nổ +1", "capacity": "Bom +1", "speed": "Tốc độ +"
}
const ONE_SHOTS: Array[String] = ["place", "skill", "hit", "ko", "spawn"]
const RING_WARNING := 5000.0

## One cell's width on screen; a cell is TILT as tall.
var tw: float = 48.0
var th: float = 48.0 * TILT
## Where cell (0, 0)'s centre is.
var origin := Vector2.ZERO
## Your fighter's id, "" when you watch.
var me: String = ""
var view: Dictionary = {}

var _ground := Control.new()
var _world := Node2D.new()
var _top := Node2D.new()
var _overlay := Control.new()
var _tiles: Array[Texture2D] = []
var _post: Texture2D
var _blocks: Dictionary = {}
var _block_art: Dictionary = {}
var _bombs: Dictionary = {}
var _pickups: Dictionary = {}
var _flames: Dictionary = {}
## id → {sprite, status, position, correction, element, facing, one_shot, moved, before…}.
var _actors: Dictionary = {}
var _floaters: Array[Dictionary] = []
var _warnings: Array[Dictionary] = []
var _cells: Array = []
var _items: Dictionary = {}
var _blast: int = 0
var _phase: String = ""
var _snapshot_at: float = 0.0
## While you steer, your own fighter keeps its prediction over the snapshots.
var _steered_at: float = -1000.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for layer: Control in [_ground, _overlay]:
		layer.set_anchors_preset(Control.PRESET_FULL_RECT)
		layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ground.draw.connect(_draw_ground)
	_overlay.draw.connect(_draw_overlay)
	add_child(_ground)
	_world.y_sort_enabled = true
	add_child(_world)
	add_child(_top)
	add_child(_overlay)
	_tiles = [load(ART + "tile-grass.webp"), load(ART + "tile-dirt.webp")]
	_post = load(ART + "fence-post.webp")
	_block_art = {"crate": load(ART + "block-crate.webp"), "wall": load(ART + "block-stone.webp")}


## Fits the board in `area` (as big as it goes) and redraws it there.
func fit(area: Rect2) -> void:
	tw = minf(area.size.x / REACH.size.x, area.size.y / (REACH.size.y * TILT))
	th = tw * TILT
	var size := Vector2(REACH.size.x * tw, REACH.size.y * th)
	var at: Vector2 = area.position + (area.size - size) / 2.0
	origin = at - Vector2(REACH.position.x * tw, REACH.position.y * th)
	_place_all()


## The board's rect on screen.
func board_rect() -> Rect2:
	return Rect2(project(REACH.position), Vector2(REACH.size.x * tw, REACH.size.y * th))


func project(cell: Vector2) -> Vector2:
	return origin + Vector2(cell.x * tw, cell.y * th)


## Where this screen shows a fighter (your own one walks ahead of the server).
func shown_at(id: String) -> Vector2:
	if _actors.has(id):
		return _actors[id]["position"]
	var one: Dictionary = Rules.fighter(view, id)
	return Vector2(float(one.get("x", 0)), float(one.get("y", 0)))


## The play clock now: the snapshot's time plus what passed since it came (at most one tick).
func now() -> float:
	if view.is_empty():
		return 0.0
	return float(view["time"]) + minf(100.0, Time.get_ticks_msec() - _snapshot_at)


## A new snapshot. `feedback` false (a resync, another viewer) shows it without effects.
func show_view(next: Dictionary, feedback: bool = true) -> void:
	var first: bool = view.is_empty()
	view = next
	_snapshot_at = Time.get_ticks_msec()
	var playing: bool = str(view["phase"]) == "playing"
	feedback = feedback and not first
	if feedback and playing:
		_crates_and_items()
	_cells = (view["cells"] as Array).duplicate()
	_items.clear()
	for item: Dictionary in view["pickups"]:
		_items[Vector2i(int(item["x"]), int(item["y"]))] = item
	_warnings = Rules.warnings(view)
	_show_blocks()
	_show_actors(feedback)
	_show_bombs()
	_show_pickups()
	_show_flames()
	var top: int = 0
	for blast: Dictionary in view["blasts"]:
		top = maxi(top, int(blast["id"]))
	if feedback and playing and top > _blast:
		cue.emit("explode")
	_blast = top
	var phase: String = str(view["phase"])
	if phase != _phase and feedback and phase == "playing":
		cue.emit("start")
		for id: String in _actors:
			_play(_actors[id], "spawn")
	if phase == "ended" and _phase != "ended" and not first:
		var won: bool = (view["winners"] as Array).has(me)
		if won:
			_effect("victory", shown_at(me), 2.4)
		cue.emit("win" if won else "lose")
	_phase = phase
	_ground.queue_redraw()


## One frame: `direction` is where you steer ("none" when you do not).
func step(delta: float, direction: String) -> void:
	if view.is_empty():
		return
	var time: float = now()
	var ms: float = Time.get_ticks_msec()
	if direction != "none":
		_steered_at = ms
	var playing: bool = str(view["phase"]) == "playing"
	for one: Dictionary in view["fighters"]:
		var id: String = str(one["id"])
		if not _actors.has(id) or int(one["hp"]) <= 0:
			continue
		var actor: Dictionary = _actors[id]
		var held: bool = float(one["frozenUntil"]) > time or float(one["stunUntil"]) > time
		var local: bool = id == me
		var dir: String = "none" if held else (direction if local else str(one["dir"]))
		var speed: float = float(one["speed"])
		speed *= 1.85 if float(one["dashUntil"]) > time else 1.0
		speed *= 0.5 if float(one["slowUntil"]) > time else 1.0
		var before: Vector2 = actor["position"]
		var at: Vector2 = before
		if playing and (local or ms - _snapshot_at < 100.0):
			var d: Vector2 = Vector2(Rules.DIRECTIONS[dir]) * speed * delta
			at = Rules.move(view, id, at, d)
		var pull: float = minf(1.0, delta * 8.0)
		var correction: Vector2 = actor["correction"]
		at += correction * pull
		actor["correction"] = correction * (1.0 - pull)
		actor["position"] = at
		if at.distance_to(before) > 0.002 and not held:
			actor["moved"] = ms
		_animate(actor, one, dir, local and direction != "none", time, ms)
		_place_actor(actor, one, time)
	_pulse_bombs(time, ms)
	_grow_flames(time, ms)
	var items: Array = _pickups.values()
	for i: int in items.size():
		var item: Sprite2D = items[i]
		var cell: Vector2 = item.get_meta("cell")
		item.position = project(cell) + Vector2(0, th * 0.22 + sin(ms / 260.0 + i) * tw * 0.05)
	var kept: Array[Dictionary] = []
	for floater: Dictionary in _floaters:
		if (ms - float(floater["start"])) / 900.0 < 1.0:
			kept.append(floater)
	_floaters = kept
	_ground.queue_redraw()
	_overlay.queue_redraw()


## Forgets what the screen remembered (a new viewer or a resync): no effects for this view.
func reset() -> void:
	for id: String in _actors:
		var actor: Dictionary = _actors[id]
		(actor["sprite"] as Node).queue_free()
		if actor["status"] != null:
			(actor["status"] as Node).queue_free()
	_actors.clear()
	for child: Node in _top.get_children():
		child.queue_free()
	_flames.clear()
	_floaters.clear()
	view = {}
	_phase = ""


func _crates_and_items() -> void:
	var cells: Array = view["cells"]
	for i: int in mini(cells.size(), _cells.size()):
		if _cells[i] == "crate" and cells[i] == "floor":
			_effect("crate-break", Vector2(i % Rules.WIDTH, i / Rules.WIDTH), 1.12)
	var now_items: Dictionary = {}
	for item: Dictionary in view["pickups"]:
		now_items[Vector2i(int(item["x"]), int(item["y"]))] = true
	for cell: Vector2i in _items:
		if now_items.has(cell):
			continue
		for one: Dictionary in view["fighters"]:
			var at := Vector2(float(one["x"]), float(one["y"]))
			if at.distance_to(Vector2(cell)) < 0.7:
				_effect("dust", Vector2(cell), 0.9)
				var kind: String = str(_items[cell]["kind"])
				_float(ITEM_LABEL.get(kind, ""), Vector2(cell), Color("#3f9b6e"))
				if str(one["id"]) == me:
					cue.emit("pickup")
				break


func _show_blocks() -> void:
	var ring: int = int(view.get("ring", 0))
	var seen: Dictionary = {}
	for y: int in range(1, Rules.HEIGHT - 1):
		for x: int in range(1, Rules.WIDTH - 1):
			var tile: String = Rules.tile_at(view, x, y)
			if tile == "floor":
				continue
			var cell := Vector2i(x, y)
			seen[cell] = true
			var block: Sprite2D = _blocks.get(cell)
			if block == null:
				block = Sprite2D.new()
				block.centered = false
				_world.add_child(block)
				_blocks[cell] = block
			block.texture = _block_art[tile]
			block.set_meta("cell", cell)
			var pillar: bool = x % 2 == 0 and y % 2 == 0
			var closing: bool = tile == "wall" and not pillar and ring > 0
			block.modulate = Color("#ffb4a6") if closing else Color.WHITE
			_place_block(block)
	for cell: Vector2i in _blocks.keys():
		if not seen.has(cell):
			(_blocks[cell] as Node).queue_free()
			_blocks.erase(cell)


func _place_block(block: Sprite2D) -> void:
	var size: Vector2 = block.texture.get_size()
	var k: float = tw * 1.02 / size.x
	block.scale = Vector2(k, k)
	block.offset = Vector2(-size.x / 2.0, -size.y)
	block.position = project(Vector2(block.get_meta("cell"))) + Vector2(0, th * 0.52)


func _show_actors(feedback: bool) -> void:
	var time: float = float(view["time"])
	var playing: bool = str(view["phase"]) == "playing"
	for one: Dictionary in view["fighters"]:
		var id: String = str(one["id"])
		var at := Vector2(float(one["x"]), float(one["y"]))
		var element: String = str(one["element"])
		if not _actors.has(id):
			var sprite := AnimatedSprite2D.new()
			sprite.name = "Fighter_%d" % int(one["seat"])
			sprite.centered = false
			sprite.offset = Vector2(-128, -244)
			_world.add_child(sprite)
			var actor: Dictionary = {
				"sprite": sprite,
				"status": null,
				"position": at,
				"correction": Vector2.ZERO,
				"element": "",
				"facing": str(one["facing"]),
				"one_shot": "",
				"moved": -1000.0,
				"dust": 0.0,
				"hp": int(one["hp"]),
				"skill": float(one["skillReady"]),
				"bomb": float(one["nextBomb"]),
				"dash": float(one["dashReady"]),
			}
			sprite.animation_finished.connect(_on_actor_done.bind(actor))
			_actors[id] = actor
		var actor: Dictionary = _actors[id]
		if actor["element"] != element:
			actor["element"] = element
			(actor["sprite"] as AnimatedSprite2D).sprite_frames = Atlas.actor(element)
			actor["one_shot"] = ""
			_play(actor, "frozen" if float(one["frozenUntil"]) > time else "idle", true)
		var shown: Vector2 = actor["position"]
		var error: Vector2 = at - shown
		if absf(error.x) + absf(error.y) > 1.25 or not playing:
			actor["position"] = at
			error = Vector2.ZERO
		# Your own fighter keeps its prediction while you steer: the server follows the position
		# this screen sends, so its older snapshots must not pull you back. A push is further.
		var steering: bool = Time.get_ticks_msec() - _steered_at < 500.0
		var own: bool = id == me and steering and absf(error.x) + absf(error.y) < 1.2
		actor["correction"] = Vector2.ZERO if own else error
		if feedback:
			_feedback(actor, one, time)
		actor["hp"] = int(one["hp"])
		actor["skill"] = float(one["skillReady"])
		actor["bomb"] = float(one["nextBomb"])
		actor["dash"] = float(one["dashReady"])
		var sprite: AnimatedSprite2D = actor["sprite"]
		sprite.visible = int(one["hp"]) > 0 or actor["one_shot"] == "ko"
		_place_actor(actor, one, time)


func _feedback(actor: Dictionary, one: Dictionary, time: float) -> void:
	var hp: int = int(one["hp"])
	var at: Vector2 = actor["position"]
	var facing: String = str(one["facing"])
	var mine: bool = str(one["id"]) == me
	if hp < int(actor["hp"]):
		_float("−%d" % (int(actor["hp"]) - hp), at, Color("#e2475e"))
		if mine:
			cue.emit("hurt")
		var clip: String = "hit"
		if hp == 0:
			clip = "ko"
		elif float(one["frozenUntil"]) > time:
			clip = "frozen"
		_play(actor, clip, false, facing)
	elif float(one["skillReady"]) > float(actor["skill"]):
		_play(actor, "skill", false, facing)
		_effect("skill-" + str(one["element"]), at, 1.6)
		if mine:
			cue.emit("skill")
	elif float(one["nextBomb"]) > float(actor["bomb"]):
		_play(actor, "place", false, facing)
		if mine:
			cue.emit("place")
	if float(one["dashReady"]) > float(actor["dash"]):
		_effect("dash", at, 1.2)
		if mine:
			cue.emit("dash")


func _on_actor_done(actor: Dictionary) -> void:
	if actor["one_shot"] == "ko":
		(actor["sprite"] as AnimatedSprite2D).visible = false
	actor["one_shot"] = ""


func _play(actor: Dictionary, clip: String, force: bool = false, facing: String = "") -> void:
	if facing == "":
		facing = actor["facing"]
	var sprite: AnimatedSprite2D = actor["sprite"]
	var anim: String = clip + "-" + facing
	if sprite.sprite_frames == null or not sprite.sprite_frames.has_animation(anim):
		return
	if not force and sprite.animation == anim and sprite.is_playing():
		return
	actor["facing"] = facing
	actor["one_shot"] = clip if ONE_SHOTS.has(clip) else ""
	sprite.speed_scale = 1.0
	sprite.play(anim)


func _animate(
	actor: Dictionary, one: Dictionary, dir: String, steering: bool, time: float, ms: float
) -> void:
	var sprite: AnimatedSprite2D = actor["sprite"]
	if float(one["frozenUntil"]) > time:
		_play(actor, "frozen", false, str(one["facing"]))
		return
	if actor["one_shot"] != "":
		return
	var held: bool = float(one["stunUntil"]) > time
	var moving: bool = (
		str(view["phase"]) == "playing"
		and not held
		and (dir != "none" or ms - float(actor["moved"]) < 130.0)
	)
	var facing: String = dir if steering else str(one["facing"])
	_play(actor, "walk" if moving else "idle", false, facing)
	var dashing: bool = float(one["dashUntil"]) > time
	if moving:
		sprite.speed_scale = (
			float(one["speed"])
			/ 3.2
			* (1.65 if dashing else 1.0)
			* (0.65 if float(one["slowUntil"]) > time else 1.0)
		)
		if dashing and ms - float(actor["dust"]) > 160.0:
			_effect("dust", actor["position"], 0.65)
			actor["dust"] = ms
	else:
		sprite.speed_scale = 1.0


func _place_actor(actor: Dictionary, one: Dictionary, time: float) -> void:
	var sprite: AnimatedSprite2D = actor["sprite"]
	var at: Vector2 = project(actor["position"])
	var feet: Vector2 = at + Vector2(0, th * 0.25)
	var k: float = tw * 1.79 / 256.0
	sprite.scale = Vector2(k, k)
	sprite.position = feet
	var blink: bool = (
		float(one["invulnerableUntil"]) > time and Time.get_ticks_msec() / 100 % 2 == 1
	)
	sprite.modulate.a = 0.6 if blink else 1.0
	var status: String = ""
	if int(one["hp"]) > 0:
		if float(one["frozenUntil"]) > time:
			status = "freeze"
		elif float(one["stunUntil"]) > time:
			status = "stun"
	var shown: AnimatedSprite2D = actor["status"]
	if status == "":
		if shown != null:
			shown.queue_free()
			actor["status"] = null
		return
	if shown == null:
		shown = AnimatedSprite2D.new()
		shown.sprite_frames = Atlas.effects()
		shown.centered = false
		shown.offset = Vector2(-80, -96)
		_top.add_child(shown)
		actor["status"] = shown
	if shown.animation != status:
		shown.play(status)
	shown.scale = Vector2.ONE * tw * 1.2 / 160.0
	shown.position = feet - Vector2(0, tw * 0.45)


func _show_bombs() -> void:
	var seen: Dictionary = {}
	for bomb: Dictionary in view["bombs"]:
		var id: int = int(bomb["id"])
		seen[id] = true
		var sprite: AnimatedSprite2D = _bombs.get(id)
		if sprite == null:
			sprite = AnimatedSprite2D.new()
			sprite.name = "Bomb_%d" % id
			sprite.sprite_frames = Atlas.arena()
			sprite.centered = false
			sprite.offset = Vector2(-96, -180)
			sprite.play("bomb")
			_world.add_child(sprite)
			_bombs[id] = sprite
		sprite.set_meta("bomb", bomb)
		sprite.position = (
			project(Vector2(float(bomb["x"]), float(bomb["y"]))) + Vector2(0, th * 0.3)
		)
	for id: int in _bombs.keys():
		if not seen.has(id):
			(_bombs[id] as Node).queue_free()
			_bombs.erase(id)


func _pulse_bombs(time: float, ms: float) -> void:
	for id: int in _bombs:
		var sprite: AnimatedSprite2D = _bombs[id]
		var bomb: Dictionary = sprite.get_meta("bomb")
		var frozen: bool = float(bomb.get("frozenUntil", 0)) > time
		var left: float = float(bomb["explodeAt"]) - time
		var soon: bool = left < 700.0
		sprite.speed_scale = 0.2 if frozen else (2.4 if soon else 1.0)
		var pulse: float = 1.0
		if not frozen:
			pulse += maxf(0.0, sin(ms / (45.0 if soon else 110.0))) * (0.1 if soon else 0.04)
		sprite.scale = Vector2.ONE * tw * pulse / 192.0
		if frozen:
			sprite.modulate = Color("#bfefff")
		elif soon and int(ms / 90.0) % 2 == 1:
			sprite.modulate = Color("#ffb0a0")
		else:
			sprite.modulate = Color.WHITE


func _show_pickups() -> void:
	var seen: Dictionary = {}
	for item: Dictionary in view["pickups"]:
		var cell := Vector2i(int(item["x"]), int(item["y"]))
		var key: String = "%d,%d,%s" % [cell.x, cell.y, item["kind"]]
		seen[key] = true
		var sprite: Sprite2D = _pickups.get(key)
		if sprite == null:
			sprite = Sprite2D.new()
			sprite.texture = Atlas.still("item-%s-00" % item["kind"])
			sprite.centered = false
			sprite.offset = Vector2(-96, -176)
			sprite.set_meta("cell", Vector2(cell))
			_world.add_child(sprite)
			_pickups[key] = sprite
		sprite.scale = Vector2.ONE * tw * 0.78 / 192.0
		sprite.position = project(Vector2(cell)) + Vector2(0, th * 0.22)
	for key: String in _pickups.keys():
		if not seen.has(key):
			(_pickups[key] as Node).queue_free()
			_pickups.erase(key)


func _show_flames() -> void:
	var seen: Dictionary = {}
	for blast: Dictionary in view["blasts"]:
		for cell: Dictionary in blast["cells"]:
			var at := Vector2(float(cell["x"]), float(cell["y"]))
			var key: String = "%d:%d,%d" % [int(blast["id"]), at.x, at.y]
			seen[key] = true
			var flame: AnimatedSprite2D = _flames.get(key)
			if flame == null:
				flame = AnimatedSprite2D.new()
				flame.sprite_frames = Atlas.arena()
				flame.play("blast-" + str(blast["element"]))
				flame.set_meta("born", Time.get_ticks_msec())
				_top.add_child(flame)
				_flames[key] = flame
			flame.set_meta("cell", at)
			flame.set_meta("expires", float(blast["expires"]))
			flame.position = project(at)
	for key: String in _flames.keys():
		if not seen.has(key):
			(_flames[key] as Node).queue_free()
			_flames.erase(key)


func _grow_flames(time: float, ms: float) -> void:
	for key: String in _flames:
		var flame: AnimatedSprite2D = _flames[key]
		var grow: float = minf(1.0, (ms - float(flame.get_meta("born"))) / 140.0)
		flame.scale = Vector2.ONE * tw * 1.2 / 192.0 * (0.45 + 0.55 * grow)
		flame.modulate.a = clampf((float(flame.get_meta("expires")) - time) / 300.0, 0.0, 1.0)


func _effect(clip: String, at: Vector2, size: float) -> void:
	if _top.get_child_count() > 60:
		return
	var sprite := AnimatedSprite2D.new()
	sprite.sprite_frames = Atlas.effects()
	sprite.centered = false
	sprite.offset = Vector2(-80, -88)
	sprite.scale = Vector2.ONE * tw * size / 160.0
	sprite.position = project(at)
	sprite.animation_finished.connect(sprite.queue_free)
	_top.add_child(sprite)
	sprite.play(clip)


func _float(text: String, at: Vector2, ink: Color) -> void:
	if _floaters.size() < 18:
		_floaters.append({"text": text, "at": at, "ink": ink, "start": Time.get_ticks_msec()})


func _place_all() -> void:
	for cell: Vector2i in _blocks:
		_place_block(_blocks[cell])
	if not view.is_empty():
		_show_actors(false)
		_show_bombs()
		_show_pickups()
		_show_flames()
	for child: Node in _top.get_children():
		if child is AnimatedSprite2D and not _flames.values().has(child):
			child.queue_free()
	_ground.queue_redraw()


func _draw_ground() -> void:
	var a: Vector2 = project(Vector2(0.5, 0.5))
	var b: Vector2 = project(Vector2(11.5, 9.5))
	var pad: float = tw * 0.1
	var lawn := Rect2(a, b - a)
	_round(
		_ground,
		lawn.grow(pad).grow_individual(0, -pad, 0, pad + th * 0.12),
		Color(0.25, 0.42, 0.16, 0.28),
		pad * 2.0
	)
	_round(_ground, lawn.grow(pad * 0.6), Color("#7d6338"), pad * 1.5)
	_ground.draw_rect(lawn, Color("#5f8f35"))
	var cell := Vector2(tw * 1.01, th * 1.01)
	for y: int in range(1, Rules.HEIGHT - 1):
		for x: int in range(1, Rules.WIDTH - 1):
			var at: Vector2 = project(Vector2(x, y))
			_ground.draw_texture_rect(_tiles[(x + y) % 2], Rect2(at - cell / 2.0, cell), false)
	# Each block casts a soft shadow down and to the right (light from the upper left).
	for key: Vector2i in _blocks:
		var at: Vector2 = project(Vector2(key))
		_round(
			_ground,
			Rect2(at + Vector2(-tw * 0.42, th * 0.4), Vector2(tw * 0.96, th * 0.3)),
			Color(0.14, 0.22, 0.11, 0.3),
			minf(10.0, tw * 0.14)
		)
	_draw_fence(a, b)
	if view.is_empty():
		return
	var time: float = now()
	_draw_warnings(time)
	for one: Dictionary in view["fighters"]:
		var id: String = str(one["id"])
		if int(one["hp"]) <= 0 or not _actors.has(id):
			continue
		var feet: Vector2 = project(_actors[id]["position"]) + Vector2(0, th * 0.23)
		_ellipse(_ground, feet, Vector2(tw * 0.31, th * 0.15), Color(0.18, 0.35, 0.13, 0.3), true)
		if str(view.get("mode", "solo")) == "teams":
			var ink: Color = TEAM_INK[int(one["team"]) % 2]
			_ellipse(_ground, feet, Vector2(tw * 0.37, th * 0.19), ink, false)
	for bomb: Dictionary in view["bombs"]:
		var element: String = str(bomb["element"])
		var at: Vector2 = project(Vector2(float(bomb["x"]), float(bomb["y"])))
		var ink: Color = Rules.CHARACTERS[element]["color"]
		ink.a = 0.55
		_ellipse(_ground, at + Vector2(0, th * 0.26), Vector2(tw * 0.36, th * 0.2), ink, true)
	for cell_at: Vector2i in _items:
		var at: Vector2 = project(Vector2(cell_at)) + Vector2(0, th * 0.24)
		_ellipse(_ground, at, Vector2(tw * 0.31, th * 0.17), Color(1, 0.96, 0.78, 0.7), true)


func _draw_warnings(time: float) -> void:
	if str(view["phase"]) != "playing":
		return
	var ms: float = Time.get_ticks_msec()
	var size := Vector2(tw * 0.9, th * 0.9)
	var r: float = minf(10.0, tw * 0.14)
	var closing: float = Rules.closing_in(view, time, RING_WARNING)
	var next: Dictionary = Rules.next_ring(view)
	if closing >= 0.0 and not next.is_empty():
		var ring: int = int(next["ring"])
		var pulse: float = 0.45 + absf(sin(ms / (90.0 if closing < 2000.0 else 180.0))) * 0.3
		for y: int in range(1, Rules.HEIGHT - 1):
			for x: int in range(1, Rules.WIDTH - 1):
				var cell := Vector2i(x, y)
				if not Rules.in_ring(cell, ring) or Rules.in_ring(cell, ring - 1):
					continue
				if Rules.tile_at(view, x, y) == "wall":
					continue
				var box := Rect2(project(Vector2(cell)) - size / 2.0, size)
				_round(_ground, box, Color(0.78, 0.12, 0.17, pulse), r)
				_round(_ground, box, Color(1, 1, 1, 0.9), r, 3.0)
	for warning: Dictionary in _warnings:
		var box := Rect2(project(Vector2(warning["cell"])) - size / 2.0, size)
		var soon: bool = float(warning["start"]) - time < 700.0
		var ink: Color = Rules.CHARACTERS[warning["element"]]["color"]
		if warning["frozen"]:
			ink = Color("#72c6dd")
		elif soon:
			ink = Color("#ff5a3c")
		var fill: Color = ink
		fill.a = 0.4 + sin(ms / 70.0) * 0.12 if soon else 0.24
		_round(_ground, box, fill, r)
		var line: Color = Color("#fff0d8") if soon else ink
		line.a = 0.95 if soon else 0.7
		_round(_ground, box, line, r, 2.0)
	for blast: Dictionary in view["blasts"]:
		var element: String = str(blast["element"])
		var ink: Color = (
			Color("#ff8a3d") if element == "fire" else Rules.CHARACTERS[element]["color"]
		)
		ink.a = 0.5 * clampf((float(blast["expires"]) - time) / 300.0, 0.0, 1.0)
		for cell: Dictionary in blast["cells"]:
			var at: Vector2 = project(Vector2(float(cell["x"]), float(cell["y"])))
			_round(_ground, Rect2(at - size / 2.0, size), ink, r)


func _draw_fence(a: Vector2, b: Vector2) -> void:
	var t: float = th * 0.1
	_rail_v(a.x, a.y - th * 0.42, b.y - th * 0.22, t)
	_rail_v(b.x, a.y - th * 0.42, b.y - th * 0.22, t)
	_rail_h(a.x, b.x, a.y - th * 0.44, t)
	_rail_h(a.x, b.x, a.y - th * 0.2, t)
	var front: float = project(Vector2(0, 9.62)).y
	_rail_h(a.x, b.x, front - th * 0.3, t * 0.9)
	_rail_h(a.x, b.x, front - th * 0.11, t * 0.9)
	for i: int in 12:
		var x: float = 0.5 + i
		var corner: bool = i == 0 or i == 11
		_draw_post(project(Vector2(x, 0.5)), th * (0.78 if corner else 0.66))
		_draw_post(
			project(Vector2(x, 9.62)) + Vector2(0, th * 0.04), th * (0.62 if corner else 0.5)
		)
	for i: int in 8:
		for x: float in [0.5, 11.5]:
			_draw_post(project(Vector2(x, 1.5 + i)), th * 0.62)


func _draw_post(foot: Vector2, height: float) -> void:
	var size: Vector2 = _post.get_size() * height / _post.get_size().y
	_ground.draw_texture_rect(
		_post, Rect2(foot - Vector2(size.x / 2.0, size.y * 0.97), size), false
	)


func _rail_h(x0: float, x1: float, y: float, t: float) -> void:
	_round(
		_ground,
		Rect2(x0 - 1.5, y - t / 2.0 - 1.5, x1 - x0 + 3.0, t + 3.0),
		Color("#8a5a43"),
		t / 2.0
	)
	_round(_ground, Rect2(x0, y - t / 2.0, x1 - x0, t), Color("#d99a5b"), t / 2.0)
	_ground.draw_rect(
		Rect2(x0 + t, y - t / 2.0 + 1.0, x1 - x0 - 2.0 * t, maxf(1.5, t / 3.0)), Color("#f2c588")
	)


func _rail_v(x: float, y0: float, y1: float, t: float) -> void:
	_round(
		_ground,
		Rect2(x - t * 0.6 - 1.5, y0 - 1.5, t * 1.2 + 3.0, y1 - y0 + 3.0),
		Color("#8a5a43"),
		t * 0.6
	)
	_round(_ground, Rect2(x - t * 0.6, y0, t * 1.2, y1 - y0), Color("#d99a5b"), t * 0.6)
	_ground.draw_rect(Rect2(x - t * 0.15, y0 + t, t * 0.3, y1 - y0 - 2.0 * t), Color("#f2c588"))


## Names over other people's fighters, the numbers that float up and the heart over yours.
func _draw_overlay() -> void:
	if view.is_empty():
		return
	var font: Font = XomDaoUi.display_font(800)
	var ms: float = Time.get_ticks_msec()
	var name_size: int = maxi(14, int(tw * 0.24))
	for one: Dictionary in view["fighters"]:
		var id: String = str(one["id"])
		if int(one["hp"]) <= 0 or not _actors.has(id):
			continue
		var feet: Vector2 = project(_actors[id]["position"]) + Vector2(0, th * 0.25)
		if id == me and str(view["phase"]) != "ended":
			_heart(feet - Vector2(0, tw * 1.5 - sin(ms / 180.0) * tw * 0.05), tw * 0.25)
		elif not bool(one["bot"]) and id != me:
			_text(
				font, str(one["name"]).left(12), feet - Vector2(0, tw * 1.5), name_size, Color.WHITE
			)
	for floater: Dictionary in _floaters:
		var t: float = (ms - float(floater["start"])) / 900.0
		var ink: Color = floater["ink"]
		ink.a = clampf((1.0 - t) * 2.0, 0.0, 1.0)
		var at: Vector2 = project(floater["at"]) - Vector2(0, tw * 0.9 + t * 34.0)
		_text(font, floater["text"], at, maxi(18, int(tw * 0.34)), ink)


func _text(font: Font, text: String, at: Vector2, font_size: int, ink: Color) -> void:
	var w: float = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
	var spot: Vector2 = at - Vector2(w / 2.0, -font_size * 0.35)
	var outline := Color("#5b3a2e", ink.a)
	_overlay.draw_string_outline(
		font, spot, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 6, outline
	)
	_overlay.draw_string(font, spot, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, ink)


## The red heart pointing down at your own fighter.
func _heart(tip: Vector2, r: float) -> void:
	var white: Array[Vector2] = [
		tip + Vector2(-r * 1.1, -r * 1.6), tip + Vector2(r * 1.1, -r * 1.6), tip
	]
	_overlay.draw_colored_polygon(PackedVector2Array(white), Color.WHITE)
	_overlay.draw_circle(tip + Vector2(-r * 0.55, -r * 1.5), r * 0.62, Color.WHITE)
	_overlay.draw_circle(tip + Vector2(r * 0.55, -r * 1.5), r * 0.62, Color.WHITE)
	var red: Array[Vector2] = [
		tip + Vector2(-r * 0.8, -r * 1.5),
		tip + Vector2(r * 0.8, -r * 1.5),
		tip + Vector2(0, -r * 0.25)
	]
	_overlay.draw_colored_polygon(PackedVector2Array(red), Color("#f04359"))
	_overlay.draw_circle(tip + Vector2(-r * 0.4, -r * 1.42), r * 0.42, Color("#f04359"))
	_overlay.draw_circle(tip + Vector2(r * 0.4, -r * 1.42), r * 0.42, Color("#f04359"))


static func _round(
	on: CanvasItem, box: Rect2, ink: Color, radius: float, line: float = 0.0
) -> void:
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(int(radius))
	if line > 0.0:
		style.draw_center = false
		style.border_color = ink
		style.set_border_width_all(int(line))
	else:
		style.bg_color = ink
	on.draw_style_box(style, box)


static func _ellipse(on: CanvasItem, at: Vector2, radii: Vector2, ink: Color, fill: bool) -> void:
	var points := PackedVector2Array()
	for i: int in 25:
		var angle: float = TAU * i / 24.0
		points.append(at + Vector2(cos(angle) * radii.x, sin(angle) * radii.y))
	if fill:
		on.draw_colored_polygon(points, ink)
	else:
		on.draw_polyline(points, ink, maxf(2.0, radii.x * 0.1), true)
