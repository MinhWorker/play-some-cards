extends GutTest
## Tài khoản (no server): the login form for a guest, Đăng xuất for an account, and the server
## address the account requests go to.


func _user(username: String) -> XomDaoUser:
	return XomDaoUser.from_dict(
		{"id": "u1", "username": username, "name": "Lan", "avatar": "boy", "frame": "gold"}
	)


func test_a_guest_gets_the_form() -> void:
	var account: HubAccount = add_child_autofree(HubAccount.create(_user("khach0123abcd")))
	await wait_process_frames(2)
	var submit: XomDaoButton = account.find_child("AccountSubmit", true, false)
	assert_eq(submit.text, "Vào chơi")
	var display_name: LineEdit = account.find_child("DisplayName", true, false)
	assert_false(display_name.visible, "no name to log in")
	assert_eq(display_name.text, "Lan", "a new account starts with the guest's name")
	(account.find_child("AccountMode", true, false) as XomDaoChoice).choose(1)
	assert_eq(submit.text, "Tạo tài khoản")
	assert_true(display_name.visible)
	assert_true((account.find_child("Password", true, false) as LineEdit).secret)


func test_an_empty_form_is_not_sent() -> void:
	var account: HubAccount = add_child_autofree(HubAccount.create(_user("khach0123abcd")))
	watch_signals(account)
	(account.find_child("AccountSubmit", true, false) as XomDaoButton).pressed.emit()
	assert_signal_not_emitted(account, "signed_in")
	assert_eq((account.find_child("AccountError", true, false) as Label).text, "Điền đủ các ô")


func test_an_account_can_sign_out() -> void:
	var account: HubAccount = add_child_autofree(HubAccount.create(_user("lan")))
	assert_null(account.find_child("AccountSubmit", true, false))
	assert_eq(
		(account.find_child("AccountUsername", true, false) as Label).text, "Tên đăng nhập: lan"
	)
	watch_signals(account)
	(account.find_child("SignOut", true, false) as XomDaoButton).pressed.emit()
	assert_signal_emitted(account, "signed_out")


func test_http_base_follows_the_socket() -> void:
	var session: Script = load("res://core/session.gd")
	assert_eq(session.http_base("ws://localhost:8033/ws"), "http://localhost:8033")
	assert_eq(session.http_base("wss://news.example.com/ws"), "https://news.example.com")
