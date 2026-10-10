class_name XomDaoRoomScore
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var wins: Array[int] = []
var draws: int = 0


static func from_dict(d: Dictionary) -> XomDaoRoomScore:
	var o := XomDaoRoomScore.new()
	for item: Variant in _list(d, "wins"):
		o.wins.append(int(item))
	o.draws = int(d.get("draws", 0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["wins"] = wins
	d["draws"] = draws
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
