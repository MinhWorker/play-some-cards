class_name XomDaoMatchRecord
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var game_id: String = ""
var outcome: String = ""
var started_at: float = 0.0
var ended_at: float = 0.0
var players: Array[XomDaoMatchPlayer] = []


static func from_dict(d: Dictionary) -> XomDaoMatchRecord:
	var o := XomDaoMatchRecord.new()
	o.id = str(d.get("id", ""))
	o.game_id = str(d.get("gameId", ""))
	o.outcome = str(d.get("outcome", ""))
	o.started_at = float(d.get("startedAt", 0.0))
	o.ended_at = float(d.get("endedAt", 0.0))
	for item: Variant in _list(d, "players"):
		if item is Dictionary:
			o.players.append(XomDaoMatchPlayer.from_dict(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["gameId"] = game_id
	d["outcome"] = outcome
	d["startedAt"] = started_at
	d["endedAt"] = ended_at
	d["players"] = _dicts(players)
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
