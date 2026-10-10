class_name XomDaoMatchPlayer
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var name: String = ""
var avatar: String = ""
var frame: String = ""
var bot: bool = false
var won: bool = false
var left: bool = false
var me: bool = false


static func from_dict(d: Dictionary) -> XomDaoMatchPlayer:
	var o := XomDaoMatchPlayer.new()
	o.name = str(d.get("name", ""))
	o.avatar = str(d.get("avatar", ""))
	o.frame = str(d.get("frame", ""))
	o.bot = bool(d.get("bot", false))
	o.won = bool(d.get("won", false))
	o.left = bool(d.get("left", false))
	o.me = bool(d.get("me", false))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["name"] = name
	if avatar != "":
		d["avatar"] = avatar
	if frame != "":
		d["frame"] = frame
	d["bot"] = bot
	d["won"] = won
	d["left"] = left
	d["me"] = me
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
