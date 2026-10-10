class_name XomDaoUser
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var username: String = ""
var name: String = ""
var avatar: String = ""
var frame: String = ""


static func from_dict(d: Dictionary) -> XomDaoUser:
	var o := XomDaoUser.new()
	o.id = str(d.get("id", ""))
	o.username = str(d.get("username", ""))
	o.name = str(d.get("name", ""))
	o.avatar = str(d.get("avatar", ""))
	o.frame = str(d.get("frame", ""))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["username"] = username
	d["name"] = name
	d["avatar"] = avatar
	d["frame"] = frame
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
