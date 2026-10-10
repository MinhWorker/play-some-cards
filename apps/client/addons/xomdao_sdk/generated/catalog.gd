class_name XomDaoCatalog
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var genres: Array[XomDaoGenre] = []
var games: Array[XomDaoGameCard] = []


static func from_dict(d: Dictionary) -> XomDaoCatalog:
	var o := XomDaoCatalog.new()
	for item: Variant in _list(d, "genres"):
		if item is Dictionary:
			o.genres.append(XomDaoGenre.from_dict(item))
	for item: Variant in _list(d, "games"):
		if item is Dictionary:
			o.games.append(XomDaoGameCard.from_dict(item))
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["genres"] = _dicts(genres)
	d["games"] = _dicts(games)
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
