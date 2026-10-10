class_name XomDaoAuthReply
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var token: String = ""
var user: XomDaoUser


static func from_dict(d: Dictionary) -> XomDaoAuthReply:
	var o := XomDaoAuthReply.new()
	o.token = str(d.get("token", ""))
	o.user = XomDaoUser.from_dict(_dict(d, "user"))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["token"] = token
	d["user"] = user.to_dict()
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
