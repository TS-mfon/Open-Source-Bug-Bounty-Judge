import hashlib
import json
import os

import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded


@pytest.mark.slow
def test_public_github_review_on_studionet():
    platform = os.environ.get("GENLAYER_INTEGRATION_PLATFORM_ADDRESS")
    repository = os.environ.get("GENLAYER_INTEGRATION_REPOSITORY")
    issue_number = os.environ.get("GENLAYER_INTEGRATION_ISSUE")
    pull_number = os.environ.get("GENLAYER_INTEGRATION_PULL")
    head_sha = os.environ.get("GENLAYER_INTEGRATION_HEAD_SHA")
    if not all([platform, repository, issue_number, pull_number, head_sha]):
        pytest.skip("Public GitHub integration fixture is not configured")

    factory = get_contract_factory("ContributionReviewProtocol")
    contract = factory.deploy(args=[platform])
    review_key = hashlib.sha256(
        "|".join(
            [
                platform.lower(),
                "individual",
                repository.lower(),
                str(int(pull_number)),
                head_sha.lower(),
                "code-v1",
                "single",
            ]
        ).encode("utf-8")
    ).hexdigest()
    receipt = contract.request_single_review(
        args=[
            "integration-public-github",
            review_key,
            platform,
            json.dumps(
                {
                    "id": "integration-candidate",
                    "repository": repository,
                    "issueNumber": int(issue_number),
                    "pullRequestNumber": int(pull_number),
                    "headSha": head_sha,
                    "contributor": "integration",
                    "contributionType": "code",
                    "stellarEvidenceUrls": [],
                }
            ),
        ]
    ).transact()
    assert tx_execution_succeeded(receipt)
    stored = json.loads(
        contract.get_review(args=["integration-public-github"]).call()
    )
    assert stored["result"]["candidates"][0]["citations"]
