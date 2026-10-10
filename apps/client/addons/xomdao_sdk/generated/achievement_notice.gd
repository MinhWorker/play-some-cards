class_name XomDaoAchievementNotice
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var achievements: Array[XomDaoAchievementInfo] = []
var balances: Dictionary = {}


static func from_dict(d: Dictionary) -> XomDaoAchievementNotice:
	var o := XomDaoAchievementNotice.new()
	for item: Variant in _list(d, "achievements"):
		if item is Dictionary:
			o.achievements.append(XomDaoAchievementInfo.from_dict(item))
	o.balances = _dict(d, "balances")
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["achievements"] = _dicts(achievements)
	d["balances"] = balances
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
