class_name XomDaoRoomTimer
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var event: String = ""
var ms: float = 0.0
var left: float = 0.0


static func from_dict(d: Dictionary) -> XomDaoRoomTimer:
	var o := XomDaoRoomTimer.new()
	o.event = str(d.get("event", ""))
	o.ms = float(d.get("ms", 0.0))
	o.left = float(d.get("left", 0.0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["event"] = event
	d["ms"] = ms
	d["left"] = left
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
