extends GutTest
## Nhà and Chợ against made-up replies (no server): what each item shows and offers.


func _items(owned: Array) -> Array[XomDaoShopItem]:
	var out: Array[XomDaoShopItem] = []
	for row: Array in [
		["core:frame-gold", "frame", "gold", "Khung vàng", 0],
		["core:frame-jade", "frame", "jade", "Khung ngọc bích", 200],
		["core:card-back-lattice", "card-back", "lattice", "Lưng bài ô trám", 0],
		["core:card-back-lotus", "card-back", "lotus", "Lưng bài hoa sen", 300],
	]:
		(
			out
			. append(
				(
					XomDaoShopItem
					. from_dict(
						{
							"id": row[0],
							"slot": row[1],
							"look": row[2],
							"name": row[3],
							"price": row[4],
							"owned": owned.has(row[0]),
						}
					)
				)
			)
		)
	return out


func _profile(frame: String, owned: Array) -> XomDaoProfile:
	return (
		XomDaoProfile
		. from_dict(
			{
				"id": "minh",
				"name": "Minh",
				"avatar": "boy",
				"frame": frame,
				"cardBack": "lattice",
				"owned": owned,
			}
		)
	)


func test_shop_offers_what_you_lack() -> void:
	var shop: HubShop = add_child_autofree(HubShop.new())
	var owned: Array = ["core:frame-gold", "core:card-back-lattice"]
	shop.show_items(_items(owned), 250)
	assert_null(shop.find_child("Item_frame-gold", true, false), "free items are not for sale")
	var buy: XomDaoButton = shop.find_child("Buy_frame-jade", true, false)
	assert_eq(buy.text, "Mua 200")
	watch_signals(shop)
	buy.pressed.emit()
	assert_signal_emitted_with_parameters(shop, "buy_requested", ["core:frame-jade"])
	(shop.find_child("Tab_card-back", true, false) as XomDaoButton).pressed.emit()
	await wait_process_frames(1)
	assert_not_null(shop.find_child("Buy_card-back-lotus", true, false))
	shop.show_items(_items(owned + ["core:card-back-lotus"]), 0)
	assert_not_null(shop.find_child("Owned_card-back-lotus", true, false))


func test_home_wears_owned_items() -> void:
	var home: HubHome = add_child_autofree(HubHome.new())
	var owned: Array = ["core:frame-gold", "core:frame-jade", "core:card-back-lattice"]
	home.show_profile(_profile("jade", owned), _items(owned))
	var worn: XomDaoButton = home.find_child("Equip_frame-jade", true, false)
	assert_true(worn.disabled, "the frame you wear")
	assert_eq(worn.text, "Đang dùng")
	assert_null(home.find_child("Item_card-back-lotus", true, false), "not owned")
	var jade: Node = home.find_child("Item_frame-jade", true, false)
	var gold: Node = home.find_child("Item_frame-gold", true, false)
	assert_lt(jade.get_index(), gold.get_index(), "what was bought comes first")
	watch_signals(home)
	(home.find_child("Equip_frame-gold", true, false) as XomDaoButton).pressed.emit()
	assert_signal_emitted_with_parameters(home, "equip_requested", ["core:frame-gold"])
	assert_eq((home.find_child("HomeAvatar", true, false) as XomDaoAvatar).frame, "jade")


func test_someone_elses_home_is_read_only() -> void:
	var home: HubHome = add_child_autofree(HubHome.new(null, false))
	var owned: Array = ["core:frame-gold", "core:card-back-lattice"]
	home.show_profile(_profile("gold", owned), _items(owned))
	assert_not_null(home.find_child("Item_frame-gold", true, false))
	assert_null(home.find_child("Equip_frame-gold", true, false))


func test_looks_have_pictures() -> void:
	assert_not_null(XomDaoLooks.frame("jade"))
	assert_null(XomDaoLooks.frame(""))
	assert_not_null(XomDaoLooks.card_back("lotus"))
	assert_eq(XomDaoLooks.card_back("nope"), XomDaoLooks.card_back("lattice"), "the default back")
