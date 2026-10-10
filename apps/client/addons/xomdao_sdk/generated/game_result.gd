class_name XomDaoGameResult
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var winners: Array[String] = []
var rewards: Array[XomDaoReward] = []


static func from_dict(d: Dictionary) -> XomDaoGameResult:
	var o := XomDaoGameResult.new()
	for item: Variant in _list(d, "winners"):
		o.winners.append(str(item))
	for item: Variant in _list(d, "rewards"):
		if item is Dictionary:
			o.rewards.append(XomDaoReward.from_dict(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["winners"] = winners
	d["rewards"] = _dicts(rewards)
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
