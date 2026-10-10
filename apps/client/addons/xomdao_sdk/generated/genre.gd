class_name XomDaoGenre
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var name: String = ""
var order: int = 0
var island: String = ""
var main: bool = false


static func from_dict(d: Dictionary) -> XomDaoGenre:
	var o := XomDaoGenre.new()
	o.id = str(d.get("id", ""))
	o.name = str(d.get("name", ""))
	o.order = int(d.get("order", 0))
	o.island = str(d.get("island", ""))
	o.main = bool(d.get("main", false))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["name"] = name
	d["order"] = order
	d["island"] = island
	d["main"] = main
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
