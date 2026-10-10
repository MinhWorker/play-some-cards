class_name XomDaoEventClaim
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var progress: XomDaoEventProgress
var balances: Dictionary = {}


static func from_dict(d: Dictionary) -> XomDaoEventClaim:
	var o := XomDaoEventClaim.new()
	o.progress = XomDaoEventProgress.from_dict(_dict(d, "progress"))
	o.balances = _dict(d, "balances")
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["progress"] = progress.to_dict()
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
