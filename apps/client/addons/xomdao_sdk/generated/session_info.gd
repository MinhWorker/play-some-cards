class_name XomDaoSessionInfo
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var user: XomDaoUser
var room: XomDaoJoinedRoom
var balances: Dictionary = {}


static func from_dict(d: Dictionary) -> XomDaoSessionInfo:
	var o := XomDaoSessionInfo.new()
	o.user = XomDaoUser.from_dict(_dict(d, "user"))
	if d.get("room") is Dictionary:
		o.room = XomDaoJoinedRoom.from_dict(d["room"])
	o.balances = _dict(d, "balances")
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["user"] = user.to_dict()
	d["room"] = room.to_dict() if room != null else null
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
