class_name XomDaoPlayed
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var ms: float = 0.0
var running: bool = false


static func from_dict(d: Dictionary) -> XomDaoPlayed:
	var o := XomDaoPlayed.new()
	o.ms = float(d.get("ms", 0.0))
	o.running = bool(d.get("running", false))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["ms"] = ms
	d["running"] = running
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
