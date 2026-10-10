class_name XomDaoProfile
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var name: String = ""
var avatar: String = ""
var frame: String = ""
var card_back: String = ""
var owned: Array[String] = []


static func from_dict(d: Dictionary) -> XomDaoProfile:
	var o := XomDaoProfile.new()
	o.id = str(d.get("id", ""))
	o.name = str(d.get("name", ""))
	o.avatar = str(d.get("avatar", ""))
	o.frame = str(d.get("frame", ""))
	o.card_back = str(d.get("cardBack", ""))
	for item: Variant in _list(d, "owned"):
		o.owned.append(str(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["name"] = name
	d["avatar"] = avatar
	d["frame"] = frame
	d["cardBack"] = card_back
	d["owned"] = owned
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
