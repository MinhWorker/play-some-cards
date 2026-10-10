class_name XomDaoPlayerStats
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var user_id: String = ""
var level: int = 0
var xp: int = 0
var level_xp: int = 0
var next_xp: int = 0
var played: int = 0
var won: int = 0
var achievements: Array[XomDaoAchievementInfo] = []
var ranks: Array[XomDaoRankInfo] = []


static func from_dict(d: Dictionary) -> XomDaoPlayerStats:
	var o := XomDaoPlayerStats.new()
	o.user_id = str(d.get("userId", ""))
	o.level = int(d.get("level", 0))
	o.xp = int(d.get("xp", 0))
	o.level_xp = int(d.get("levelXp", 0))
	o.next_xp = int(d.get("nextXp", 0))
	o.played = int(d.get("played", 0))
	o.won = int(d.get("won", 0))
	for item: Variant in _list(d, "achievements"):
		if item is Dictionary:
			o.achievements.append(XomDaoAchievementInfo.from_dict(item))
	for item: Variant in _list(d, "ranks"):
		if item is Dictionary:
			o.ranks.append(XomDaoRankInfo.from_dict(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["userId"] = user_id
	d["level"] = level
	d["xp"] = xp
	d["levelXp"] = level_xp
	d["nextXp"] = next_xp
	d["played"] = played
	d["won"] = won
	d["achievements"] = _dicts(achievements)
	d["ranks"] = _dicts(ranks)
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
