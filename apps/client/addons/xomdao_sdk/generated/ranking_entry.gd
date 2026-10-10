class_name XomDaoRankingEntry
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var rank: int = 0
var id: String = ""
var name: String = ""
var avatar: String = ""
var frame: String = ""
var value: int = 0


static func from_dict(d: Dictionary) -> XomDaoRankingEntry:
	var o := XomDaoRankingEntry.new()
	o.rank = int(d.get("rank", 0))
	o.id = str(d.get("id", ""))
	o.name = str(d.get("name", ""))
	o.avatar = str(d.get("avatar", ""))
	o.frame = str(d.get("frame", ""))
	o.value = int(d.get("value", 0))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["rank"] = rank
	d["id"] = id
	d["name"] = name
	d["avatar"] = avatar
	d["frame"] = frame
	d["value"] = value
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
