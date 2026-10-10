class_name XomDaoJoinedRoom
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var room_code: String = ""
var player_id: String = ""


static func from_dict(d: Dictionary) -> XomDaoJoinedRoom:
	var o := XomDaoJoinedRoom.new()
	o.room_code = str(d.get("roomCode", ""))
	o.player_id = str(d.get("playerId", ""))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["roomCode"] = room_code
	d["playerId"] = player_id
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
