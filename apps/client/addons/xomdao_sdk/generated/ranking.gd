class_name XomDaoRanking
extends RefCounted
## Generated from packages/shared/src/protocol.ts by npm run gen:protocol. Do not edit.

var board: String = ""
var entries: Array[XomDaoRankingEntry] = []
var me: XomDaoRankingEntry


static func from_dict(d: Dictionary) -> XomDaoRanking:
	var o := XomDaoRanking.new()
	o.board = str(d.get("board", ""))
	for item: Variant in _list(d, "entries"):
		if item is Dictionary:
			o.entries.append(XomDaoRankingEntry.from_dict(item))
	if d.get("me") is Dictionary:
		o.me = XomDaoRankingEntry.from_dict(d["me"])
	return o


func to_dict() -> Dictionary:
	var d: Dictionary = {}
	d["board"] = board
	d["entries"] = _dicts(entries)
	d["me"] = me.to_dict() if me != null else null
	return d


static func _dict(d: Dictionary, key: String) -> Dictionary:
	var value: Variant = d.get(key)
	return value if value is Dictionary else {}


static func _list(d: Dictionary, key: String) -> Array:
	var value: Variant = d.get(key)
	return value if value is Array else []


static func _dicts(items: Array) -> Array:
	return items.map(func(item: Variant) -> Variant: return item.to_dict())
