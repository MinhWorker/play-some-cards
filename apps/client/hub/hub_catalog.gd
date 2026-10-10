class_name HubCatalog
extends RefCounted
## The hub's view of the catalog (`catalog:get`): genres, game cards, and which games this
## client can play (it has their pack). A card the client cannot play yet is "Sắp có".

var catalog: XomDaoCatalog
## Game ids this client has a pack for (ContentLoader.available()).
var playable: Array[String] = []


static func create(from: XomDaoCatalog, can_play: Array[String]) -> HubCatalog:
	var out := HubCatalog.new()
	out.catalog = from
	out.playable = can_play
	return out


## The genre's cards: the ones this client plays first, then the others, each in catalog order.
func games_of(genre_id: String) -> Array[XomDaoGameCard]:
	var ready: Array[XomDaoGameCard] = []
	var later: Array[XomDaoGameCard] = []
	for card: XomDaoGameCard in catalog.games:
		if card.genre != genre_id:
			continue
		if can_play(card.id):
			ready.append(card)
		else:
			later.append(card)
	return ready + later


func card(game_id: String) -> XomDaoGameCard:
	for item: XomDaoGameCard in catalog.games:
		if item.id == game_id:
			return item
	return null


func can_play(game_id: String) -> bool:
	var item: XomDaoGameCard = card(game_id)
	return item != null and item.status == "ready" and playable.has(game_id)


## Genres with at least one ready card: the others are locked islands.
func ready_genres() -> Array[String]:
	var out: Array[String] = []
	for item: XomDaoGameCard in catalog.games:
		if item.status == "ready" and not out.has(item.genre):
			out.append(item.genre)
	return out


## The events open now (the server lists only those), soonest to close first.
func open_events() -> Array[XomDaoGameCard]:
	var out: Array[XomDaoGameCard] = []
	for item: XomDaoGameCard in catalog.games:
		if item.kind == "event" and can_play(item.id):
			out.append(item)
	out.sort_custom(
		func(a: XomDaoGameCard, b: XomDaoGameCard) -> bool: return a.closes_in < b.closes_in
	)
	return out


## Whole days until an event closes, counting today ("Còn 1 ngày" on its last day).
static func days_left(card: XomDaoGameCard) -> int:
	return maxi(1, ceili(card.closes_in / 86_400_000.0))


## The genres in the order of the ring and the tabs (HubIslandRing.entries, without Sắp có).
func ordered_genres() -> Array[XomDaoGenre]:
	var out: Array[XomDaoGenre] = []
	for entry: Dictionary in HubIslandRing.entries(catalog.genres, []):
		for genre: XomDaoGenre in catalog.genres:
			if genre.id == entry["id"]:
				out.append(genre)
	return out


## Every card's name, by game id.
func names() -> Dictionary:
	var out: Dictionary = {}
	for item: XomDaoGameCard in catalog.games:
		out[item.id] = item.name
	return out


## Đình's game boards: the table games this client plays, as [[id, name], …] in catalog order.
func ranked_games() -> Array:
	var out: Array = []
	for item: XomDaoGameCard in catalog.games:
		if item.kind == "table" and can_play(item.id):
			out.append([item.id, item.name])
	return out
