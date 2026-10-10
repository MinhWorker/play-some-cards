class_name XomDaoShopList
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var items: Array[XomDaoShopItem] = []


static func from_dict(d: Dictionary) -> XomDaoShopList:
	var o := XomDaoShopList.new()
	for item: Variant in _list(d, "items"):
		if item is Dictionary:
			o.items.append(XomDaoShopItem.from_dict(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["items"] = _dicts(items)
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
