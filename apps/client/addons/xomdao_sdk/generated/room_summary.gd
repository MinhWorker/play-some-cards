class_name XomDaoRoomSummary
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var code: String = ""
var host_name: String = ""
var players: int = 0
var max_players: int = 0
var spectators: int = 0
var status: String = ""
var can_join: bool = false


static func from_dict(d: Dictionary) -> XomDaoRoomSummary:
	var o := XomDaoRoomSummary.new()
	o.code = str(d.get("code", ""))
	o.host_name = str(d.get("hostName", ""))
	o.players = int(d.get("players", 0))
	o.max_players = int(d.get("maxPlayers", 0))
	o.spectators = int(d.get("spectators", 0))
	o.status = str(d.get("status", ""))
	o.can_join = bool(d.get("canJoin", false))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["code"] = code
	d["hostName"] = host_name
	d["players"] = players
	d["maxPlayers"] = max_players
	d["spectators"] = spectators
	d["status"] = status
	d["canJoin"] = can_join
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
