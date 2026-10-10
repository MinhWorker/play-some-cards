class_name XomDaoEventProgress
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var event_id: String = ""
var points: int = 0
var claimed: Array[int] = []


static func from_dict(d: Dictionary) -> XomDaoEventProgress:
	var o := XomDaoEventProgress.new()
	o.event_id = str(d.get("eventId", ""))
	o.points = int(d.get("points", 0))
	for item: Variant in _list(d, "claimed"):
		o.claimed.append(int(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["eventId"] = event_id
	d["points"] = points
	d["claimed"] = claimed
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
