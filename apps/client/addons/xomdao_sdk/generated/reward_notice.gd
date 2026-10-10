class_name XomDaoRewardNotice
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var user_id: String = ""
var game_id: String = ""
var rewards: Array[Dictionary] = []
var balances: Dictionary = {}


static func from_dict(d: Dictionary) -> XomDaoRewardNotice:
	var o := XomDaoRewardNotice.new()
	o.user_id = str(d.get("userId", ""))
	o.game_id = str(d.get("gameId", ""))
	for item: Variant in _list(d, "rewards"):
		if item is Dictionary:
			o.rewards.append(item)
	o.balances = _dict(d, "balances")
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["userId"] = user_id
	d["gameId"] = game_id
	d["rewards"] = rewards
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
