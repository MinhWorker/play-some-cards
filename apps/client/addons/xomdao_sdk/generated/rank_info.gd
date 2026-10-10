class_name XomDaoRankInfo
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var board: String = ""
var value: int = 0
var rank: int = 0


static func from_dict(d: Dictionary) -> XomDaoRankInfo:
	var o := XomDaoRankInfo.new()
	o.board = str(d.get("board", ""))
	o.value = int(d.get("value", 0))
	o.rank = int(d.get("rank", 0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["board"] = board
	d["value"] = value
	d["rank"] = rank
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
