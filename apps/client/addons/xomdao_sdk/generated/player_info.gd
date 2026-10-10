class_name XomDaoPlayerInfo
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var name: String = ""
var connected: bool = false
var bot: bool = false
var avatar: String = ""
var frame: String = ""
var card_back: String = ""
var left: bool = false


static func from_dict(d: Dictionary) -> XomDaoPlayerInfo:
	var o := XomDaoPlayerInfo.new()
	o.id = str(d.get("id", ""))
	o.name = str(d.get("name", ""))
	o.connected = bool(d.get("connected", false))
	o.bot = bool(d.get("bot", false))
	o.avatar = str(d.get("avatar", ""))
	o.frame = str(d.get("frame", ""))
	o.card_back = str(d.get("cardBack", ""))
	o.left = bool(d.get("left", false))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["name"] = name
	d["connected"] = connected
	if bot != false:
		d["bot"] = bot
	if avatar != "":
		d["avatar"] = avatar
	if frame != "":
		d["frame"] = frame
	if card_back != "":
		d["cardBack"] = card_back
	if left != false:
		d["left"] = left
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
