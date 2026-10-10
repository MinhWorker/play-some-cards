class_name XomDaoLastMove
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var seq: int = 0
var player: String = ""
var move: Variant = null


static func from_dict(d: Dictionary) -> XomDaoLastMove:
	var o := XomDaoLastMove.new()
	o.seq = int(d.get("seq", 0))
	o.player = str(d.get("player", ""))
	o.move = d.get("move")
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["seq"] = seq
	d["player"] = player
	d["move"] = move
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
