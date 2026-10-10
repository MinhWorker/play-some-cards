class_name XomDaoLooks
extends RefCounted
## How players show, as the items they wear from Túi đồ (`ITEMS` in packages/shared/src/items.ts):
## the frame round their avatar (`XomDaoPlayerInfo.frame`) and the back of their cards
## (`card_back`). Each look is a picture in `ui/looks/`; games draw card backs with `card_back`.

const DEFAULT_FRAME := "gold"
const DEFAULT_CARD_BACK := "lattice"
const _DIR := "res://addons/xomdao_sdk/ui/looks/"


## The ring for a frame id ("jade"), or null for none or an unknown one.
static func frame(id: String) -> Texture2D:
	var path: String = _DIR + "frame-%s.webp" % id
	return load(path) if id != "" and ResourceLoader.exists(path) else null


## The back of a card for a card-back id ("lotus"); an unknown or empty id gives the default.
static func card_back(id: String) -> Texture2D:
	var path: String = _DIR + "card-back-%s.webp" % id
	if id == "" or not ResourceLoader.exists(path):
		path = _DIR + "card-back-%s.webp" % DEFAULT_CARD_BACK
	return load(path)


## The picture of an item for a shelf or a shop: its frame or card back ({slot, look}).
static func preview(slot: String, look: String) -> Texture2D:
	return card_back(look) if slot == "card-back" else frame(look)
