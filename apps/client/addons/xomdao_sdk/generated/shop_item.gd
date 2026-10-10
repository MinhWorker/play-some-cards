class_name XomDaoShopItem
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var id: String = ""
var slot: String = ""
var look: String = ""
var name: String = ""
var price: int = 0
var owned: bool = false


static func from_dict(d: Dictionary) -> XomDaoShopItem:
	var o := XomDaoShopItem.new()
	o.id = str(d.get("id", ""))
	o.slot = str(d.get("slot", ""))
	o.look = str(d.get("look", ""))
	o.name = str(d.get("name", ""))
	o.price = int(d.get("price", 0))
	o.owned = bool(d.get("owned", false))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["id"] = id
	d["slot"] = slot
	d["look"] = look
	d["name"] = name
	d["price"] = price
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
