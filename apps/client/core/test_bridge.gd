extends Node
## window.xomdao, for headless browser tests (scripts/e2e, npm run shots). Debug web builds only;
## a release build has none of it.
##
##   xomdao.scene()         the current screen: "home", "room", the game's id…
##   xomdao.tree(depth)     visible nodes as { name, type, text?, children? }
##   xomdao.text(name)      the text of the first visible node with that name, or null
##   xomdao.rect(name)      its box in CSS pixels of the page { x, y, width, height }, or null
##   xomdao.click(name)     presses that button (BaseButton.pressed); false when there is none
##   xomdao.state()         { scene, user, room: the latest room snapshot, downloaded }
##
## Each call runs synchronously in Godot (single-threaded build) and returns plain JSON data.

const SHIM := """
window.xomdao = {
	_call(name, args) {
		this._out = undefined;
		this._run(name, JSON.stringify(args));
		return this._out === undefined ? null : JSON.parse(this._out);
	},
	scene() { return this._call('scene', []); },
	tree(depth) { return this._call('tree', [depth ?? 99]); },
	text(name) { return this._call('text', [name]); },
	click(name) { return this._call('click', [name]); },
	state() { return this._call('state', []); },
	rect(name) {
		const r = this._call('rect', [name]);
		if (!r) return null;
		const canvas = document.querySelector('canvas');
		const box = canvas.getBoundingClientRect();
		const k = box.width / canvas.width;
		return { x: box.x + r[0] * k, y: box.y + r[1] * k, width: r[2] * k, height: r[3] * k };
	},
};
"""

## Set by the hub: the name of what is on screen.
var scene: String = "boot"

var _api: JavaScriptObject
var _callback: JavaScriptObject


func _ready() -> void:
	if not OS.has_feature("web") or not OS.is_debug_build():
		return
	JavaScriptBridge.eval(SHIM, true)
	_api = JavaScriptBridge.get_interface("xomdao")
	_callback = JavaScriptBridge.create_callback(_on_call)
	_api["_run"] = _callback


func _on_call(args: Array) -> void:
	var call: String = str(args[0])
	var params: Array = JSON.parse_string(str(args[1]))
	_api["_out"] = JSON.stringify(_answer(call, params))


func _answer(call: String, params: Array) -> Variant:
	var arg: String = str(params[0]) if not params.is_empty() else ""
	var answers: Dictionary = {
		"scene": func() -> Variant: return scene,
		"tree": func() -> Variant: return _tree(get_tree().root, int(arg)),
		"text": func() -> Variant: return _text(find(arg)),
		"rect": func() -> Variant: return _rect(find(arg) as Control),
		"click": func() -> Variant: return _click(find(arg) as BaseButton),
		"state": func() -> Variant: return _state(),
	}
	var answer: Callable = answers.get(call, func() -> Variant: return null)
	return answer.call()


func _text(node: Node) -> Variant:
	return node.get("text") if node != null and "text" in node else null


## The control's box in window pixels: [x, y, width, height].
func _rect(control: Control) -> Variant:
	if control == null:
		return null
	var local := Rect2(Vector2.ZERO, control.size)
	var box: Rect2 = (
		control.get_viewport().get_final_transform()
		* (control.get_global_transform_with_canvas() * local)
	)
	return [box.position.x, box.position.y, box.size.x, box.size.y]


func _click(button: BaseButton) -> bool:
	if button == null or button.disabled:
		return false
	button.pressed.emit()
	return true


func _state() -> Dictionary:
	var client: XomDaoClient = Net.client
	return {
		"scene": scene,
		"user": client.user.to_dict() if client.user != null else null,
		"playerId": client.player_id,
		"room": client.snapshot.to_dict() if client.snapshot != null else null,
		"downloaded": ContentLoader.downloaded,
	}


## The first visible node with this name, searching the whole tree.
func find(node_name: String) -> Node:
	return _find(get_tree().root, node_name)


func _find(node: Node, node_name: String) -> Node:
	if node is CanvasItem and not (node as CanvasItem).is_visible_in_tree():
		return null
	if node.name == node_name:
		return node
	for child: Node in node.get_children():
		var found: Node = _find(child, node_name)
		if found != null:
			return found
	return null


func _tree(node: Node, depth: int) -> Dictionary:
	var out: Dictionary = {"name": str(node.name), "type": node.get_class()}
	if "text" in node and str(node.get("text")) != "":
		out["text"] = node.get("text")
	var children: Array = []
	if depth > 0:
		for child: Node in node.get_children():
			if child is CanvasItem and not (child as CanvasItem).is_visible_in_tree():
				continue
			if child is HTTPRequest or child is XomDaoClient:
				continue
			children.append(_tree(child, depth - 1))
	if not children.is_empty():
		out["children"] = children
	return out
