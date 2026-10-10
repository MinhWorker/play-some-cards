class_name XomDaoLobbyRooms
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var game_id: String = ""
var rooms: Array[XomDaoRoomSummary] = []


static func from_dict(d: Dictionary) -> XomDaoLobbyRooms:
	var o := XomDaoLobbyRooms.new()
	o.game_id = str(d.get("gameId", ""))
	for item: Variant in _list(d, "rooms"):
		if item is Dictionary:
			o.rooms.append(XomDaoRoomSummary.from_dict(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["gameId"] = game_id
	d["rooms"] = _dicts(rooms)
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
