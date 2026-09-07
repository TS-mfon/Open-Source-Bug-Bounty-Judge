def test_protocol_directory_discovers_active_versions(
    direct_vm, direct_deploy, direct_alice
):
    direct_vm.sender = direct_alice
    directory = direct_deploy(
        "contracts/protocol_directory.py", "0x" + direct_alice.hex()
    )
    assert directory.get_active_contract("registry") == "0x" + direct_alice.hex()
    directory.set_active_contract("review_protocol", "0x" + "1" * 40, "v2")
    assert directory.get_active_contract("review_protocol") == "0x" + "1" * 40
    assert directory.get_active_version("review_protocol") == "v2"
