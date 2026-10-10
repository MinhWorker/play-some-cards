class_name XomDaoRoomClosed
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var game_id: String = ""
var reason: String = ""


static func from_dict(d: Dictionary) -> XomDaoRoomClosed:
	var o := XomDaoRoomClosed.new()
	o.game_id = str(d.get("gameId", ""))
	o.reason = str(d.get("reason", ""))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["gameId"] = game_id
	d["reason"] = reason
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
