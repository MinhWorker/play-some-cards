class_name XomDaoEventInfo
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var opens_at: String = ""
var closes_at: String = ""
var tiers: Array[Dictionary] = []
var color: String = ""


static func from_dict(d: Dictionary) -> XomDaoEventInfo:
	var o := XomDaoEventInfo.new()
	o.opens_at = str(d.get("opensAt", ""))
	o.closes_at = str(d.get("closesAt", ""))
	for item: Variant in _list(d, "tiers"):
		if item is Dictionary:
			o.tiers.append(item)
	o.color = str(d.get("color", ""))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["opensAt"] = opens_at
	d["closesAt"] = closes_at
	d["tiers"] = tiers
	if color != "":
		d["color"] = color
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
