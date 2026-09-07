import json


def deploy_protocol(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    platform = "0x" + direct_alice.hex()
    return direct_deploy(
        "contracts/contribution_review_protocol.py", platform, platform
    )


def test_protocol_metadata_and_job_lifecycle(direct_vm, direct_deploy, direct_alice):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    assert contract.get_protocol_version() == "2.0.0"
    contract.create_review_job(
        "job-1", "a" * 64, "org-1", "campaign-1", "", 5
    )
    job = json.loads(contract.get_review_job("job-1"))
    assert job["status"] == "accepted"
    contract.update_review_job(
        "job-1", "evidence_pending", 1, "executor-1", "lease-1", ""
    )
    job = json.loads(contract.get_review_job("job-1"))
    assert job["status"] == "evidence_pending"
    assert job["attempt"] == 1


def test_pause_blocks_protocol_writes_and_owner_can_resume(
    direct_vm, direct_deploy, direct_alice
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    contract.pause_protocol()
    assert contract.is_paused() is True
    with direct_vm.expect_revert("Protocol is paused"):
        contract.create_review_job(
            "job-paused", "b" * 64, "org-1", "campaign-1", "", 5
        )
    contract.unpause_protocol()
    contract.create_review_job(
        "job-resumed", "c" * 64, "org-1", "campaign-1", "", 5
    )


def test_platform_wallet_rotation_is_two_step(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = deploy_protocol(direct_vm, direct_deploy, direct_alice)
    old_wallet = "0x" + direct_alice.hex()
    new_wallet = "0x" + direct_bob.hex()
    assert contract.get_platform_wallet() == old_wallet.lower()
    contract.request_platform_wallet_rotation(new_wallet)
    assert contract.get_pending_platform_wallet() == new_wallet.lower()
    direct_vm.sender = direct_bob
    contract.activate_platform_wallet_rotation()
    assert contract.get_platform_wallet() == new_wallet.lower()
    assert int(contract.get_signer_epoch()) == 1
