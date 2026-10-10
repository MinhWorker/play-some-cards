class_name XomDaoAchievementInfo
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var name: String = ""
var game_id: String = ""
var stat: String = ""
var at: int = 0
var progress: int = 0
var unlocked: bool = false
var reward: Dictionary = {}
var xp: int = 0


static func from_dict(d: Dictionary) -> XomDaoAchievementInfo:
	var o := XomDaoAchievementInfo.new()
	o.id = str(d.get("id", ""))
	o.name = str(d.get("name", ""))
	o.game_id = str(d.get("gameId", ""))
	o.stat = str(d.get("stat", ""))
	o.at = int(d.get("at", 0))
	o.progress = int(d.get("progress", 0))
	o.unlocked = bool(d.get("unlocked", false))
	o.reward = _dict(d, "reward")
	o.xp = int(d.get("xp", 0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["name"] = name
	d["gameId"] = game_id
	d["stat"] = stat
	d["at"] = at
	d["progress"] = progress
	d["unlocked"] = unlocked
	d["reward"] = reward
	d["xp"] = xp
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
