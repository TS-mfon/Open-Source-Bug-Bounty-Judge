import json

import pytest


def wallet(value: int) -> str:
    return "0x" + f"{value:040x}"


def deploy_registry(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    platform = "0x" + direct_alice.hex()
    return direct_deploy("contracts/organization_registry.py", platform)


def test_profile_and_organization_creator_flow(
    direct_vm, direct_deploy, direct_alice
):
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice)
    creator = wallet(1)
    registry.register_profile(creator, "organization", 0)
    registry.create_organization("route-dock", "RouteDock", creator, 1)

    profile = json.loads(registry.get_profile(creator))
    organization = json.loads(registry.get_organization("route-dock"))
    assert profile["default_workspace"] == "organization"
    assert organization["creator_wallet"] == creator
    assert registry.get_member_role("route-dock", creator) == "creator"
    assert int(registry.get_wallet_organization_count(creator)) == 1
    assert registry.get_wallet_organization_id_at(creator, 0) == "route-dock"


def test_creator_can_assign_admin_and_admin_can_add_member(
    direct_vm, direct_deploy, direct_alice
):
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice)
    creator = wallet(1)
    admin = wallet(2)
    member = wallet(3)
    registry.register_profile(creator, "organization", 0)
    registry.create_organization("route-dock", "RouteDock", creator, 1)
    registry.add_member("route-dock", creator, admin, "admin", 2)
    registry.add_member("route-dock", admin, member, "member", 0)

    assert registry.get_member_role("route-dock", admin) == "admin"
    assert registry.get_member_role("route-dock", member) == "member"
    assert int(registry.get_organization_member_count("route-dock")) == 3


def test_creator_cannot_be_demoted_or_removed(
    direct_vm, direct_deploy, direct_alice
):
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice)
    creator = wallet(1)
    admin = wallet(2)
    registry.register_profile(creator, "organization", 0)
    registry.create_organization("route-dock", "RouteDock", creator, 1)
    registry.add_member("route-dock", creator, admin, "admin", 2)

    with pytest.raises(Exception, match="Creator role is immutable"):
        registry.set_member_role("route-dock", admin, creator, "member", 0)
    with pytest.raises(Exception, match="Creator cannot be removed"):
        registry.remove_member("route-dock", admin, creator, 0)


def test_nonce_replay_is_rejected(direct_vm, direct_deploy, direct_alice):
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice)
    actor = wallet(1)
    registry.register_profile(actor, "individual", 0)
    with pytest.raises(Exception, match="Invalid wallet action nonce"):
        registry.set_default_workspace(actor, "organization", 0)


def test_member_cannot_manage_members(direct_vm, direct_deploy, direct_alice):
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice)
    creator = wallet(1)
    member = wallet(2)
    other = wallet(3)
    registry.register_profile(creator, "organization", 0)
    registry.create_organization("route-dock", "RouteDock", creator, 1)
    registry.add_member("route-dock", creator, member, "member", 2)

    with pytest.raises(Exception, match="Organization admin required"):
        registry.add_member("route-dock", member, other, "member", 0)
