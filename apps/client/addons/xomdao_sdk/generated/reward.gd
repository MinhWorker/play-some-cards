class_name XomDaoReward
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var player: String = ""
var resource: String = ""
var amount: int = 0


static func from_dict(d: Dictionary) -> XomDaoReward:
	var o := XomDaoReward.new()
	o.player = str(d.get("player", ""))
	o.resource = str(d.get("resource", ""))
	o.amount = int(d.get("amount", 0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["player"] = player
	d["resource"] = resource
	d["amount"] = amount
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
